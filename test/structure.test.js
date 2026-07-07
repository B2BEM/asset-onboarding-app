// Register-structure gate — roleOfLevel / structureComplete / level-forced classification
// (design 2026-07-07, company level). Structure level = parent-chain depth across register
// assets AND session rows; levels 1–3 force CLASSIFICATION to the role name.
// Run: node test/structure.test.js   (exit 0 = pass)
import fs from 'node:fs';
import { initData, ASSETS, assetLevel } from '../src/shared/domain/data.js';
import { withSession } from '../src/shared/domain/session.js';
import { STRUCTURE_ROLES, roleOfLevel, structureComplete } from '../src/shared/domain/structure.js';
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

if(failures){ console.error('STRUCTURE GATE: FAIL —', failures, 'check(s)'); process.exit(1); }
console.log('STRUCTURE GATE: PASS');
