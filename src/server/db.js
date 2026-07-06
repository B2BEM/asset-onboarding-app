// SQLite connection + schema (README §7). One shared connection, WAL mode for
// concurrent read/write safety under Express's single-process, many-request model.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(REPO_ROOT, process.env.DB_PATH)
  : path.resolve(REPO_ROOT, 'data', 'app.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- "no" is deliberately NOT unique: the master register fixture contains duplicate
-- asset numbers, and the domain layer's ASSETS array must reproduce them in order
-- (ASSET_BY_NO last-wins semantics depend on it).
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no TEXT NOT NULL,
  desc TEXT,
  parent TEXT,
  org TEXT,
  lvl INTEGER,
  tx_json TEXT
);

CREATE TABLE IF NOT EXISTS taxonomy_nodes (
  value TEXT PRIMARY KEY,
  type TEXT,
  code TEXT,
  desc TEXT,
  level_desc TEXT,
  src TEXT
);

CREATE TABLE IF NOT EXISTS taxonomy_edges (
  parent TEXT NOT NULL,
  child TEXT NOT NULL,
  PRIMARY KEY (parent, child)
);

CREATE TABLE IF NOT EXISTS site_roots (
  value TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS taken_nos (
  no TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS users (
  upn TEXT PRIMARY KEY,
  display_name TEXT,
  role TEXT,
  last_seen TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  action TEXT,
  detail TEXT,
  at TEXT
);

CREATE TABLE IF NOT EXISTS onboarding_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  project_json TEXT,
  action TEXT,
  parent TEXT,
  levels_json TEXT,
  tag TEXT,
  desc TEXT,
  dept TEXT,
  loc TEXT,
  classification TEXT,
  abbreviation TEXT,
  number TEXT,
  work_orderable INTEGER,
  class_override TEXT,
  abbr_override TEXT,
  duty TEXT,
  item_type TEXT,
  groups_minor_items INTEGER,
  has_concrete_assets_beneath INTEGER,
  asset_no TEXT,
  asset_name TEXT,
  info_json TEXT,
  bom_json TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS bom_existing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  asset_no TEXT,
  bom_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  name TEXT,
  project_json TEXT,
  rows_json TEXT,
  bom_existing_json TEXT,
  new_tax_json TEXT,
  ts TEXT
);

CREATE TABLE IF NOT EXISTS taxonomy_additions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  value TEXT,
  type TEXT,
  code TEXT,
  desc TEXT,
  parent TEXT,
  promoted INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS kv_json (
  key TEXT PRIMARY KEY,
  json TEXT
);

CREATE TABLE IF NOT EXISTS seed_meta (
  version TEXT PRIMARY KEY,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_onboarding_rows_user ON onboarding_rows(user);
CREATE INDEX IF NOT EXISTS idx_bom_existing_user_asset ON bom_existing(user, asset_no);
CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts(user);
CREATE INDEX IF NOT EXISTS idx_taxonomy_additions_user ON taxonomy_additions(user);
CREATE INDEX IF NOT EXISTS idx_assets_parent ON assets(parent);
CREATE INDEX IF NOT EXISTS idx_assets_no ON assets(no);
`);

export default db;
export { DB_PATH, REPO_ROOT };
