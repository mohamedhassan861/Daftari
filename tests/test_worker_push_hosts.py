"""The server only calls real browser push services. The rule is read from worker/auth-worker.js itself and run in Node."""
import json, os, subprocess, sys
from lib import ok, failed

GOOD = ['https://fcm.googleapis.com/fcm/send/abc:APA91', 'https://fcm.googleapis.com/wp/xyz', 'https://fcm.googleapis.com:443/wp/xyz',
        'https://updates.push.services.mozilla.com/wpush/v2/gAAA', 'https://web.push.apple.com/QGk',
        'https://wns2-by3p.notify.windows.com/w/?token=AwY', 'https://android.googleapis.com/gcm/send/x']
BAD = ['https://example.com/x', 'http://fcm.googleapis.com/fcm/send/a', 'https://fcm.googleapis.com.evil.com/a',
       'https://fcm.googleapis.com@evil.com/a', 'https://evil.com/?https://fcm.googleapis.com/', 'https://fcm.googleapis.com:8443/a',
       'https://push.apple.com.evil.io/a', 'https://evilnotify.windows.com/a', 'https://x.notify.windows.com.evil.com/',
       'https://169.254.169.254/latest', 'https://localhost/x', 'ftp://fcm.googleapis.com/a', '', None,
       'https://user:pw@fcm.googleapis.com/a', 'https://fcm.googleapis.com/' + 'a' * 1000]
JS = """const fs=require('fs');const src=fs.readFileSync(process.argv[1],'utf8');
const m=src.match(/const PUSH_HOSTS[\\s\\S]*?\\n}\\n/)[0];const f=new Function(m+';return pushEndpointOk')();
const [good,bad]=JSON.parse(process.argv[2]);console.log(JSON.stringify([good.filter(u=>!f(u)),bad.filter(u=>f(u))]));"""
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'worker', 'auth-worker.js')
out = subprocess.run(['node', '-e', JS, src, json.dumps([GOOD, BAD])], capture_output=True, text=True)
ok(out.returncode == 0, 'the rule in the worker file runs ' + out.stderr[:200])
refused, accepted = json.loads(out.stdout) if out.returncode == 0 else ([], [])
ok(not refused, f'{len(GOOD)} real push addresses are accepted {refused}')
ok(not accepted, f'{len(BAD)} other addresses are refused {accepted}')
text = open(src, encoding='utf-8').read()
ok(text.count('pushEndpointOk(') >= 3, 'the rule guards saving a subscription, the test push and the daily push')
ok('fetch(sub.endpoint' in text and text.index('pushEndpointOk(sub.endpoint)') < text.index('fetch(sub.endpoint'), 'and it runs before the worker calls the address')
sys.exit(1 if failed() else 0)
