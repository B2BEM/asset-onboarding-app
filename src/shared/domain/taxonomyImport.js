// Taxonomy CSV import/export (pure — no DOM, no DB). The inverse of buildTaxCSV in csv.js:
// a 5-column CSV (TAXONOMY VALUE, TAXONOMY TYPE, CODE, DESCRIPTION, PARENT TAXONOMY VALUE)
// parsed into the dataset's taxonomy shape { taxonomyNodes, edges, siteRoots } and back.
// Consumed by src/server/routes.js (admin import/export endpoints) and the unit gate.

const REQUIRED = [
  ['value', 'TAXONOMY VALUE'],
  ['type', 'TAXONOMY TYPE'],
  ['code', 'CODE'],
  ['desc', 'DESCRIPTION'],
  ['parent', 'PARENT TAXONOMY VALUE'],
];
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

// CSV / formula injection guard (mirrors csv.js): neutralise cells a spreadsheet would treat
// as a formula on export; parse strips the guard so import round-trips are lossless.
const CSV_RISK = /^[=+\-@\t\r]/;
function csvGuard(v) { v = (v == null ? '' : String(v)); return CSV_RISK.test(v) ? "'" + v : v; }
function csvUnguard(v) { v = (v == null ? '' : String(v)); return (v[0] === "'" && CSV_RISK.test(v.slice(1))) ? v.slice(1) : v; }
function csvCell(v) { v = csvGuard(v == null ? '' : String(v)); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function normHeader(h) { return String(h == null ? '' : h).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function cap(v, n) { v = String(v == null ? '' : v); return v.length > n ? v.slice(0, n) : v; }

// A parent-pointer forest cycles only in simple loops (each node has one parent). Climb the
// parent chain from each node; hitting a node already on the current climb path is a cycle.
function detectCycle(nodes, parentOf) {
  // null-proto: keys are untrusted TAXONOMY VALUEs, so an inherited member name
  // (toString, constructor, __proto__, …) must NOT resolve to a truthy prototype value.
  const color = Object.create(null); // 1 = on current path, 2 = proven acyclic
  for (const start of Object.keys(nodes)) {
    if (color[start]) continue;
    const path = [];
    let v = start;
    while (v && nodes[v] && !color[v]) { color[v] = 1; path.push(v); v = parentOf[v]; }
    if (v && nodes[v] && color[v] === 1) return v;   // climbed back onto our own path
    for (const n of path) color[n] = 2;
  }
  return null;
}

// Parse a taxonomy CSV. Returns { ok:true, dataset, stats } or { ok:false, errors }.
// Strict + all-or-nothing: every applicable error is collected so the admin sees them at once.
export function parseTaxonomyCSV(text) {
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

  const dataRows = grid.slice(1);
  if (dataRows.length > MAX_ROWS) return { ok: false, errors: ['Too many rows (' + dataRows.length + '); limit is ' + MAX_ROWS + '.'] };

  // null-proto maps: TAXONOMY VALUE / PARENT are untrusted, so a cell like "toString",
  // "constructor" or "__proto__" must not shadow real entries via Object.prototype — that
  // previously bypassed the "parent is not defined" guard and crashed on edges[parent].push.
  const nodes = Object.create(null), edges = Object.create(null), roots = [], parentOf = Object.create(null);
  const seen = new Set(), dup = new Set();
  dataRows.forEach((r, n) => {
    const line = n + 2;                                  // 1-based, including the header row
    const value = csvUnguard((r[idx.value] || '').trim());
    if (!value) { errors.push('Row ' + line + ': TAXONOMY VALUE is required.'); return; }
    if (seen.has(value)) { if (!dup.has(value)) { dup.add(value); errors.push('Duplicate TAXONOMY VALUE: "' + value + '".'); } return; }
    seen.add(value);
    nodes[value] = {
      value: cap(value, 300),
      type: cap(csvUnguard((r[idx.type] || '').trim()), 50),
      code: cap(csvUnguard((r[idx.code] || '').trim()), 50),
      desc: cap(csvUnguard((r[idx.desc] || '').trim()), 2000),
    };
    parentOf[value] = csvUnguard((r[idx.parent] || '').trim());
  });

  // edges + roots + referential integrity. Object key order = row order, so children and
  // roots keep the file's order (matching buildDataset()/reseed semantics).
  for (const value of Object.keys(nodes)) {
    const parent = parentOf[value];
    if (!parent) roots.push(value);
    else if (!nodes[parent]) errors.push('Row for "' + value + '": parent "' + parent + '" is not a defined TAXONOMY VALUE.');
    else (edges[parent] = edges[parent] || []).push(value);
  }
  const cyc = detectCycle(nodes, parentOf);
  if (cyc) errors.push('Cycle detected at "' + cyc + '" (a node is its own ancestor).');
  else if (!roots.length) errors.push('No root rows: at least one row must have an empty PARENT TAXONOMY VALUE.');

  if (errors.length) return { ok: false, errors: errors.slice(0, 100) };
  return { ok: true, dataset: { taxonomyNodes: nodes, edges, siteRoots: roots }, stats: { nodes: Object.keys(nodes).length, roots: roots.length } };
}

// Serialise a dataset's taxonomy to the 5-column CSV, DFS pre-order from siteRoots so the
// hierarchy reads top-down. Unreachable nodes (none in a valid tree) are appended defensively.
export function taxonomyToCSV(dataset) {
  const nodes = (dataset && dataset.taxonomyNodes) || {};
  const edges = (dataset && dataset.edges) || {};
  const roots = (dataset && dataset.siteRoots) || [];
  const parentOf = Object.create(null); // null-proto: child values are untrusted (see parseTaxonomyCSV)
  for (const p in edges) for (const c of (edges[p] || [])) parentOf[c] = p;
  const H = ['TAXONOMY VALUE', 'TAXONOMY TYPE', 'CODE', 'DESCRIPTION', 'PARENT TAXONOMY VALUE'];
  const lines = [H.map(csvCell).join(',')];
  const emitted = new Set();
  const emit = (v) => {
    const n = nodes[v] || {};
    lines.push([v, n.type || '', n.code || '', n.desc || '', parentOf[v] || ''].map(csvCell).join(','));
    emitted.add(v);
  };
  const stack = [...roots].reverse();                   // iterative DFS (no recursion-depth limit)
  while (stack.length) {
    const v = stack.pop();
    if (emitted.has(v)) continue;
    emit(v);
    const kids = edges[v] || [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);   // preserve child order
  }
  for (const v of Object.keys(nodes)) if (!emitted.has(v)) emit(v);
  return lines.join('\r\n');
}
