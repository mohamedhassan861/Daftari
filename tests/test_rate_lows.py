"""The lowest-price table reads the shipped daily history (public prices)."""
import asyncio, sys
from lib import *

async def main():
    async with async_playwright() as p:
        b, pg, errs = await open_app(p, when='2026-11-12T20:00:00', size=(360, 800))
        await tab(pg, 'set'); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
        t = await pg.evaluate("(()=>{const g=[...document.querySelectorAll('.grp')].find(x=>/📉/.test(x.textContent));return g?g.nextElementSibling.innerText:''})()")
        ok('USD' in t and 'ذهب 21 / جرام' in t, 'lowest-price table shown')
        ok('30.8' in t and '27/12/2023' in t, 'USD 3-year low 30.80 on 27/12/2023')
        ok('46.62' in t and '14/02/2026' in t, 'USD 1-year low 46.62 on 14/02/2026')
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
