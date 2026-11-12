#!/usr/bin/env python3
"""Sets the app version everywhere it must match, and rebuilds the offline file list.

Why: a version mismatch between these places lets a phone mix an old file with a new one, or keep an old
offline copy. Run it for every release:  python3 tools/release.py 0.98
"""
import json, re, sys, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
v = sys.argv[1]
assert re.fullmatch(r'\d+\.\d+', v), 'version like 0.98'

def sub(path, pattern, repl, count=1):
    p = R / path; s = p.read_text(encoding='utf-8')
    s2, n = re.subn(pattern, repl, s)
    assert n >= count, f'{path}: {pattern} not found'
    p.write_text(s2, encoding='utf-8')

sub('js/core/start.js', r"const APP_VER\s*=\s*'[^']*';", f"const APP_VER = '{v}';")
sub('js/boot.js', r"var V='[^']*';", f"var V='{v}';")
sub('index.html', r'\?v=[0-9.]+"', f'?v={v}"', 3)
(R / 'version.json').write_text(json.dumps({'v': v}) + '\n', encoding='utf-8')
boot = (R / 'js/boot.js').read_text(encoding='utf-8')
files = json.loads(re.search(r'var FILES=(\[[\s\S]*?\]);', boot).group(1))
css = re.findall(r'href="(css/[^"?]+)\?v=', (R / 'index.html').read_text(encoding='utf-8'))
shell = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png',
         f'./js/boot.js?v={v}', f'./data/rates-history.json?v={v}'] + [f'./{c}?v={v}' for c in css] + [f'./js/{f}?v={v}' for f in files]
sw = (R / 'sw.js').read_text(encoding='utf-8')
n = int(re.search(r"const CACHE = 'daftari-v(\d+)';", sw).group(1)) + 1
sw = re.sub(r"const CACHE = 'daftari-v\d+';", f"const CACHE = 'daftari-v{n}';", sw)
sw = re.sub(r"const SHELL = \[[^\]]*\];", 'const SHELL = ' + json.dumps(shell, ensure_ascii=False) + ';', sw)
(R / 'sw.js').write_text(sw, encoding='utf-8')
for f in files: assert (R / 'js' / f).exists(), f
print('version', v, '· cache', n, '·', len(files), 'js files ·', len(css), 'css files')
