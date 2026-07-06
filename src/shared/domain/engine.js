import { RULES } from './rules.js';
import { childrenOfRules } from './cascade.js';
import { NODES, ASSET_NOS, ASSET_BY_NO, assetLevel, descOf } from './data.js';
import { parentTx, proposedAssetNo } from './numbering.js';
import { infoMissing, isItemRow, bomStockIssues } from './fields.js';
import { roleOfLevel } from './structure.js';
import { rows, editing } from './session.js';
/* ===========================================================
   Engine input assembly
=========================================================== */
function lastLevel(e){ return e.levels && e.levels.length ? e.levels[e.levels.length-1] : null; }
function assetTypeOf(e){ const own=descOf(lastLevel(e)); return e.assetType || (lastLevel(e)?own:'') || e.tag || ''; }
function taxChildCountOf(e){ const v=lastLevel(e); return v ? childrenOfRules(v, e.levels).length : 0; }
function rowChildCount(e){ if(!e.tag) return 0; return rows.filter(r=>r!==e && r.parent===e.tag).length; }
function engineInput(e){
  const own = lastLevel(e) ? descOf(lastLevel(e)) : '';
  const at = assetTypeOf(e);
  const desc = ((e.desc||'')+' '+own).trim();
  const cc = taxChildCountOf(e) + rowChildCount(e);
  const ltype = (NODES[lastLevel(e)]||{}).type;
  return { description: desc, assetType: at, duty: e.duty||'', childCount: cc, transformedChildCount: cc,
    isGrouping: ltype==='REFERENCE', workOrderable: e.workOrderable, groupsMinorItems: e.groupsMinorItems===true,
    isSystem: /\bsystem\b/i.test(desc+' '+at), hasConcreteAssetsBeneath: e.hasConcreteAssetsBeneath!==false,
    number: e.number, abbreviation: e.abbreviation, parentTag: e.parent, tag: e.tag, classOverride: e.classOverride||null };
}
function takenAbbrevs(){ const s=new Set(); rows.forEach(r=>{ if(r!==editing && r.abbreviation) s.add(String(r.abbreviation).toUpperCase()); }); return s; }
/* ---------- register structure level (design 2026-07-06 WS1) ---------- */
// Structure level = parent-chain depth: register parents via assetLevel, session parents by
// recursion; no parent = 1. Unknown/cyclic parents count as level 3 so the row stays a normal
// (level ≥4) asset — never mis-forced into a structure role by a typo'd parent.
function rowStructLevel(r, seen){
  if(!r || !r.parent) return 1;
  seen = seen || new Set();
  if(seen.has(r.parent)) return 4;
  seen.add(r.parent);
  if(ASSET_BY_NO.has(r.parent)) return 1 + assetLevel(r.parent);
  const p = rows.find(x => x !== r && (x.assetNo === r.parent || (x.tag && x.tag === r.parent)));
  return p ? 1 + rowStructLevel(p, seen) : 4;
}
// Forced role for structure rows (levels 1–3), or null for real assets (level ≥4).
function structRoleOf(r){ const lvl = rowStructLevel(r); return lvl <= 3 ? roleOfLevel(lvl) : null; }
function classOf(e){ return e.classOverride || RULES.classify(engineInput(e)); }
function dataIssuesFor(levels, parent, tag){
  const who=tag||'(row)'; const out=[];
  const inh=new Set(parentTx(parent)||[]);   // values inherited from the parent are authoritative (don't flag)
  // custom / off-taxonomy level values are allowed (free-text deeper levels) — warn, don't block
  (levels||[]).forEach(v=>{ if(v && !NODES[v] && !inh.has(v)) out.push({rule:'TAX',severity:'medium',message:who+': custom taxonomy value “'+v+'” (not in the standard list)'}); });
  // a parent is valid if it exists in the master data OR was created earlier this session (in-session rows)
  if(parent && !ASSET_NOS.has(parent) && !rows.some(r=>r.assetNo===parent)) out.push({rule:'PARENT',severity:'medium',message:who+': parent asset “'+parent+'” not found in current data or this session'});
  return out;
}
function computeForRow(r){
  const a = engineInput(r);
  const sRole = structRoleOf(r);   // levels 1–3: CLASSIFICATION is forced to the role name
  const cls = sRole || r.classification || RULES.classify(a);
  const abbr = r.abbreviation || RULES.buildAbbreviation(a.assetType, a.duty, new Set());
  const num = r.number || RULES.resolveNumber(a) || '';
  const assetNo = proposedAssetNo(r);
  const vi = Object.assign({}, a, {abbreviation:abbr, number:r.number||'', classOverride:r.classOverride||null, tag:r.tag});
  const issues = RULES.validate(vi, new Set()).concat(dataIssuesFor(r.levels, r.parent, r.tag));
  if(r.action==='add'){
    // §LVL applies to real assets (level ≥4) nested under a parent; structure rows
    // (Site / Asset Class / Asset Sub Class) ARE the shallow levels and are exempt.
    if(!sRole && r.parent && (r.levels||[]).length<2) issues.push({rule:'LVL',severity:'high',message:'Asset must be at Level 4 or deeper.'});
    if(assetNo && (ASSET_NOS.has(assetNo) || rows.some(x=>x!==r && x.assetNo===assetNo)))
      issues.push({rule:'3.10',severity:'high',message:'Asset no. “'+assetNo+'” already exists.'});
    if(!sRole){
      const miss=infoMissing(r); if(miss.length) issues.push({rule:'INFO',severity:'medium',message:'Asset Information incomplete ('+miss.join(', ')+') — recommended before export.'});
      if(isItemRow(r)) bomStockIssues(r.bom).forEach(x=>issues.push(x));
    }
  }
  return {cls, abbr, num, assetNo, issues, hasHigh: issues.some(i=>i.severity==='high'), hasIssue: issues.length>0};
}
export { lastLevel, assetTypeOf, taxChildCountOf, rowChildCount, engineInput, takenAbbrevs, classOf, dataIssuesFor, computeForRow, rowStructLevel, structRoleOf };
