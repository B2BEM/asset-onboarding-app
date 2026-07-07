// Register structure roles (design 2026-07-07, company level) — what a row IS is decided by
// its ASSET LEVEL (parent-chain depth): 1 = COMPANY, 2 = SITE, 3 = ASSET CLASS,
// 4+ = real asset. Structure rows (levels 1–3) get CLASSIFICATION forced to the role name;
// taxonomy-derived classification starts at level 4.
const STRUCTURE_ROLES = ['COMPANY', 'SITE', 'ASSET CLASS'];
function roleOfLevel(lvl){
  if(lvl <= 1) return 'COMPANY';
  if(lvl === 2) return 'SITE';
  if(lvl === 3) return 'ASSET CLASS';
  return 'ASSET';
}
// True when at least one complete Company ▸ Site ▸ Asset Class chain exists — i.e.
// some entry sits at depth 3 (its parent chain reaches depth 1 by construction). Pure: the
// caller supplies the entries (register assets + session rows) and the level function.
function structureComplete(levelOf, entries){
  return (entries || []).some(e => levelOf(e) === 3);
}
// Hierarchical display order (design 2026-07-07, site-scoped rows): depth-first from the
// roots so children sit under their parent regardless of entry order. entries = [{no, parent}]
// in input order; a root is an entry whose parent is not another entry's no (rows parented to
// a register asset root their own subtree). Sibling and root order = input order. Cycle-safe:
// entries left rootless by a parent cycle are appended in input order, each emitted once.
function hierarchyOrder(entries){
  const list = entries || [];
  const byNo = new Map();
  list.forEach((e, i) => { if(e && e.no && !byNo.has(e.no)) byNo.set(e.no, i); });
  const kids = new Map(); const roots = [];
  list.forEach((e, i) => {
    const p = (e && e.parent && byNo.has(e.parent) && byNo.get(e.parent) !== i) ? byNo.get(e.parent) : -1;
    if(p < 0) roots.push(i);
    else { if(!kids.has(p)) kids.set(p, []); kids.get(p).push(i); }
  });
  const out = [], seen = new Set();
  const visit = i => { if(seen.has(i)) return; seen.add(i); out.push(i); (kids.get(i) || []).forEach(visit); };
  roots.forEach(visit);
  list.forEach((_, i) => visit(i));
  return out;
}
// Self + ancestor chain of `no` under parentOf(no) -> parent no or ''. Stops on repeats (cycles).
function chainOf(no, parentOf){
  const chain = new Set();
  let v = no;
  while(v && !chain.has(v)){ chain.add(v); v = parentOf(v) || ''; }
  return chain;
}
// Site scope (design 2026-07-07, site-scoped rows): with a site selected, an entry is in scope
// when the site is on its self+ancestor chain (the site row itself and everything under it), or
// the entry is on the SITE's ancestor chain (the company above it). Entries under a different
// site — and entries with neither no nor parent resolvable — are out of scope. parentOf must
// span session rows AND register assets so chains cross the register/session seam. The entry's
// OWN parent is authoritative for the first hop, so a row is scoped by its real parent even when
// another row shares its asset no (parentOf is a first-wins no->parent map; edge fix 2026-07-07).
function inSiteScope(entry, siteNo, parentOf){
  if(!siteNo) return true;
  const e = entry || {};
  if(e.no && e.no === siteNo) return true;                 // the site row itself
  const chain = new Set();                                 // entry's self + ancestor chain
  if(e.no) chain.add(e.no);
  let v = e.parent || '';                                  // first hop = entry's OWN declared parent
  while(v && !chain.has(v)){ chain.add(v); v = parentOf(v) || ''; }   // then climb via parentOf; cycle-safe
  if(chain.has(siteNo)) return true;                       // site sits on the entry's chain (site + its subtree)
  return !!e.no && chainOf(siteNo, parentOf).has(e.no);    // entry is an ancestor of the site (the company above)
}
export { STRUCTURE_ROLES, roleOfLevel, structureComplete, hierarchyOrder, inSiteScope };
