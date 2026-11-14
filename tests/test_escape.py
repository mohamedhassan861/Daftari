"""Text typed by a user (or by a shared-ledger member, or read from a file) is never drawn as HTML.
A marker tag is put in every free-text field; if any screen turns it into a real element, the check fails."""
import asyncio, sys
from lib import *

MARK = """(()=>{const T=window.__T,S=T.S,m=k=>'<i data-x="'+k+'">X</i>';
  S.accounts.forEach(a=>{a.name+=m('account');if(a.group)a.group+=m('account group')});
  ['expense','income'].forEach(ty=>S.cats[ty].forEach(c=>{if(!c.sys){c.ar+=m('category');c.en+=m('category')}}));
  S.tx.forEach(x=>{x.note=(x.note||'')+m('note');x.tags=(x.tags||[]).concat(['t'+m('tag')])});
  S.loans.forEach(l=>{l.person+=m('person');l.note=(l.note||'')+m('loan note');if(l.group)l.group+=m('loan group')});
  S.inst.forEach(o=>{o.name+=m('instalment');if(o.group)o.group+=m('group')});S.gam.forEach(o=>o.name+=m('gameya'));
  (S.goals||[]).forEach(g=>g.name+=m('goal'));(S.recur||[]).forEach(r=>r.tpl.note=(r.tpl.note||'')+m('repeat note'));
  T.commit()})()"""
SKIP = {'lockNow', 'reset', 'updateNow', 'driveSwitch', 'driveRestore', 'driveNow', 'driveTidy', 'driveKeepAll', 'ratesNow',
        'pushOn', 'pushOff', 'pushTest', 'export', 'exportTx', 'backup', 'shareApp', 'import', 'importX', 'why', 'bioOn',
        'bioOff', 'users', 'monthSum', 'signOut', 'unreg', 'driveLink', 'driveUnlink', 'install', 'appUpdate', 'reviewExport',
        'exportCats', 'copyBackup', 'driveResume'}

async def main():
    async with async_playwright() as p:
        b, pg, errs = await open_app(p)
        await pg.evaluate(MARK); await pg.wait_for_timeout(400); await close_sheets(pg)
        found = {}
        async def scan(where):
            for k in await pg.evaluate("[...new Set([...document.querySelectorAll('i[data-x]')].map(e=>e.dataset.x))]"):
                found.setdefault(k, set()).add(where)
        seen = 0
        for name in ['home', 'tx', 'rep', 'obl', 'set']:
            await tab(pg, name); await scan('tab ' + name)
            for i in range(await pg.evaluate("document.querySelectorAll('#view .seg button').length")):
                await pg.evaluate(f"(()=>{{const b=[...document.querySelectorAll('#view .seg button')][{i}];b&&b.click()}})()")
                await pg.wait_for_timeout(200); await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
                await scan(f'tab {name}/{i}')
            await tab(pg, name)
            for k in (await pg.evaluate("[...new Set([...document.querySelectorAll('[data-w]')].map(e=>e.dataset.w))]"))[:60]:
                await pg.evaluate("k=>{const e=document.querySelector('[data-w=\"'+k+'\"]');e&&e.click()}", k)
                await pg.wait_for_timeout(120); await scan('number breakdown ' + k.split(':')[0]); seen += 1
                await close_sheets(pg)
            for a in await pg.evaluate("[...new Set([...document.querySelectorAll('#view [data-act]')].map(e=>e.dataset.act))]"):
                if a in SKIP: continue
                await pg.evaluate("a=>{const e=document.querySelector('#view [data-act=\"'+a+'\"]');e&&e.click()}", a)
                await pg.wait_for_timeout(200); await pg.evaluate("document.querySelectorAll('#shB details').forEach(d=>d.open=true)")
                await scan('screen ' + a); seen += 1
                await close_sheets(pg); await tab(pg, name)
        for i in await pg.evaluate("window.__T.S.accounts.map(a=>a.id)"):
            await act(pg, 'stmtAcc', i); await scan('account statement'); seen += 1; await close_sheets(pg)
        ok(seen > 40, f'{seen} screens and breakdowns were opened')
        ok(not found, 'no typed text is drawn as HTML ' + str({k: sorted(v)[:4] for k, v in found.items()}))
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
