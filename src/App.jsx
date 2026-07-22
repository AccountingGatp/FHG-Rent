import React, { useState, useCallback, useRef } from 'react';
import { generate } from './lib/rentImport.js';

// Default MONTH TOKEN / BILL DATE from today: e.g. Jul'26Rent + 07/01/2026.
function defaults() {
  const now = new Date();
  const mon = now.toLocaleString('en-US', { month: 'short' }); // Jul
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return {
    token: `${mon}'${yy}Rent`,
    billDate: `${mm}/01/${now.getFullYear()}`,
  };
}

const fmt = (n) =>
  (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function App() {
  const d = defaults();
  const [token, setToken] = useState(d.token);
  const [billDate, setBillDate] = useState(d.billDate);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const inputRef = useRef(null);

  const outName = `Rent_QB_Import_${token.replace(/[^A-Za-z0-9]/g, '')}.xlsx`;

  const onFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setStatus('idle');
    setReport(null);
    setError('');
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
  }, [blobUrl]);

  const run = useCallback(async () => {
    if (!file) return;
    setStatus('working');
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const { report, blob } = await generate(buf, { token, billDate });
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(URL.createObjectURL(blob));
      setReport(report);
      setStatus('done');
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
      setStatus('error');
    }
  }, [file, token, billDate, blobUrl]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div className="page">
      <header className="hero">
        <h1>Rent&nbsp;→&nbsp;QuickBooks Bill Import</h1>
        <p>Turn the monthly Rent Input sheet into a QB-ready bill-import workbook —
          <strong> ON Rent</strong>, <strong> NB&nbsp;&amp;&nbsp;NS Rent</strong>, and a
          <strong> Tax Reconciliation</strong> sheet. Everything runs in your browser; no file leaves this page.</p>
      </header>

      <section className="card">
        <div className="grid2">
          <label className="field">
            <span>MONTH TOKEN</span>
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Jul'26Rent" />
            <small>S.No prefix. e.g. <code>Jul'26Rent01, 02, …</code></small>
          </label>
          <label className="field">
            <span>BILL DATE</span>
            <input value={billDate} onChange={(e) => setBillDate(e.target.value)} placeholder="07/01/2026" />
            <small>First of the billing month, on every bill line.</small>
          </label>
        </div>

        <div
          className={`dropzone ${file ? 'has-file' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {file ? (
            <>
              <div className="dz-icon">📄</div>
              <div className="dz-main">{file.name}</div>
              <div className="dz-sub">Click to choose a different file</div>
            </>
          ) : (
            <>
              <div className="dz-icon">⬆️</div>
              <div className="dz-main">Drop the Rent Input sheet here</div>
              <div className="dz-sub">or click to browse (.xlsx)</div>
            </>
          )}
        </div>

        <button className="primary" disabled={!file || status === 'working'} onClick={run}>
          {status === 'working' ? 'Building…' : 'Build QB Import Workbook'}
        </button>

        {status === 'error' && <div className="alert error">⚠️ {error}</div>}
      </section>

      {status === 'done' && report && (
        <section className="card result">
          <div className="result-head">
            <div>
              <h2>Workbook ready</h2>
              <p className="muted">Review the reconciliation summary, then download.</p>
            </div>
            <a className="primary download" href={blobUrl} download={outName}>⬇ Download {outName}</a>
          </div>

          <div className="stats">
            <Stat label="ON bills" value={report.counts.on} sub={report.ranges.on} />
            <Stat label="NB & NS bills" value={report.counts.nbns} sub={report.ranges.nbns} />
            <Stat label="Total bills" value={report.counts.total} sub={`NB ${report.counts.nb} · NS ${report.counts.ns}`} />
            <Stat
              label="Rows flagged 'Check'"
              value={report.flagged.length}
              sub={report.flagged.length ? 'review below' : 'all OK'}
              tone={report.flagged.length ? 'warn' : 'ok'}
            />
          </div>

          <div className="totals">
            <span>ON pre-tax total: <strong>{fmt(report.preTaxTotals.on)}</strong></span>
            <span>NB&amp;NS pre-tax total: <strong>{fmt(report.preTaxTotals.nbns)}</strong></span>
          </div>

          {report.lineMismatches.length > 0 && (
            <div className="alert warn">
              {report.lineMismatches.length} customer(s) whose charge lines don't sum to Total&nbsp;Pre-Tax (Col&nbsp;X):{' '}
              {report.lineMismatches.map((r) => r.class).join(', ')}
            </div>
          )}

          {report.flagged.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Class</th><th>Customer</th><th>Prov</th><th>Calc HST</th><th>Sheet HST</th><th>Diff</th></tr>
                </thead>
                <tbody>
                  {report.flagged.map((r) => (
                    <tr key={r.class}>
                      <td>{r.class}</td><td>{r.payee}</td><td>{r.province}</td>
                      <td className="num">{fmt(r._calcHst)}</td>
                      <td className="num">{fmt(r.hst)}</td>
                      <td className="num flag">{fmt(r._diff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="alert ok">✓ Every customer reconciles within ±0.02. No rows flagged “Check”.</div>
          )}
        </section>
      )}

      <footer className="foot">
        <details>
          <summary>Rules applied (from Rent SOP)</summary>
          <ul>
            <li><strong>Sheets:</strong> ON Rent (Province = ON) · NB&nbsp;&amp;&nbsp;NS Rent (NB then NS) · Tax Reconciliation (all).</li>
            <li><strong>S.No:</strong> MONTH TOKEN + 2-digit sequence, continuous across both bill sheets (ON 01…, NB&amp;NS continues).</li>
            <li><strong>One line per charge type with a value</strong> — blanks and zeros skipped.</li>
            <li><strong>Tax:</strong> ON → HST ON · NB → HST NB 2016 · NS → HST NS 2025. Global Tax = Exclusive of Tax.</li>
            <li><strong>Recon:</strong> Calc HST = ROUND(Pre-Tax × rate, 2); rate ON 13% · NB 15% · NS 14%. Status = Check when |diff| &gt; 0.02.</li>
            <li><strong>Style:</strong> Arial, navy #1F3864 headers, frozen header row, currency <code>#,##0.00;(#,##0.00);"-"</code>.</li>
          </ul>
        </details>
        <p className="muted small">FHG Rent · client-side · files never leave the browser.</p>
      </footer>
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
