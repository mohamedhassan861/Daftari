# دفتري — Daftari

Personal and household finance tracker for the phone: expenses, income, installments, gam'eyas (rotating savings), loans and monthly budgets. Arabic and English.

## Privacy
- Everything is stored on the device, encrypted with the user's PIN (PBKDF2 + AES-GCM).
- Backups are encrypted with the PIN before they leave the phone.
- Google Drive sync uses the `drive.file` scope: the app sees only the files it created, in a "Daftari" folder.
- "Save a copy to Google Drive" through the share menu also works without linking an account.
- No server, no analytics. This repository holds only the app's code.

## Files
- `index.html` — the whole app
- `config.js` — Google OAuth Client ID for Drive sync
- `manifest.webmanifest`, `sw.js`, icons — install on the home screen and open offline

## Auth helper (optional)
`worker/auth-worker.js` runs on Cloudflare Workers (free plan). It swaps Google sign-in codes and refresh tokens for short access tokens so Drive stays linked. It stores nothing. Set the secret `GOOGLE_CLIENT_SECRET` in the Worker settings and put the Worker address in `config.js` as `authWorker`.
