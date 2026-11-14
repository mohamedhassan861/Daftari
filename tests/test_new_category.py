"""A category can be added from inside the entry form."""
import asyncio, sys
from lib import *

async def main():
    async with async_playwright() as p:
        b, pg, errs = await open_app(p)
        await pg.click('#fab'); await pg.wait_for_timeout(600)
        ok(await pg.locator('#cat option[value=__new]').count() == 1, 'new-category choice in the list')
        n0 = await pg.evaluate("window.__T.S.cats.expense.length")
        await pg.fill('#amt', '75'); await pg.fill('#nt', 'قهوة')
        await pg.select_option('#cat', '__new'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("!document.querySelector('#ncW').hidden"), 'small add box opens in the form')
        await pg.click('#f .foot button.pri'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("!!document.querySelector('#f')"), 'saving with an unfinished new category is stopped')
        await pg.fill('#ncN', 'كافيهات'); await pg.press('#ncN', 'Enter'); await pg.wait_for_timeout(300)
        nc = await pg.evaluate("window.__T.S.cats.expense.find(c=>(c.ar||c.en)==='كافيهات')")
        ok(nc and await pg.evaluate("document.querySelector('#cat').value") == nc['id'], 'category created and chosen')
        ok(await pg.evaluate("window.__T.S.cats.expense.length") == n0 + 1, 'one category added')
        ok(await pg.evaluate("document.querySelector('#amt').value") == '75', 'what was typed is kept')
        await pg.click('#f .foot button.pri'); await pg.wait_for_timeout(600)
        tx = await pg.evaluate("window.__T.S.tx[window.__T.S.tx.length-1]")
        ok(tx['cat'] == nc['id'] and tx['amount'] == 75, 'entry saved with the new category')
        await pg.click('#fab'); await pg.wait_for_timeout(600)
        await pg.select_option('#cat', '__new'); await pg.fill('#ncN', 'كافيهات'); await pg.click('#ncOk'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("window.__T.S.cats.expense.length") == n0 + 1, 'same name again picks the existing one')
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
