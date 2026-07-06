let DATA = {};
/* ---------- indexes ---------- */
let NODES = {};
let EDGES = {};
let ROOTS = [];
let ASSETS = [];
let DEPTS = [];
let SITES = [];
let LOCS = [];
let ASSET_NOS = new Set();
let TAKEN_NOS = new Set();  // existing master-register numbers — sequence + collision
let ASSET_BY_NO = new Map();
let CONTAINER_NOS = new Set();   // existing assets that have children = reference / reference-sub parents
let ASSET_LEVEL_CACHE = new Map();   // memoised parent-chain depth = ASSET LEVEL (1=port, 2=site, 3=grouping, 4+=equipment)
export function initData(dataset){
  DATA = dataset || {};
  NODES = DATA.taxonomyNodes || {};
  EDGES = DATA.edges || {};
  ROOTS = DATA.siteRoots || [];
  ASSETS = DATA.existingAssets || [];
  DEPTS = DATA.departments || [];
  SITES = DATA.sites || [];
  LOCS = DATA.locationOverrides || [];
  TAKEN_NOS = new Set((DATA && DATA.takenNos) || []);
  rebuildAssetIndex();
}
function rebuildAssetIndex(){
  ASSET_NOS = new Set(ASSETS.map(a=>a.no));
  ASSET_BY_NO = new Map(ASSETS.map(a=>[a.no,a]));
  CONTAINER_NOS = new Set(); ASSETS.forEach(a=>{ if(a.parent) CONTAINER_NOS.add(a.parent); });
  ASSET_LEVEL_CACHE = new Map();
}
// ASSET LEVEL via parent-chain depth (root=1). Matches the source register's ASSET LEVEL column when present.
function assetLevel(no, seen){
  if(ASSET_LEVEL_CACHE.has(no)) return ASSET_LEVEL_CACHE.get(no);
  seen = seen || new Set();
  if(seen.has(no)) return 1;
  seen.add(no);
  const a = ASSET_BY_NO.get(no);
  if(!a) return 1;
  if(typeof a.lvl==='number'){ ASSET_LEVEL_CACHE.set(no, a.lvl); return a.lvl; }   // prefer baked snapshot ASSET LEVEL if the dataset has it
  const p = a.parent;
  const d = (!p || !ASSET_BY_NO.has(p)) ? 1 : 1 + assetLevel(p, seen);
  ASSET_LEVEL_CACHE.set(no, d);
  return d;
}

const nodeOf = v => NODES[v] || {value:v,type:'',code:'',desc:'',levelDesc:'',suffix:''};
const childrenOf = v => (EDGES[v] || []);
const descOf = v => { const n=nodeOf(v); return n.desc || n.levelDesc || v; };
function rootByCode(code){ if(!code) return null; for(const v of ROOTS){ if((NODES[v]||{}).code===code) return v; } return null; }
export { DATA, NODES, EDGES, ROOTS, ASSETS, DEPTS, SITES, LOCS, ASSET_NOS, TAKEN_NOS, ASSET_BY_NO, CONTAINER_NOS, ASSET_LEVEL_CACHE, rebuildAssetIndex, assetLevel, nodeOf, childrenOf, descOf, rootByCode };
