// Register import unit gate. Run: node test/registerImport.test.js (exit 0 = pass)
import * as RI from '../src/shared/domain/registerImport.js';
import { csvCell, csvGuard, csvUnguard } from '../src/shared/domain/csv.js';

let failures = 0;
function check(name, cond, detail){ if(cond) console.log('PASS', name); else { failures++; console.error('FAIL', name, detail == null ? '' : JSON.stringify(detail)); } }

// A minimal onboarding-export header: the four required columns + two LEVEL columns.
// parseRegisterCSV only needs the required columns; LEVEL 3..13 are optional detail.
const HDR = 'SELECT PARENT ASSET,ADD ROW?,LEVEL 3,LEVEL 4,ASSET NO (AUTO),ASSET NAME (AUTO)';

// --- valid parse: ADD rows -> records, non-ADD ignored, quoted comma preserved, trailing blank level trimmed
{
  const csv = [
    HDR,
    'B2BE,TRUE,South,,B2BE-STH,South site',
    'B2BE-STH,TRUE,Building,,B2BE-STH-B&I,"Building, & Infrastructure"',
    ',FALSE,,,B2BE-OLD,Should be ignored',
  ].join('\r\n');
  const r = RI.parseRegisterCSV(csv);
  check('valid: ok', r.ok === true, r.errors);
  check('valid: only ADD rows kept', r.ok && r.records.length === 2 && r.stats.rows === 2, r.ok && r.stats);
  const leaf = r.ok && r.records[1];
  check('valid: fields captured', !!leaf && leaf.no === 'B2BE-STH-B&I' && leaf.parent === 'B2BE-STH', leaf);
  check('valid: quoted comma preserved in name', !!leaf && leaf.name === 'Building, & Infrastructure', leaf && leaf.name);
  check('valid: trailing blank level trimmed', !!leaf && JSON.stringify(leaf.levels) === JSON.stringify(['Building']), leaf && leaf.levels);
}

// --- levels captured in order when multiple present
{
  const csv = [HDR, 'P,TRUE,Alpha,Beta,NO1,Name one'].join('\r\n');
  const r = RI.parseRegisterCSV(csv);
  check('levels: order preserved', r.ok && JSON.stringify(r.records[0].levels) === JSON.stringify(['Alpha', 'Beta']), r.ok && r.records[0].levels);
}

// --- skip: ADD row with blank asset no is counted, not rejected
{
  const csv = [HDR, 'P,TRUE,X,,,No id here', 'P,TRUE,Y,,NO2,Has id'].join('\r\n');
  const r = RI.parseRegisterCSV(csv);
  check('skip: blank asset no counted', r.ok && r.records.length === 1 && r.stats.skippedNoId === 1, r.ok && r.stats);
}

// --- dedup: duplicate no within the file, first wins
{
  const csv = [HDR, 'P,TRUE,,,DUP,First', 'P,TRUE,,,DUP,Second'].join('\r\n');
  const r = RI.parseRegisterCSV(csv);
  check('dedup: first wins', r.ok && r.records.length === 1 && r.records[0].name === 'First' && r.stats.skippedDup === 1, r.ok && r.stats);
}

// --- error cases
function errs(csv){ const r = RI.parseRegisterCSV(csv); return r.ok ? null : r.errors.join(' | '); }
check('error: missing required column', /Missing column: ASSET NO/.test(errs('SELECT PARENT ASSET,ADD ROW?,ASSET NAME (AUTO)\nP,TRUE,x') || ''), errs('SELECT PARENT ASSET,ADD ROW?,ASSET NAME (AUTO)\nP,TRUE,x'));
check('error: empty CSV', /empty/i.test(errs('') || ''), errs(''));

// --- header-only export (no ADD rows) is valid with zero records
{
  const r = RI.parseRegisterCSV(HDR);
  check('header-only: ok with 0 records', r.ok === true && r.records.length === 0, r.ok && r.stats);
}

// --- CSV / formula injection guard (security): export neutralises formula-leading cells,
//     import strips the guard so a round-trip is lossless.
{
  check('guard: = neutralised', csvGuard('=1+1') === "'=1+1" && csvCell('=cmd|calc') === "'=cmd|calc", [csvGuard('=1+1'), csvCell('=cmd|calc')]);
  check('guard: + - @ neutralised', csvGuard('+x')==="'+x" && csvGuard('-x')==="'-x" && csvGuard('@x')==="'@x", [csvGuard('+x'),csvGuard('-x'),csvGuard('@x')]);
  check('guard: safe value untouched', csvGuard('B2BE-STH')==='B2BE-STH' && csvCell('Building & Infrastructure')==='Building & Infrastructure', csvGuard('B2BE-STH'));
  check('guard: unguard is the inverse', csvUnguard(csvGuard('=DDE()'))==='=DDE()' && csvUnguard('B2BE')==='B2BE', csvUnguard(csvGuard('=DDE()')));
  // end-to-end: a guarded onboarding CSV re-imports to the original malicious-looking name
  const csv = [HDR, "P,TRUE,,,ATK1,'=cmd|'/c calc"].join('\r\n');
  const r = RI.parseRegisterCSV(csv);
  check('guard: register import strips the guard back to the original value',
    r.ok && r.records[0].name === "=cmd|'/c calc", r.ok && r.records[0].name);
}

if(failures){ console.error('REGISTER IMPORT GATE: FAIL —', failures); process.exit(1); }
console.log('REGISTER IMPORT GATE: PASS');
