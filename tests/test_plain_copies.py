"""The two things kept outside the encrypted ledger: the reminders list in the browser (only while notifications
are on) and the monthly summary file on Drive (a plain file the user can switch off)."""
import asyncio, sys
from lib import *

IDB = """k=>new Promise(res=>{const r=indexedDB.open('daftari-sw',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>{const q=r.result.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result===undefined?null:q.result)}})"""

async def main():
    async with async_playwright() as p:
        b, pg, errs = await open_app(p)
        up = await pg.evaluate("window.__T.upcomingReminders(window.__T.S).length")
        ok(up > 0, f'the sample ledger has upcoming due items ({up})')
        await pg.evaluate("window.__T.commit()"); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(IDB, 'reminders') in (None, []), 'notifications off: nothing about due items is kept in the browser')
        await pg.evaluate("localStorage.setItem('daftari-push','1');window.__T.commit()"); await pg.wait_for_timeout(500)
        ok(len(await pg.evaluate(IDB, 'reminders') or []) == up, 'notifications on: the list is kept so the phone can show it while locked')
        await pg.evaluate("localStorage.removeItem('daftari-push');window.__T.commit()"); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(IDB, 'reminders') == [], 'notifications off again: the list is emptied')
        await tab(pg, 'set')
        txt = await pg.evaluate("document.querySelector('#view').innerText")
        ok('مش متشفر' in txt, 'settings say the month summary is a plain file')
        ok(await pg.evaluate("!JSON.parse(localStorage.getItem('daftari-drive')).sumOff"), 'saving it each month is on unless the user stops it')
        await pg.click('#view [data-act=msAuto]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("JSON.parse(localStorage.getItem('daftari-drive')).sumOff") is True, 'one tap stops it, and the choice is remembered')
        ok('مش بيتحفظ لوحده' in await pg.evaluate("document.querySelector('#view').innerText"), 'and the screen says so')
        await pg.click('#view [data-act=msAuto]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("!JSON.parse(localStorage.getItem('daftari-drive')).sumOff"), 'one more tap turns it back on')
        pv = await (await pg.request.get(URL.replace('index.html', 'privacy.html'))).text()
        ok('عادي مش متشفر' in pv and 'not encrypted' in pv and 'من غير تشفير' in pv and 'without encryption' in pv,
           'the privacy page names both in Arabic and English')
        ok(not errs, 'no page errors ' + str(errs[:2]))
        await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
