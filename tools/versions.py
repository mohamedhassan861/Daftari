#!/usr/bin/env python3
"""Writes VERSIONS.md: every released version and its commit.
Why: the GitHub connection used here cannot push tags, so this file is how any version can be found and restored:
  git checkout <commit>      (or download https://github.com/mohamedhassan861/daftari/archive/<commit>.zip)"""
import subprocess, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
g = lambda *a: subprocess.run(['git', '-C', str(R), *a], capture_output=True, text=True).stdout.strip()
tags = sorted(g('tag').split(), key=lambda t: [int(x) for x in t.lstrip('v').split('.') if x.isdigit()], reverse=True)
rows = ['# النسخ · Versions', '', 'للرجوع لأي نسخة: `git checkout <commit>` أو حمّلها من `https://github.com/mohamedhassan861/daftari/archive/<commit>.zip`', '',
        '| النسخة | commit | التاريخ | الوصف |', '|---|---|---|---|']
for t in tags:
    sha, date, subj = g('log', '-1', '--format=%H|%ad|%s', '--date=short', t + '^{commit}').split('|', 2)
    rows.append(f'| {t} | `{sha[:10]}` | {date} | {subj.replace("|", "/")[:90]} |')
(R / 'VERSIONS.md').write_text('\n'.join(rows) + '\n', encoding='utf-8')
print(len(tags), 'versions')
