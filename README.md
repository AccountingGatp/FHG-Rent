# FHG Rent → QuickBooks Bill Import

A browser-based web application that turns the **monthly Rent Input sheet** into a
**QuickBooks-ready bill-import workbook**, following the FHG Rent SOP.

**Live app:** https://fhg-rent-qb-import.vercel.app

**Offline tool:** [`offline-tool/Rent_QB_Import_Tool.html`](offline-tool/) — a single self-contained
HTML file. Download it, double-click, and it runs in any browser with **no server, no install, and
no internet**.

Everything runs **client-side** — the uploaded spreadsheet never leaves the browser.

## What it produces

One `.xlsx` workbook with three sheets:

| Sheet | Contents |
|-------|----------|
| **ON Rent Sheet** | All customers where Province = `ON` |
| **NB & NS Rent Sheet** | Province = `NB` first, then `NS` |
| **Tax Reconciliation** | HST check for every customer (all provinces) |

### Bill sheets — columns
`S.No · Date · Payee · Description · Amount · Class · Tax · Global Tax · GL`

- **S.No** — `MONTH TOKEN` + 2-digit sequence (`Jul'26Rent01, 02, …`). One number per bill;
  all of a customer's lines repeat the same S.No. Numbering is **continuous across both bill
  sheets** — ON ends, NB & NS continues (it does not restart at 01).
- **Date** — the `BILL DATE` on every line.
- **Payee** — Shopping Center (input col `C`). **Class** — Franchise Salon # (input col `A`).
- **Description / Amount** — one line per charge type that has a non-zero value; blanks and zeros
  are skipped.
- **Tax** — `ON → HST ON`, `NB → HST NB 2016`, `NS → HST NS 2025`. **Global Tax** — `Exclusive of Tax`.
- **GL** — per the mapping in [`src/lib/rentImport.js`](src/lib/rentImport.js) (`CHARGE_MAP`).

### Tax Reconciliation — columns
`Class · Customer / Shopping Center · Province · Total Pre-Tax · Tax Rate · Calculated HST ·
Sheet HST (Col Y) · Difference · Status`

- **Tax Rate** — `ON 13% · NB 15% · NS 14%`.
- **Calculated HST** — live formula `=ROUND(Pre-Tax × Rate, 2)`.
- **Difference** — live formula `=ROUND(Calculated − Sheet HST, 2)`.
- **Status** — `=IF(ABS(Difference)<=0.02,"OK","Check")`; "Check" is conditionally formatted red.
- A **TOTAL** row sums Pre-Tax, Calculated HST, Sheet HST and Difference.
- Hardcoded inputs (Pre-Tax, Rate, Sheet HST) are shown in blue; formulas in black.

House style: Arial, navy `#1F3864` headers with white bold text, frozen header row,
currency format `#,##0.00;(#,##0.00);"-"`.

## Input column reference (Rent Input sheet)
`A Franchise Salon # · C Shopping Center · F Province · L Rent · M Real Estate Tax · N CAM ·
O Management Fee · P Outdoor Advertising · Q Insurance · R Trash · S Water/Sewer · T Hydro ·
U HVAC · V Sign · W Snow Removal · X Total Pre-Tax · Y HST`

## Usage

1. Open the app.
2. **Enter MONTH TOKEN** (e.g. `Jul'26Rent`) and **BILL DATE** (`MM/DD/YYYY`, e.g. `07/01/2026`).
   Both are **required** — the app does not pre-fill them, and generation stays disabled until
   both are provided (BILL DATE must be valid `MM/DD/YYYY`).
3. Drop in this month's Rent Input `.xlsx`.
4. Click **Build QB Import Workbook**, review the reconciliation summary, and download.

## Develop

```bash
npm install
npm run dev            # local dev server
npm run build          # production build -> dist/
npm run build:offline  # single self-contained file -> offline/index.html
npm run preview        # preview the production build
```

Verify the generation logic against a real input sheet:

```bash
node scripts/verify.mjs path/to/Rent_Input_sheet.xlsx out.xlsx
```

## Extending

- **New province** — add its HST code to `TAX_CODE` and rate to `TAX_RATE` in
  `src/lib/rentImport.js`, and to `PROVINCE_ORDER` for grouping.
- **GL / charge mapping** — edit `CHARGE_MAP` (single source of truth). `Outdoor Advertising`
  maps to `Advertising` (no account number) and `Management Fee` to `60380 Utilities`, per the
  current SOP.

All bill/recon rules live in [`src/lib/rentImport.js`](src/lib/rentImport.js); the SOP is in
[`docs/Rent_SOP.md`](docs/Rent_SOP.md).
