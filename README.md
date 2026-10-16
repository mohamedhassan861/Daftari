# دفتري — Pocket Ledger

Personal and household finance tracker for the phone: expenses, income, installments, gam'eyas (rotating savings), loans and monthly budgets. Arabic and English.

## Privacy
- Everything is stored on the device, encrypted with the user's PIN (PBKDF2 + AES-GCM).
- Optional Google Drive backup uses the `drive.file` scope: the app can only see the files it created, in a "Pocket Ledger" folder. Backups are encrypted before upload.
- No server, no analytics. This repository holds only the app's code.

## Files
- `index.html` — the whole app
- `config.js` — Google OAuth Client ID for Drive backup
- `manifest.webmanifest`, `sw.js`, icons — install on the home screen and open offline
