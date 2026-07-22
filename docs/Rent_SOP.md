# Reusable Prompt — Monthly Rent → QuickBooks Bill Import

**Purpose:** Turn the monthly Rent Input sheet into a QB-ready bill import workbook
(ON sheet + NB&NS sheet) plus a Tax Reconciliation check.

This is the source-of-truth SOP the web application in this repo implements.

## Output: one workbook, three sheets

- **ON Rent Sheet** — all customers where Province = ON
- **NB & NS Rent Sheet** — Province = NB first, then NS
- **Tax Reconciliation** — HST check for every customer (all provinces)

House style: Arial, GATP navy `#1F3864` headers, white bold text, alternating row fills,
frozen header row, currency format `#,##0.00;(#,##0.00);"-"`.

Two values are set per run:

- **MONTH TOKEN** — e.g. `May'26Rent` (change each month)
- **BILL DATE** — first of the billing month, e.g. `05/01/2026`, on every bill

## Sheets 1 & 2 — bill import columns (in this order)

`S.No | Date | Payee | Description | Amount | Class | Tax | Global Tax | GL`

- **S.No** = MONTH TOKEN + 2-digit sequence (`May'26Rent01, 02, …`). One number per
  customer/bill; all of that customer's lines repeat the same S.No. Number continuously across
  both sheets so every bill number is unique (ON ends, NB&NS continues) — do not restart at 01
  on sheet 2.
- **Date** = BILL DATE on every line.
- **Payee** = Shopping Center (input column C).
- **Description / Amount** = one line per charge type that has a value. Pull the amount from the
  matching input column. Skip any charge that is blank or 0 — no zero lines.
- **Class** = Franchise Salon # (input column A).
- **Tax** = by Province: ON → `HST ON`, NB → `HST NB 2016`, NS → `HST NS 2025`.
- **Global Tax** = `Exclusive of Tax` on every line.
- **GL** = per the mapping table below.

### Description → input column → GL account

| Description | Input col | GL account |
|-------------|-----------|------------|
| Rent | L | 65100 Rent or Lease of Buildings:Rent or lease payments |
| Real Estate Tax | M | 65300 Rent or Lease of Buildings:Real Estate Taxes |
| CAM | N | 65200 Rent or Lease of Buildings:Rent - CAM |
| Management Fee | O | 60380 Utilities |
| Outdoor Advertising | P | Advertising |
| Insurance | Q | 60410 Insurance:Insurance - Property & Liability |
| Trash | R | 60380 Utilities |
| Water/Sewer | S | 60380 Utilities |
| Hydro | T | 60380 Utilities |
| HVAC | U | 60380 Utilities |
| Sign | V | 60380 Utilities |
| Snow Removal | W | 60380 Utilities |

## Sheet 3 — Tax Reconciliation (one row per customer, grouped ON → NB → NS)

Columns: `Class | Customer / Shopping Center | Province | Total Pre-Tax | Tax Rate |
Calculated HST | Sheet HST (Col Y) | Difference | Status`

- **Total Pre-Tax** = input column X (hardcode).
- **Tax Rate** by Province: ON = 13%, NB = 15%, NS = 14%.
- **Calculated HST** = live formula `=ROUND(Pre-Tax × Rate, 2)`.
- **Sheet HST (Col Y)** = pull from input column Y (hardcode).
- **Difference** = live formula `=ROUND(Calculated HST − Sheet HST, 2)`.
- **Status** = `=IF(ABS(Difference)<=0.02,"OK","Check")`; conditional-format "Check" red.
- Add a **TOTAL** row summing Pre-Tax, Calculated HST, Sheet HST, Difference.
- Hardcoded inputs (Pre-Tax, Rate, Sheet HST) in blue; formulas in black.

## Before delivering

- Confirm each customer's lines sum to its Total Pre-Tax (column X).
- Recalculate the workbook and confirm zero formula errors.
- Report: bills per sheet, S.No range per sheet, pre-tax total per sheet, and any reconciliation
  rows flagged "Check".

## Input column reference (Rent Input sheet)

`A Franchise Salon # · C Shopping Center · F Province · L Rent · M Real Estate Tax · N CAM ·
O Management Fee · P Outdoor Advertising · Q Insurance · R Trash · S Water/Sewer · T Hydro ·
U HVAC · V Sign · W Snow Removal · X Total Pre-Tax · Y HST`

## Notes for the team

- If a new province appears, add its HST code and rate before running.
- "Outdoor Advertising" GL is just `Advertising` (no account number) — intentional per current
  mapping; update here if the COA changes.
- "Management Fee" maps to `60380 Utilities` per current mapping — change in one place (the table
  above) if reclassified.
- Small aggregate differences (a cent or two) on the recon sheet are normal: they come from the
  source storing HST to extra decimals. Only investigate rows flagged "Check".
