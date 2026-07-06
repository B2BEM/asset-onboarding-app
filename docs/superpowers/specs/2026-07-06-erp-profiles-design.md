# ERP Profiles, Flexible CSV Import Mapping & Draft Management — Design Spec

**Date:** 2026-07-06
**Repo:** `C:\dev\asset-onboarding-app`
**Status:** Approved design → ready for implementation plan
**Author:** K. Duffy (B2BEM) with Claude

---

## 1. Context & problem

The Asset Onboarding app is built around B2BEM's ISO 55001 methodology: a taxonomy
hierarchy, automatic asset numbering, and classification, all implemented in **frozen**
shared domain modules (`src/shared/domain/*.js`) behind a rule-regression test gate
(`npm test`). The client (`src/client/app.js`) is a UI layer over those modules.

Today the app speaks only one CSV dialect:

- **Import** accepts only the app's own template headers — `importCSV` hard-matches
  `ASSET / TAG NAME`, `LEVEL 3–13`, etc., and rejects anything else ("Unrecognised CSV").
- **Export** emits a fixed `CSV_HEADERS` set, built **server-side** (`/api/export/onboarding.csv`,
  with UTF-8 BOM).

This blocks using the app with other ERP systems. Three capabilities are wanted:

1. **Draft management** — a Delete-draft and a Create-new button.
2. **Flexible CSV import** — review the headers in an imported CSV and map them to the
   app's fields, so files exported from other ERPs can be imported.
3. **ERP setup page** — an admin selects the ERP in use, selects/renames/reorders required
   fields (or adds custom ones) to define the blank CSV template + export, and can run the
   app in a taxonomy-free **flat** mode.

---

## 2. Decisions (locked)

| Area | Decision | Choice |
|---|---|---|
| Scope | Sequencing | All as one project, one spec |
| Core method | ISO engine vs flat | Keep ISO engine **and add flat mode** (engine off) |
| Import mapping | Reuse | **Auto-guess + save mapping per ERP profile** |
| Storage | Where profiles live | **Per-browser (localStorage)** |
| Approach | Architecture | **① I/O adapter layer** — new client module, frozen engine untouched |
| Setup access | Who opens setup | **Behind the existing Admin toggle** |
| Default export | Parity | Default ISO profile keeps **server-side** export (byte-identical); custom/flat use **client-side** export |

---

## 3. Architecture overview

Introduce one new client module — **`src/client/erpProfile.js`** — in the *client* layer,
**not** in the frozen `shared/domain`. It owns:

- the ERP profile data model + localStorage persistence,
- the field catalogue (selectable value sources) for ISO and flat modes,
- import header auto-guess + mapping application,
- the profile-driven blank-template + client-side CSV export builder.

`app.js` consumes this module. The frozen `shared/domain` modules are **unchanged**, so
`npm test` continues to pass without modification.

### 3.1 ERP profile model

```js
{
  id: string,          // stable id
  name: string,        // "B2BEM ISO 55001", "SAP PM", ...
  erpType: string,     // preset key: 'b2bem-iso' | 'sap-pm' | 'maximo' | 'pronto' | 'generic' | 'other'
  mode: 'iso' | 'flat',
  builtIn: boolean,    // default profile: true (locked from delete/rename)
  columns: [
    {
      key: string,       // stable column key
      header: string,    // ERP column label (editable) — used in template & export
      source: string,    // value source id (ISO: a catalogue field id; flat: catalogue id or 'custom')
      include: boolean,  // in template/export?
      required: boolean  // flagged required (drives template hint + soft pre-export validation)
    }
  ],
  importMap: {           // normalisedForeignHeader -> column.key (or catalogue field id)
    '<normkey>': '<target>'
  }
}
```

**localStorage keys**

- `erp.profiles` — array of profiles (JSON)
- `erp.activeId` — id of the active profile

On first load with no stored profiles, **seed the built-in "B2BEM ISO 55001" profile**
(columns mirror `CSV_HEADERS`, `mode:'iso'`, `builtIn:true`) and set it active. This makes
the default experience byte-identical to today.

### 3.2 Field catalogue (selectable value sources)

- **ISO catalogue** = the app's known internal fields:
  - export columns derived from `CSV_HEADERS` (ASSET NO, TAXONOMY PATH / LEVEL *n*, TAG NAME,
    CLASSIFICATION, PARENT ASSET, ASSET TYPE, …), each with a row→value getter matching the
    server's `buildCSV` semantics;
  - asset-info fields from `INFO_FIELDS` (make/model/serial/etc.).
- **Flat catalogue** = a generic starter set (Asset no., Tag/Name, Description, Location,
  Parent, Status) plus any custom columns. No engine-derived sources.

A **custom column** has `source:'custom'`; its value is whatever the user typed into that
column (flat mode). Custom columns are not available as ISO-derived sources.

### 3.3 ERP presets

`erpType` seeds a starting `columns` set + default `mode`. **Scope change (2026-07-06):**
three ERPs ship with their real, full column schemas (encoded data-only in
`src/client/erpSchemas.js`); the rest stay lightweight starters to be completed later.

All three full-schema presets use `mode:'iso'` (ISO-reproject): the ISO engine stays on,
and export reprojects the canonical CSV into the ERP's column layout. Columns whose
`source` names an app catalogue field are filled from the engine; `source:'custom'`
columns emit blank. Rationale: each ERP has genuine app-field matches (asset no/name,
tag, parent, make/model/serial, supplier, dates, project no), and the app's job is
ISO-engine onboarding *then* handover to the ERP.

- **`oracle-fusion-classic` — Oracle Cloud Fusion, FBDI (classic).** The complete
  `FA_MASS_ADDITIONS` sheet of the official 25C FBDI template
  `FixedAssetMassAdditionsImportTemplate.xlsm`: all **422 columns in template order**
  with the real header strings, and the template's 7 `*`-required columns flagged
  (Interface Line Number, Asset Book, Asset Description, Cost, Asset Units,
  Posting Status, Depreciate). App-field sources where a genuine match exists:
  Asset Number ← ASSET NO (AUTO), Asset Description ← ASSET NAME (AUTO),
  Tag Number ← ASSET / TAG NAME, Manufacturer ← MAKE, Model ← MODEL,
  Serial Number ← SERIAL NO., Parent Asset Number ← SELECT PARENT ASSET,
  Date Placed in Service ← ACQUIRED DATE, Supplier Name ← SUPPLIER,
  Project Number ← PROJECT NUMBER. All other columns `source:'custom'`.
  *Sources:* FBDI listing page
  `docs.oracle.com/en/cloud/saas/financials/25c/oefbf/fixedassetmassadditionsimport-3081.html`;
  the template itself
  `oracle.com/webfolder/technetwork/docs/fbdi-25c/fbdi/xlsm/FixedAssetMassAdditionsImportTemplate.xlsm`
  (sheet FA_MASS_ADDITIONS, header row 4 — parsed directly); control file
  `oracle.com/webfolder/technetwork/docs/fbdi-25c/fbdi/controlfiles/FaMassAdditions.ctl`
  (interface-column mapping; dates are YYYY/MM/DD).

- **`oracle-fusion-redwood` — Oracle Cloud Fusion, Redwood (simplified).**
  *Research finding (July 2026):* Oracle has shipped **no Redwood-specific fixed-asset
  import or spreadsheet template** as of release 26C — the Financials What's New TOCs
  24A–26C contain zero Redwood Fixed Assets features, Oracle's Redwood adoption tracker
  lists only a 23B display tweak under Asset & Lease Management, and the
  "Add Assets in Spreadsheet" task remains a classic ADFdi workbook with no published
  column list. This preset therefore encodes Oracle's documented **simplified
  asset-creation set** — the minimum attributes required to create an asset plus the
  standard identification / source-line fields (~30 columns) — using the real FBDI
  header strings so the file stays 1:1 loadable into FA_MASS_ADDITIONS. The
  distribution-level essentials (Depreciation Expense Account, Location) are appended
  and marked as such. Replace with the true Redwood template if/when Oracle ships one.
  *Sources:* release readiness What's New TOCs
  `docs.oracle.com/en/cloud/saas/readiness/erp/{24a…26c}/fins*/toc.htm`;
  Redwood adoption tracker
  `docs.oracle.com/en/cloud/saas/readiness/redwood-adoption/raoac/rw-erp.html`;
  `docs.oracle.com/en/cloud/saas/financials/25d/faalm/manually-add-assets-using-an-integrated-workbook.html`.

- **`pronto` — Pronto Xi (Fixed Assets register).** The official **Asset Entry screen**
  field set (Pronto Xi 750.2 help topic `fa/ref_screen/asset_entry_screen.htm`),
  corroborated by the Pronto Xi 780 Fixed Assets overview: **27 fields in documented
  screen order** across the help's groups (Identifier, Acquisition Type + Details,
  Acquisition Identification, Asset Grouping, Other Details, Acquisition Details).
  Pronto's Excel bulk-import column spec itself is customer-portal-gated; the import
  populates this same asset master, so the screen fields are the authoritative public
  set. The three display-only fields (Status, Bin Location, Available Qty) are encoded
  but `include:false` by default. Required flags follow the doc's logic (unique key,
  GL-driving codes, acquisition type/date, cost). App-field sources:
  Asset ← ASSET NO (AUTO), Description ← ASSET NAME (AUTO),
  Asset ID ← ASSET / TAG NAME, Attach To ← SELECT PARENT ASSET,
  Serial No ← SERIAL NO., Current Location ← LOCATION,
  Approval Number ← REGISTRATION / APPROVAL NUMBER, Acquisition Date ← ACQUIRED DATE.
  *Sources:* Pronto Xi 750.2 help "Asset Entry screen" (verbatim printout, via
  web.archive.org snapshot of scribd.com/document/751668943);
  `engage.pronto.net/hubfs/ebooks/Financials/Pronto-Xi-780-Fixed-Assets-overview.pdf`;
  `discoveryourerp.pronto.net/wp-content/uploads/2022/12/P_AO_Financials_01_1122.pdf`.

- `b2bem-iso` → full ISO columns (the built-in default), `mode:'iso'`.
- `generic` / `sap-pm` / `maximo` → a small generic **flat** starter set the user
  renames (lightweight — to be completed later).
- `other` → user names it; minimal starter columns.

---

## 4. Component specs

### 4.1 Draft management (feature 1)

**Delete draft.** In the existing "Open draft" modal (`#draftsBg`, list built by `openDrafts`),
render a small ✕ on each draft row → `confirm()` → `DELETE /api/drafts/:id` (endpoint already
exists; autosave uses it) → refresh the list. **No backend change.**

**Create new.** A "New" button by Open/Save draft in the header (`hactions`):

1. If there are unsaved rows, `confirm()`.
2. Auto-save current work as a draft (reuse the `saveDraft`/autosave path — matches today's
   "new session on open" behaviour).
3. Clear the workspace: `rows=[]`, reset `PROJECT` header, reset session, **keep the active
   ERP profile**, re-render.

Drafts persist the active profile id alongside rows/project so restoring a draft re-selects
the right profile (warn + fall back to default if that profile no longer exists in this
browser). `loadDraftObj` and the draft POST payload extend with `profileId`.

### 4.2 ERP Setup page (feature 3, admin-only)

New admin-only button **"ERP setup"** in the Admin actions menu (`hmenu`, `.admin-only`,
visibility governed by `applyAdminUI`). Opens a new modal (`#erpSetupBg`) editing the active
profile:

- **Profile bar** — dropdown of saved profiles + **New / Duplicate / Delete** (Delete disabled
  for `builtIn`).
- **ERP type** dropdown + **ISO ⟷ Flat** segmented toggle.
- **Column editor** — rows with: include ✓, editable header text, source dropdown (catalogue
  for the current mode), required ✓, drag-handle reorder, remove; **+ Add custom field**
  appends a blank custom column.
- **Live preview** of the resulting blank-CSV header row.
- **Save** → validate (≥1 included column; unique headers) → persist → set active →
  re-render template/export/table.

Switching mode swaps the catalogue and (with `confirm()`) drops sources invalid in the new mode.

### 4.3 Import header-mapping (feature 2)

Rework the front of `importCSV`:

1. Parse headers via existing `parseCSV`.
2. Build an **auto-guess** mapping: normalise each foreign header (lowercase, strip
   non-alphanumerics), then match against (a) the active profile's saved `importMap`,
   (b) the profile column headers, (c) catalogue field ids/labels, (d) a small alias table
   (e.g. "asset number"/"tag id" → asset no).
3. If **every** foreign header resolves via a *saved* mapping → import straight through (no modal).
4. Otherwise open a **mapping modal** (`#erpMapBg`): one row per foreign header showing the
   header + first sample value + a target dropdown (profile columns / catalogue fields /
   **Ignore**), pre-filled with guesses. "Import" applies it.
5. Save the confirmed mapping into `profile.importMap`; persist.
6. Convert rows using the mapping instead of hard-coded header names:
   - **ISO mode** — mapped values feed taxonomy/numbering exactly as today. The current
     template maps 1:1, so existing files never show a modal (**backward compatible**).
   - **Flat mode** — mapped values populate the row's flat `values`.

### 4.4 Flat mode

When the active profile `mode === 'flat'`:

- "Add asset" opens a **generic record form**: one input per included profile column; required
  columns flagged.
- The ISO engine (cascade, numbering, classification, BOM scoring, asset-info requiredness) is
  **not** invoked.
- Register table columns = the profile's included columns; cells read from `row.values`.
- Blank template + export are profile-driven (client-side).
- Validation = required columns filled → soft warning banner (mirrors today's non-blocking export).

Flat row shape: `{ id, values: { [colKey]: string } }` (no taxonomy/engine fields).

### 4.5 Profile-driven template & export

- **Blank template** (`downloadTemplate`) → emit the active profile's included headers (+ one
  example/guide row). Already client-side.
- **Export**:
  - Default **built-in ISO** profile → **unchanged** server-side `/api/export/*.csv`
    (guarantees byte-identical canonical output; the admin "Update register" flow depends on it).
  - **Custom or flat** profile → new client-side `buildProfileCSV(rows, profile)` in
    `erpProfile.js`: UTF-8 BOM + CRLF + the same quoting rules as `csv.js` `csvCell`;
    ISO-sourced columns computed from the frozen domain functions already imported in `app.js`
    (parity with server semantics); flat columns read `row.values`. Download via the existing
    `download()` helper.
- BOM/taxonomy export CSVs remain ISO-only (server-side) and are simply not offered for flat profiles.

---

## 5. Cross-cutting concerns

- **Server row sync.** The ISO-default export reads server rows, so ISO rows keep syncing
  (`syncImportedRows`, `/api/rows`). Custom/flat exports are client-built from in-memory rows,
  so server sync is not required for them (drafts still persist via `/api/drafts` + local autosave).
- **Backward compatibility.** With the seeded built-in profile active, every existing behaviour
  (import of the B2BEM template, server export, register update, taxonomy additions, BOM) is
  unchanged. New code paths activate only for non-default profiles / flat mode.
- **Frozen engine + test gate.** No edits to `shared/domain/*`. `npm test` must stay green.

---

## 6. Non-goals (v1 / YAGNI)

- No server-side or shared/central profile storage (per-browser only).
- Faithful per-ERP schemas ship for Oracle Fusion classic / Redwood-simplified and
  Pronto Xi (§3.3 scope change); SAP PM / Maximo / Generic / Other remain lightweight
  starters, to be completed later.
- No client-side generation of BOM or taxonomy CSVs for flat profiles.
- No multi-file / zip ERP-export import; one CSV at a time.
- No migration of existing server rows into flat shape.

---

## 7. Build order (milestones)

1. `erpProfile.js`: model + localStorage + seed built-in ISO profile + catalogue (no visible
   change; default path identical to today).
2. Draft buttons: Delete draft (list ✕) + Create new; drafts carry `profileId`.
3. ERP Setup modal (admin): profile CRUD + column editor + live preview.
4. Profile-driven blank template + client-side `buildProfileCSV` for custom/flat; default stays
   server-side.
5. Import mapping: auto-guess + mapping modal + save to profile; wire into `importCSV`.
6. Flat mode: generic add form + table rendering + engine bypass.
7. Tests + full re-verify in the running app.

---

## 8. Testing & verification

- **Regression**: `npm test` (unchanged — must pass; proves the frozen engine is untouched).
- **New unit tests** (same harness style, `test/`): profile create/serialise/round-trip;
  import auto-guess resolution; `buildProfileCSV` output for a custom ISO profile and a flat
  profile (BOM / CRLF / quoting); flat row handling.
- **Manual** (preview server, `localhost:8080`) per milestone: default path unchanged;
  delete / create-new drafts; setup page CRUD; import a non-B2BEM CSV → mapping modal → rows
  land; flat profile add + export.

---

## 9. Files touched

- **New**: `src/client/erpProfile.js`; `src/client/erpSchemas.js` (data-only ERP column
  schemas); new modals in `src/client/index.html`
  (`#erpSetupBg`, `#erpMapBg`) + "New" and "ERP setup" buttons; styles in
  `src/client/styles.css`; new tests in `test/`.
- **Changed**: `src/client/app.js` (draft buttons, `importCSV` rework, template/export routing,
  flat-mode rendering, admin button wiring). Optional README/docs note.
- **Unchanged**: all `src/shared/domain/*`; server routes (draft DELETE already exists).
