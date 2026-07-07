# Taxonomy CSV import/export — design

**Date:** 2026-07-07
**Status:** Approved (design). Implementation pending.
**Mode:** ISO-mode only (adopted flat profiles are intentionally taxonomy-free).

## Purpose

Let an **admin** replace the app's classification taxonomy (the cascade) by loading a
dedicated taxonomy CSV, so the loaded file becomes the classification **source of truth**
for all users. Provide the inverse — download the current full taxonomy as a CSV — for
backup and as an editable template (today `buildTaxCSV` only dumps in-session `NEW_TAX`,
never the full tree). Import and export share one CSV shape and round-trip losslessly.

## CSV format (the inverse of `buildTaxCSV`)

Five columns, matched by normalized header name (case/space-insensitive, order-independent):

| Column | Maps to |
|---|---|
| `TAXONOMY VALUE` | node key (`value`) — unique |
| `TAXONOMY TYPE` | `type` (free text, e.g. `REFERENCE`, `EQUIPMENT`) |
| `CODE` | `code` |
| `DESCRIPTION` | `desc` |
| `PARENT TAXONOMY VALUE` | parent node's value; empty ⇒ this row is a root |

Synthetic example:

```
TAXONOMY VALUE,TAXONOMY TYPE,CODE,DESCRIPTION,PARENT TAXONOMY VALUE
<PUMPING>,REFERENCE,PMP,Pumping systems,
<PUMPING> CENTRIFUGAL,EQUIPMENT,CFP,Centrifugal pumps,<PUMPING>
```

## Decisions (settled during brainstorming)

- **Scope:** server-persisted, admin-gated. Becomes the real classification for everyone,
  survives restarts. Mirrors the existing admin `reseed` / `register-update` paths.
- **Combine mode:** **full replace** — clear and rebuild the taxonomy tables solely from the
  CSV. The existing asset register (`assets` / `taken_nos`) is left untouched.
- **Backup/round-trip:** yes — add a full-taxonomy CSV export in the same format.
- **Validation:** strict, all-or-nothing (transaction rollback on any error), collecting all
  errors at once.

## Architecture

Layers stay as they are: a pure shared-domain module holds the logic; the server persists;
the client is a thin admin UI.

### 1. `src/shared/domain/taxonomyImport.js` (new, pure — no DOM, no DB)

The single unit-tested core.

- `parseTaxonomyCSV(text)` → `{ ok, dataset?, stats?, errors? }`
  - `dataset` = `{ taxonomyNodes, edges, siteRoots }`, byte-shape-compatible with
    `buildDataset()`'s taxonomy fields (`taxonomyNodes` keyed by value →
    `{value,type,code,desc}`; `edges` keyed by parent → `[child,…]` in row order;
    `siteRoots` = root values in row order).
  - `stats` = `{ nodes, roots }`.
  - `errors` = `string[]` (present only when `ok` is false).
  - Includes a compact RFC-4180 field parser (quoted fields, embedded commas/quotes,
    CRLF/LF). Self-contained so the server can use it without importing client code.
- `taxonomyToCSV(dataset)` → `string`
  - DFS pre-order from `siteRoots` following `edges`, emitting the five columns per node.
  - Any node not reachable from a root is appended afterwards (defensive; a valid tree has
    none). Reuses `csvCell` from `csv.js` for quoting, or an equivalent local helper.

### 2. Validation rules (inside `parseTaxonomyCSV`)

Fails (returns `ok:false` with every applicable message) when:

1. any of the 5 required headers is missing;
2. a data row has a blank `TAXONOMY VALUE`;
3. a `TAXONOMY VALUE` is duplicated;
4. a non-empty `PARENT TAXONOMY VALUE` does not resolve to a defined `TAXONOMY VALUE` (orphan);
5. the parent graph contains a cycle;
6. there are zero roots (every row has a parent).

Fully-blank rows are dropped before validation. Field lengths / row counts are capped to
bound pathological input (server also bounds via `str()`).

### 3. Server (`src/server/routes.js`)

Mirrors `POST /admin/reseed` and `updateRegister`.

- `POST /api/admin/taxonomy-import` (`requireAdmin`)
  - Body `{ csv: "<text>" }` (reuses the existing 10 MB `express.json`).
  - `const r = parseTaxonomyCSV(body.csv)`; if `!r.ok` → `400 { errors: r.errors }`.
  - Else one `db.transaction()`:
    - `DELETE FROM taxonomy_nodes / taxonomy_edges / site_roots` (NOT assets/taken_nos);
    - re-`INSERT` nodes (`value,type,code,desc,level_desc='',src=JSON.stringify(node)`),
      edges (`parent,child`), roots (`value`) — same statements as `reseed`.
  - `refreshDataset()`; `audit(user,'admin.taxonomy-import',{nodes,roots})`;
    respond `{ ok:true, stats }`.
- `GET /api/admin/taxonomy.csv` (`requireAdmin`)
  - `taxonomyToCSV(buildDataset())`, sent with BOM via the existing `sendCsv` helper;
    filename base e.g. `"<perthDate> - Taxonomy"`.

### 4. Client (`src/client/app.js` + `index.html`)

Mirrors the `updateRegister` admin action. Two entries in the existing admin ⋯ menu
(`.admin-only`; also hidden in flat mode via `applyProfileUI`), plus a hidden
`#fileTaxonomy` input (`accept=".csv"`).

- **Import taxonomy…** → `importTaxonomy()`
  - `if(!IS_ADMIN) return toast(...)`; open file picker; read text;
  - `confirm('Replace the entire classification taxonomy with "<file>"? This replaces the
    taxonomy for all users.')`;
  - `POST /api/admin/taxonomy-import {csv}`;
  - ok → `await refreshBootstrap()` + `toast('Taxonomy replaced (N nodes, R roots)')`;
  - 400 → `showBanner(errors.join(' · '), true)` (first N + count if long).
- **Download taxonomy** → `downloadTaxonomy()` → `window.location='/api/admin/taxonomy.csv'`.

### 5. Testing — new gate

`test/taxonomyImport.test.js`, added to `package.json` `test` script as the 4th gate
(`generic + erpProfile + structure + taxonomyImport`). Cases:

- valid CSV → expected `taxonomyNodes` / `edges` / `siteRoots` + `stats`;
- **round-trip**: `dataset → taxonomyToCSV → parseTaxonomyCSV` deep-equals the original
  (order-preserving);
- orphan parent → `ok:false` with the orphan error;
- cycle → `ok:false`;
- duplicate value → `ok:false`;
- missing header → `ok:false`;
- no root → `ok:false`;
- quoted fields with embedded commas/quotes preserved.

## Files touched

| File | Change |
|---|---|
| `src/shared/domain/taxonomyImport.js` | new — pure parse/build/export |
| `test/taxonomyImport.test.js` | new — 4th gate |
| `src/server/routes.js` | +2 admin endpoints |
| `src/client/index.html` | admin ⋯ menu entries + hidden file input |
| `src/client/app.js` | `importTaxonomy` / `downloadTaxonomy` + wiring + flat-mode hide |
| `package.json` | add 4th gate to `test` |
| `README.md` | document admin taxonomy import/export |

## Edge cases & interactions

- After a replace, a user's already-classified rows may reference values no longer in the
  taxonomy → rendered as ⚠ in the tax path (warn-only, never blocks export). Called out in
  the confirm dialog.
- Existing register assets remain selectable as parents (they live in `assets`, untouched).
- UI entry points are ISO-mode-only; the endpoints are admin-only server-side regardless of
  a user's profile mode.
- Other users see the new taxonomy on their next load / `refreshBootstrap` (same propagation
  model as `reseed` / `register-update` today).

## Out of scope (YAGNI for v1)

- Merge/upsert mode (chose full replace).
- Per-branch or partial taxonomy edits in the UI (this is bulk CSV replace only).
- Undo beyond: download-before-replace (now available) and the existing admin `reseed`
  (factory reset).
- Migrating existing rows' stale taxonomy references.
