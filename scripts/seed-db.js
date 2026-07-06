#!/usr/bin/env node
// Idempotent versioned seed from data/seed-dataset.json into SQLite (README §7).
// Second run must be a no-op (checked via seed_meta).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../src/server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SEED_PATH = path.resolve(REPO_ROOT, 'data', 'seed-dataset.json');

// Bump this when the seed dataset shape/content changes in a way that requires re-seeding.
const SEED_VERSION = '2';

function loadSeed() {
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  return JSON.parse(raw);
}

function seedReferenceTables(dataset) {
  const insertNode = db.prepare(
    'INSERT OR IGNORE INTO taxonomy_nodes (value, type, code, desc, level_desc, src) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertEdge = db.prepare('INSERT OR IGNORE INTO taxonomy_edges (parent, child) VALUES (?, ?)');
  const insertRoot = db.prepare('INSERT OR IGNORE INTO site_roots (value) VALUES (?)');
  // Plain INSERT (not OR IGNORE): the fixture contains duplicate asset numbers that
  // must be preserved in order; idempotency is handled by the seed_meta version guard.
  const insertAsset = db.prepare(
    'INSERT INTO assets (no, desc, parent, org, lvl, tx_json) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertTaken = db.prepare('INSERT OR IGNORE INTO taken_nos (no) VALUES (?)');
  const upsertKv = db.prepare('INSERT OR REPLACE INTO kv_json (key, json) VALUES (?, ?)');

  const tx = db.transaction(() => {
    // taxonomy_nodes
    let nodeCount = 0;
    for (const [value, node] of Object.entries(dataset.taxonomyNodes || {})) {
      insertNode.run(value, node.type || '', node.code || '', node.desc || '', node.levelDesc || '', JSON.stringify(node));
      nodeCount++;
    }

    // taxonomy_edges (preserve child order via rowid insertion order — array iteration)
    let edgeCount = 0;
    for (const [parent, children] of Object.entries(dataset.edges || {})) {
      for (const child of children || []) {
        insertEdge.run(parent, child);
        edgeCount++;
      }
    }

    // site_roots
    let rootCount = 0;
    for (const value of dataset.siteRoots || []) {
      insertRoot.run(value);
      rootCount++;
    }

    // assets (existingAssets)
    let assetCount = 0;
    for (const a of dataset.existingAssets || []) {
      insertAsset.run(a.no, a.desc || '', a.parent || '', a.org || '', typeof a.lvl === 'number' ? a.lvl : null, a.tx && a.tx.length ? JSON.stringify(a.tx) : null);
      assetCount++;
    }

    // taken_nos
    let takenCount = 0;
    for (const no of dataset.takenNos || []) {
      insertTaken.run(no);
      takenCount++;
    }

    // kv_json catch-all (verbatim shapes)
    upsertKv.run('departments', JSON.stringify(dataset.departments || []));
    upsertKv.run('sites', JSON.stringify(dataset.sites || []));
    upsertKv.run('locAreas', JSON.stringify(dataset.locAreas || {}));
    upsertKv.run('locationOverrides', JSON.stringify(dataset.locationOverrides || []));
    upsertKv.run('meta', JSON.stringify(dataset.meta || {}));

    return { nodeCount, edgeCount, rootCount, assetCount, takenCount };
  });

  return tx();
}

function main() {
  const already = db.prepare('SELECT version, applied_at FROM seed_meta WHERE version = ?').get(SEED_VERSION);
  if (already) {
    console.log(`[seed-db] seed_meta already has version ${SEED_VERSION} (applied_at=${already.applied_at}) — no-op.`);
    return;
  }

  const dataset = loadSeed();
  const counts = seedReferenceTables(dataset);

  const perthISO = () => {
    const d = new Date();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Perth', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const tm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Perth', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
    return day + 'T' + tm.replace(/^24/, '00');
  };

  db.prepare('INSERT OR REPLACE INTO seed_meta (version, applied_at) VALUES (?, ?)').run(SEED_VERSION, perthISO());

  console.log(`[seed-db] seeded version ${SEED_VERSION}:`, counts);
}

main();
