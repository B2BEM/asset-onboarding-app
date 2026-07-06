#!/usr/bin/env node
// One-shot transform: strip the original operator's location/register data from data/seed-dataset.json,
// keeping the asset-class taxonomy, parent→child edges and generic functional site roots.
// Kept: taxonomyNodes (839), edges (443 parents), siteRoots (40).
// Cleared: departments, sites, locAreas, existingAssets, takenNos, locationOverrides; meta reset.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '..', 'data', 'seed-dataset.json');

const d = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

const out = {
  taxonomyNodes: d.taxonomyNodes,
  edges: d.edges,
  siteRoots: d.siteRoots,
  departments: [],
  sites: [],
  locAreas: {},
  existingAssets: [],
  takenNos: [],
  locationOverrides: [],
  meta: { source: 'ISO 55001 Asset Onboarding — generic template seed', assetCount: 0, assetSource: '' }
};

fs.writeFileSync(SEED_PATH, JSON.stringify(out));
console.log('[make-generic-seed] written:', {
  taxonomyNodes: Object.keys(out.taxonomyNodes).length,
  edgeParents: Object.keys(out.edges).length,
  siteRoots: out.siteRoots.length,
  existingAssets: out.existingAssets.length,
  takenNos: out.takenNos.length
});
