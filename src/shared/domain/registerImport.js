// Register CSV import (pure — no DOM, no DB). Parses the app's onboarding export
// (buildCSV in csv.js) into asset records for the admin register-import endpoint.
// Merge-friendly: only ADD rows with an auto asset no become records; everything
// else is ignored or counted as skipped. Consumed by src/server/routes.js and the
// registerImport unit gate. Header/grid helpers mirror taxonomyImport.js.

const REQUIRED = [
  ['add', 'ADD ROW?'],
  ['parent', 'SELECT PARENT ASSET'],
  ['no', 'ASSET NO (AUTO)'],
  ['name', 'ASSET NAME (AUTO)'],
];
const LEVEL_LABELS = ['LEVEL 3', 'LEVEL 4', 'LEVEL 5', 'LEVEL 6', 'LEVEL 7', 'LEVEL 8', 'LEVEL 9', 'LEVEL 10', 'LEVEL 11', 'LEVEL 12', 'LEVEL 13'];
const MAX_ROWS = 100000;

// RFC-4180-ish parser -> array of string arrays. Handles quoted fields with embedded
// commas / quotes / newlines, CRLF or LF line ends, and a leading UTF-8 BOM.
function parseCSVGrid(text) {
  const s = String(text == null ? '' : text).replace(/^﻿/, '');
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') { inQ = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip; the following \n ends the line */ }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function normHeader(h) { return String(h == null ? '' : h).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
// Strip the CSV formula-injection guard (leading ' before = + - @ / tab / CR) that csv.js adds
// on export, so importing the app's own onboarding CSV recovers the original value losslessly.
const CSV_RISK = /^[=+\-@\t\r]/;
function csvUnguard(v) { v = String(v == null ? '' : v); return (v[0] === "'" && CSV_RISK.test(v.slice(1))) ? v.slice(1) : v; }
function cell(r, j) { return (j == null || j < 0) ? '' : csvUnguard(String(r[j] == null ? '' : r[j]).trim()); }
function isTrue(v) { return String(v == null ? '' : v).trim().toLowerCase() === 'true'; }

// Parse an onboarding-export CSV into register records. Returns
// { ok:true, records, stats } or { ok:false, errors }. The four required columns
// prove the file is an onboarding export; LEVEL 3..13 are optional detail.
export function parseRegisterCSV(text) {
  const errors = [];
  const grid = parseCSVGrid(text).filter(r => r.some(c => (c || '').trim() !== ''));
  if (!grid.length) return { ok: false, errors: ['CSV is empty.'] };

  const header = grid[0].map(normHeader);
  const idx = {};
  for (const [key, label] of REQUIRED) {
    const j = header.indexOf(normHeader(label));
    if (j < 0) errors.push('Missing column: ' + label + '.');
    else idx[key] = j;
  }
  if (errors.length) return { ok: false, errors };

  // Column index of each LEVEL that is actually present, kept in LEVEL 3..13 order.
  const levelIdx = LEVEL_LABELS.map(l => header.indexOf(normHeader(l))).filter(j => j >= 0);

  const dataRows = grid.slice(1);
  if (dataRows.length > MAX_ROWS) return { ok: false, errors: ['Too many rows (' + dataRows.length + '); limit is ' + MAX_ROWS + '.'] };

  const records = [];
  const seen = new Set();
  let rows = 0, skippedNoId = 0, skippedDup = 0;
  for (const r of dataRows) {
    if (!isTrue(r[idx.add])) continue;          // only ADD rows join the register
    rows++;
    const no = cell(r, idx.no);
    if (!no) { skippedNoId++; continue; }        // ADD row with no auto number — skip, don't reject
    if (seen.has(no)) { skippedDup++; continue; } // first occurrence wins
    seen.add(no);
    const levels = levelIdx.map(j => cell(r, j));
    while (levels.length && levels[levels.length - 1] === '') levels.pop();
    records.push({ no, name: cell(r, idx.name), parent: cell(r, idx.parent), levels });
  }

  return { ok: true, records, stats: { rows, records: records.length, skippedNoId, skippedDup } };
}
