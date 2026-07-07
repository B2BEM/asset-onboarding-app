# Site-scope edge fixes — design

Date: 2026-07-07
Status: approved ("go" — #1 and #2 only), ready for implementation

Two correctness fixes surfaced by the full bug sweep, both inside the
2026-07-07 site-scoping work. Continuation of
[2026-07-07-site-scope-rows-design.md](2026-07-07-site-scope-rows-design.md).

## Problem

### #1 — Deleting the currently-selected site leaves the table scoped to the deleted site

`renderRows()` (src/client/app.js) calls `renderIsoRows()` — which reads the
selected site from `#selSite` via `currentSite()` — *before* `updateWizard()`
runs `buildSites()`, which reconciles `#selSite` against the sites that still
exist. When the selected site row is deleted, that render still scopes the
table to the now-gone site (showing only its orphaned ex-children, hiding the
company and every other site), while `buildSites()` then silently resets the
dropdown to "All sites" without triggering a re-render. Table and dropdown
disagree until the next interaction.

Reachable through ordinary use: select a site, click ✕ on that site's row.

### #2 — Duplicate asset numbers mis-scope rows

`inSiteScope(entry, siteNo, parentOf)` (src/shared/domain/structure.js) begins
its chain climb at `entry.no` and walks purely via `parentOf`, so it *ignores
the entry's own `entry.parent`* whenever `entry.no` is set. The callers
(`renderIsoRows`, `assetOptions`, `bomExAssetOptions`) build `parentOf` from a
**first-wins** `no → parent` map. When two entries share an asset number,
`parentOf(no)` resolves to the *first* entry's parent, so the second entry is
scoped by the wrong parent chain — it vanishes from its real site and appears
under the other one.

Low reachability via the normal UI (§3.10 blocks duplicate *session* asset nos
at save), but the register table intentionally permits duplicate `no` values
(see db.js) and the server persists rows without enforcing §3.10, so the
weakness is latent. The maintainer flagged "duplicate/blank asset numbers" as
an explicit edge case for this sweep.

Node repro (against the real `structure.js`): two rows share `no = DUP`, one
under site `CO1-S1`, one under `CO1-S2`. Selecting `CO1-S2` shows the DUP row
that belongs to `CO1-S1`, and hides the one that belongs to `CO1-S2`.

## Design

### #2 — `inSiteScope` uses the entry's own parent (src/shared/domain/structure.js)

Climb the entry's self+ancestor chain using `entry.parent` for the **first
hop** (authoritative even when another row shares this asset no), then follow
`parentOf` for the remaining ancestors. Keep the two existing scope rules:

- the site row itself (`entry.no === siteNo`) is in scope;
- an entry that is an *ancestor of the site* (the company above it) is in scope
  (`chainOf(siteNo).has(entry.no)`).

The `parentOf`-based climb is retained only for hops *above* the entry's
declared parent, where no per-entry authority exists. All eleven existing
`structure.test.js` `inSiteScope`/seam cases are preserved (verified), because
in the consistent case `entry.parent === parentOf(entry.no)`.

### #1 — reconcile the site before scoping the table (src/client/app.js)

In `renderRows()`, run `updateWizard()` (which calls `buildSites()` to
reconcile `#selSite`) **before** `renderIsoRows()`. A no-op in the normal case
(a still-valid selection is preserved, so the table scopes to the same site);
in the delete case the dropdown resets to "All sites" first, so the table
renders un-scoped and matches the dropdown. `updateWizard()` does not read
anything `renderIsoRows()` writes (`#rowsBody` / `#rowCount`), so the reorder
is side-effect-free.

## Tests

- `structure.test.js`: add an `inSiteScope` duplicate-no gate — two entries
  sharing an asset no under different sites are each scoped to their **own**
  parent's site (the flagged edge). Existing cases stay green.
- #1 is DOM/ordering only (no pure-function seam); verified live against
  https://localhost:10443 (delete the selected site → table shows all remaining
  rows, dropdown reads "All sites").

## Out of scope (reported, not changed)

CSV guard losslessness (`csvGuard`/`csvUnguard` non-injective for `'`+formula
values), `nextSequence` prefix-substring contamination, register-import
`skipped` under-reporting, and other low/near-unreachable edges — see the sweep
report. Left untouched per maintainer direction (the CSV guard is freshly
shipped security code).
