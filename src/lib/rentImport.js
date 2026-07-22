// Core logic: Rent Input sheet -> QuickBooks bill-import workbook.
// Implements Rent_SOP exactly. Framework-agnostic; used by the UI and testable in isolation.
import ExcelJS from 'exceljs';

export const CURRENCY_FMT = '#,##0.00;(#,##0.00);"-"';
const NAVY = 'FF1F3864';
const ALT_FILL = 'FFD9E1F2';
const WHITE = 'FFFFFFFF';
const BLUE_INPUT = 'FF0000FF';
const RED_FONT = 'FF9C0006';
const RED_FILL = 'FFFFC7CE';

// Description -> { col: input column letter, gl: GL account }  (order defines line order per bill)
export const CHARGE_MAP = [
  { desc: 'Rent',                col: 'L', gl: '65100 Rent or Lease of Buildings:Rent or lease payments' },
  { desc: 'Real Estate Tax',     col: 'M', gl: '65300 Rent or Lease of Buildings:Real Estate Taxes' },
  { desc: 'CAM',                 col: 'N', gl: '65200 Rent or Lease of Buildings:Rent - CAM' },
  { desc: 'Management Fee',      col: 'O', gl: '60380 Utilities' },
  { desc: 'Outdoor Advertising', col: 'P', gl: 'Advertising' },
  { desc: 'Insurance',           col: 'Q', gl: '60410 Insurance:Insurance - Property & Liability' },
  { desc: 'Trash',               col: 'R', gl: '60380 Utilities' },
  { desc: 'Water/Sewer',         col: 'S', gl: '60380 Utilities' },
  { desc: 'Hydro',               col: 'T', gl: '60380 Utilities' },
  { desc: 'HVAC',                col: 'U', gl: '60380 Utilities' },
  { desc: 'Sign',                col: 'V', gl: '60380 Utilities' },
  { desc: 'Snow Removal',        col: 'W', gl: '60380 Utilities' },
];

export const TAX_CODE = { ON: 'HST ON', NB: 'HST NB 2016', NS: 'HST NS 2025' };
export const TAX_RATE = { ON: 0.13, NB: 0.15, NS: 0.14 };
export const PROVINCE_ORDER = ['ON', 'NB', 'NS'];
const GLOBAL_TAX = 'Exclusive of Tax';

const colToNum = (letter) => {
  let n = 0;
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
};

const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object' && v.result !== undefined) v = v.result; // formula cell
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const cellText = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.result !== undefined) return String(v.result);
    if (v.text !== undefined) return String(v.text);
    if (v.richText) return v.richText.map((r) => r.text).join('');
  }
  return String(v);
};

// Parse an uploaded Rent Input workbook (ArrayBuffer) into customer rows.
export async function parseInput(arrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('No worksheet found in the uploaded file.');

  const rows = [];
  const unmapped = new Set();
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const salon = cellText(row.getCell(colToNum('A')).value).trim();
    if (!salon) return;
    let province = cellText(row.getCell(colToNum('F')).value).trim().toUpperCase();
    if (province && !PROVINCE_ORDER.includes(province)) unmapped.add(province);

    const charges = [];
    for (const { desc, col, gl } of CHARGE_MAP) {
      const amt = numOrNull(row.getCell(colToNum(col)).value);
      if (amt !== null && amt !== 0) charges.push({ desc, amount: amt, gl });
    }
    rows.push({
      class: salon,
      payee: cellText(row.getCell(colToNum('C')).value).trim(),
      province,
      preTax: numOrNull(row.getCell(colToNum('X')).value),
      hst: numOrNull(row.getCell(colToNum('Y')).value),
      charges,
    });
  });

  if (unmapped.size) {
    throw new Error(
      `Unmapped province(s): ${[...unmapped].join(', ')}. Add its HST code and rate before running.`
    );
  }
  return rows;
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Build the summary/report object (also used to preview in the UI).
export function buildReport(rows, token) {
  const on = rows.filter((r) => r.province === 'ON');
  const nb = rows.filter((r) => r.province === 'NB');
  const ns = rows.filter((r) => r.province === 'NS');
  const seqPad = (n) => `${token}${String(n).padStart(2, '0')}`;

  const onCount = on.length;
  const nbnsCount = nb.length + ns.length;
  const flagged = [];
  for (const r of [...on, ...nb, ...ns]) {
    const calc = round2((r.preTax ?? 0) * (TAX_RATE[r.province] ?? 0));
    const diff = round2(calc - (r.hst ?? 0));
    // per-bill line sum check
    const lineSum = round2(r.charges.reduce((s, c) => s + c.amount, 0));
    r._calcHst = calc;
    r._diff = diff;
    r._lineSum = lineSum;
    if (Math.abs(diff) > 0.02) flagged.push(r);
  }
  const lineMismatches = [...on, ...nb, ...ns].filter(
    (r) => r.preTax !== null && Math.abs(r._lineSum - r.preTax) > 0.02
  );

  return {
    on, nb, ns,
    counts: { on: onCount, nbns: nbnsCount, nb: nb.length, ns: ns.length, total: onCount + nbnsCount },
    ranges: {
      on: onCount ? `${seqPad(1)}–${seqPad(onCount)}` : '(none)',
      nbns: nbnsCount ? `${seqPad(onCount + 1)}–${seqPad(onCount + nbnsCount)}` : '(none)',
    },
    preTaxTotals: {
      on: on.reduce((s, r) => s + (r.preTax ?? 0), 0),
      nbns: [...nb, ...ns].reduce((s, r) => s + (r.preTax ?? 0), 0),
    },
    flagged,
    lineMismatches,
  };
}

function styleHeader(ws, ncols) {
  const header = ws.getRow(1);
  for (let c = 1; c <= ncols; c++) {
    const cell = header.getCell(c);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  header.height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function writeBillSheet(ws, customers, startSeq, token, billDate) {
  ws.columns = [
    { header: 'S.No', width: 14 },
    { header: 'Date', width: 12 },
    { header: 'Payee', width: 34 },
    { header: 'Description', width: 18 },
    { header: 'Amount', width: 14 },
    { header: 'Class', width: 10 },
    { header: 'Tax', width: 14 },
    { header: 'Global Tax', width: 16 },
    { header: 'GL', width: 52 },
  ];
  styleHeader(ws, 9);

  const arial = { name: 'Arial', size: 10 };
  let seq = startSeq;
  let row = 2;
  for (const cust of customers) {
    const sno = `${token}${String(seq).padStart(2, '0')}`;
    const tax = TAX_CODE[cust.province];
    const band = (seq - startSeq) % 2 === 1;
    for (const line of cust.charges) {
      const r = ws.getRow(row);
      r.getCell(1).value = sno;
      r.getCell(2).value = billDate;
      r.getCell(3).value = cust.payee;
      r.getCell(4).value = line.desc;
      const amt = r.getCell(5);
      amt.value = line.amount;
      amt.numFmt = CURRENCY_FMT;
      r.getCell(6).value = isNaN(Number(cust.class)) ? cust.class : Number(cust.class);
      r.getCell(7).value = tax;
      r.getCell(8).value = GLOBAL_TAX;
      r.getCell(9).value = line.gl;
      for (let c = 1; c <= 9; c++) {
        const cell = r.getCell(c);
        cell.font = arial;
        if (band) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_FILL } };
      }
      r.getCell(1).alignment = { horizontal: 'center' };
      r.getCell(2).alignment = { horizontal: 'center' };
      row++;
    }
    seq++;
  }
  return seq; // next sequence
}

function writeRecon(ws, ordered) {
  ws.columns = [
    { header: 'Class', width: 10 },
    { header: 'Customer / Shopping Center', width: 40 },
    { header: 'Province', width: 10 },
    { header: 'Total Pre-Tax', width: 15 },
    { header: 'Tax Rate', width: 10 },
    { header: 'Calculated HST', width: 15 },
    { header: 'Sheet HST (Col Y)', width: 16 },
    { header: 'Difference', width: 13 },
    { header: 'Status', width: 10 },
  ];
  styleHeader(ws, 9);

  const arial = { name: 'Arial', size: 10 };
  const blue = { name: 'Arial', size: 10, color: { argb: BLUE_INPUT } };
  let row = 2;
  for (const cust of ordered) {
    const r = ws.getRow(row);
    r.getCell(1).value = isNaN(Number(cust.class)) ? cust.class : Number(cust.class);
    r.getCell(1).font = arial;
    r.getCell(2).value = cust.payee;
    r.getCell(2).font = arial;
    r.getCell(3).value = cust.province;
    r.getCell(3).font = arial;
    r.getCell(3).alignment = { horizontal: 'center' };
    const d = r.getCell(4); d.value = cust.preTax; d.font = blue; d.numFmt = CURRENCY_FMT;
    const e = r.getCell(5); e.value = TAX_RATE[cust.province]; e.font = blue; e.numFmt = '0%';
    const f = r.getCell(6); f.value = { formula: `ROUND(D${row}*E${row},2)` }; f.font = arial; f.numFmt = CURRENCY_FMT;
    const g = r.getCell(7); g.value = cust.hst; g.font = blue; g.numFmt = CURRENCY_FMT;
    const h = r.getCell(8); h.value = { formula: `ROUND(F${row}-G${row},2)` }; h.font = arial; h.numFmt = CURRENCY_FMT;
    const i = r.getCell(9); i.value = { formula: `IF(ABS(H${row})<=0.02,"OK","Check")` }; i.font = arial;
    i.alignment = { horizontal: 'center' };
    row++;
  }
  const last = row - 1;

  // TOTAL row
  const tr = ws.getRow(row);
  tr.getCell(1).value = 'TOTAL';
  for (const c of [4, 6, 7, 8]) {
    const L = ws.getColumn(c).letter;
    const cell = tr.getCell(c);
    cell.value = { formula: `SUM(${L}2:${L}${last})` };
    cell.numFmt = CURRENCY_FMT;
  }
  for (let c = 1; c <= 9; c++) {
    tr.getCell(c).font = { name: 'Arial', size: 10, bold: true };
    tr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_FILL } };
  }

  // Conditional format: highlight "Check" in red
  if (last >= 2) {
    ws.addConditionalFormatting({
      ref: `I2:I${last}`,
      rules: [
        {
          type: 'expression',
          formulae: ['$I2="Check"'],
          style: {
            font: { name: 'Arial', size: 10, bold: true, color: { argb: RED_FONT } },
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: RED_FILL } },
          },
        },
      ],
    });
  }
}

// Build the full workbook. Returns an ExcelJS.Workbook.
export async function buildWorkbook(rows, { token, billDate }) {
  const on = rows.filter((r) => r.province === 'ON');
  const nb = rows.filter((r) => r.province === 'NB');
  const ns = rows.filter((r) => r.province === 'NS');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'FHG Rent QB Import';
  const ws1 = wb.addWorksheet('ON Rent Sheet');
  const ws2 = wb.addWorksheet('NB & NS Rent Sheet');
  const ws3 = wb.addWorksheet('Tax Reconciliation');

  const nextSeq = writeBillSheet(ws1, on, 1, token, billDate);
  writeBillSheet(ws2, [...nb, ...ns], nextSeq, token, billDate); // NB then NS, continuous numbering
  writeRecon(ws3, [...on, ...nb, ...ns]); // grouped ON -> NB -> NS

  return wb;
}

// Convenience: full pipeline from ArrayBuffer -> { report, blob }
export async function generate(arrayBuffer, { token, billDate }) {
  const rows = await parseInput(arrayBuffer);
  const report = buildReport(rows, token);
  const wb = await buildWorkbook(rows, { token, billDate });
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return { report, blob };
}
