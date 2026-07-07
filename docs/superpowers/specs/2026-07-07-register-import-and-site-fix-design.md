# Register CSV import (file picker) + SITE dropdown fix — design

Date: 2026-07-07
Status: approved (brainstorming), ready for implementation

Two changes to the asset-onboarding app, both touching the admin register flow.

---

## Part 1 — SITE dropdown misses childless sites (bug)

### Symptom
An admin created company `B2BE` with two sites: `B2BE-STH` (has asset class
`B2BE-STH-B&I`) and `B2BE-NTH` (no children yet). The `#selSite` dropdown only
lists `B2BE-STH`. A site with no asset class under it never appears.

### Cause
`buildSites()` in `src/client/app.js` (~line 990) filters level-2 entries to
only those that already contain a child:

```js
const hasChild = no => CONTAINER_NOS.has(no) || rows.some(r=>r.action==='add' && r.parent===no);
const tops=wizardEntriesAtLevel(2).filter(s=>hasChild(s.no));
```

In the ladder (1=COMPANY, 2=SITE, 3=ASSET CLASS, 4+=assets), a level-2 row under
a company **is** a site by definition — childless or not. The `hasChild` filter
is wrong.

### Fix
Drop the filter and the now-unused `hasChild` local. List every level-2 entry
(register or in-session):

```js
const tops = wizardEntriesAtLevel(2);
```

### Impact / non-impact
- `currentSite()` reads `#selSite.value` — unaffected.
- `refreshAddBtn()` gates on `structureOk()`, not the site list — unaffected.
- The parent picker uses `assetOptions()`, not `buildSites()` — unaffected.
- Net: `B2BE-NTH` appears immediately after creation, alongside `B2BE-STH`.

### Verification
Live: create a company + two sites (one childless), confirm both appear in the
dropdown immediately; confirm site scoping still filters rows; confirm no
regression to the Add-asset button or the parent picker.

---

## Part 2 — "Update register" becomes a CSV file import

### Current behaviour (to be replaced)
- `#btnRegister` (index.html) title claims it "pulls onboarding CSVs from the
  SharePoint folder". This is stale — there is **no** folder-reading code.
- `updateRegister()` (app.js ~954) POSTs `/api/admin/register-update`.
- `/api/admin/register-update` (routes.js ~341) reads the current admin's own
  `onboarding_rows` (action=`add`) from the DB and merges them into `assets`,
  deduped by asset `no`, deriving `lvl` from the parent asset's `lvl+1`.

### Decisions (locked)
1. **Picker:** hidden `<input type=file accept=".csv">` (same pattern as the
   existing taxonomy import). Not the File System Access API.
2. **CSV format:** the app's own onboarding export ("Asset hierarchy" /
   `onboarding.csv`, produced by `buildCSV` in `src/shared/domain/csv.js`).
3. **Merge semantics:** merge + dedup (add new asset `no`s, skip existing).
   Not a full replace.
4. **Old endpoint:** remove `/api/admin/register-update` entirely.

### New shared parser — `src/shared/domain/registerImport.js`
Pure, DOM-free / DB-free, modeled on `taxonomyImport.js`. Exports
`parseRegisterCSV(text)`.

- Reuses the same RFC-4180-ish grid parser (quoted commas/quotes/newlines, CRLF
  or LF, leading BOM) and header normalisation as `taxonomyImport.js`.
- Required header columns (from `CSV_HEADERS`): `ADD ROW?`, `SELECT PARENT ASSET`,
  `ASSET NO (AUTO)`, `ASSET NAME (AUTO)`. Missing any of these → hard error (the
  file isn't an onboarding export). The `LEVEL 3`…`LEVEL 13` columns are optional
  detail: captured when present, absent columns contribute nothing.
- For each data row where `ADD ROW?` is truthy (`TRUE`, case-insensitive), emit:
  ```js
  { no: <ASSET NO (AUTO)>, name: <ASSET NAME (AUTO)>,
    parent: <SELECT PARENT ASSET>, levels: [<LEVEL 3..13, trailing blanks trimmed>] }
  ```
- Rows where `ADD ROW?` is not truthy are ignored (update/retire/blank rows).
- An ADD row with a blank `ASSET NO (AUTO)` is **skipped** and counted
  (`stats.skippedNoId`), not a hard error — a valid export must never bounce.
- Duplicate `no` within the file: first wins, rest skipped and counted
  (`stats.skippedDup`).
- Returns `{ ok:true, records, stats:{ rows, records, skippedNoId, skippedDup } }`
  or `{ ok:false, errors:[...] }`.
- `MAX_ROWS` guard mirrors the taxonomy parser.

### Server — `src/server/routes.js`
- Add `POST /api/admin/register-import` (`requireAdmin`):
  - Read `req.body.csv` (string). Empty → `400 { errors:['No CSV supplied.'] }`.
  - `const r = parseRegisterCSV(csvText)`; if `!r.ok` → `400 { errors:r.errors }`.
  - Run the **same merge transaction** the old endpoint used, over `r.records`:
    - skip if `no` missing or `SELECT 1 FROM assets WHERE no = ?` exists → `skipped++`;
    - else `lvl = parentAsset.lvl + 1` (or `null`), and
      `INSERT INTO assets (no, desc, parent, org, lvl, tx_json)` with
      `desc = record.name`, `org = ''`,
      `tx_json = record.levels.length ? JSON.stringify(record.levels) : null`.
  - `audit(user, 'admin.register-import', { added, skipped })`, `refreshDataset()`,
    `res.json({ added, skipped })`.
- **Remove** the `POST /api/admin/register-update` handler.

### Client — `src/client/index.html`
- Add hidden input beside `#fileTaxonomy`:
  `<input type="file" id="fileRegister" accept=".csv,text/csv" style="display:none">`.
- Change `#btnRegister` title to:
  "Admin: import an onboarding CSV to merge new assets into the internal register".

### Client — `src/client/app.js`
- `updateRegister()` → open the picker (mirror `importTaxonomy()`):
  ```js
  function updateRegister(){ if(!IS_ADMIN){ toast('Admin sign-in required to update the register'); return; } $('#fileRegister').click(); }
  ```
- New `importRegisterFile(file)` mirroring `importTaxonomyFile`:
  - read `file.text()`; on failure toast and return;
  - `confirm('Import assets from “'+file.name+'” into the register?\n\nNew asset numbers are added; ones already in the register are skipped. (The taxonomy is unaffected.)')`;
  - POST `/api/admin/register-import` with `{ csv:text }`;
  - on `!res.ok` → `showBanner` with the returned errors (same slice/format as taxonomy import);
  - on ok → `await refreshBootstrap()`, `hideBanner()`,
    `updateDsInfo('register +'+o.added+' · '+perthDateTime())`,
    toast `+added` / `skipped` (reuse the wording from the old `updateRegister`).
- Wire `$('#fileRegister').onchange` next to `$('#fileTaxonomy').onchange`:
  `if($('#fileRegister')) $('#fileRegister').onchange=e=>{ if(e.target.files[0]) importRegisterFile(e.target.files[0]); e.target.value=''; };`

### Tests — `test/registerImport.test.js` (new gate)
Unit gate on the pure parser (mirrors `taxonomyImport.test.js`):
- valid parse: ADD rows → records; non-ADD rows ignored; `parent`, `name`,
  `levels` captured; quoted comma in a name preserved;
- levels: trailing blank LEVEL columns trimmed;
- skip: ADD row with blank `ASSET NO (AUTO)` counted in `skippedNoId`, not an error;
- dup: duplicate `no` within file counted in `skippedDup`, first wins;
- error: missing a required header column → `!ok` with a `Missing column` message;
- error: empty CSV → `!ok`.

Wire into `package.json` `test` script (appended after `taxonomyImport.test.js`).
The existing four gates (generic / erpProfile / structure / taxonomyImport) stay
green.

### Live verification
Docker rebuild (`docker compose … up -d --build`), then on
https://localhost:10443:
1. Part 1: create a company with two sites (one childless) → both in the SITE
   dropdown.
2. Part 2: click **Update register** → file picker opens → import a small
   onboarding-export CSV → assets merge in, toast shows `+added` / `skipped`,
   re-importing the same file adds 0 (all skipped).

---

## Out of scope
- No change to the onboarding CSV export format.
- No change to taxonomy import/export.
- No directory/folder ingestion.
