// Register structure roles (design 2026-07-06, Workstream 1) — what a row IS is decided by
// its ASSET LEVEL (parent-chain depth): 1 = SITE, 2 = ASSET CLASS, 3 = ASSET SUB CLASS,
// 4+ = real asset. Structure rows (levels 1–3) get CLASSIFICATION forced to the role name;
// taxonomy-derived classification starts at level 4.
const STRUCTURE_ROLES = ['SITE', 'ASSET CLASS', 'ASSET SUB CLASS'];
function roleOfLevel(lvl){
  if(lvl <= 1) return 'SITE';
  if(lvl === 2) return 'ASSET CLASS';
  if(lvl === 3) return 'ASSET SUB CLASS';
  return 'ASSET';
}
// True when at least one complete Site ▸ Asset Class ▸ Asset Sub Class chain exists — i.e.
// some entry sits at depth 3 (its parent chain reaches depth 1 by construction). Pure: the
// caller supplies the entries (register assets + session rows) and the level function.
function structureComplete(levelOf, entries){
  return (entries || []).some(e => levelOf(e) === 3);
}
export { STRUCTURE_ROLES, roleOfLevel, structureComplete };
