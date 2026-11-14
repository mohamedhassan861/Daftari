"""Matching with a bank or card statement, on invented data. The statements are CSV text built here:
one with headings (debit / credit / balance), one in a bank's heading-less card layout (dd-mm dates, CR marks,
opening and closing balance lines)."""
import asyncio, re, sys
from lib import *

LEDGER = """(()=>{const T=window.__T,S=T.S;
  S.accounts=[{id:'bank',type:'bank',name:'بنك تجريبي',currency:'EGP',opening:5000},{id:'cash',type:'cash',name:'كاش',currency:'EGP',opening:1000},
    {id:'cc',type:'card',name:'كارت تجريبي',currency:'EGP',opening:0,closeDay:10,dueDay:5,limit:50000}];
  const x=(id,o)=>S.tx.push(Object.assign({id,note:id},o));
  x('sal',{type:'income',acc:'bank',cat:'salary',amount:18000,date:'2026-10-01'});
  x('tocash',{type:'transfer',cat:'transfer',acc:'bank',toAcc:'cash',amount:3000.5,date:'2026-10-02'});
  x('e1',{type:'expense',acc:'bank',cat:'food',amount:742.35,date:'2026-10-03'});
  x('e2',{type:'expense',acc:'bank',cat:'bills',amount:1260,date:'2026-10-08'});
  x('e3',{type:'expense',acc:'bank',cat:'health',amount:415.5,date:'2026-10-10'});
  x('week',{type:'expense',acc:'bank',cat:'food',amount:3000,date:'2026-10-13',note:'مصاريف أسبوع'});
  x('e4',{type:'expense',acc:'bank',cat:'clothes',amount:899,date:'2026-10-18'});
  x('apponly',{type:'expense',acc:'bank',cat:'personal',amount:150.25,date:'2026-10-22'});
  x('e5',{type:'expense',acc:'bank',cat:'house',amount:2310.4,date:'2026-10-25'});
  x('side',{type:'income',acc:'bank',cat:'side',amount:500,date:'2026-10-27'});
  x('p0',{type:'expense',acc:'cc',cat:'food',amount:2000,date:'2026-09-20'});
  x('pay0',{type:'transfer',cat:'transfer',acc:'cash',toAcc:'cc',amount:2000,date:'2026-10-12'});
  x('p1',{type:'expense',acc:'cc',cat:'food',amount:1200.5,date:'2026-10-15'});
  x('pay1',{type:'transfer',cat:'transfer',acc:'cash',toAcc:'cc',amount:500,date:'2026-10-20'});
  x('p2',{type:'expense',acc:'cc',cat:'clothes',amount:830,date:'2026-10-28'});
  x('r1',{type:'income',acc:'cc',cat:'iother',amount:100,date:'2026-10-30'});
  x('p3',{type:'expense',acc:'cc',cat:'health',amount:415.25,date:'2026-11-03'});
  S.defAcc='bank';T.migrate();T.commit()})()"""

# (date, description, amount): what the bank shows. The weekly total is two lines here, one entry is missing,
# two lines are not in the app, and some dates are a day later than in the app.
BANK = [('01/10/2026', 'SALARY TRANSFER', 18000), ('03/10/2026', 'ATM TRANSFER OUT', -3000.5), ('03/10/2026', 'POS MARKET', -742.35),
        ('09/10/2026', 'ELECTRICITY', -1260), ('10/10/2026', 'PHARMACY', -415.5), ('12/10/2026', 'POS GROCER A', -2000),
        ('13/10/2026', 'POS GROCER B', -1000), ('15/10/2026', 'ATM CASH WITHDRAWAL 123', -500), ('18/10/2026', 'POS CLOTHES', -899),
        ('25/10/2026', 'HOME REPAIR', -2310.4), ('27/10/2026', 'INCOMING TRANSFER', 500), ('28/10/2026', 'VODAFONE BILL 0100', -350.75)]

def bank_csv():
    bal, rows = 5000.0, ['Account statement,,,,', 'Transaction Date,Description,Debit,Credit,Balance']
    for d, s, a in BANK:
        bal = round(bal + a, 2)
        rows.append(f'{d},{s},{"%.2f" % -a if a < 0 else ""},{"%.2f" % a if a > 0 else ""},"{bal:,.2f}"')
    return '\n'.join(rows).encode()

def bank_xlsx_rows():
    """The same statement as an Excel sheet: real date cells, numbers as numbers, headings on the sixth row."""
    bal, rows = 5000.0, [['Test Bank'], ['Account statement'], [], ['Customer', 'Invented Name'], [],
                         ['Transaction Date', 'Description', 'Debit', 'Credit', 'Balance']]
    for d, s, a in BANK:
        bal = round(bal + a, 2)
        rows.append(['D:%s-%s-%s' % (d[6:], d[3:5], d[:2]), s, -a if a < 0 else '', a if a > 0 else '', bal])
    return rows

def card_csv():
    L = [(',,Nov-26,OPENING BALANCE,,2000.00'), ('15-10,,16-10,MARKET ONE,,1200.50'), ('12-10,,12-10,PAYMENT RECEIVED,,2000.00 CR'),
         ('20-10,,20-10,PAYMENT RECEIVED,,500.00 CR'), ('28-10,,29-10,CLOTHES SHOP,,830.00'), ('00-00,,00-00,"SAR10,00",,.00'),
         ('30-10,,31-10,REFUND,,100.00 CR'), ('03-11,,04-11,PHARMACY,,415.25'), (',,Nov-26,CLOSING BALANCE,,1845.75')]
    return ('CARD STATEMENT,,,,,\nCard Limit,,,,,50000\n' + '\n'.join(L)).encode()

def counts(txt):
    f = lambda k: int(m.group(1)) if (m := re.search(re.escape(k) + r'[^(\n]{0,40}\((\d+)\)', txt)) else 0
    return {'bank': f('في البنك ومش عندك'), 'groups': f('إجماليات'), 'app': f('عندك ومش في البنك'), 'ok': f('متطابق')}

XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

async def match(pg, acc, name, data):
    await close_sheets(pg)
    await act(pg, 'stmtAcc', acc)
    await pg.click('#shB [data-sact=bmatch]'); await pg.wait_for_timeout(300)
    await pg.select_option('#bma', acc)
    await pg.set_input_files('#bmf', files=[{'name': name, 'mimeType': XLSX if name.endswith('.xlsx') else 'text/csv', 'buffer': data}]); await pg.wait_for_timeout(2500)
    return await pg.evaluate("document.querySelector('#shB').innerText")

async def main():
    async with async_playwright() as p:
        b, pg, errs = await open_app(p, when='2026-11-14T10:00:00', sample=False)
        await pg.evaluate(LEDGER); await pg.wait_for_timeout(400)
        want = {'bank': 2, 'groups': 1, 'app': 1, 'ok': 8}
        txt = await match(pg, 'bank', 'bank.xlsx', await make_xlsx(pg, bank_xlsx_rows())); c = counts(txt)
        ok('12 حركة' in txt and c == want, 'the same statement as an Excel file (date cells) gives the same result ' + str(c))
        ok(await pg.evaluate("[...document.scripts].some(s=>/^http:\\/\\/localhost.*vendor\\/xlsx-/.test(s.src))")
           and not await pg.evaluate("[...document.scripts].some(s=>/cdnjs|cdn\\./.test(s.src))"),
           'the Excel reader is loaded from inside the app, not from another site')
        txt = await match(pg, 'bank', 'bank.csv', bank_csv()); c = counts(txt)
        ok('12 حركة' in txt, 'all 12 statement lines read')
        ok(c == want, 'two lines missing in the app, one total with its two details, one entry missing in the bank, eight matched ' + str(c))
        ok('الباقي بعدهم: 0' in txt, 'the balance difference is fully explained')
        sug = await pg.evaluate("[...document.querySelectorAll('[data-bl]')].map(s=>s.value)")
        ok(sug[0] == 'acc:cash', 'cash withdrawal suggested as a transfer to cash ' + str(sug))
        n0 = await pg.evaluate("window.__T.S.tx.length")
        await pg.evaluate("(()=>{const s=document.querySelectorAll('[data-bl]')[1];s.value='cat:bills';})()")
        await pg.click('#bmadd'); await pg.wait_for_timeout(900)
        new = await pg.evaluate(f"window.__T.S.tx.slice({n0}).map(x=>[x.type,x.acc,x.toAcc||'',x.amount,x.date,x.cat])")
        ok(new == [['transfer', 'bank', 'cash', 500, '2026-10-15', 'transfer'], ['expense', 'bank', '', 350.75, '2026-10-28', 'bills']],
           'the two missing lines recorded with the right kind, account, amount and date')
        await pg.evaluate("document.querySelectorAll('[data-gl]').forEach(s=>s.value='cat:food')")
        await pg.click('#shB [data-split]'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("!!window.__T.S.tx.find(x=>x.id==='week')"), 'the total is still there until the user agrees')
        await pg.click('#cYes'); await pg.wait_for_timeout(1200)
        ok(not await pg.evaluate("!!window.__T.S.tx.find(x=>x.id==='week')"), 'after agreeing the total entry is removed')
        det = await pg.evaluate("window.__T.S.tx.filter(x=>/POS GROCER/.test(x.note)).map(x=>[x.amount,x.date,x.cat])")
        ok(sorted(det) == [[1000, '2026-10-13', 'food'], [2000, '2026-10-12', 'food']], 'and its two details are recorded in its place')
        log = await pg.evaluate("window.__T.S.log.slice(-5).map(l=>l.act)")
        ok(log.count('add') == 4 and log.count('del') == 1, 'every change is in the change log ' + str(log))
        c = counts(await pg.evaluate("document.querySelector('#shB').innerText"))
        ok(c == {'bank': 0, 'groups': 0, 'app': 1, 'ok': 12}, 'matching again: only the entry missing in the bank is left ' + str(c))
        bal = await pg.evaluate("Math.round(window.__T.accBalance(window.__T.S.accounts.find(a=>a.id==='bank'))*100)/100")
        ok(bal == round(5000 + sum(a for _, _, a in BANK) - 150.25, 2), 'account balance = bank balance less the entry not in the bank yet')
        txt = await match(pg, 'cc', 'card.csv', card_csv()); c = counts(txt)
        ok('6 حركة' in txt, 'card layout without headings: 6 lines read, balance lines and the currency sub-line skipped')
        ok('عليك 1,845.75' in txt and '✓ 0' in txt, 'closing balance 1,845.75 read and equal to the app')
        ok(c == {'bank': 0, 'groups': 0, 'app': 0, 'ok': 6}, 'all card lines matched ' + str(c))
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
