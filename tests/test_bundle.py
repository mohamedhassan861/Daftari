"""What phones download: one joined script and one stylesheet that match the source, under a page policy that
lets only the app's own files and Google's sign-in pages run. Also: a new user starts with an empty ledger."""
import asyncio, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools'))
import build
from lib import *

async def main():
    js, css = build.joined(); R = build.R
    ok((R / 'js/app.js').read_text(encoding='utf-8') == js, 'js/app.js is the source files joined (run tools/build.py after any change)')
    ok((R / 'css/app.css').read_text(encoding='utf-8') == css, 'css/app.css is the css files joined')
    html = (R / 'index.html').read_text(encoding='utf-8')
    csp = re.search(r'Content-Security-Policy" content="([^"]+)"', html)
    ok(bool(csp), 'the page has a content security policy')
    script = re.search(r"script-src ([^;]+)", csp.group(1)).group(1) if csp else "'unsafe-inline'"
    ok("'unsafe-inline'" not in script and "'unsafe-eval'" not in script and '*' not in script, 'scripts: no inline code, no eval, no wildcard · ' + script)
    ok(not re.search(r'<script(?![^>]*\bsrc=)', html) and not re.search(r'\son[a-z]+="', html), 'index.html holds no inline script')
    async with async_playwright() as p:
        seen, blocked = [], []
        b, pg, errs = await open_app(p, sample=False)
        ok(await pg.evaluate("(()=>{const S=window.__T.S;return S.tx.length+S.inst.length+S.gam.length+S.loans.length+(S.goals||[]).length+(S.recur||[]).length})()") == 0,
           'a new user starts with an empty ledger: no entries, instalments, loans, goals or names')
        ok(await pg.evaluate("JSON.stringify(window.__T.S.accounts.map(a=>[a.type,a.opening]))") == '[["cash",0]]',
           'the only account is an empty cash wallet')
        ok(await pg.evaluate("!window.__T.S.sample"), 'and it is not marked as sample data')
        pg.on('console', lambda m: blocked.append(m.text) if 'Content Security Policy' in m.text else None)
        pg.on('request', lambda r: seen.append(r.url))
        await pg.evaluate("(()=>{const T=window.__T;T.S=T.seed();T.S.sample=false;T.migrate();T.commit()})()")
        for name in ['home', 'tx', 'rep', 'obl', 'set']:
            await tab(pg, name)
        await pg.reload(); await pg.wait_for_selector('#lp1, #lkF input')
        own = [u for u in seen if u.startswith('http://localhost') and re.search(r'\.(js|css)(\?|$)', u)]
        ok(len(own) <= 4 and any('js/app.js' in u for u in own), f'opening the app fetches {len(own)} script and style files, not ninety')
        mine = [m for m in blocked if 'localhost' in m and 'fonts.g' not in m]
        ok(not mine, 'the policy blocks nothing the app itself needs ' + str(mine[:2]))
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
