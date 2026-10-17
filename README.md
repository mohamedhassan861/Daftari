# دفتري — Pocket Ledger

Personal and household finance tracker for the phone: expenses, income, installments, gam'eyas (rotating savings), loans and monthly budgets. Arabic and English.

## Privacy
- Everything is stored on the device, encrypted with the user's PIN (PBKDF2 + AES-GCM).
- Backups are encrypted with the PIN. "Save a copy to Google Drive" uses the phone's share menu, so no Google account is linked to the app.
- No server, no analytics. This repository holds only the app's code.

## Files
- `index.html` — the whole app
- `manifest.webmanifest`, `sw.js`, icons — install on the home screen and open offline
