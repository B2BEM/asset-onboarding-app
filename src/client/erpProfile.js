// Client-layer I/O adapter for ERP profiles. The frozen shared/domain engine is
// untouched; this module only adapts CSV in/out around it. Storage is pluggable so
// the same code runs in the browser (localStorage) and in Node tests (memory).
import { CSV_HEADERS, csvCell, buildCSV, CSV_BOM } from '../shared/domain/csv.js';
import { oracleClassicColumns, oracleRedwoodColumns, prontoXiColumns } from './erpSchemas.js';

const LS_PROFILES = 'erp.profiles';
const LS_ACTIVE = 'erp.activeId';

let _store = (typeof localStorage !== 'undefined')
  ? localStorage
  : (() => { const m = {}; return {
      getItem: k => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: k => { delete m[k]; }
    }; })();
export function setStore(s){ _store = s; }

let _seq = 0;
export function newId(prefix){ _seq++; return (prefix || 'erp') + '-' + Date.now().toString(36) + '-' + _seq.toString(36); }
export function normHeader(h){ return String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]+/g, ''); }

export function seedDefault(){
  return {
    id: 'b2bem-iso', name: 'B2BEM ISO 55001', erpType: 'b2bem-iso',
    mode: 'iso', builtIn: true,
    columns: CSV_HEADERS.map((h, i) => ({ key: 'c' + i, header: h, source: h, include: true, required: false })),
    importMap: {}
  };
}

export const FLAT_STARTER = ['Asset No', 'Tag / Name', 'Description', 'Location', 'Parent', 'Status'];
// Oracle classic/redwood + Pronto ship their REAL full column schemas (spec §3.3),
// encoded data-only in erpSchemas.js; `schema` builders return the official ordered
// column set. These presets are mode:'iso' (ISO-reproject on export). SAP PM / Maximo /
// Generic / Other remain lightweight flat starters, to be completed later.
export const PRESETS = {
  'b2bem-iso':             { name: 'B2BEM ISO 55001', mode: 'iso' },
  'oracle-fusion-classic': { name: 'Oracle Cloud Fusion — FBDI (classic)', mode: 'iso', schema: oracleClassicColumns },
  'oracle-fusion-redwood': { name: 'Oracle Cloud Fusion — Redwood (simplified)', mode: 'iso', schema: oracleRedwoodColumns },
  'pronto':                { name: 'Pronto Xi (Fixed Assets)', mode: 'iso', schema: prontoXiColumns },
  'generic':   { name: 'Generic ERP', mode: 'flat', headers: FLAT_STARTER },
  'sap-pm':    { name: 'SAP PM', mode: 'flat', headers: FLAT_STARTER },
  'maximo':    { name: 'IBM Maximo', mode: 'flat', headers: FLAT_STARTER },
  'other':     { name: 'Other', mode: 'flat', headers: ['Asset No', 'Description'] }
};

export function newProfile(erpType){
  if(erpType === 'b2bem-iso'){ const d = seedDefault(); d.id = newId('erp'); d.name = 'B2BEM ISO 55001 (copy)'; d.builtIn = false; return d; }
  const p = PRESETS[erpType] || PRESETS.generic;
  if(p.schema){
    return {
      id: newId('erp'), name: p.name, erpType, mode: p.mode, builtIn: false,
      columns: p.schema().map((c, i) => ({ key: 'c' + i, header: c.header, source: c.source, include: c.include, required: c.required })),
      importMap: {}
    };
  }
  return {
    id: newId('erp'), name: p.name, erpType, mode: p.mode, builtIn: false,
    columns: (p.headers || FLAT_STARTER).map((h, i) => ({ key: 'c' + i, header: h, source: 'custom', include: true, required: i < 2 })),
    importMap: {}
  };
}

export function listProfiles(){
  let arr;
  try { arr = JSON.parse(_store.getItem(LS_PROFILES) || 'null'); } catch(_) { arr = null; }
  if(!Array.isArray(arr) || !arr.length){ arr = [seedDefault()]; _store.setItem(LS_PROFILES, JSON.stringify(arr)); }
  return arr;
}
export function getActive(){
  const arr = listProfiles();
  return arr.find(p => p.id === _store.getItem(LS_ACTIVE)) || arr[0];
}
export function setActive(id){ _store.setItem(LS_ACTIVE, id); }
export function saveProfile(profile){
  const arr = listProfiles();
  const i = arr.findIndex(p => p.id === profile.id);
  if(i >= 0) arr[i] = profile; else arr.push(profile);
  _store.setItem(LS_PROFILES, JSON.stringify(arr));
  return profile;
}
export function deleteProfile(id){
  let arr = listProfiles();
  const p = arr.find(x => x.id === id);
  if(!p || p.builtIn) return false;
  arr = arr.filter(x => x.id !== id);
  _store.setItem(LS_PROFILES, JSON.stringify(arr));
  if(_store.getItem(LS_ACTIVE) === id) setActive(arr[0].id);
  return true;
}
export function duplicateProfile(id){
  const src = listProfiles().find(p => p.id === id) || seedDefault();
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = newId('erp'); copy.name = src.name + ' (copy)'; copy.builtIn = false;
  return saveProfile(copy);
}
// Selectable value sources: ISO mode exposes the canonical export columns (CSV_HEADERS,
// which already include the ASSET DETAILS info fields); flat mode exposes the profile's
// own columns. Used by the setup source dropdown and as import-mapping targets.
export function catalogue(profile){
  if(profile.mode === 'flat') return profile.columns.map(c => ({ id: c.key, label: c.header }));
  return CSV_HEADERS.map(h => ({ id: h, label: h }));
}
export function templateHeaders(profile){
  return profile.columns.filter(c => c.include).map(c => c.header);
}

export function parseCSV(text){
  const rows = []; let row = [], field = '', q = false, i = 0;
  text = String(text).replace(/^﻿/, '');
  while(i < text.length){
    const c = text[i];
    if(q){
      if(c === '"'){ if(text[i + 1] === '"'){ field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if(c === '"'){ q = true; i++; continue; }
    if(c === ','){ row.push(field); field = ''; i++; continue; }
    if(c === '\r'){ i++; continue; }
    if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if(field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows;
}

const ALIASES = {
  assetnumber: 'ASSET / TAG NAME', assetno: 'ASSET / TAG NAME', assetid: 'ASSET / TAG NAME',
  tag: 'ASSET / TAG NAME', tagname: 'ASSET / TAG NAME', name: 'ASSET / TAG NAME',
  description: 'SPECIFIC ASSET DESCRIPTION', desc: 'SPECIFIC ASSET DESCRIPTION',
  parent: 'SELECT PARENT ASSET', parentasset: 'SELECT PARENT ASSET',
  manufacturer: 'MAKE', serialnumber: 'SERIAL NO.', serialno: 'SERIAL NO.'
};

// Resolve foreign CSV headers to import targets: (a) the profile's saved importMap,
// (b) exact normalized matches against the catalogue AND the profile's own column
// headers (an ISO column header resolves to its configured source), (c) fuzzy ALIASES.
// allSaved: every header came from the saved map. allExact: every header resolved
// without aliases — either lets the caller import without showing the mapping modal.
export function autoGuess(foreignHeaders, profile){
  const cat = catalogue(profile);
  const byNorm = {};
  cat.forEach(c => { byNorm[normHeader(c.label)] = c.id; byNorm[normHeader(c.id)] = c.id; });
  profile.columns.forEach(c => {
    const target = profile.mode === 'flat' ? c.key : c.source;
    if(!target || target === 'custom') return;
    const nk = normHeader(c.header);
    if(!(nk in byNorm)) byNorm[nk] = target;
  });
  const valid = new Set(cat.map(c => c.id));
  const saved = profile.importMap || {};
  const map = {}; let allSaved = foreignHeaders.length > 0, allExact = foreignHeaders.length > 0;
  for(const h of foreignHeaders){
    const nk = normHeader(h);
    if(nk in saved){
      const t = saved[nk];
      if(t === ''){ map[h] = null; continue; }              // remembered "Ignore"
      if(valid.has(t)){ map[h] = t; continue; }
    }
    allSaved = false;
    map[h] = byNorm[nk] || (valid.has(ALIASES[nk]) ? ALIASES[nk] : null);
    if(!byNorm[nk]) allExact = false;
  }
  return { map, allSaved, allExact };
}

// Ignored headers persist as '' so a re-import of the same file needs no modal.
export function saveImportMap(profile, confirmedMap){
  profile.importMap = profile.importMap || {};
  for(const h in confirmedMap){ profile.importMap[normHeader(h)] = confirmedMap[h] || ''; }
  saveProfile(profile);
  return profile;
}

// ISO: produce a canonical grid ([headers, ...rows]) the existing importer understands.
export function remapGrid(grid, mapping){
  const fHeaders = grid[0] || [];
  const keep = [];
  fHeaders.forEach((h, idx) => { const t = mapping[h]; if(t) keep.push({ idx, target: t }); });
  return [keep.map(k => k.target)].concat(grid.slice(1).map(r => keep.map(k => (r[k.idx] == null ? '' : r[k.idx]))));
}

// Flat: produce row objects keyed by the profile column keys.
export function remapFlatRows(grid, mapping, profile){
  const fHeaders = grid[0] || [];
  const idxByTarget = {}; fHeaders.forEach((h, idx) => { const t = mapping[h]; if(t) idxByTarget[t] = idx; });
  return grid.slice(1).filter(r => r.some(c => (c || '').trim() !== '')).map((r, n) => {
    const values = {};
    profile.columns.forEach(c => { const idx = idxByTarget[c.key]; values[c.key] = idx == null ? '' : (r[idx] || ''); });
    return { id: 'f' + Date.now().toString(36) + n, values };
  });
}

// ISO custom profiles reproject the canonical buildCSV() output (parity with the
// server's semantics by construction); columns whose source is 'custom' emit blank.
// Flat profiles read row.values directly. Both emit UTF-8 BOM + CRLF via csvCell.
export function buildProfileCSV(profile, opts){
  opts = opts || {};
  const cols = profile.columns.filter(c => c.include);
  const line = arr => arr.map(csvCell).join(',');
  if(profile.mode === 'flat'){
    const body = (opts.rows || []).map(r => cols.map(c => (r.values && r.values[c.key]) || ''));
    return CSV_BOM + [cols.map(c => c.header)].concat(body).map(line).join('\r\n') + '\r\n';
  }
  const canonical = parseCSV((opts.buildCSV || buildCSV)());
  const cHeaders = canonical[0] || [];
  const idxOf = {}; cHeaders.forEach((h, i) => { idxOf[h] = i; });
  const out = [cols.map(c => c.header)];
  canonical.slice(1).forEach(r => out.push(cols.map(c => { const i = idxOf[c.source]; return i == null ? '' : (r[i] || ''); })));
  return CSV_BOM + out.map(line).join('\r\n') + '\r\n';
}

// "Adopt this file's format": build a flat profile whose columns ARE the loaded CSV's header row
// (in order). Blank headers get a positional name so every column is valid; duplicates are allowed
// (records key by column position, not header text — see flatRowsFromGrid). Nothing is saved here.
export function profileFromHeaders(headers, name){
  const cols = (headers || []).map((h, i) => {
    const header = String(h == null ? '' : h).trim() || ('Column ' + (i + 1));
    return { key: 'c' + i, header, source: 'custom', include: true, required: false };
  });
  if(!cols.length) cols.push({ key: 'c0', header: 'Column 1', source: 'custom', include: true, required: false });
  return { id: newId('erp'), name: (name && String(name).trim()) || 'Imported format', erpType: 'adopted',
    mode: 'flat', builtIn: false, columns: cols, importMap: {} };
}

// Build flat records straight from a grid whose columns line up 1:1 with the profile's columns
// (the adopt case). Positional, so it is robust to duplicate/blank headers where header-string
// mapping would collide. Blank data rows are dropped; short rows pad missing cells with ''.
export function flatRowsFromGrid(grid, profile){
  const cols = profile.columns;
  return (grid || []).slice(1).filter(r => r.some(c => (c || '').trim() !== '')).map((r, n) => {
    const values = {};
    cols.forEach((c, i) => { values[c.key] = (r[i] == null ? '' : r[i]); });
    return { id: 'f' + Date.now().toString(36) + n, values };
  });
}
