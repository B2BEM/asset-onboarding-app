import { NODES, childrenOf, descOf } from './data.js';
function cleanName(s){ return (s==null?'':String(s)).replace(/[<>]/g,'').replace(/^[*"(\s]+/,'').replace(/\s+$/,'').trim(); }
/* ===========================================================
   §7.1 CASCADE TRANSFORM
=========================================================== */
// Organisational grouping references collapsed out of the cascade (their children promoted a level).
// Fixed Plant / Structure and their redundant Process-Assets (PCA) / Civil (CIV) counterparts are all
// flattened, so the taxonomy shows equipment directly with no PCA/CIV grouping level (client request,
// 2026-07-07). Real *CIVIL - *… asset classes (carparks, gardens, bridges) are NOT groups and remain.
function isGroupNode(v){
  const n=NODES[v]; if(!n || n.type!=='REFERENCE') return false;
  return v.indexOf('<FIXED PLANT>')===0 || v.indexOf('<STRUCTURE>')===0
      || v.indexOf('<PROCESS ASSETS>')===0 || v.indexOf('<CIVIL>')===0;
}
function plainNode(v){ const n=NODES[v]||{}; return {value:v, display:v, code:n.code, type:n.type}; }
// Fixed Plant / Structure are organisational group nodes: always flattened, their leaf children
// promoted up a level in the cascade. (These were formerly kept and relabelled PCA / CIV whenever an
// <OUTLOAD> ancestor was present; that relabel was removed 2026-07-07 at the client's request.)
function transformedChildren(parent, visited){
  visited = visited || new Set();
  const out=[], seen=new Set(), kids=childrenOf(parent);
  for(let i=0;i<kids.length;i++){
    const c=kids[i];
    if(isGroupNode(c)){
      if(visited.has(c)) continue; const v2=new Set(visited); v2.add(c);
      const promoted=transformedChildren(c, v2);
      for(let j=0;j<promoted.length;j++){ const e=promoted[j]; if(!seen.has(e.value)){ seen.add(e.value); out.push(e); } }
    } else { if(!seen.has(c)){ seen.add(c); out.push(plainNode(c)); } }
  }
  return out;
}
// ancestorLevels kept for call-site compatibility; no longer used now that <OUTLOAD> has no special case.
function childrenOfRules(parentVal, ancestorLevels){ return transformedChildren(parentVal); }
function descOfRules(v, ancestorLevels){ return descOf(v); }
export { cleanName, isGroupNode, plainNode, transformedChildren, childrenOfRules, descOfRules };
