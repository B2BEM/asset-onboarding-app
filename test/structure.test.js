// Register-structure gate — roleOfLevel / structureComplete / level-forced classification
// (design 2026-07-06, Workstream 1). Structure level = parent-chain depth across register
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
check('roleOfLevel(1) = SITE', roleOfLevel(1) === 'SITE');
check('roleOfLevel(2) = ASSET CLASS', roleOfLevel(2) === 'ASSET CLASS');
check('roleOfLevel(3) = ASSET SUB CLASS', roleOfLevel(3) === 'ASSET SUB CLASS');
check('roleOfLevel(4) = ASSET', roleOfLevel(4) === 'ASSET');
check('roleOfLevel(9) = ASSET', roleOfLevel(9) === 'ASSET');
check('STRUCTURE_ROLES = [SITE, ASSET CLASS, ASSET SUB CLASS]',
  JSON.stringify(STRUCTURE_ROLES) === JSON.stringify(['SITE','ASSET CLASS','ASSET SUB CLASS']));

initData(JSON.parse(fs.readFileSync('data/seed-dataset.json', 'utf8')));   // taxonomy kept, register empty

const PROJECT = { pm:'', number:'', start:'', end:'' };
const B_I = '<BUILDINGS & INFRASTRUCTURE>';
const site = { action:'add', parent:null, levels:[], tag:'SITE1', desc:'Example site', assetNo:'SITE1', info:{}, bom:[] };
const cls  = { action:'add', parent:'SITE1', levels:[B_I], tag:'', desc:'', assetNo:'SITE1-B&I', info:{}, bom:[] };
const sub  = { action:'add', parent:'SITE1-B&I', levels:[B_I,'*BUILDING - *OFFICE'], tag:'', desc:'', assetNo:'SITE1-B&I-BLD01', info:{}, bom:[] };
const leaf = { action:'add', parent:'SITE1-B&I-BLD01', levels:[B_I,'*BUILDING - *OFFICE'], tag:'UNIT 1', desc:'', info:{}, bom:[] };

// entries are register assets (have .no) or session rows
const levelOf = e => e.no ? assetLevel(e.no) : rowStructLevel(e);

// --- structureComplete over session rows
withSession({ rows:[], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('structureComplete: no entries → false', structureComplete(levelOf, []) === false);
});
withSession({ rows:[site, cls], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('partial chain (Site ▸ Class) → false', structureComplete(levelOf, [site, cls]) === false);
});
withSession({ rows:[site, cls, sub], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('full chain (Site ▸ Class ▸ Sub Class) → true', structureComplete(levelOf, [site, cls, sub]) === true);
  check('structure levels: site=1 class=2 sub=3',
    rowStructLevel(site) === 1 && rowStructLevel(cls) === 2 && rowStructLevel(sub) === 3,
    [rowStructLevel(site), rowStructLevel(cls), rowStructLevel(sub)]);
});

// --- classification forcing: levels 1–3 forced to role, level ≥4 taxonomy-derived
withSession({ rows:[site, cls, sub, leaf], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('level 1 forced SITE', computeForRow(site).cls === 'SITE', computeForRow(site).cls);
  check('level 2 forced ASSET CLASS', computeForRow(cls).cls === 'ASSET CLASS', computeForRow(cls).cls);
  check('level 3 forced ASSET SUB CLASS', computeForRow(sub).cls === 'ASSET SUB CLASS', computeForRow(sub).cls);
  check('rowStructLevel(leaf) = 4', rowStructLevel(leaf) === 4, rowStructLevel(leaf));
  const l4 = computeForRow(leaf);
  check('level 4 keeps taxonomy-derived classification', STRUCTURE_ROLES.indexOf(l4.cls) < 0, l4.cls);
  check('structure rows carry no blocking issues (§LVL exempt)',
    !computeForRow(cls).hasHigh && !computeForRow(sub).hasHigh,
    computeForRow(cls).issues.concat(computeForRow(sub).issues));
});

// --- chain spanning register + session: register Site ▸ Class, session Sub Class
initData({ taxonomyNodes:{}, edges:{}, siteRoots:[], departments:[], sites:[], locationOverrides:[], takenNos:[],
  existingAssets:[ { no:'RS', desc:'REGISTER SITE', parent:'' }, { no:'RS-FL', desc:'FLEET', parent:'RS' } ] });
const sessSub = { action:'add', parent:'RS-FL', levels:[], tag:'HV', desc:'Heavy vehicles', assetNo:'RS-FL-HV', info:{}, bom:[] };
withSession({ rows:[sessSub], PROJECT, BOM_EXISTING:[], NEW_TAX:[] }, () => {
  check('register levels: RS=1, RS-FL=2', assetLevel('RS') === 1 && assetLevel('RS-FL') === 2, [assetLevel('RS'), assetLevel('RS-FL')]);
  check('session sub under register class = level 3', rowStructLevel(sessSub) === 3, rowStructLevel(sessSub));
  check('register-only entries (Site ▸ Class) → false', structureComplete(levelOf, ASSETS.slice()) === false);
  check('chain spanning register+session → true', structureComplete(levelOf, ASSETS.concat([sessSub])) === true);
  check('spanning sub class forced ASSET SUB CLASS', computeForRow(sessSub).cls === 'ASSET SUB CLASS', computeForRow(sessSub).cls);
});

if(failures){ console.error('STRUCTURE GATE: FAIL —', failures, 'check(s)'); process.exit(1); }
console.log('STRUCTURE GATE: PASS');
