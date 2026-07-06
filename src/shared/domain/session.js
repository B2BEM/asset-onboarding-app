// UI/session-state bridge: the six globals the domain engine reads.
// Client binds its live state objects; server binds per-request via withSession.
// Domain code only READS these (verified); all writes happen in the UI/server layer.
let rows = [];
let BOM_EXISTING = [];
let editing = null;
let editIndex = -1;
let NEW_TAX = [];
let PROJECT = {pm:'', number:'', start:'', end:''};
export function bindSession(s){
  s = s || {};
  rows = s.rows || [];
  BOM_EXISTING = s.BOM_EXISTING || [];
  editing = ('editing' in s) ? s.editing : null;
  editIndex = (typeof s.editIndex === 'number') ? s.editIndex : -1;
  NEW_TAX = s.NEW_TAX || [];
  PROJECT = s.PROJECT || {pm:'', number:'', start:'', end:''};
}
export function resetSession(){ bindSession(null); }
// Server discipline: bind -> compute -> reset, synchronously (no await between).
export function withSession(s, fn){ bindSession(s); try { return fn(); } finally { resetSession(); } }
export { rows, editing, editIndex, PROJECT, BOM_EXISTING, NEW_TAX };
