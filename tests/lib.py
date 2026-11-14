"""Shared helpers for the checks. Every check opens the real app in a headless browser at a fixed date,
creates a fresh PIN, and works on invented data only (the app's own sample ledger or data built in the check).
No real user data belongs in this folder."""
import os
from playwright.async_api import async_playwright

PORT = os.environ.get('DAFTARI_PORT', '8765')
URL = f'http://localhost:{PORT}/index.html'
REG = ("localStorage.setItem('daftari-reg',JSON.stringify({email:'a@b.com',name:'A'}));"
       "if(!localStorage.getItem('daftari-drive'))localStorage.setItem('daftari-drive',JSON.stringify({linked:true,email:'a@b.com'}));")
_fail = [0]

def ok(cond, msg):
    if not cond: _fail[0] += 1
    print(('PASS ' if cond else 'FAIL ') + msg)

def failed():
    return _fail[0]

async def open_app(p, when='2026-11-14T10:00:00', sample=True, init='', route=None, size=(390, 844)):
    """Returns (browser, page, errors). Outside requests are blocked unless `route` answers them."""
    b = await p.chromium.launch()
    pg = await b.new_page(viewport={'width': size[0], 'height': size[1]})
    await pg.clock.set_fixed_time(when)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))

    async def rt(r):
        if r.request.url.startswith('http://localhost'):
            await r.continue_()
        elif route and await route(r):
            pass
        else:
            await r.abort()
    await pg.route('**/*', rt)
    await pg.add_init_script(REG + init)
    await pg.goto(URL)
    await pg.wait_for_selector('#lp1')
    await pg.fill('#lp1', '123456'); await pg.fill('#lp2', '123456'); await pg.click('#lkF button.pri')
    await pg.wait_for_function('window.__T && window.__T.S', timeout=20000)
    if sample:
        await pg.evaluate("(()=>{const T=window.__T;T.S=T.seed();T.S.sample=false;T.migrate();T.commit()})()")
    await pg.wait_for_timeout(400)
    await close_sheets(pg)
    return b, pg, errs

async def close_sheets(pg):
    await pg.evaluate("document.querySelector('#rqClose')&&document.querySelector('#rqClose').click()")
    await pg.keyboard.press('Escape')
    await pg.evaluate("document.querySelector('#shX')&&document.querySelector('#shX').click()")

async def tab(pg, name):
    await pg.evaluate(f"document.querySelector('[data-tab={name}]').click()")
    await pg.wait_for_timeout(350)
    await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")

async def act(pg, name, id_=None):
    """Runs one of the app's own actions the way a tap on its button would."""
    await pg.evaluate("([a,i])=>{const b=document.createElement('button');b.dataset.act=a;if(i)b.dataset.id=i;"
                      "document.querySelector('#view').appendChild(b);b.click();b.remove()}", [name, id_])
    await pg.wait_for_timeout(500)

LIB = 'vendor/xlsx-0.20.3/xlsx.full.min.js'

async def _sheet_page(pg):
    """A second page that holds only the app's own Excel library, to build or read test files."""
    q = await pg.context.browser.new_page()
    await q.goto(URL.replace('index.html', 'privacy.html'))
    await q.add_script_tag(url=URL.replace('index.html', LIB))
    return q

async def make_xlsx(pg, rows):
    """rows -> bytes of an .xlsx file. A value written as 'D:2026-10-01' becomes a real Excel date cell."""
    q = await _sheet_page(pg)
    out = await q.evaluate("""rows=>{const X=window.XLSX,
      r=rows.map(a=>a.map(v=>typeof v==='string'&&v.startsWith('D:')?new Date(+v.slice(2,6),+v.slice(7,9)-1,+v.slice(10,12)):v));
      const ws=X.utils.aoa_to_sheet(r,{cellDates:true}),wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'Statement');
      return Array.from(new Uint8Array(X.write(wb,{type:'array',bookType:'xlsx'})))}""", rows)
    await q.close()
    return bytes(out)

async def read_xlsx(pg, data):
    """bytes of an .xlsx file -> {rows (raw values), rtl}."""
    q = await _sheet_page(pg)
    out = await q.evaluate("""d=>{const X=window.XLSX,wb=X.read(new Uint8Array(d),{type:'array'});
      return {rows:X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''}),
              rtl:!!(wb.Workbook&&wb.Workbook.Views&&wb.Workbook.Views[0]&&wb.Workbook.Views[0].RTL)}}""", list(data))
    await q.close()
    return out

__all__ = ['async_playwright', 'ok', 'failed', 'open_app', 'close_sheets', 'tab', 'act', 'URL', 'make_xlsx', 'read_xlsx']
