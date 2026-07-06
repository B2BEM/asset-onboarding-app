import { NODES, childrenOf, descOf } from './data.js';
function cleanName(s){ return (s==null?'':String(s)).replace(/[<>]/g,'').replace(/^[*"(\s]+/,'').replace(/\s+$/,'').trim(); }
/* ===========================================================
   §7.1 CASCADE TRANSFORM
=========================================================== */
function isGroupNode(v){
  const n=NODES[v]; if(!n || n.type!=='REFERENCE') return false;
  const fp = v.indexOf('<FIXED PLANT>')===0 && (n.code==='FPT'||n.code==='PCA');
  const st = v.indexOf('<STRUCTURE>')===0   && (n.code==='STR'||n.code==='CIV');
  return fp||st;
}
function relabelGroup(v){
  const n=NODES[v]||{};
  if(v.indexOf('<FIXED PLANT>')===0) return {value:v, display:v.replace('<FIXED PLANT>','<PROCESS ASSETS>'), code:'PCA', type:n.type};
  return {value:v, display:v.replace('<STRUCTURE>','<CIVIL>'), code:'CIV', type:n.type};
}
function plainNode(v){ const n=NODES[v]||{}; return {value:v, display:v, code:n.code, type:n.type}; }
function underOutload(levels){ return (levels||[]).indexOf('<OUTLOAD>')>=0; }
function transformedChildren(parent, parentUnderOutload, visited){
  visited = visited || new Set();
  const out=[], seen=new Set(), kids=childrenOf(parent);
  for(let i=0;i<kids.length;i++){
    const c=kids[i];
    if(isGroupNode(c)){
      if(parentUnderOutload){ if(!seen.has(c)){ seen.add(c); out.push(relabelGroup(c)); } }
      else { if(visited.has(c)) continue; const v2=new Set(visited); v2.add(c);
        const promoted=transformedChildren(c, false, v2);
        for(let j=0;j<promoted.length;j++){ const e=promoted[j]; if(!seen.has(e.value)){ seen.add(e.value); out.push(e); } } }
    } else { if(!seen.has(c)){ seen.add(c); out.push(plainNode(c)); } }
  }
  return out;
}
function childrenOfRules(parentVal, ancestorLevels){ return transformedChildren(parentVal, underOutload(ancestorLevels)); }
function descOfRules(v, ancestorLevels){
  if(underOutload(ancestorLevels) && isGroupNode(v)) return cleanName(relabelGroup(v).display);
  return descOf(v);
}
export { cleanName, isGroupNode, relabelGroup, plainNode, underOutload, transformedChildren, childrenOfRules, descOfRules };
