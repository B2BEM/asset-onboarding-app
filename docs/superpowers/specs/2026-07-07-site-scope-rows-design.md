# Site-scoped main-page rows + hierarchical display order — design

Date: 2026-07-07
Status: approved ("go"), ready for implementation

Two changes to the main-page onboarding table (ISO mode), continuing the
2026-07-07 register-import/site-fix work.

## Problem

1. With SITE = "south" selected, the `B2BE-NTH` (North site) row is still
   visible. The dropdown scopes the parent picker but `renderIsoRows()`
   (src/client/app.js) renders every session row; `#selSite.onchange` only
   calls `refreshAddBtn`, never re-renders the table.
2. Rows render in insertion order. Entering company → south → class → north
   shows north *after* the class row instead of under its parent. Rows must
   display cascading from LVL 1 (COMPANY) down, children under their parent,
   regardless of entry order.

## Design

### New pure helpers — `src/shared/domain/structure.js`

- `hierarchyOrder(entries)` — `entries = [{no, parent}]` (session rows in
  input order). Returns the indices in depth-first display order: roots =
  entries whose `parent` is not another entry's `no` (rows parented to a
  register asset root their own subtree); sibling and root order = input
  order; cycle-safe (an emitted entry is never emitted twice; entries left
  rootless by a cycle are appended in input order).
- `inSiteScope(entry, siteNo, parentOf)` — `entry = {no, parent}`,
  `parentOf(no) → parent no or ''` (spans session rows AND register assets).
  True when: no site selected; the site is on the entry's self+ancestor chain
  (the site row itself and everything under it); or the entry is on the
  *site's* ancestor chain (the company above it). Other sites and their
  subtrees are false. An entry with neither `no` nor `parent` resolvable is
  out of scope while a site is selected. Chain climbing is cycle-safe.

### `src/client/app.js`

- `renderIsoRows()`:
  - Build `noOf(r) = r.assetNo || proposedAssetNo(r) || ''` and a
    session-no → row map; `parentOf` falls through to `ASSET_BY_NO`.
  - Order rows via `hierarchyOrder`, then filter by `inSiteScope` against
    `currentSite()`, then the existing issues-only + search filters.
  - `#` column shows the *display* position; `data-edit`/`data-del` keep the
    original `rows` index (the click handler indexes into `rows`).
  - "N shown" suffix appears whenever any filter (site/search/issues) hides
    rows, not just search.
- Delete confirm labels the row by asset no/tag instead of `#(index+1)`
  (display numbers no longer match array indices).
- `$('#selSite').onchange` → `refreshAddBtn()` **and** `renderRows()`.
- `index.html` hint text: "Parent assets are limited to the selected site."
  → "Rows and parent assets are limited to the selected site."

### Non-impact

Flat-profile rendering (`renderFlatRows`), CSV export order, server rows API,
and draft persistence are untouched — this is display order/visibility only.
"All sites" (empty selection) shows everything, ordered hierarchically.

## Tests — extend `test/structure.test.js`

- `hierarchyOrder`: out-of-entry-order input reorders children under parents
  from level 1 down; register-parented row roots its subtree; sibling order =
  input order; cycle pair emitted once each, in input order.
- `inSiteScope`: site row itself, child, grandchild → true; company (ancestor
  of site) → true; sibling site and its child → false; no site selected →
  true; chain spanning register assets (session class under register site) →
  true for that site, false for another.

## Follow-up (same day): pickers must use the same site scope

With SITE = North selected, the Add-asset parent picker still offered the South
class `B2BE-STH-B&I` ("added this session"). Cause: `assetOptions()` site-limits
only *register* assets, by number-prefix (`no === site || no.startsWith(site+'-')`),
while the session-row branch appends qualifying rows with no site check at all.
`bomExAssetOptions()` uses the same prefix heuristic.

Fix: both pickers scope through `inSiteScope` with a `parentOf` spanning session
rows and register assets — the same definition of "belongs to the site" the
table uses. This also correctly scopes entries whose numbering doesn't carry
the site prefix (e.g. imported registers). `/api/assets/search` already returns
`parent`, so BOM-to-existing entries chain-climb even before bootstrap knows them.

## Verification

`npm test` (all 5 gates) → commit spec + impl separately → ff `main` in
`C:\dev` → docker rebuild → served `app.js` contains the new logic; user
confirms in browser: with "south" selected only B2BE ▸ B2BE-STH ▸ B2BE-STH-B&I
show (north hidden), rows cascade under their parents, "All sites" shows all
four in tree order.
