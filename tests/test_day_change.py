"""If the day changes while the app stays open, it loads again with the new date, without losing a form being filled."""
import asyncio, sys
from lib import *

async def main():
    async with async_playwright() as p:
        b, pg, errs = await open_app(p, when='2026-11-13T23:58:00')
        ok(await pg.evaluate("window.__T.TODAY") == '2026-11-13', 'today is the 13th before midnight')
        await pg.evaluate("window.__mark=1")
        await pg.click('#fab'); await pg.wait_for_timeout(400); await pg.fill('#amt', '55')
        await pg.clock.set_fixed_time('2026-11-14T00:01:00')
        await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(1500)
        ok(await pg.evaluate("window.__mark") == 1 and await pg.evaluate("document.querySelector('#amt').value") == '55',
           'an open form is left alone when the day changes')
        await close_sheets(pg); await pg.wait_for_timeout(300)
        await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(5000)
        ok(await pg.evaluate("window.__mark") != 1, 'the app loaded again once the form was closed')
        ok(await pg.evaluate("window.__T.TODAY") == '2026-11-14', 'today is now the 14th')
        ok(await pg.evaluate("!!window.__T.S"), 'still open, the PIN was not asked again')
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
