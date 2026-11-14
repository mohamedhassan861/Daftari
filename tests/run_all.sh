#!/bin/bash
# Runs every check in this folder against the app in this repository, at a fixed date, in a headless browser.
# Prints each failure and the totals; exits 1 if anything failed.   Usage: bash tests/run_all.sh
cd "$(dirname "$0")" || exit 2
export DAFTARI_PORT="${DAFTARI_PORT:-8765}"
if ! curl -s -o /dev/null "localhost:$DAFTARI_PORT/index.html"; then
  (cd .. && python3 -m http.server "$DAFTARI_PORT" >/dev/null 2>&1 &)
  sleep 1
fi
pass=0; bad=0
for f in test_*.py; do
  out=$(timeout 600 python3 "$f" 2>&1); code=$?
  n=$(echo "$out" | grep -c '^PASS')
  pass=$((pass + n))
  if [ $code -ne 0 ] || echo "$out" | grep -q '^FAIL\|Traceback'; then
    bad=$((bad + 1)); echo "== $f"; echo "$out" | grep -E '^FAIL|Error|Traceback' | head -8
  else
    echo "ok  $f ($n)"
  fi
done
echo "PASS total: $pass · failing files: $bad"
[ $bad -eq 0 ]
