// Taxonomy import/export unit gate. Run: node test/taxonomyImport.test.js (exit 0 = pass)
import * as TI from '../src/shared/domain/taxonomyImport.js';

let failures = 0;
function check(name, cond, detail){ if(cond) console.log('PASS', name); else { failures++; console.error('FAIL', name, detail == null ? '' : JSON.stringify(detail)); } }

const HDR = 'TAXONOMY VALUE,TAXONOMY TYPE,CODE,DESCRIPTION,PARENT TAXONOMY VALUE';

// --- valid parse: nodes / edges / roots / stats, quoted comma preserved
{
  const csv = [
    HDR,
    '<PUMPING>,REFERENCE,PMP,Pumping systems,',
    '<PUMPING> CENTRIFUGAL,EQUIPMENT,CFP,"Centrifugal, pumps",<PUMPING>',
    '<TANKS>,REFERENCE,TNK,Storage tanks,',
  ].join('\r\n');
  const r = TI.parseTaxonomyCSV(csv);
  check('valid: ok', r.ok === true, r.errors);
  check('valid: stats', r.ok && r.stats.nodes === 3 && r.stats.roots === 2, r.stats);
  const leaf = r.ok && r.dataset.taxonomyNodes['<PUMPING> CENTRIFUGAL'];
  check('valid: node fields', !!leaf && leaf.type === 'EQUIPMENT' && leaf.code === 'CFP' && leaf.desc === 'Centrifugal, pumps', leaf);
  check('valid: quoted comma preserved', !!leaf && leaf.desc.indexOf(',') > 0, leaf && leaf.desc);
  check('valid: edges in order', r.ok && JSON.stringify(r.dataset.edges['<PUMPING>']) === JSON.stringify(['<PUMPING> CENTRIFUGAL']), r.ok && r.dataset.edges);
  check('valid: roots in file order', r.ok && JSON.stringify(r.dataset.siteRoots) === JSON.stringify(['<PUMPING>', '<TANKS>']), r.ok && r.dataset.siteRoots);
}

// --- round-trip idempotency: dataset -> CSV -> parse -> CSV (order + quoting stable)
{
  const dataset = {
    taxonomyNodes: {
      A: { value: 'A', type: 'REFERENCE', code: 'A', desc: 'Alpha' },
      'A/1': { value: 'A/1', type: 'EQUIPMENT', code: 'A1', desc: 'A one, with comma' },
      'A/2': { value: 'A/2', type: 'EQUIPMENT', code: 'A2', desc: 'A "two"' },
      B: { value: 'B', type: 'REFERENCE', code: 'B', desc: 'Bravo' },
    },
    edges: { A: ['A/1', 'A/2'] },
    siteRoots: ['A', 'B'],
  };
  const csv1 = TI.taxonomyToCSV(dataset);
  const p = TI.parseTaxonomyCSV(csv1);
  check('round-trip: parse ok', p.ok === true, p.errors);
  check('round-trip: stats', p.ok && p.stats.nodes === 4 && p.stats.roots === 2, p.stats);
  check('round-trip: edges preserved', p.ok && JSON.stringify(p.dataset.edges.A) === JSON.stringify(['A/1', 'A/2']), p.ok && p.dataset.edges);
  const csv2 = TI.taxonomyToCSV(p.dataset);
  check('round-trip: CSV idempotent', csv1 === csv2, { csv1, csv2 });
}

// --- error cases (strict, all-or-nothing)
function errs(csv){ const r = TI.parseTaxonomyCSV(csv); return r.ok ? null : r.errors.join(' | '); }
check('error: missing header', /Missing column/.test(errs('VALUE,TYPE\nx,y') || ''), errs('VALUE,TYPE\nx,y'));
check('error: blank value', /TAXONOMY VALUE is required/.test(errs(HDR + '\n,REF,X,x,') || ''), errs(HDR + '\n,REF,X,x,'));
check('error: duplicate value', /Duplicate/.test(errs(HDR + '\nA,REF,A,a,\nA,REF,A,a2,') || ''), errs(HDR + '\nA,REF,A,a,\nA,REF,A,a2,'));
check('error: orphan parent', /is not a defined/.test(errs(HDR + '\nchild,EQUIPMENT,C,desc,ghost') || ''), errs(HDR + '\nchild,EQUIPMENT,C,desc,ghost'));
check('error: cycle', /Cycle/.test(errs(HDR + '\nA,REF,A,a,B\nB,REF,B,b,C\nC,REF,C,c,A') || ''), errs(HDR + '\nA,REF,A,a,B\nB,REF,B,b,C\nC,REF,C,c,A'));
check('error: no root (header only)', /No root/.test(errs(HDR) || ''), errs(HDR));

if(failures){ console.error('TAXONOMY GATE: FAIL —', failures); process.exit(1); }
console.log('TAXONOMY GATE: PASS');
