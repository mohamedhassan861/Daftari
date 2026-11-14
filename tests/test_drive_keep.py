"""Old Drive backup copies: the keep rule, and that nothing is moved to the bin before the user agrees.
Drive itself is replaced by a stand-in that answers the app's requests."""
import asyncio, json, sys, datetime as D
from lib import *
TODAY=D.date(2026,11,14)
def mk(days,times=('08-00-00','13-00-00','21-00-00')):
    out=[]
    for a in days:
        d=TODAY-D.timedelta(days=a)
        for t in times: out.append({'id':f'b{a}_{t}','name':f'daftari_{d.isoformat()}_{t}.json','createdTime':d.isoformat()+'T'+t.replace('-',':')+'Z'})
    return out
OTHER=[{'id':'sh1','name':'Daftari - البيت.dft','createdTime':'2026-01-01T00:00:00Z'},{'id':'rc1','name':'receipt_abc.jpg','createdTime':'2025-01-01T00:00:00Z'},
       {'id':'sm1','name':'summary_2025-12.html','createdTime':'2026-01-01T00:00:00Z'},{'id':'rk','name':'daftari-recovery.json','createdTime':'2025-01-01T00:00:00Z'}]
async def main():
  async with async_playwright() as p:
    FILES=mk(range(0,400))+OTHER; patched=[]
    H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'}
    async def drive(r):
      u=r.request.url
      if 'googleapis.com/drive/v3/files' not in u: return False
      if r.request.method=='OPTIONS': await r.fulfill(status=204,headers=H)
      elif r.request.method=='PATCH': patched.append(u.split('/files/')[1].split('?')[0]); await r.fulfill(status=200,headers=H,body='{}')
      elif '/files/F1' in u: await r.fulfill(status=200,headers=H,body=json.dumps({'id':'F1','trashed':False}))
      else:
        live=sorted([f for f in FILES if f['id'] not in patched],key=lambda f:f['createdTime'],reverse=True)
        paged='nextPageToken' in u
        body={'files':live[1000:]} if 'pageToken=' in u else ({'files':live[:1000],'nextPageToken':'p2'} if paged and len(live)>1000 else {'files':live[:1000]})
        await r.fulfill(status=200,headers=H,body=json.dumps(body))
      return True
    b,pg,errs=await open_app(p,sample=False,route=drive,init="localStorage.setItem('daftari-drive',JSON.stringify({linked:true,email:'a@b.com',folderId:'F1'}));localStorage.setItem('daftari-gtoken',JSON.stringify({t:'tok',exp:new Date('2027-01-01').getTime()}));")
    await pg.wait_for_timeout(1500)
    patched.clear()
    # --- the rule itself ---
    gone=set(await pg.evaluate("f=>window.__T.backupsToTrash(f,'2026-11-14').map(x=>x.id)",FILES))
    age=lambda f:(TODAY-D.date.fromisoformat(f['name'][8:18])).days
    bk=[f for f in FILES if f['name'].startswith('daftari_2')]
    ok(not any(f['id'] in gone for f in OTHER),'shared ledgers, receipts, summaries and the recovery file are never touched')
    ok(not any(f['id'] in gone for f in bk if age(f)<=7),'every copy of the last 7 days stays')
    days={}
    for f in bk:
      if 7<age(f)<=97: days.setdefault(age(f),[]).append(f)
    ok(all([x['id'] for x in v if x['id'] not in gone]==[max(v,key=lambda x:x['name'])['id']] for v in days.values()),'8 to 97 days back: only the last copy of each day stays')
    months={}
    for f in bk:
      if age(f)>97: months.setdefault(f['name'][8:15],[]).append(f)
    full=[m for m,v in months.items() if not any(x['name'][8:15]==m and age(x)<=97 for x in bk)]
    ok(all([x['id'] for x in months[m] if x['id'] not in gone]==[max(months[m],key=lambda x:x['name'])['id']] for m in full),'older: only the last copy of each month stays')
    old=mk(range(200,210))  # 30 copies, all old, two months
    g2=await pg.evaluate("f=>window.__T.backupsToTrash(f,'2026-11-14').length",old)
    ok(len(old)-g2>=20,'the newest 20 copies always stay ('+str(len(old)-g2)+' of 30 kept)')
    # --- in the app: nothing goes before the user agrees ---
    await close_sheets(pg)
    await pg.evaluate("document.querySelector('[data-tab=set]').click()");await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    ok('كل النسخ بتفضل محفوظة' in await pg.evaluate("document.querySelector('#view').innerText"),'settings say every copy is kept, before agreeing')
    await pg.evaluate("document.querySelector('[data-act=driveTidy]').click()");await pg.wait_for_timeout(2500)
    q=await pg.evaluate("document.querySelector('#shT').textContent")
    ok(str(len(bk)) in q and str(len(gone)) in q,'the question shows how many copies there are and how many would go: '+q[:60])
    ok(len(patched)==0,'nothing moved before the answer')
    await pg.click('#cYes');await pg.wait_for_timeout(6000)
    ok(set(patched)==gone,'after agreeing, exactly the old copies were moved to the bin ('+str(len(patched))+')')
    await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    v=await pg.evaluate("document.querySelector('#view').innerText")
    ok('بتتنضّف لوحدها' in v and await pg.locator('[data-act=driveKeepAll]').count()==1,'settings now say old copies are cleared automatically, with a way back')
    # restore list shows backups only
    await pg.evaluate("document.querySelector('[data-act=driveRestore]').click()");await pg.wait_for_timeout(2000)
    n=await pg.evaluate("document.querySelectorAll('#shB [data-f]').length")
    ok(n==len(bk)-len(gone) and n>0,'restore list shows the remaining backup copies only ('+str(n)+')')
    ok(not errs,'no page errors '+str(errs[:2]))
    await b.close()
asyncio.run(main()); sys.exit(1 if failed() else 0)
