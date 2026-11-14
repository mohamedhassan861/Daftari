"""Paying more than everything left on an instalment asks what the extra is, then records it as its own expense."""
import asyncio, re, sys
from lib import *

async def main():
    async with async_playwright() as p:
        b, pg, errs = await open_app(p)
        await pg.evaluate("(()=>{const T=window.__T;T.S.cats.expense.unshift({id:'bankfees',ar:'رسوم ومصاريف بنكية',en:'Bank fees',sys:false});T.commit()})()")
        o = await pg.evaluate("(()=>{const o=window.__T.S.inst[0];return {id:o.id,left:window.__T.oblStats('inst',o).left}})()")
        await close_sheets(pg); await act(pg, 'payInst', o['id'])
        left = float(re.sub(r'[^\d.]', '', await pg.evaluate("document.querySelectorAll('#shB .sumgrid b.num')[1].textContent")))
        ok(abs(left - o['left']) < 0.01 and left > 0, f'the form shows what is left ({left})')
        n0 = await pg.evaluate("window.__T.S.tx.length")
        await pg.fill('#amt', str(round(left + 57.75, 2))); await pg.click('#f .foot button.pri'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("!document.querySelector('#ovW').hidden"), 'paying more than what is left asks a question')
        ok('57.75' in await pg.evaluate("document.querySelector('#ovT').textContent"), 'the question names the extra amount')
        ok(await pg.evaluate("window.__T.S.tx.length") == n0, 'nothing saved yet')
        await pg.click('#f .foot button.pri'); await pg.wait_for_timeout(800)
        new = await pg.evaluate(f"window.__T.S.tx.slice({n0}).map(x=>[x.amount,x.cat,!!x.link])")
        ok(len(new) == 2 and abs(new[0][0] - left) < 0.01 and new[0][2], 'instalment paid with exactly what was left')
        ok(new[1] == [57.75, 'bankfees', False], 'extra recorded as its own expense under bank fees')
        lf = await pg.evaluate(f"window.__T.oblStats('inst',window.__T.S.inst.find(x=>x.id==='{o['id']}')).left")
        ok(abs(lf) < 0.01, 'nothing left on the instalment')
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
