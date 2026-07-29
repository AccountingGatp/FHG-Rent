# Offline tool

**`Rent_QB_Import_Tool.html`** is the entire app in one self-contained file — no server,
no install, no internet required.

## How to use

1. Download **`Rent_QB_Import_Tool.html`** (click the file above → **Download raw file**, or
   the download button on the file view).
2. Save it anywhere — Desktop, a shared drive, a USB stick.
3. **Double-click it.** It opens in your default browser (Chrome, Edge, or Firefox).
4. Enter **MONTH TOKEN** and **BILL DATE**, drop in the month's Rent Input `.xlsx`, and click
   **Build QB Import Workbook**. Review the reconciliation summary, then download the workbook.

Everything — the app and the Excel engine — is embedded in the one HTML file, so it works with
Wi-Fi off and the uploaded spreadsheet never leaves your computer.

## Rebuilding it

The file is a build output. To regenerate it after changing the source:

```bash
npm install
npm run build:offline      # writes offline/index.html
```

Then copy `offline/index.html` over `offline-tool/Rent_QB_Import_Tool.html`.

> The `offline/` build directory is git-ignored; this committed copy is the ready-to-use version.
