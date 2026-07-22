// Verify the browser logic against the real Rent Input sheet (run in Node).
// Usage: node scripts/verify.mjs <input.xlsx> [outCheck.xlsx]
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { generate } from '../src/lib/rentImport.js';

const input = process.argv[2];
const out = process.argv[3];
if (!input) { console.error('need input path'); process.exit(1); }

const buf = fs.readFileSync(input);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const { report, blob } = await generate(ab, { token: "Jul'26Rent", billDate: '07/01/2026' });

console.log('ON bills      ', report.counts.on, report.ranges.on, 'pretax', report.preTaxTotals.on.toFixed(2));
console.log('NB&NS bills   ', report.counts.nbns, report.ranges.nbns, 'pretax', report.preTaxTotals.nbns.toFixed(2));
console.log('  NB', report.counts.nb, 'NS', report.counts.ns);
console.log('Total bills   ', report.counts.total);
console.log('Flagged Check ', report.flagged.length);
console.log('Line mismatch ', report.lineMismatches.length);

// Reload the produced workbook and re-check per-bill sums + formulas exist
const wbBuf = Buffer.from(await blob.arrayBuffer());
if (out) fs.writeFileSync(out, wbBuf);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(wbBuf);
const names = wb.worksheets.map((w) => w.name);
console.log('Sheets        ', names.join(' | '));

// per-bill sum check across both bill sheets
const sums = new Map(); const cls = new Map();
for (const sh of ['ON Rent Sheet', 'NB & NS Rent Sheet']) {
  const ws = wb.getWorksheet(sh);
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const sno = row.getCell(1).value;
    if (!sno) return;
    sums.set(sno, (sums.get(sno) || 0) + (row.getCell(5).value || 0));
    cls.set(sno, row.getCell(6).value);
  });
}
// input pretax
const inWb = new ExcelJS.Workbook();
await inWb.xlsx.load(buf);
const ins = inWb.worksheets[0];
const pre = new Map();
ins.eachRow((row, n) => {
  if (n === 1) return;
  const a = row.getCell(1).value;
  if (a === null || a === undefined || a === '') return;
  pre.set(String(a), row.getCell(24).value);
});
let bad = 0;
for (const [sno, tot] of sums) {
  const c = String(cls.get(sno));
  const p = Number(pre.get(c));
  if (Math.abs(tot - p) > 0.02) { console.log('MISMATCH', sno, c, tot.toFixed(2), p); bad++; }
}
console.log(`Per-bill sums checked ${sums.size}, mismatches ${bad}`);

// recon formulas present?
const recon = wb.getWorksheet('Tax Reconciliation');
const f6 = recon.getCell('F2').value, h6 = recon.getCell('H2').value, i6 = recon.getCell('I2').value;
console.log('Recon F2/H2/I2 formulas:', f6.formula, '|', h6.formula, '|', i6.formula);
const totalRow = recon.rowCount;
console.log('Recon TOTAL row', recon.getCell(`A${totalRow}`).value, recon.getCell(`D${totalRow}`).value?.formula);
console.log(bad === 0 ? 'PASS' : 'FAIL');
