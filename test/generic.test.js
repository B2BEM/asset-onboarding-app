// Generic rule-regression test — replaces the retired original-parity harness (see archive/) as `npm test`.
// Exercises the frozen domain modules against the shipped generic seed plus a tiny
// user-built hierarchy (top-level site row → classed child row) on the empty register.
// Run: node test/generic.test.js   (exit 0 = pass)
import fs from 'node:fs';
import { initData, ROOTS, NODES } from '../src/shared/domain/data.js';
import { withSession } from '../src/shared/domain/session.js';
import { childrenOfRules } from '../src/shared/domain/cascade.js';
import { computeForRow } from '../src/shared/domain/engine.js';
import { infoMissing } from '../src/shared/domain/fields.js';
import { CSV_HEADERS, buildCSV, buildBOMCSV, buildTaxCSV } from '../src/shared/domain/csv.js';

let failures = 0;
function check(name, cond, detail){
  if(cond){ console.log('PASS', name); }
  else { failures++; console.error('FAIL', name, detail==null?'':JSON.stringify(detail)); }
}

initData(JSON.parse(fs.readFileSync('data/seed-dataset.json', 'utf8')));

// --- dataset shape: taxonomy kept, register empty
check('taxonomy kept (839 nodes)', Object.keys(NODES).length === 839, Object.keys(NODES).length);
check('siteRoots kept (40)', ROOTS.length === 40, ROOTS.length);
const B_I = '<BUILDINGS & INFRASTRUCTURE>';
check('cascade: B&I root has 23 children', childrenOfRules(B_I, []).length === 23, childrenOfRules(B_I, []).length);

// --- user-built hierarchy on the empty register
const PROJECT = { pm:'', number:'', start:'', end:'' };
const siteRow = { action:'add', parent:null, levels:[], tag:'SITE1', desc:'Example site',
  classification:'REFERENCE', classOverride:'REFERENCE', assetNo:'SITE1', info:{}, bom:[] };
const childRow = { action:'add', parent:'SITE1', levels:[B_I, '*BUILDING - *OFFICE'], tag:'', desc:'', info:{}, bom:[] };

withSession({ rows:[siteRow, childRow], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  const site = computeForRow(siteRow);
  check('site row: assetNo = tag', site.assetNo === 'SITE1', site.assetNo);
  check('site row: parentless rows exempt from §LVL (no blocking issues)', !site.hasHigh, site.issues);
  check('site row: level-1 classification forced SITE', site.cls === 'SITE', site.cls);

  const child = computeForRow(childRow);
  check('child row: numbering SITE1-BLD01', child.assetNo === 'SITE1-BLD01', child.assetNo);
  check('child row: level-2 classification forced ASSET CLASS', child.cls === 'ASSET CLASS', child.cls);
  check('child row: abbreviation OB', child.abbr === 'OB', child.abbr);
  check('child row: no issues', child.issues.length === 0, child.issues);

  const csv = buildCSV().split('\r\n');
  check('onboarding CSV: header + 2 rows', csv.length === 3, csv.length);
  check('BOM CSV builds', buildBOMCSV().length > 0);
  check('taxonomy CSV builds', buildTaxCSV().length > 0);
});

// --- §LVL is KEPT for real assets (structure level ≥4) with too-shallow taxonomy
const clsRow = { action:'add', parent:'SITE1', levels:[B_I], tag:'', desc:'', assetNo:'SITE1-B&I', info:{}, bom:[] };
const subRow = { action:'add', parent:'SITE1-B&I', levels:[B_I, '*BUILDING - *OFFICE'], tag:'', desc:'', assetNo:'SITE1-B&I-BLD01', info:{}, bom:[] };
const shallowRow = { action:'add', parent:'SITE1-B&I-BLD01', levels:[B_I], tag:'X', desc:'', info:{}, bom:[] };
withSession({ rows:[siteRow, clsRow, subRow, shallowRow], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('level-2/3 structure rows exempt from §LVL', !computeForRow(clsRow).hasHigh && !computeForRow(subRow).hasHigh,
    computeForRow(clsRow).issues.concat(computeForRow(subRow).issues));
  const shallow = computeForRow(shallowRow);
  check('level-4 row above taxonomy Level 4 still blocks (§LVL kept)',
    shallow.issues.some(i => i.rule === 'LVL' && i.severity === 'high'), shallow.issues);
});

// --- ISO 55001 asset attributes: optional (warn-if-missing, never block), CSV columns present
const ISO_COLS = ['CRITICALITY','CONDITION','LIFE-CYCLE STAGE','ASSET FUNCTION / PURPOSE','VALUE TO ORGANIZATION'];
ISO_COLS.forEach(c => check('CSV header includes '+c, CSV_HEADERS.includes(c), null));

// item asset sits at structure level 4 (under the Sub Class) — ISO attribute warnings apply there
const itemRow = { action:'add', parent:'SITE1-B&I-BLD01', levels:[B_I, '*BUILDING - *OFFICE'], tag:'', desc:'',
  classification:'EQUIPMENT GROUP - EQUIPMENT TYPE', classOverride:'EQUIPMENT GROUP - EQUIPMENT TYPE', info:{}, bom:[] };
withSession({ rows:[siteRow, clsRow, subRow, itemRow], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  const miss = infoMissing(itemRow);
  ['isoCriticality','isoCondition','isoLifecycle','isoFunction','isoValue']
    .forEach(k => check('infoMissing flags '+k, miss.includes(k), miss));
  const item = computeForRow(itemRow);
  const infoIssue = item.issues.find(i => i.rule === 'INFO');
  check('missing ISO attributes warn (medium), never block', !!infoIssue && infoIssue.severity === 'medium' && !item.hasHigh, item.issues);
});

if(failures){ console.error('GENERIC GATE: FAIL —', failures, 'check(s)'); process.exit(1); }
console.log('GENERIC GATE: PASS');
