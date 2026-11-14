#!/usr/bin/env python3
"""Joins the source files into the two files phones download: js/app.js and css/app.css.

Why: the source stays in many small files that can be read and reviewed one by one, but a phone opening the app
should fetch two files, not ninety. Nothing is rewritten or minified: the parts are joined in the order of FILES in
js/boot.js (and the css links order), exactly as the loader used to join them in the browser.
tools/release.py runs this; tests/test_bundle.py fails if the joined files are older than the source.
"""
import json, re, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
CSS = [f'css/app-{i}.css' for i in range(1, 9)]

def parts():
    boot = (R / 'js/boot.js').read_text(encoding='utf-8')
    return json.loads(re.search(r'var FILES=(\[[\s\S]*?\]);', boot).group(1))

def joined():
    js = ''.join((R / 'js' / f).read_text(encoding='utf-8') for f in parts())
    css = '\n'.join((R / c).read_text(encoding='utf-8') for c in CSS)
    return js, css

if __name__ == '__main__':
    js, css = joined()
    (R / 'js/app.js').write_text(js, encoding='utf-8')
    (R / 'css/app.css').write_text(css, encoding='utf-8')
    print('built js/app.js', len(js) // 1024, 'KB · css/app.css', len(css) // 1024, 'KB')
