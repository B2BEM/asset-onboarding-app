// Rebuilds the full in-memory dataset object FROM THE DB, byte-shape-compatible with
// data/seed-dataset.json, and feeds it into the frozen shared domain module (initData).
// Called at boot and after any register-update / reseed / taxonomy promotion (README §4, §6-§9).
import db from './db.js';
import { initData } from '../shared/domain/data.js';

const KV_KEYS = ['departments', 'sites', 'locAreas', 'locationOverrides', 'meta'];

function loadKv(key, fallback) {
  const row = db.prepare('SELECT json FROM kv_json WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.json); } catch { return fallback; }
}

// taxonomyNodes: object keyed by value -> {value,type,code,desc,levelDesc,suffix}
function buildTaxonomyNodes() {
  const rows = db.prepare('SELECT value, type, code, desc, level_desc, src FROM taxonomy_nodes').all();
  // null-proto: `value` is a stored TAXONOMY VALUE that may legitimately be "toString",
  // "constructor", etc. On a plain {} those keys collide with Object.prototype (silently
  // dropping the node, or — in buildEdges — crashing .push on the inherited function).
  const out = Object.create(null);
  for (const r of rows) {
    let node;
    try { node = JSON.parse(r.src); } catch { node = null; }
    out[r.value] = node || {
      value: r.value, type: r.type || '', code: r.code || '', desc: r.desc || '',
      levelDesc: r.level_desc || '', suffix: '',
    };
  }
  return out;
}

// edges: object keyed by parent -> [child, ...] (array-of-strings JSON stored per parent for exact order)
function buildEdges() {
  const rows = db.prepare('SELECT parent, child FROM taxonomy_edges ORDER BY rowid ASC').all();
  const out = Object.create(null); // null-proto: `parent` is an untrusted TAXONOMY VALUE (see buildTaxonomyNodes)
  for (const r of rows) {
    if (!out[r.parent]) out[r.parent] = [];
    out[r.parent].push(r.child);
  }
  return out;
}

function buildSiteRoots() {
  return db.prepare('SELECT value FROM site_roots ORDER BY rowid ASC').all().map(r => r.value);
}

function buildExistingAssets() {
  const rows = db.prepare('SELECT no, desc, parent, org, lvl, tx_json FROM assets ORDER BY rowid ASC').all();
  return rows.map(r => {
    const a = { no: r.no, desc: r.desc || '', parent: r.parent || '', org: r.org || '', lvl: r.lvl };
    if (r.tx_json) {
      try { const tx = JSON.parse(r.tx_json); if (tx && tx.length) a.tx = tx; } catch { /* ignore malformed tx */ }
    }
    return a;
  });
}

function buildTakenNos() {
  return db.prepare('SELECT no FROM taken_nos ORDER BY rowid ASC').all().map(r => r.no);
}

// taxonomy_additions (promoted=1 only) merged on top of base taxonomy_nodes/edges — approved extension:
// promotion writes directly into taxonomy_nodes/taxonomy_edges (see routes.js), so buildTaxonomyNodes/
// buildEdges already include them. This helper is kept for callers that want additions in isolation.
function buildPromotedAdditions() {
  return db.prepare('SELECT * FROM taxonomy_additions WHERE promoted = 1 ORDER BY id ASC').all();
}

function buildDataset() {
  return {
    taxonomyNodes: buildTaxonomyNodes(),
    edges: buildEdges(),
    siteRoots: buildSiteRoots(),
    departments: loadKv('departments', []),
    sites: loadKv('sites', []),
    locAreas: loadKv('locAreas', {}),
    existingAssets: buildExistingAssets(),
    takenNos: buildTakenNos(),
    meta: loadKv('meta', {}),
    locationOverrides: loadKv('locationOverrides', []),
  };
}

// Rebuild dataset from DB and push into the shared domain module's live indexes.
function refreshDataset() {
  const dataset = buildDataset();
  initData(dataset);
  return dataset;
}

export { buildDataset, refreshDataset, buildPromotedAdditions, KV_KEYS };
