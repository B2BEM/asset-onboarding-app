// ERP profile adapter unit gate. Run: node test/erpProfile.test.js (exit 0 = pass)
import fs from 'node:fs';
import { initData } from '../src/shared/domain/data.js';
import { withSession } from '../src/shared/domain/session.js';
import { CSV_HEADERS, buildCSV } from '../src/shared/domain/csv.js';
import * as EP from '../src/client/erpProfile.js';

let failures = 0;
function check(name, cond, detail){ if(cond) console.log('PASS', name); else { failures++; console.error('FAIL', name, detail == null ? '' : JSON.stringify(detail)); } }

const mem = {};
EP.setStore({ getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } });

const def = EP.getActive();
check('default seeded: iso + builtIn', def && def.mode === 'iso' && def.builtIn === true, def && { mode: def.mode, builtIn: def.builtIn });
check('default columns mirror CSV_HEADERS (all included)', def.columns.length === CSV_HEADERS.length && def.columns.every(c => c.include), def.columns.length);
check('normHeader strips case + punctuation', EP.normHeader('Asset / Tag  Name') === 'assettagname', EP.normHeader('Asset / Tag  Name'));
check('templateHeaders returns included headers', EP.templateHeaders(def).length === def.columns.length, EP.templateHeaders(def).length);

const dup = EP.duplicateProfile('b2bem-iso');
check('duplicate is not builtIn', dup.builtIn === false, dup.builtIn);
check('duplicate got new id', dup.id !== 'b2bem-iso', dup.id);
check('cannot delete builtIn', EP.deleteProfile('b2bem-iso') === false, null);
check('can delete a copy', EP.deleteProfile(dup.id) === true, null);

// full-schema presets (spec §3.3): counts, order anchors, required flags, source validity
const oc = EP.newProfile('oracle-fusion-classic');
check('oracle classic: 422 columns', oc.columns.length === 422, oc.columns.length);
check('oracle classic: 7 required', oc.columns.filter(c => c.required).length === 7, oc.columns.filter(c => c.required).map(c => c.header));
check('oracle classic: iso mode', oc.mode === 'iso', oc.mode);
check('oracle classic: first/last headers', oc.columns[0].header === 'Interface Line Number' && oc.columns[421].header === 'YTD Annuity Interest',
  [oc.columns[0].header, oc.columns[oc.columns.length - 1].header]);
check('oracle classic: unique headers', new Set(oc.columns.map(c => c.header)).size === 422, null);
const or = EP.newProfile('oracle-fusion-redwood');
check('oracle redwood: iso mode + has required', or.mode === 'iso' && or.columns.some(c => c.required), null);
check('oracle redwood: headers subset of classic + distribution pair',
  or.columns.every(c => ['Depreciation Expense Account', 'Location'].includes(c.header) || oc.columns.some(x => x.header === c.header)), null);
const px = EP.newProfile('pronto');
check('pronto: 27 columns', px.columns.length === 27, px.columns.length);
check('pronto: display-only excluded', px.columns.filter(c => !c.include).length === 3, px.columns.filter(c => !c.include).map(c => c.header));
check('pronto: iso mode', px.mode === 'iso', px.mode);
// every non-custom source must be a real catalogue field (CSV_HEADERS entry)
const validSrc = new Set(CSV_HEADERS);
[oc, or, px].forEach(p => check('sources valid: ' + p.erpType,
  p.columns.every(c => c.source === 'custom' || validSrc.has(c.source)),
  p.columns.filter(c => c.source !== 'custom' && !validSrc.has(c.source)).map(c => c.source)));

// import auto-guess + saved mapping + remap
const dprof = EP.getActive(); // default iso
const guess = EP.autoGuess(['ASSET / TAG NAME', 'Weird Col'], dprof);
check('autoGuess maps canonical 1:1', guess.map['ASSET / TAG NAME'] === 'ASSET / TAG NAME', guess.map);
check('autoGuess leaves unknown null', guess.map['Weird Col'] === null, guess.map);
check('autoGuess allSaved=false while guessing', guess.allSaved === false, guess.allSaved);
check('autoGuess allExact=false with unknown header', guess.allExact === false, guess.allExact);
check('autoGuess allExact=true for canonical headers', EP.autoGuess(['ASSET / TAG NAME', 'MAKE'], dprof).allExact === true, null);
check('autoGuess alias hit is not exact', (() => { const g = EP.autoGuess(['Asset Number'], dprof); return g.map['Asset Number'] === 'ASSET / TAG NAME' && g.allExact === false; })(), EP.autoGuess(['Asset Number'], dprof));
const ocProf = EP.saveProfile(EP.newProfile('oracle-fusion-classic'));
check('autoGuess resolves profile column header to its source', EP.autoGuess(['Serial Number'], ocProf).map['Serial Number'] === 'SERIAL NO.', EP.autoGuess(['Serial Number'], ocProf).map);
EP.deleteProfile(ocProf.id);
EP.saveImportMap(dprof, { 'Weird Col': 'SPECIFIC ASSET DESCRIPTION' });
const g2 = EP.autoGuess(['Weird Col'], EP.getActive());
check('saved import mapping is reused (allSaved)', g2.map['Weird Col'] === 'SPECIFIC ASSET DESCRIPTION' && g2.allSaved === true, g2);
EP.saveImportMap(EP.getActive(), { 'Junk Col': null });
const g3 = EP.autoGuess(['Junk Col'], EP.getActive());
check('ignored header is remembered (no re-prompt)', g3.map['Junk Col'] === null && g3.allSaved === true, g3);
const grid = [['ASSET / TAG NAME', 'Weird Col'], ['PUMP 01', 'hello'], ['', '']];
const canon = EP.remapGrid(grid, { 'ASSET / TAG NAME': 'ASSET / TAG NAME', 'Weird Col': 'SPECIFIC ASSET DESCRIPTION' });
check('remapGrid renames to canonical headers', canon[0].join('|') === 'ASSET / TAG NAME|SPECIFIC ASSET DESCRIPTION', canon[0]);
check('remapGrid keeps row data', canon[1].join('|') === 'PUMP 01|hello', canon[1]);
const fprof = EP.newProfile('generic');
const frMapped = EP.remapFlatRows([['A', 'B'], ['x1', 'y1']], { A: fprof.columns[0].key, B: fprof.columns[2].key }, fprof);
check('remapFlatRows keys values by column key', frMapped.length === 1 && frMapped[0].values[fprof.columns[0].key] === 'x1' && frMapped[0].values[fprof.columns[2].key] === 'y1' && frMapped[0].values[fprof.columns[1].key] === '', frMapped);

// flat export: BOM + CRLF + header row + values by column key
const flat = EP.newProfile('generic');
const frows = [{ id: 'f1', values: {} }];
flat.columns.forEach((c, i) => { frows[0].values[c.key] = 'v' + i; });
const flatCsv = EP.buildProfileCSV(flat, { rows: frows });
check('flat CSV starts with BOM', flatCsv.charCodeAt(0) === 0xFEFF, flatCsv.charCodeAt(0));
const flatLines = flatCsv.replace(/^﻿/, '').split('\r\n');
check('flat CSV header = included headers', flatLines[0] === flat.columns.filter(c => c.include).map(c => c.header).join(','), flatLines[0]);
check('flat CSV data row in column order', flatLines[1] === flat.columns.map((c, i) => 'v' + i).join(','), flatLines[1]);

// iso reprojection (needs data + a bound session)
initData(JSON.parse(fs.readFileSync('data/seed-dataset.json', 'utf8')));
const siteRow = { action: 'add', parent: null, levels: [], tag: 'SITE1', desc: 'Example site',
  classification: 'REFERENCE', classOverride: 'REFERENCE', assetNo: 'SITE1', info: { make: 'ACME' }, bom: [] };
withSession({ rows: [siteRow], PROJECT: { pm: '', number: '', start: '', end: '' }, BOM_EXISTING: [], NEW_TAX: [] }, () => {
  const iso = { id: 'x', name: 'x', erpType: 'other', mode: 'iso', builtIn: false,
    columns: [
      { key: 'a', header: 'Name', source: 'ASSET / TAG NAME', include: true, required: false },
      { key: 'b', header: 'Maker', source: 'MAKE', include: true, required: false },
      { key: 'c', header: 'Blank', source: 'custom', include: true, required: false }
    ], importMap: {} };
  const lines = EP.buildProfileCSV(iso, { buildCSV }).replace(/^﻿/, '').split('\r\n').filter(Boolean);
  check('iso reprojection renames headers', lines[0] === 'Name,Maker,Blank', lines[0]);
  check('iso reprojection maps values + blanks custom cols', lines[1] === 'SITE1,ACME,', lines[1]);
});

if(failures){ console.error('ERP GATE: FAIL —', failures); process.exit(1); }
console.log('ERP GATE: PASS');
