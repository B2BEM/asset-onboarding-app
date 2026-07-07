import { NODES, ASSETS, ASSET_NOS, TAKEN_NOS, ASSET_BY_NO, descOf } from './data.js';
import { rows, editing, editIndex } from './session.js';
import { lastLevel } from './engine.js';
// Full taxonomy path of a parent asset: dataset container `tx`, else a session-created row's own levels.
function parentTx(parentNo){
  if(!parentNo) return null;
  const a=ASSET_BY_NO.get(parentNo);
  if(a && a.tx && a.tx.length) return a.tx.slice();
  const r=rows.find(x=>x.assetNo===parentNo);
  if(r && r.levels && r.levels.length) return r.levels.slice();
  return null;
}
/* ===========================================================
   ASSET NAME / NUMBER ENGINE  (reproduces the master's segment+sequence algorithm)
   Asset no = parent asset no + "-" + taxonomy code per new level + next sequence on the leaf.
   Reference / Reference-sub carry no number. Sequence is the next free among the existing
   asset data + in-session siblings sharing the same parent+code prefix.
=========================================================== */
function levelCode(v){ const n=NODES[v]||{}; return n.code || ''; }
// The new leaf = the deepest taxonomy level chosen BEYOND the parent's inherited path, so the parent's
// own codes are never re-appended. Falls back to abbreviation when nothing new was added.
function inheritedLen(e){ const t=parentTx(e&&e.parent); return t?t.length:0; }
function newLeafLevel(e){ const lv=(e&&e.levels)||[], pl=inheritedLen(e); for(let i=lv.length-1;i>=pl;i--){ if(lv[i]) return lv[i]; } return null; }
function leafCodeOf(e){ const leaf=newLeafLevel(e); return leaf ? (levelCode(leaf)||'') : ((e&&e.abbreviation)||''); }
function newSegments(e){ const c=leafCodeOf(e); return c?[c]:[]; }
function basePrefix(e){
  const parent=(e&&e.parent)||'', code=leafCodeOf(e);
  if(!parent && !code) return '';
  return parent ? (code ? parent+'-'+code : parent) : code;
}
// Enumerable — a CLASS instance or EQUIPMENT unit gets an instance sequence; pure REFERENCE containers do not.
function leafEnumerable(e){ const leaf=newLeafLevel(e)||lastLevel(e); const t=(NODES[leaf]||{}).type; return t==='CLASS'||t==='EQUIPMENT'; }
// a full asset no is "taken" if it exists in the master data or is already used by another in-session row
function noTaken(no, e){
  if(!no) return false;
  if(ASSET_NOS.has(no) || TAKEN_NOS.has(no)) return true;
  // when e is the edited clone, rows[editIndex] is the SAME logical row — treat it as self, not a sibling
  for(let i=0;i<rows.length;i++){ const r=rows[i]; if(r===e || (e===editing && i===editIndex)) continue; if(r.assetNo===no || r.tag===no) return true; }
  return false;
}
function nextSequence(prefix, e){
  if(!prefix) return '01';
  let max=0;
  ASSETS.forEach(a=>{ const no=a.no; if(no && no.indexOf(prefix)===0){ const m=no.slice(prefix.length).match(/^-?(\d+)/); if(m){ const n=parseInt(m[1],10); if(n>max)max=n; } } });
  TAKEN_NOS.forEach(no=>{ if(no.indexOf(prefix)===0){ const m=no.slice(prefix.length).match(/^-?(\d+)/); if(m){ const n=parseInt(m[1],10); if(n>max)max=n; } } });
  let ord=0, mine=0, sawE=false;
  rows.forEach((r,idx)=>{ if(basePrefix(r)===prefix){ ord++; if(r===e || (e===editing && idx===editIndex)){ mine=ord; sawE=true; } } });
  if(e && !sawE) mine=ord+1;
  if(!mine) mine=1;
  // never propose a number that collides with the master data or another row (Rule §3.10)
  let n=max+mine, guard=0;
  while(noTaken(prefix+String(n).padStart(2,'0'), e) && guard<9999){ n++; guard++; }
  return String(n).padStart(2,'0');
}
function autoAssetNo(e){
  if(!e || (!(e.levels && e.levels.length) && !e.parent)) return '';
  const prefix=basePrefix(e); if(!prefix) return '';
  if(e.number!=null && e.number!=='') return prefix + String(e.number);
  if(leafEnumerable(e)) return prefix + nextSequence(prefix, e);
  return prefix;   // reference container: no instance number
}
// #2 — the manually entered Asset/Tag name is the LAST segment of the id: parent + "-" + entry.
function proposedAssetNo(e){
  if(!e) return '';
  const tag=(e.tag||'').trim(), parent=e.parent||'';
  if(tag){
    if(!parent) return tag;
    if(tag===parent || tag.indexOf(parent+'-')===0) return tag;   // user typed a full / parent-prefixed path
    return parent+'-'+tag;
  }
  return autoAssetNo(e);   // no manual name yet → auto suggestion
}
function proposedAssetDesc(e){
  const parent=e.parent||'';
  const pd=(ASSET_BY_NO.get(parent)||{}).desc||'';
  const leaf=lastLevel(e); const ld=leaf?descOf(leaf):'';
  // trailing digit run via backward scan — /(\d+)$/ backtracks quadratically on digit-heavy
  // strings (ReDoS audit 2026-07-07); charCode 48-57 is exactly \d (ASCII, no u-flag)
  let num=''; { const s=proposedAssetNo(e); let i=s.length; while(i>0){ const c=s.charCodeAt(i-1); if(c<48||c>57) break; i--; }
    if(i<s.length && (leafEnumerable(e) || (e.number!=null&&e.number!=='')) ) num=' '+s.slice(i); }
  const spec=(e.desc||'').trim();
  let parts=[]; if(pd) parts.push(pd); if(ld && (!pd || pd.toUpperCase().indexOf(ld.toUpperCase())<0)) parts.push(ld);
  let desc=(parts.join(' ').trim()+num).trim();
  if(spec && desc.toUpperCase().indexOf(spec.toUpperCase())<0) desc=(desc+' '+spec).trim();
  return desc;
}
export { parentTx, levelCode, inheritedLen, newLeafLevel, leafCodeOf, newSegments, basePrefix, leafEnumerable, noTaken, nextSequence, autoAssetNo, proposedAssetNo, proposedAssetDesc };
