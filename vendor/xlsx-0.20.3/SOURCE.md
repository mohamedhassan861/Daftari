# SheetJS Community Edition 0.20.3

`xlsx.full.min.js` and `LICENSE` (Apache-2.0) are taken unchanged from the official package
`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (file `package/dist/xlsx.full.min.js`).

- Package fingerprint checked before unpacking:
  `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`
- sha256 of `xlsx.full.min.js`: `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`

Why it is kept here instead of a CDN: the old copy (0.18.5 from cdnjs) had two known faults when reading a
crafted file (CVE-2023-30533, CVE-2024-22363), and fixed versions are published only on SheetJS's own site.
Keeping the file inside the app also means nothing outside the app can change it, and Excel works offline.
