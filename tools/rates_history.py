#!/usr/bin/env python3
"""Builds or extends data/rates-history.json: one row per day of EGP prices for USD, SAR, EUR and one ounce of gold.

Why: the app shows the lowest price over the last 3 months / 1 / 2 / 3 years, which needs daily history the live
rate feed does not give. From 2 March 2024 the rows come from the free daily feed @fawazahmed0/currency-api (one npm
version per day, same source the app uses for recent days); earlier rows come from tools/rates-gap (see SOURCES.md).
Run before a release to add the newest days:  python3 tools/rates_history.py
"""
import csv, io, json, pathlib, subprocess, sys, tarfile, urllib.request
from concurrent.futures import ThreadPoolExecutor
R = pathlib.Path(__file__).resolve().parent.parent
OUT, GAP = R / 'data/rates-history.json', R / 'tools/rates-gap'
CACHE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None   # optional folder of <version>.json already fetched
PKG = 'https://registry.npmjs.org/@fawazahmed0/currency-api'

def gap_rows():
    rd = lambda f, fmt: {(d if fmt == 'iso' else d[6:] + '-' + d[3:5] + '-' + d[:2]): float(v) for d, v in csv.reader(open(GAP / f))}
    usd, eur, xau = rd('usd.csv', 'dmy'), rd('eur.csv', 'dmy'), rd('xauusd.csv', 'iso')
    rows = {}
    for d in sorted(set(usd) | set(eur) | set(xau)):
        u = usd.get(d)
        rows[d] = [round(u, 4) if u else None, round(u / 3.75, 4) if u else None, round(eur[d], 4) if d in eur else None,
                   round(xau[d] * u, 2) if u and d in xau else None]
    return rows

def day(v):
    if CACHE and (CACHE / (v + '.json')).exists():
        j = json.loads((CACHE / (v + '.json')).read_text())
    else:
        with urllib.request.urlopen(f'{PKG}/-/currency-api-{v}.tgz', timeout=120) as r:
            t = tarfile.open(fileobj=io.BytesIO(r.read()))
        j = json.load(t.extractfile('package/v1/currencies/egp.min.json'))
    e = j['egp']
    inv = lambda k, n: round(1 / e[k], n) if e.get(k) else None
    return j['date'], [inv('usd', 4), inv('sar', 4), inv('eur', 4), inv('xau', 2)]

old = {r[0]: r[1:] for r in json.loads(OUT.read_text())['rows']} if OUT.exists() else gap_rows()
last = max(old)
with urllib.request.urlopen(PKG, timeout=120) as r:
    vers = [v for v in json.load(r)['versions'] if v.startswith('20')]
iso = lambda v: '-'.join(p.zfill(2) for p in v.split('.'))
todo = [v for v in vers if iso(v) > last]
with ThreadPoolExecutor(8) as ex:
    for d, row in ex.map(day, todo):
        if all(x is None for x in row): continue
        old[d] = row
rows = [[d] + old[d] for d in sorted(old)]
OUT.write_text(json.dumps({'cols': ['USD', 'SAR', 'EUR', 'XAU'], 'unit': 'EGP per 1 unit; XAU = one troy ounce',
                           'rows': rows}, separators=(',', ':')) + '\n')
print(len(rows), 'days', rows[0][0], '->', rows[-1][0], '· added', len(todo))
