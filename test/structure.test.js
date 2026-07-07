// Register-structure gate — roleOfLevel / structureComplete / level-forced classification
// (design 2026-07-07, company level). Structure level = parent-chain depth across register
// assets AND session rows; levels 1–3 force CLASSIFICATION to the role name.
// Run: node test/structure.test.js   (exit 0 = pass)
import fs from 'node:fs';
import { initData, ASSETS, assetLevel } from '../src/shared/domain/data.js';
import { withSession } from '../src/shared/domain/session.js';
import { STRUCTURE_ROLES, roleOfLevel, structureComplete, hierarchyOrder, inSiteScope } from '../src/shared/domain/structure.js';
import { computeForRow, rowStructLevel } from '../src/shared/domain/engine.js';

let failures = 0;
function check(name, cond, detail){
  if(cond){ console.log('PASS', name); }
  else { failures++; console.error('FAIL', name, detail==null?'':JSON.stringify(detail)); }
}

// --- roleOfLevel
check('roleOfLevel(1) = COMPANY', roleOfLevel(1) === 'COMPANY');
check('roleOfLevel(2) = SITE', roleOfLevel(2) === 'SITE');
check('roleOfLevel(3) = ASSET CLASS', roleOfLevel(3) === 'ASSET CLASS');
check('roleOfLevel(4) = ASSET', roleOfLevel(4) === 'ASSET');
check('roleOfLevel(9) = ASSET', roleOfLevel(9) === 'ASSET');
check('STRUCTURE_ROLES = [COMPANY, SITE, ASSET CLASS]',
  JSON.stringify(STRUCTURE_ROLES) === JSON.stringify(['COMPANY','SITE','ASSET CLASS']));

initData(JSON.parse(fs.readFileSync('data/seed-dataset.json', 'utf8')));   // taxonomy kept, register empty

const PROJECT = { pm:'', number:'', start:'', end:'' };
const B_I = '<BUILDINGS & INFRASTRUCTURE>';
const co   = { action:'add', parent:null, levels:[], tag:'CO1', desc:'Example company', assetNo:'CO1', info:{}, bom:[] };
const site = { action:'add', parent:'CO1', levels:[], tag:'S1', desc:'Example site', assetNo:'CO1-S1', info:{}, bom:[] };
const cls  = { action:'add', parent:'CO1-S1', levels:[B_I], tag:'', desc:'', assetNo:'CO1-S1-B&I', info:{}, bom:[] };
const leaf = { action:'add', parent:'CO1-S1-B&I', levels:[B_I,'*BUILDING - *OFFICE'], tag:'UNIT 1', desc:'', info:{}, bom:[] };

// entries are register assets (have .no) or session rows
const levelOf = e => e.no ? assetLevel(e.no) : rowStructLevel(e);

// --- structureComplete over session rows
withSession({ rows:[], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('structureComplete: no entries → false', structureComplete(levelOf, []) === false);
});
withSession({ rows:[co, site], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('partial chain (Company ▸ Site) → false', structureComplete(levelOf, [co, site]) === false);
});
withSession({ rows:[co, site, cls], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('full chain (Company ▸ Site ▸ Class) → true', structureComplete(levelOf, [co, site, cls]) === true);
  check('structure levels: company=1 site=2 class=3',
    rowStructLevel(co) === 1 && rowStructLevel(site) === 2 && rowStructLevel(cls) === 3,
    [rowStructLevel(co), rowStructLevel(site), rowStructLevel(cls)]);
});

// --- classification forcing: levels 1–3 forced to role, level ≥4 taxonomy-derived
withSession({ rows:[co, site, cls, leaf], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('level 1 forced COMPANY', computeForRow(co).cls === 'COMPANY', computeForRow(co).cls);
  check('level 2 forced SITE', computeForRow(site).cls === 'SITE', computeForRow(site).cls);
  check('level 3 forced ASSET CLASS', computeForRow(cls).cls === 'ASSET CLASS', computeForRow(cls).cls);
  check('rowStructLevel(leaf) = 4', rowStructLevel(leaf) === 4, rowStructLevel(leaf));
  const l4 = computeForRow(leaf);
  check('level 4 keeps taxonomy-derived classification', STRUCTURE_ROLES.indexOf(l4.cls) < 0, l4.cls);
  check('structure rows carry no blocking issues (§LVL exempt)',
    !computeForRow(site).hasHigh && !computeForRow(cls).hasHigh,
    computeForRow(site).issues.concat(computeForRow(cls).issues));
});

// --- chain spanning register + session: register Company ▸ Site, session Asset Class
initData({ taxonomyNodes:{}, edges:{}, siteRoots:[], departments:[], sites:[], locationOverrides:[], takenNos:[],
  existingAssets:[ { no:'RS', desc:'REGISTER COMPANY', parent:'' }, { no:'RS-FL', desc:'FLEET SITE', parent:'RS' } ] });
const sessCls = { action:'add', parent:'RS-FL', levels:[], tag:'HV', desc:'Heavy vehicles', assetNo:'RS-FL-HV', info:{}, bom:[] };
withSession({ rows:[sessCls], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('register levels: RS=1, RS-FL=2', assetLevel('RS') === 1 && assetLevel('RS-FL') === 2, [assetLevel('RS'), assetLevel('RS-FL')]);
  check('session class under register site = level 3', rowStructLevel(sessCls) === 3, rowStructLevel(sessCls));
  check('register-only entries (Company ▸ Site) → false', structureComplete(levelOf, ASSETS.slice()) === false);
  check('chain spanning register+session → true', structureComplete(levelOf, ASSETS.concat([sessCls])) === true);
  check('spanning class forced ASSET CLASS', computeForRow(sessCls).cls === 'ASSET CLASS', computeForRow(sessCls).cls);
});

// --- hierarchyOrder: children display under their parent regardless of entry order
{
  // entry order: company, south, class-under-south, north (the bug report's scenario)
  const E = [
    { no:'B2BE',         parent:'' },
    { no:'B2BE-STH',     parent:'B2BE' },
    { no:'B2BE-STH-B&I', parent:'B2BE-STH' },
    { no:'B2BE-NTH',     parent:'B2BE' },
  ];
  const o = hierarchyOrder(E).map(i => E[i].no);
  check('order: north follows the site block, under company',
    JSON.stringify(o) === JSON.stringify(['B2BE','B2BE-STH','B2BE-STH-B&I','B2BE-NTH']), o);

  const shuffled = [E[2], E[3], E[0], E[1]];   // class, north, company, south
  const o2 = hierarchyOrder(shuffled).map(i => shuffled[i].no);
  check('order: scrambled entry order still cascades from LVL 1',
    o2[0] === 'B2BE' && o2.indexOf('B2BE-STH') < o2.indexOf('B2BE-STH-B&I') && o2.length === 4, o2);
}
{
  const E = [ { no:'RS-FL-HV', parent:'RS-FL' }, { no:'X', parent:'' } ];   // register parent RS-FL not in entries
  const o = hierarchyOrder(E);
  check('order: register-parented row roots its own subtree, input order kept',
    JSON.stringify(o) === JSON.stringify([0,1]), o);
}
{
  const E = [ { no:'A', parent:'B' }, { no:'B', parent:'A' } ];   // parent cycle — no root
  const o = hierarchyOrder(E);
  check('order: cycle-safe — each emitted once, input order',
    JSON.stringify([...o].sort()) === JSON.stringify([0,1]) && o.length === 2, o);
}

// --- inSiteScope: selected site shows its subtree + ancestors; other sites hidden
{
  const P = { 'B2BE':'', 'B2BE-STH':'B2BE', 'B2BE-NTH':'B2BE', 'B2BE-STH-B&I':'B2BE-STH', 'B2BE-STH-B&I-U1':'B2BE-STH-B&I' };
  const parentOf = n => P[n] || '';
  const S = 'B2BE-STH';
  check('scope: site row itself visible', inSiteScope({no:'B2BE-STH', parent:'B2BE'}, S, parentOf) === true);
  check('scope: child + grandchild visible',
    inSiteScope({no:'B2BE-STH-B&I', parent:'B2BE-STH'}, S, parentOf) && inSiteScope({no:'B2BE-STH-B&I-U1', parent:'B2BE-STH-B&I'}, S, parentOf));
  check('scope: company (ancestor of site) visible', inSiteScope({no:'B2BE', parent:''}, S, parentOf) === true);
  check('scope: sibling site hidden', inSiteScope({no:'B2BE-NTH', parent:'B2BE'}, S, parentOf) === false);
  check('scope: no site selected → everything visible', inSiteScope({no:'B2BE-NTH', parent:'B2BE'}, '', parentOf) === true);
  check('scope: unresolvable entry hidden under a site', inSiteScope({no:'', parent:''}, S, parentOf) === false);
}
{
  // chain spanning the register/session seam: session class under register site RS-FL
  const P = { 'RS':'', 'RS-FL':'RS', 'RS-P2':'RS', 'RS-FL-HV':'RS-FL' };
  const parentOf = n => P[n] || '';
  check('scope: session class under register site visible for that site',
    inSiteScope({no:'RS-FL-HV', parent:'RS-FL'}, 'RS-FL', parentOf) === true);
  check('scope: same class hidden for the other register site',
    inSiteScope({no:'RS-FL-HV', parent:'RS-FL'}, 'RS-P2', parentOf) === false);
}

if(failures){ console.error('STRUCTURE GATE: FAIL —', failures, 'check(s)'); process.exit(1); }
console.log('STRUCTURE GATE: PASS');
