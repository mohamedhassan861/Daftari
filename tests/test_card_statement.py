"""Card: what to pay and by when, and the statement adding up like the bank's
(previous balance + purchases - refunds - payments = statement balance). Data is invented here."""
import asyncio, sys
from lib import *

DATA = """(()=>{const T=window.__T,S=T.S;
  S.accounts=[{id:'bank',type:'bank',name:'بنك تجريبي',currency:'EGP',opening:20000},{id:'cash',type:'cash',name:'كاش',currency:'EGP',opening:1000},
    {id:'cc',type:'card',name:'كارت تجريبي',currency:'EGP',opening:0,closeDay:10,dueDay:5,limit:50000}];
  const x=(id,o)=>S.tx.push(Object.assign({id,note:id},o));
  x('p0',{type:'expense',acc:'cc',cat:'food',amount:2000,date:'2026-09-20'});
  x('pay0',{type:'transfer',cat:'transfer',acc:'bank',toAcc:'cc',amount:2000,date:'2026-10-12'});
  x('p1',{type:'expense',acc:'cc',cat:'food',amount:1200.5,date:'2026-10-15'});
  x('pay1',{type:'transfer',cat:'transfer',acc:'bank',toAcc:'cc',amount:500,date:'2026-10-20'});
  x('p2',{type:'expense',acc:'cc',cat:'clothes',amount:830,date:'2026-10-28'});
  x('r1',{type:'income',acc:'cc',cat:'iother',amount:100,date:'2026-10-30'});
  x('p3',{type:'expense',acc:'cc',cat:'health',amount:415.25,date:'2026-11-03'});
  x('p4',{type:'expense',acc:'cc',cat:'food',amount:127,date:'2026-11-12'});
  S.defAcc='bank';T.migrate();T.commit()})()"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await open_app(p, when='2026-11-14T10:00:00', sample=False)
        await pg.evaluate(DATA); await pg.wait_for_timeout(400); await close_sheets(pg)
        c = await pg.evaluate("(()=>{const T=window.__T,a=T.S.accounts.find(x=>x.id==='cc');return {i:T.cardInfo(a),cy:T.cardCycles(a).map(s=>({C:s.C,open:s.open,sum:s.sum,prev:s.prevBal,ref:s.refunds,pay:s.payments,bal:s.bal}))}})()")
        ok(abs(c['i']['due'] - 1845.75) < 0.01 and c['i']['dueDate'] == '2026-12-05' and c['i']['close'] == '2026-11-10',
           'due 1,845.75 by 05/12 for the statement closed 10/11')
        ok(abs(c['i']['owed'] - 1972.75) < 0.01, 'owed in total 1,972.75 (with the purchase after the close)')
        cur = [s for s in c['cy'] if s['C'] == '2026-11-10'][0]
        ok([cur['prev'], cur['sum'], cur['ref'], cur['pay'], cur['bal']] == [2000, 2445.75, 100, 2500, 1845.75],
           'statement parts: previous 2,000 + purchases 2,445.75 - refunds 100 - payments 2,500 = 1,845.75')
        for s in c['cy']:
            if not s['open']:
                ok(abs(s['prev'] + s['sum'] - s['ref'] - s['pay'] - s['bal']) < 0.01, 'statement ' + s['C'] + ' adds up')
        await tab(pg, 'home')
        home = await pg.evaluate("document.querySelector('[data-act=goCards]').innerText")
        ok('يرجى السداد قبل' in home and '1,845.75' in home and '05/12/2026' in home and 'كشف لحد' in home,
           'home says what to pay and by when: ' + home.replace('\n', ' | ')[:90])
        await act(pg, 'stmtAcc', 'cc')
        st = await pg.evaluate("document.querySelector('#shB').innerText")
        ok('يرجى السداد قبل' in st and '1,845.75' in st and 'ده رصيد كشف الحساب لحد' in st and '127' in st,
           'card statement shows the amount due, its statement date and what moves to the next statement')
        await close_sheets(pg)
        await tab(pg, 'obl')
        await pg.evaluate("(()=>{const e=[...document.querySelectorAll('#view .seg button')].find(x=>/كروت/.test(x.textContent));e&&e.click()})()")
        await pg.wait_for_timeout(500)
        rows = await pg.evaluate("[...document.querySelectorAll('.cst .row')].map(x=>x.innerText.replace(/\\n/g,' | '))")
        ok(any('1,845.75' in r and 'مشتريات 2,445.75' in r for r in rows), 'closed statement row shows the balance, purchases under it')
        await pg.evaluate("document.querySelector('[data-w=\"cst:cc:2026-11-10\"]').click()"); await pg.wait_for_timeout(500)
        t = await pg.evaluate("document.querySelector('#shB').innerText")
        ok('رصيد الكشف اللي قبله' in t and 'مدفوعات' in t and 'المطلوب سداده' in t, 'tapping a statement shows the bank-style sum')
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
