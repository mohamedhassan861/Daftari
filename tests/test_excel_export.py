"""Exporting an account statement to Excel: the file opens, dates are real dates on the right day,
amounts are numbers, and the library comes from inside the app."""
import asyncio, sys, datetime
from lib import *

async def main():
    async with async_playwright() as p:
        b, pg, errs = await open_app(p)
        acc = await pg.evaluate("(()=>{const T=window.__T,S=T.S;const n={};S.tx.forEach(x=>n[x.acc]=(n[x.acc]||0)+1);"
                                "return Object.keys(n).sort((a,b)=>n[b]-n[a])[0]})()")
        await close_sheets(pg); await act(pg, 'stmtAcc', acc)
        shown = await pg.evaluate("document.querySelectorAll('#shB .srow').length")
        await pg.click('#shB [data-sact=export]'); await pg.wait_for_selector('#xx')
        async with pg.expect_download() as dl:
            await pg.click('#xx')
        f = await dl.value
        ok(f.suggested_filename.endswith('.xlsx'), 'an .xlsx file is produced: ' + f.suggested_filename)
        out = await read_xlsx(pg, open(await f.path(), 'rb').read()); rows = out['rows']
        ok(out['rtl'], 'the sheet opens right to left in Arabic')
        head = next(i for i, r in enumerate(rows) if len([v for v in r if v != '']) >= 3)
        body = [r for r in rows[head + 1:] if isinstance(r[0], (int, float))]
        ok(len(body) >= 3 and shown >= len(body), f'{len(body)} dated lines under the headings')
        ok(all(abs(r[0] - round(r[0])) < 0.05 for r in body), 'every date is a real Excel date, not text')
        days = sorted({(datetime.date(1899, 12, 30) + datetime.timedelta(days=round(r[0]))).isoformat() for r in body})
        mine = set(await pg.evaluate(f"window.__T.S.tx.filter(x=>x.acc==='{acc}'||x.toAcc==='{acc}').map(x=>x.date)"))
        ok(set(days) <= mine, f'and each falls on the day of an entry in the ledger ({days[0]} … {days[-1]})')
        ok(any(isinstance(v, (int, float)) and v != round(v) or isinstance(v, (int, float)) and abs(v) >= 10 for r in body for v in r[1:]),
           'amounts are numbers')
        ok(await pg.evaluate("[...document.scripts].some(s=>/^http:\\/\\/localhost.*vendor\\/xlsx-0\\.20\\.3/.test(s.src))"),
           'the Excel library is the copy kept inside the app')
        ok(await pg.evaluate("window.XLSX.version") == '0.20.3', 'version 0.20.3')
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
