// Server-side row recompute — the ONLY place a row's classification/abbreviation/number/
// assetNo/assetName get computed. Client-sent computed values are display-only and ignored.
// Recipe is dictated exactly by the Phase 2 packet (clone semantics, no await between bind
// and compute — better-sqlite3 is sync, so keep handler bodies synchronous).
import db from './db.js';
import { withSession } from '../shared/domain/session.js';
import { computeForRow } from '../shared/domain/engine.js';
import { proposedAssetDesc } from '../shared/domain/numbering.js';

// Row shape used INTERNALLY by the domain engine (levels array, tag, parent, etc.) — same
// shape as the wire "Row JSON" contract in the API, so incoming rows can be passed through.
function toDomainRow(row) {
  return {
    id: row.id,
    action: row.action || '',
    parent: row.parent || '',
    levels: Array.isArray(row.levels) ? row.levels : [],
    tag: row.tag || '',
    desc: row.desc || '',
    dept: row.dept || '',
    loc: row.loc || '',
    duty: row.duty || '',
    workOrderable: row.workOrderable,
    classOverride: row.classOverride || null,
    abbrOverride: row.abbrOverride || null,
    itemType: row.itemType || '',
    groupsMinorItems: row.groupsMinorItems === true,
    hasConcreteAssetsBeneath: row.hasConcreteAssetsBeneath,
    classification: row.classification || '',
    abbreviation: row.abbreviation || '',
    number: row.number || '',
    assetNo: row.assetNo || '',
    assetName: row.assetName || '',
    info: row.info || {},
    bom: Array.isArray(row.bom) ? row.bom : [],
    project: row.project || {},
  };
}

// DB row (onboarding_rows table row) -> domain row shape.
function dbRowToDomainRow(dbRow) {
  return {
    id: dbRow.id,
    action: dbRow.action || '',
    parent: dbRow.parent || '',
    levels: dbRow.levels_json ? JSON.parse(dbRow.levels_json) : [],
    tag: dbRow.tag || '',
    desc: dbRow.desc || '',
    dept: dbRow.dept || '',
    loc: dbRow.loc || '',
    duty: dbRow.duty || '',
    workOrderable: !!dbRow.work_orderable,
    classOverride: dbRow.class_override || null,
    abbrOverride: dbRow.abbr_override || null,
    itemType: dbRow.item_type || '',
    groupsMinorItems: !!dbRow.groups_minor_items,
    hasConcreteAssetsBeneath: dbRow.has_concrete_assets_beneath === null ? undefined : !!dbRow.has_concrete_assets_beneath,
    classification: dbRow.classification || '',
    abbreviation: dbRow.abbreviation || '',
    number: dbRow.number || '',
    assetNo: dbRow.asset_no || '',
    assetName: dbRow.asset_name || '',
    info: dbRow.info_json ? JSON.parse(dbRow.info_json) : {},
    bom: dbRow.bom_json ? JSON.parse(dbRow.bom_json) : [],
    project: dbRow.project_json ? JSON.parse(dbRow.project_json) : {},
  };
}

// DB row -> wire (API) row shape.
function dbRowToWireRow(dbRow) {
  const d = dbRowToDomainRow(dbRow);
  return {
    id: d.id,
    action: d.action,
    parent: d.parent,
    levels: d.levels,
    tag: d.tag,
    desc: d.desc,
    dept: d.dept,
    loc: d.loc,
    duty: d.duty,
    workOrderable: d.workOrderable,
    classOverride: d.classOverride,
    abbrOverride: d.abbrOverride,
    itemType: d.itemType,
    groupsMinorItems: d.groupsMinorItems,
    hasConcreteAssetsBeneath: d.hasConcreteAssetsBeneath,
    classification: d.classification,
    abbreviation: d.abbreviation,
    number: d.number,
    assetNo: d.assetNo,
    assetName: d.assetName,
    info: d.info,
    bom: d.bom,
    project: d.project,
  };
}

function loadUserRows(user) {
  return db.prepare('SELECT * FROM onboarding_rows WHERE user = ? ORDER BY id ASC').all(user);
}

function loadUserBomExisting(user) {
  return db.prepare('SELECT * FROM bom_existing WHERE user = ? ORDER BY id ASC').all(user).map(r => ({
    id: r.id,
    no: r.asset_no,
    assetNo: r.asset_no,
    desc: '',
    bom: r.bom_json ? JSON.parse(r.bom_json) : [],
  }));
}

function loadUserUnpromotedTax(user) {
  return db.prepare('SELECT * FROM taxonomy_additions WHERE user = ? AND promoted = 0 ORDER BY id ASC').all(user).map(r => ({
    id: r.id,
    value: r.value,
    type: r.type,
    code: r.code,
    desc: r.desc,
    parent: r.parent,
  }));
}

// The exact recompute recipe from the packet. `payloadRow` is the incoming wire row (plain
// object, not yet a DB row). `editingId` is the row id being updated, or null/undefined for a
// new row. Returns { cf, assetName } where cf = {cls, abbr, num, assetNo, issues, ...}.
function recompute(user, payloadRow, editingId) {
  const userRowsDb = loadUserRows(user);
  const userRows = userRowsDb.map(dbRowToDomainRow);
  const editIndex = (editingId != null) ? userRows.findIndex(r => r.id === editingId) : -1;
  const editingDomainRow = editIndex >= 0 ? userRows[editIndex] : null;

  const payloadDomainRow = toDomainRow(payloadRow);
  // While editing, the "editing" clone must be the SAME logical row object identity that
  // appears in `rows` at editIndex, per session.js/numbering.js clone-semantics (noTaken,
  // nextSequence compare `r===e || (e===editing && idx===editIndex)`). We splice the payload
  // row (with the real id) into the rows array at editIndex so identity checks work, and pass
  // that same object as `editing`.
  let rowsForSession = userRows;
  let editingForSession = null;
  if (editIndex >= 0) {
    payloadDomainRow.id = editingId;
    rowsForSession = userRows.slice();
    rowsForSession[editIndex] = payloadDomainRow;
    editingForSession = payloadDomainRow;
  }

  const bomExisting = loadUserBomExisting(user);
  const newTax = loadUserUnpromotedTax(user);

  const result = withSession(
    {
      rows: rowsForSession,
      editing: editingForSession,
      editIndex,
      PROJECT: payloadRow.project || {},
      BOM_EXISTING: bomExisting,
      NEW_TAX: newTax,
    },
    () => {
      const cf = computeForRow(payloadDomainRow);
      return { ...cf, assetName: proposedAssetDesc(payloadDomainRow) };
    }
  );

  return result;
}

export { toDomainRow, dbRowToDomainRow, dbRowToWireRow, loadUserRows, loadUserBomExisting, loadUserUnpromotedTax, recompute };
