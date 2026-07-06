// API routes (README §8, API CONTRACT v1). All /api/* require an authenticated user;
// admin endpoints additionally require role==='admin'. Server recomputes every row
// server-side via the frozen shared domain modules — client-sent computed values are
// display-only and ignored.
import express from 'express';
import db from './db.js';
import { requireUser, requireAdmin } from './auth.js';
import { refreshDataset, buildDataset } from './dataset.js';
import { recompute, dbRowToWireRow, dbRowToDomainRow, loadUserRows, loadUserBomExisting, loadUserUnpromotedTax } from './rowCompute.js';
import { withSession } from '../shared/domain/session.js';
import { buildCSV, buildBOMCSV, buildTaxCSV, withBom, exportFileBase } from '../shared/domain/csv.js';
import { perthISO } from '../shared/domain/time.js';
import { ASSET_BY_NO } from '../shared/domain/data.js';

const router = express.Router();

function audit(user, action, detail) {
  db.prepare('INSERT INTO audit_log (user, action, detail, at) VALUES (?, ?, ?, ?)').run(
    user, action, typeof detail === 'string' ? detail : JSON.stringify(detail || {}), perthISO()
  );
}

// ---------- input normalization ----------
// better-sqlite3 binds only strings/numbers/null — an object in a scalar field throws
// (a 500). Coerce scalars to bounded strings and clamp array/object shapes up front so
// hand-crafted payloads can't error out mid-write or store unbounded junk. Caps are far
// above anything the UI or CSV import produces, so legitimate round-trips are unchanged.
function str(v, max = 4000) {
  if (v == null || typeof v === 'object' || typeof v === 'function') return '';
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}
const ROW_ACTIONS = new Set(['', 'add', 'update', 'retire']);
function plainObj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
function normalizeRowPayload(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
  const action = str(p.action, 20);
  return {
    ...p,
    action: ROW_ACTIONS.has(action) ? action : '',
    parent: str(p.parent, 300),
    tag: str(p.tag, 500),
    desc: str(p.desc, 4000),
    dept: str(p.dept, 300),
    loc: str(p.loc, 300),
    duty: str(p.duty, 300),
    number: str(p.number, 50),
    itemType: str(p.itemType, 50),
    classOverride: p.classOverride == null ? null : str(p.classOverride, 100),
    abbrOverride: p.abbrOverride == null ? null : str(p.abbrOverride, 100),
    levels: Array.isArray(p.levels) ? p.levels.slice(0, 16).map(v => str(v, 300)) : [],
    info: plainObj(p.info),
    bom: Array.isArray(p.bom) ? p.bom.slice(0, 1000) : [],
    project: plainObj(p.project),
  };
}

router.use(requireUser);

// ---------- /api/me ----------
router.get('/me', (req, res) => {
  res.json({ upn: req.user.upn, displayName: req.user.displayName, role: req.user.role });
});

// ---------- /api/bootstrap ----------
router.get('/bootstrap', (req, res) => {
  const dataset = buildDataset();
  res.json({ dataset, user: { upn: req.user.upn, displayName: req.user.displayName, role: req.user.role } });
});

// ---------- rows persistence helpers ----------
function persistRow(user, id, payloadRow, cf, assetName, now) {
  const params = {
    user,
    project_json: JSON.stringify(payloadRow.project || {}),
    action: payloadRow.action || '',
    parent: payloadRow.parent || '',
    levels_json: JSON.stringify(payloadRow.levels || []),
    tag: payloadRow.tag || '',
    desc: payloadRow.desc || '',
    dept: payloadRow.dept || '',
    loc: payloadRow.loc || '',
    classification: cf.cls || '',
    abbreviation: cf.abbr || '',
    // number stores the USER'S input ('' = auto next sequence), NOT the computed
    // sequence — the original keeps blank-means-auto on the row; persisting cf.num
    // made re-edits fail §1 (REFERENCE - SUB must not carry a number).
    number: payloadRow.number || '',
    work_orderable: payloadRow.workOrderable ? 1 : 0,
    class_override: payloadRow.classOverride || null,
    abbr_override: payloadRow.abbrOverride || null,
    duty: payloadRow.duty || '',
    item_type: payloadRow.itemType || '',
    groups_minor_items: payloadRow.groupsMinorItems ? 1 : 0,
    has_concrete_assets_beneath: payloadRow.hasConcreteAssetsBeneath === undefined ? null : (payloadRow.hasConcreteAssetsBeneath ? 1 : 0),
    asset_no: cf.assetNo || '',
    asset_name: assetName || '',
    info_json: JSON.stringify(payloadRow.info || {}),
    bom_json: JSON.stringify(payloadRow.bom || []),
    updated_at: now,
  };

  if (id == null) {
    const stmt = db.prepare(`
      INSERT INTO onboarding_rows
        (user, project_json, action, parent, levels_json, tag, desc, dept, loc,
         classification, abbreviation, number, work_orderable, class_override, abbr_override,
         duty, item_type, groups_minor_items, has_concrete_assets_beneath, asset_no, asset_name,
         info_json, bom_json, created_at, updated_at)
      VALUES
        (@user, @project_json, @action, @parent, @levels_json, @tag, @desc, @dept, @loc,
         @classification, @abbreviation, @number, @work_orderable, @class_override, @abbr_override,
         @duty, @item_type, @groups_minor_items, @has_concrete_assets_beneath, @asset_no, @asset_name,
         @info_json, @bom_json, @created_at, @updated_at)
    `);
    const info = stmt.run({ ...params, created_at: now });
    return info.lastInsertRowid;
  } else {
    const stmt = db.prepare(`
      UPDATE onboarding_rows SET
        project_json=@project_json, action=@action, parent=@parent, levels_json=@levels_json,
        tag=@tag, desc=@desc, dept=@dept, loc=@loc, classification=@classification,
        abbreviation=@abbreviation, number=@number, work_orderable=@work_orderable,
        class_override=@class_override, abbr_override=@abbr_override, duty=@duty,
        item_type=@item_type, groups_minor_items=@groups_minor_items,
        has_concrete_assets_beneath=@has_concrete_assets_beneath, asset_no=@asset_no,
        asset_name=@asset_name, info_json=@info_json, bom_json=@bom_json, updated_at=@updated_at
      WHERE id=@id AND user=@user
    `);
    stmt.run({ ...params, id });
    return id;
  }
}

// ---------- /api/rows ----------
router.get('/rows', (req, res) => {
  const rows = loadUserRows(req.user.upn).map(dbRowToWireRow);
  res.json({ rows });
});

router.post('/rows', (req, res) => {
  const payloadRow = normalizeRowPayload(req.body);
  const now = perthISO();
  const r = recompute(req.user.upn, payloadRow, null);
  const id = persistRow(req.user.upn, null, payloadRow, r, r.assetName, now);
  const saved = db.prepare('SELECT * FROM onboarding_rows WHERE id = ?').get(id);
  audit(req.user.upn, 'row.create', { id, assetNo: r.assetNo });
  refreshDataset();
  res.json({ row: dbRowToWireRow(saved) });
});

router.put('/rows/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM onboarding_rows WHERE id = ? AND user = ?').get(id, req.user.upn);
  if (!existing) return res.status(404).json({ error: 'Row not found' });

  const payloadRow = normalizeRowPayload(req.body);
  const now = perthISO();
  const r = recompute(req.user.upn, payloadRow, id);
  persistRow(req.user.upn, id, payloadRow, r, r.assetName, now);
  const saved = db.prepare('SELECT * FROM onboarding_rows WHERE id = ?').get(id);
  audit(req.user.upn, 'row.update', { id, assetNo: r.assetNo });
  refreshDataset();
  res.json({ row: dbRowToWireRow(saved) });
});

router.delete('/rows/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM onboarding_rows WHERE id = ? AND user = ?').get(id, req.user.upn);
  if (!existing) return res.status(404).json({ error: 'Row not found' });
  db.prepare('DELETE FROM onboarding_rows WHERE id = ? AND user = ?').run(id, req.user.upn);
  audit(req.user.upn, 'row.delete', { id });
  res.json({ ok: true });
});

// ---------- /api/rows/validate ----------
router.post('/rows/validate', (req, res) => {
  const payloadRow = normalizeRowPayload(req.body);
  const id = req.body && req.body.id != null ? Number(req.body.id) : null;
  const r = recompute(req.user.upn, payloadRow, Number.isFinite(id) ? id : null);
  res.json({
    issues: r.issues,
    computed: { cls: r.cls, abbr: r.abbr, num: r.num, assetNo: r.assetNo, assetName: r.assetName },
  });
});

// ---------- /api/drafts ----------
router.get('/drafts', (req, res) => {
  const drafts = db.prepare('SELECT id, name, ts FROM drafts WHERE user = ? ORDER BY id DESC').all(req.user.upn);
  res.json({ drafts });
});

router.post('/drafts', (req, res) => {
  const { name, project, rows, bomExisting, newTax } = req.body || {};
  const ts = perthISO();
  const stmt = db.prepare(`
    INSERT INTO drafts (user, name, project_json, rows_json, bom_existing_json, new_tax_json, ts)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    req.user.upn, str(name, 300), JSON.stringify(project || {}), JSON.stringify(rows || []),
    JSON.stringify(bomExisting || []), JSON.stringify(newTax || []), ts
  );
  audit(req.user.upn, 'draft.save', { id: info.lastInsertRowid, name });
  res.json({ id: info.lastInsertRowid, ts });
});

router.get('/drafts/:id', (req, res) => {
  const id = Number(req.params.id);
  const d = db.prepare('SELECT * FROM drafts WHERE id = ? AND user = ?').get(id, req.user.upn);
  if (!d) return res.status(404).json({ error: 'Draft not found' });
  res.json({
    id: d.id,
    name: d.name,
    ts: d.ts,
    project: d.project_json ? JSON.parse(d.project_json) : {},
    rows: d.rows_json ? JSON.parse(d.rows_json) : [],
    bomExisting: d.bom_existing_json ? JSON.parse(d.bom_existing_json) : [],
    newTax: d.new_tax_json ? JSON.parse(d.new_tax_json) : [],
  });
});

router.delete('/drafts/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM drafts WHERE id = ? AND user = ?').get(id, req.user.upn);
  if (!existing) return res.status(404).json({ error: 'Draft not found' });
  db.prepare('DELETE FROM drafts WHERE id = ? AND user = ?').run(id, req.user.upn);
  audit(req.user.upn, 'draft.delete', { id });
  res.json({ ok: true });
});

// ---------- /api/bom-existing ----------
router.get('/bom-existing', (req, res) => {
  const items = db.prepare('SELECT id, asset_no, bom_json FROM bom_existing WHERE user = ? ORDER BY id ASC').all(req.user.upn)
    .map(r => ({ id: r.id, assetNo: r.asset_no, bom: r.bom_json ? JSON.parse(r.bom_json) : [] }));
  res.json({ items });
});

router.post('/bom-existing', (req, res) => {
  const assetNo = str((req.body || {}).assetNo, 100);
  const rawBom = (req.body || {}).bom;
  const bom = Array.isArray(rawBom) ? rawBom.slice(0, 1000) : [];
  if (!assetNo) return res.status(400).json({ error: 'assetNo is required' });
  const now = perthISO();
  const existing = db.prepare('SELECT id FROM bom_existing WHERE user = ? AND asset_no = ?').get(req.user.upn, assetNo);
  let id;
  if (existing) {
    db.prepare('UPDATE bom_existing SET bom_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(bom || []), now, existing.id);
    id = existing.id;
  } else {
    const info = db.prepare('INSERT INTO bom_existing (user, asset_no, bom_json, updated_at) VALUES (?, ?, ?, ?)')
      .run(req.user.upn, assetNo, JSON.stringify(bom || []), now);
    id = info.lastInsertRowid;
  }
  audit(req.user.upn, 'bom-existing.upsert', { id, assetNo });
  const saved = db.prepare('SELECT id, asset_no, bom_json FROM bom_existing WHERE id = ?').get(id);
  res.json({ item: { id: saved.id, assetNo: saved.asset_no, bom: saved.bom_json ? JSON.parse(saved.bom_json) : [] } });
});

// ---------- /api/assets/search ----------
router.get('/assets/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const limit = Math.max(1, Number(req.query.limit) || 30);   // NaN-safe: bad input falls back to 30
  const rows = db.prepare('SELECT no, desc, parent, lvl FROM assets WHERE lvl >= 4').all();
  const filtered = rows.filter(a =>
    !q || (a.no && a.no.toLowerCase().includes(q)) || (a.desc && a.desc.toLowerCase().includes(q))
  ).slice(0, limit);
  res.json({ assets: filtered });
});

// ---------- /api/taxonomy/additions ----------
router.post('/taxonomy/additions', (req, res) => {
  const b = req.body || {};
  const value = str(b.value, 300), type = str(b.type, 50), code = str(b.code, 20),
    desc = str(b.desc, 2000), parent = str(b.parent, 300);
  if (!value) return res.status(400).json({ error: 'value is required' });
  const now = perthISO();
  db.prepare(`
    INSERT INTO taxonomy_additions (user, value, type, code, desc, parent, promoted, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(req.user.upn, value, type || '', code || '', desc || '', parent || '', now);
  audit(req.user.upn, 'taxonomy.addition', { value, type, code, parent });
  res.json({ ok: true });
});

router.delete('/taxonomy/additions/:value', (req, res) => {
  const value = req.params.value;
  const existing = db.prepare('SELECT id FROM taxonomy_additions WHERE user = ? AND value = ? AND promoted = 0').get(req.user.upn, value);
  if (!existing) return res.status(404).json({ error: 'Taxonomy addition not found' });
  db.prepare('DELETE FROM taxonomy_additions WHERE id = ?').run(existing.id);
  audit(req.user.upn, 'taxonomy.addition.delete', { value });
  res.json({ ok: true });
});

// ---------- CSV export ----------
function exportSessionFor(user) {
  const rows = loadUserRows(user);
  const mostRecent = db.prepare('SELECT project_json FROM onboarding_rows WHERE user = ? ORDER BY updated_at DESC, id DESC LIMIT 1').get(user);
  const PROJECT = mostRecent && mostRecent.project_json ? JSON.parse(mostRecent.project_json) : { pm: '', number: '', start: '', end: '' };
  const BOM_EXISTING = loadUserBomExisting(user);
  const NEW_TAX = loadUserUnpromotedTax(user);
  return { rows: rows.map(dbRowToDomainRow), PROJECT, BOM_EXISTING, NEW_TAX, editing: null, editIndex: -1 };
}

function sendCsv(res, filenameBase, body) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
  res.send(withBom(body));
}

router.get('/export/onboarding.csv', (req, res) => {
  const session = exportSessionFor(req.user.upn);
  const { body, base } = withSession(session, () => ({ body: buildCSV(), base: exportFileBase() }));
  audit(req.user.upn, 'export', { type: 'onboarding' });
  sendCsv(res, base, body);
});

router.get('/export/bom.csv', (req, res) => {
  const session = exportSessionFor(req.user.upn);
  const { body, base } = withSession(session, () => ({ body: buildBOMCSV(), base: exportFileBase() + ' - BOM' }));
  audit(req.user.upn, 'export', { type: 'bom' });
  sendCsv(res, base, body);
});

router.get('/export/taxonomy.csv', (req, res) => {
  const session = exportSessionFor(req.user.upn);
  const { body, base } = withSession(session, () => ({ body: buildTaxCSV(), base: exportFileBase() + ' - Taxonomy Additions' }));
  audit(req.user.upn, 'export', { type: 'taxonomy' });
  sendCsv(res, base, body);
});

// ---------- admin ----------
router.post('/admin/register-update', requireAdmin, (req, res) => {
  const userRows = loadUserRows(req.user.upn).filter(r => r.action === 'add');
  let added = 0, skipped = 0;

  const tx = db.transaction(() => {
    for (const r of userRows) {
      const no = r.asset_no;
      if (!no) { skipped++; continue; }
      const exists = db.prepare('SELECT 1 FROM assets WHERE no = ?').get(no);
      if (exists) { skipped++; continue; }
      const parentAsset = r.parent ? db.prepare('SELECT lvl FROM assets WHERE no = ?').get(r.parent) : null;
      const lvl = parentAsset && typeof parentAsset.lvl === 'number' ? parentAsset.lvl + 1 : null;
      db.prepare('INSERT INTO assets (no, desc, parent, org, lvl, tx_json) VALUES (?, ?, ?, ?, ?, ?)').run(
        no, r.asset_name || '', r.parent || '', '', lvl, r.levels_json || null
      );
      added++;
    }
  });
  tx();

  audit(req.user.upn, 'admin.register-update', { added, skipped });
  refreshDataset();
  res.json({ added, skipped });
});

router.get('/admin/dataset', requireAdmin, (req, res) => {
  res.json({ dataset: buildDataset() });
});

router.post('/admin/reseed', requireAdmin, async (req, res) => {
  // Re-run seed logic fresh for reference tables only. Clears reference tables (not
  // user-owned onboarding_rows/drafts/bom_existing/taxonomy_additions) then reseeds.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const seedPath = path.resolve(__dirname, '..', '..', 'data', 'seed-dataset.json');
  const dataset = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM taxonomy_nodes').run();
    db.prepare('DELETE FROM taxonomy_edges').run();
    db.prepare('DELETE FROM site_roots').run();
    db.prepare('DELETE FROM assets').run();
    db.prepare('DELETE FROM taken_nos').run();

    const insertNode = db.prepare('INSERT OR IGNORE INTO taxonomy_nodes (value, type, code, desc, level_desc, src) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [value, node] of Object.entries(dataset.taxonomyNodes || {})) {
      insertNode.run(value, node.type || '', node.code || '', node.desc || '', node.levelDesc || '', JSON.stringify(node));
    }
    const insertEdge = db.prepare('INSERT OR IGNORE INTO taxonomy_edges (parent, child) VALUES (?, ?)');
    for (const [parent, children] of Object.entries(dataset.edges || {})) {
      for (const child of children || []) insertEdge.run(parent, child);
    }
    const insertRoot = db.prepare('INSERT OR IGNORE INTO site_roots (value) VALUES (?)');
    for (const value of dataset.siteRoots || []) insertRoot.run(value);
    const insertAsset = db.prepare('INSERT INTO assets (no, desc, parent, org, lvl, tx_json) VALUES (?, ?, ?, ?, ?, ?)');
    for (const a of dataset.existingAssets || []) {
      insertAsset.run(a.no, a.desc || '', a.parent || '', a.org || '', typeof a.lvl === 'number' ? a.lvl : null, a.tx && a.tx.length ? JSON.stringify(a.tx) : null);
    }
    const insertTaken = db.prepare('INSERT OR IGNORE INTO taken_nos (no) VALUES (?)');
    for (const no of dataset.takenNos || []) insertTaken.run(no);

    const upsertKv = db.prepare('INSERT OR REPLACE INTO kv_json (key, json) VALUES (?, ?)');
    upsertKv.run('departments', JSON.stringify(dataset.departments || []));
    upsertKv.run('sites', JSON.stringify(dataset.sites || []));
    upsertKv.run('locAreas', JSON.stringify(dataset.locAreas || {}));
    upsertKv.run('locationOverrides', JSON.stringify(dataset.locationOverrides || []));
    upsertKv.run('meta', JSON.stringify(dataset.meta || {}));
  });
  tx();

  audit(req.user.upn, 'admin.reseed', {});
  refreshDataset();
  res.json({ ok: true });
});

export default router;
