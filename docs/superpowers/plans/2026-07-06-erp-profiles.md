# ERP Profiles, CSV Import Mapping & Draft Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app import/export CSV for other ERP systems via per-browser "ERP profiles" (ISO or engine-off *flat* mode), add CSV import header-mapping, and add Delete-draft / Create-new buttons — without touching the frozen ISO engine.

**Architecture:** A new client module `src/client/erpProfile.js` is an I/O adapter layer around the frozen `shared/domain` engine. It owns the profile model (localStorage), a field catalogue, CSV parsing, import header auto-mapping, and a profile-driven blank-template + client-side export builder. `app.js` consumes it. The built-in "B2BEM ISO 55001" profile keeps today's *server-side* export byte-identical; custom/flat profiles use the new client-side builder.

**Tech Stack:** Vanilla ES modules (browser), Express + better-sqlite3 (server, unchanged here), Node test scripts (`node test/*.test.js`).

**Spec:** `docs/superpowers/specs/2026-07-06-erp-profiles-design.md`

**Testing note:** Pure logic in `erpProfile.js` is unit-tested with Node scripts in the existing `check()` harness style (Tasks 1, 5, 6). DOM wiring has no unit harness in this codebase, so it is verified against the live preview server on `localhost:8080` (Tasks 3, 4, 7) with explicit snapshot/click/assert steps. `npm test` (the frozen-engine regression gate) must stay green throughout.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/client/erpProfile.js` | Profile model, localStorage, catalogue, CSV parse, auto-mapping, `buildProfileCSV` | **new** |
| `src/client/erpSchemas.js` | Data-only full ERP column schemas (Oracle FBDI classic 422 cols, Oracle Redwood-simplified, Pronto Xi 27 fields) — see spec §3.3 | **new** |
| `test/erpProfile.test.js` | Unit tests for the above | **new** |
| `src/client/app.js` | Consume `erpProfile`; draft buttons; import remap; export/template routing; flat rendering | modify |
| `src/client/index.html` | "New" + "ERP setup" buttons; `#erpSetupBg`, `#erpMapBg` modals; per-draft ✕ | modify |
| `src/client/styles.css` | Styles for setup/map modals, draft rows, flat form | modify |
| `package.json` | Run the new test file in `npm test` | modify |
| `src/shared/domain/*` | — | **unchanged** |
| server routes | draft `DELETE` already exists | **unchanged** |

---

## Task 1: `erpProfile.js` — model, storage, catalogue, presets

**Files:**
- Create: `src/client/erpSchemas.js` (data-only; full schemas per spec §3.3)
- Create: `src/client/erpProfile.js`
- Create: `test/erpProfile.test.js`
- Modify: `package.json`

- [ ] **Step 1: Create the module with the storage + model core**

Create `src/client/erpProfile.js`:

```js
// Client-layer I/O adapter for ERP profiles. The frozen shared/domain engine is
// untouched; this module only adapts CSV in/out around it. Storage is pluggable so
// the same code runs in the browser (localStorage) and in Node tests (memory).
import { CSV_HEADERS, csvCell, buildCSV } from '../shared/domain/csv.js';

const LS_PROFILES = 'erp.profiles';
const LS_ACTIVE = 'erp.activeId';

let _store = (typeof localStorage !== 'undefined')
  ? localStorage
  : (() => { const m = {}; return {
      getItem: k => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: k => { delete m[k]; }
    }; })();
export function setStore(s){ _store = s; }

let _seq = 0;
export function newId(prefix){ _seq++; return (prefix || 'erp') + '-' + Date.now().toString(36) + '-' + _seq.toString(36); }
export function normHeader(h){ return String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]+/g, ''); }

export function seedDefault(){
  return {
    id: 'b2bem-iso', name: 'B2BEM ISO 55001', erpType: 'b2bem-iso',
    mode: 'iso', builtIn: true,
    columns: CSV_HEADERS.map((h, i) => ({ key: 'c' + i, header: h, source: h, include: true, required: false })),
    importMap: {}
  };
}

export const FLAT_STARTER = ['Asset No', 'Tag / Name', 'Description', 'Location', 'Parent', 'Status'];
// SCOPE CHANGE 2026-07-06: Oracle classic/redwood + Pronto ship their REAL full column
// schemas (spec §3.3), encoded data-only in erpSchemas.js and referenced here via
// `schema` builders. Each returns [{header, source, required, include}] in official
// column order. These presets are mode:'iso' (ISO-reproject on export).
// import { oracleClassicColumns, oracleRedwoodColumns, prontoXiColumns } from './erpSchemas.js';
export const PRESETS = {
  'b2bem-iso':             { name: 'B2BEM ISO 55001', mode: 'iso' },
  'oracle-fusion-classic': { name: 'Oracle Cloud Fusion — FBDI (classic)', mode: 'iso', schema: oracleClassicColumns },
  'oracle-fusion-redwood': { name: 'Oracle Cloud Fusion — Redwood (simplified)', mode: 'iso', schema: oracleRedwoodColumns },
  'pronto':                { name: 'Pronto Xi (Fixed Assets)', mode: 'iso', schema: prontoXiColumns },
  'generic':   { name: 'Generic ERP', mode: 'flat', headers: FLAT_STARTER },
  'sap-pm':    { name: 'SAP PM', mode: 'flat', headers: FLAT_STARTER },
  'maximo':    { name: 'IBM Maximo', mode: 'flat', headers: FLAT_STARTER },
  'other':     { name: 'Other', mode: 'flat', headers: ['Asset No', 'Description'] }
};

export function newProfile(erpType){
  if(erpType === 'b2bem-iso'){ const d = seedDefault(); d.id = newId('erp'); d.name = 'B2BEM ISO 55001 (copy)'; d.builtIn = false; return d; }
  const p = PRESETS[erpType] || PRESETS.generic;
  if(p.schema){
    return {
      id: newId('erp'), name: p.name, erpType, mode: p.mode, builtIn: false,
      columns: p.schema().map((c, i) => ({ key: 'c' + i, header: c.header, source: c.source, include: c.include, required: c.required })),
      importMap: {}
    };
  }
  return {
    id: newId('erp'), name: p.name, erpType, mode: p.mode, builtIn: false,
    columns: (p.headers || FLAT_STARTER).map((h, i) => ({ key: 'c' + i, header: h, source: 'custom', include: true, required: i < 2 })),
    importMap: {}
  };
}

export function listProfiles(){
  let arr;
  try { arr = JSON.parse(_store.getItem(LS_PROFILES) || 'null'); } catch(_) { arr = null; }
  if(!Array.isArray(arr) || !arr.length){ arr = [seedDefault()]; _store.setItem(LS_PROFILES, JSON.stringify(arr)); }
  return arr;
}
export function getActive(){
  const arr = listProfiles();
  return arr.find(p => p.id === _store.getItem(LS_ACTIVE)) || arr[0];
}
export function setActive(id){ _store.setItem(LS_ACTIVE, id); }
export function saveProfile(profile){
  const arr = listProfiles();
  const i = arr.findIndex(p => p.id === profile.id);
  if(i >= 0) arr[i] = profile; else arr.push(profile);
  _store.setItem(LS_PROFILES, JSON.stringify(arr));
  return profile;
}
export function deleteProfile(id){
  let arr = listProfiles();
  const p = arr.find(x => x.id === id);
  if(!p || p.builtIn) return false;
  arr = arr.filter(x => x.id !== id);
  _store.setItem(LS_PROFILES, JSON.stringify(arr));
  if(_store.getItem(LS_ACTIVE) === id) setActive(arr[0].id);
  return true;
}
export function duplicateProfile(id){
  const src = listProfiles().find(p => p.id === id) || seedDefault();
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = newId('erp'); copy.name = src.name + ' (copy)'; copy.builtIn = false;
  return saveProfile(copy);
}
export function catalogue(profile){
  if(profile.mode === 'flat') return profile.columns.map(c => ({ id: c.key, label: c.header }));
  return CSV_HEADERS.map(h => ({ id: h, label: h }));
}
export function templateHeaders(profile){
  return profile.columns.filter(c => c.include).map(c => c.header);
}
```

- [ ] **Step 2: Write the failing test**

Create `test/erpProfile.test.js`:

```js
// ERP profile adapter unit gate. Run: node test/erpProfile.test.js (exit 0 = pass)
import fs from 'node:fs';
import { initData } from '../src/shared/domain/data.js';
import { withSession } from '../src/shared/domain/session.js';
import { buildCSV } from '../src/shared/domain/csv.js';
import * as EP from '../src/client/erpProfile.js';

let failures = 0;
function check(name, cond, detail){ if(cond) console.log('PASS', name); else { failures++; console.error('FAIL', name, detail == null ? '' : JSON.stringify(detail)); } }

const mem = {};
EP.setStore({ getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } });

const def = EP.getActive();
check('default seeded: iso + builtIn', def && def.mode === 'iso' && def.builtIn === true, def && { mode: def.mode, builtIn: def.builtIn });
check('default columns mirror CSV_HEADERS (all included)', def.columns.length > 0 && def.columns.every(c => c.include), def.columns.length);
check('normHeader strips case + punctuation', EP.normHeader('Asset / Tag  Name') === 'assettagname', EP.normHeader('Asset / Tag  Name'));
check('templateHeaders returns included headers', EP.templateHeaders(def).length === def.columns.length, EP.templateHeaders(def).length);

const dup = EP.duplicateProfile('b2bem-iso');
check('duplicate is not builtIn', dup.builtIn === false, dup.builtIn);
check('duplicate got new id', dup.id !== 'b2bem-iso', dup.id);
check('cannot delete builtIn', EP.deleteProfile('b2bem-iso') === false, null);
check('can delete a copy', EP.deleteProfile(dup.id) === true, null);

// full-schema presets (spec §3.3): counts, order anchors, required flags, source validity
const oc = EP.newProfile('oracle-fusion-classic');
check('oracle classic: 422 columns', oc.columns.length === 422, oc.columns.length);
check('oracle classic: 7 required', oc.columns.filter(c => c.required).length === 7, null);
check('oracle classic: iso mode', oc.mode === 'iso', oc.mode);
check('oracle classic: first/last headers', oc.columns[0].header === 'Interface Line Number' && oc.columns[421].header === 'YTD Annuity Interest', null);
check('oracle classic: unique headers', new Set(oc.columns.map(c => c.header)).size === 422, null);
const or = EP.newProfile('oracle-fusion-redwood');
check('oracle redwood: iso mode + has required', or.mode === 'iso' && or.columns.some(c => c.required), null);
const px = EP.newProfile('pronto');
check('pronto: 27 columns', px.columns.length === 27, px.columns.length);
check('pronto: display-only excluded', px.columns.filter(c => !c.include).length === 3, null);
// every non-custom source must be a real catalogue field (CSV_HEADERS entry)
const validSrc = new Set(CSV_HEADERS);
[oc, or, px].forEach(p => check('sources valid: ' + p.erpType,
  p.columns.every(c => c.source === 'custom' || validSrc.has(c.source)),
  p.columns.filter(c => c.source !== 'custom' && !validSrc.has(c.source)).map(c => c.source)));

if(failures){ console.error('ERP GATE: FAIL —', failures); process.exit(1); }
console.log('ERP GATE: PASS');
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `node test/erpProfile.test.js`
Expected: all `PASS` lines, ends `ERP GATE: PASS`, exit 0.

- [ ] **Step 4: Wire the new test into `npm test`**

In `package.json`, change the `test` script so both gates run:

```json
"test": "node test/generic.test.js && node test/erpProfile.test.js"
```

Run: `npm test`
Expected: `GENERIC GATE: PASS` then `ERP GATE: PASS`.

- [ ] **Step 5: Commit**

```bash
git add src/client/erpSchemas.js src/client/erpProfile.js test/erpProfile.test.js package.json
git commit -m "feat(erp): add ERP profile model, storage, catalogue, full ERP schemas + unit gate"
```

---

## Task 2: Boot-wire `erpProfile` into `app.js` (no behaviour change)

**Files:**
- Modify: `src/client/app.js` (imports block ~line 6–14; state near `let IS_ADMIN=false;` ~line 18)

- [ ] **Step 1: Import the adapter and hold the active profile**

After the existing `shared/domain` imports (around line 14), add:

```js
import * as ERP from './erpProfile.js';
```

Near `let IS_ADMIN = false;` (~line 18) add:

```js
let ACTIVE = ERP.getActive();                 // seeds + activates the built-in ISO profile on first run
function isDefaultIso(){ return !!(ACTIVE && ACTIVE.builtIn && ACTIVE.mode === 'iso'); }
function applyProfileUI(){ renderRows(); updateExportNameHint(); }   // extended in Tasks 4 & 7
```

- [ ] **Step 2: Verify the default path is unchanged**

Run: `npm test`
Expected: both gates PASS (the frozen engine is untouched).

Then start the preview and confirm the app still renders the seeded sample rows:

Run (preview tool): start server `asset-onboarding-app`, then snapshot.
Expected: header "ISO 55001 — Asset Onboarding", 3 sample rows, no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/client/app.js
git commit -m "feat(erp): boot-wire active profile into app.js (no behaviour change)"
```

---

## Task 3: Draft management — Delete draft + Create new

**Files:**
- Modify: `src/client/index.html` (header `hactions` ~line 22; drafts modal ~line 343–358)
- Modify: `src/client/app.js` (`openDrafts` ~730; `saveDraft` ~714; autosave ~745; `loadDraftObj` ~725; init wiring ~907)
- Modify: `src/client/styles.css`

- [ ] **Step 1: Add the "New" button**

In `index.html`, in `.hactions`, immediately before `<button class="btn ghost sm" id="btnLoad" ...>Open draft</button>`, add:

```html
<button class="btn ghost sm" id="btnNew" title="Start a new blank project (current work is auto-saved as a draft first)">New</button>
```

- [ ] **Step 2: Render a delete ✕ on each draft row**

In `app.js` `openDrafts` (the `else { list.innerHTML = arr.map(...) }` branch ~line 735), replace the single-button map with a row containing an open button and a delete button:

```js
list.innerHTML = arr.map(o =>
  '<div class="draftrow">'+
    '<button class="btn ghost draft-open" data-draft-id="' + esc(String(o.id)) + '">' +
      esc(o.name || 'draft') + ' · ' + esc(String(o.ts || '').slice(0, 16).replace('T', ' ')) +
    '</button>'+
    '<button class="btn ghost danger sm draft-del" data-draft-del="' + esc(String(o.id)) + '" title="Delete this draft" aria-label="Delete draft">✕</button>'+
  '</div>').join('');
```

- [ ] **Step 3: Handle open + delete via one delegated listener**

In `app.js`, in the init/wiring section (~line 907, where other `onclick`s are set), add a single delegated handler and make sure opening ignores the delete button:

```js
$('#draftsList').addEventListener('click', async (e) => {
  const del = e.target.closest('[data-draft-del]');
  if(del){
    if(!confirm('Delete this draft permanently?')) return;
    try { await fetch('/api/drafts/' + encodeURIComponent(del.getAttribute('data-draft-del')), { method: 'DELETE' }); }
    catch(_) { toast('Delete failed — server unreachable'); return; }
    toast('Draft deleted');
    openDrafts();
    return;
  }
  const open = e.target.closest('[data-draft-id]');
  if(open){
    try {
      const o = await (await fetch('/api/drafts/' + encodeURIComponent(open.getAttribute('data-draft-id')))).json();
      loadDraftObj((o && o.rows) ? o : (o && o.draft) || o);
      closeDrafts();
    } catch(_) { toast('Could not open draft'); }
  }
});
```

> Note for the executor: if `openDrafts` already binds an open handler elsewhere, keep only ONE open path — delete the old inline binding so clicks aren't handled twice. Confirm the GET-one-draft shape against `src/server/routes.js` (`/api/drafts/:id`) and adjust the `(o.rows)?o:...` unwrap to match.

- [ ] **Step 4: Add the "New project" action**

In `app.js`, add near `saveDraft` (~line 714):

```js
async function newProject(){
  if(rows.length && !confirm('Start a new project? Your current ' + rows.length + ' row(s) will be cleared.\n\n(Your current work is auto-saved as a draft first.)')) return;
  try { await saveDraft(); } catch(_) {}
  rows = []; BOM_EXISTING = []; NEW_TAX = []; PROJECT = { pm: '', number: '', start: '', end: '' };
  syncSession(); reapplyOverrides(); fillProjectInputs(); updateExportNameHint(); renderRows(); persistLocal(); persistProject();
  toast('New project started');
}
```

Wire it in init (~line 907):

```js
$('#btnNew').onclick = newProject;
```

- [ ] **Step 5: Persist + restore the active profile with the draft**

In `saveDraft` (~line 714) and the autosave POST (~line 745), add `profileId: ACTIVE.id` to the JSON body object sent to `/api/drafts`.

In `loadDraftObj` (~line 725), after the existing state is restored (before the final `toast(...)`), add:

```js
if(o && o.profileId){
  const p = ERP.listProfiles().find(x => x.id === o.profileId);
  if(p){ ACTIVE = p; ERP.setActive(p.id); }
  else { toast('Draft\'s ERP profile is not in this browser — using ' + ACTIVE.name); }
}
applyProfileUI();
```

- [ ] **Step 6: Add styles**

In `styles.css`, append:

```css
.draftrow{ display:flex; gap:6px; align-items:center; margin:4px 0; }
.draftrow .draft-open{ flex:1; text-align:left; }
.btn.ghost.danger{ color:var(--red); }
```

- [ ] **Step 7: Verify in the preview**

Start the preview server, then:
- Click "New" with sample rows present → confirm dialog → workspace clears, toast "New project started".
- Click "Open draft" → the just-autosaved draft appears with a ✕ → click ✕ → confirm → it disappears.

Expected: no console errors; `GET /api/drafts` and `DELETE /api/drafts/:id` succeed in the network log.

- [ ] **Step 8: Commit**

```bash
git add src/client/index.html src/client/app.js src/client/styles.css
git commit -m "feat(erp): add New-project + Delete-draft; drafts carry active profileId"
```

---

## Task 4: ERP Setup page (admin-only)

**Files:**
- Modify: `src/client/index.html` (admin menu `hmenu` ~line 28; add `#erpSetupBg` modal near the other modals ~line 341)
- Modify: `src/client/app.js` (add `openErpSetup`, render + save; extend `applyProfileUI`; init wiring)
- Modify: `src/client/styles.css`

- [ ] **Step 1: Add the admin button**

In `index.html`, inside `.hmenu` (after `btnRegister`, still admin-only), add:

```html
<button class="btn ghost sm admin-only" id="btnErpSetup" title="Configure the ERP profile: fields, headers, ISO/flat mode" style="display:none">ERP setup</button>
```

`applyAdminUI` already toggles `.admin-only` elements, so this appears only when signed in as admin. Do **not** add it to the `DEAD` set in `applyAdminUI` (~line 779).

- [ ] **Step 2: Add the setup modal shell**

In `index.html`, near the other `modal-bg` blocks (~line 341), add:

```html
<div class="modal-bg" id="erpSetupBg">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head">
      <h2>ERP setup</h2>
      <button class="btn ghost x" id="erpSetupX" aria-label="Close">✕</button>
    </div>
    <div class="modal-body">
      <div class="context">
        <div class="field"><label>Profile</label><select class="native" id="erpProfileSel"></select></div>
        <div class="field"><label>ERP type</label><select class="native" id="erpTypeSel"></select></div>
        <div class="field"><label>Mode</label>
          <div class="seg" id="erpModeSeg">
            <button type="button" data-m="iso">ISO 55001</button>
            <button type="button" data-m="flat">Flat</button>
          </div>
        </div>
        <div class="grow"></div>
        <button class="btn sm" id="erpNew">New</button>
        <button class="btn sm" id="erpDup">Duplicate</button>
        <button class="btn sm danger" id="erpDel">Delete</button>
      </div>
      <div class="section-title" style="margin-top:12px">Columns</div>
      <div class="subnote">Tick the columns to include, rename headers, choose the source, and mark required. Drag to reorder.</div>
      <div id="erpCols"></div>
      <button class="btn sm" id="erpAddCol" type="button" style="margin-top:8px">＋ Add custom field</button>
      <div class="section-title" style="margin-top:12px">Blank-CSV preview</div>
      <div class="hint" id="erpPreview" style="font-family:monospace;white-space:pre-wrap"></div>
    </div>
    <div class="modal-foot">
      <div class="spacer"></div>
      <button class="btn" id="erpSetupCancel">Cancel</button>
      <button class="btn primary" id="erpSetupSave">Save profile</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Render + edit + save in `app.js`**

Add to `app.js`:

```js
let EDIT_PROFILE = null;   // working copy while the setup modal is open

function erpRenderCols(){
  const cat = ERP.catalogue(EDIT_PROFILE);
  const opt = sel => cat.map(c => '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('');
  $('#erpCols').innerHTML = EDIT_PROFILE.columns.map((c, i) =>
    '<div class="erpcol" data-i="' + i + '">'+
      '<input type="checkbox" class="erp-inc"' + (c.include ? ' checked' : '') + '>'+
      '<input class="text erp-hdr" value="' + esc(c.header) + '" placeholder="Column header">'+
      (EDIT_PROFILE.mode === 'flat'
        ? '<span class="hint">custom</span>'
        : '<select class="native erp-src">' + opt(c.source) + '</select>')+
      '<label class="ctx-check"><input type="checkbox" class="erp-req"' + (c.required ? ' checked' : '') + '> req</label>'+
      '<button class="btn ghost danger sm erp-rm" type="button" title="Remove">✕</button>'+
    '</div>').join('');
  $('#erpPreview').textContent = ERP.templateHeaders(EDIT_PROFILE).join(',') || '(no columns included)';
}

function erpReadCols(){
  const rows = [...$('#erpCols').querySelectorAll('.erpcol')];
  EDIT_PROFILE.columns = rows.map((el, i) => {
    const prev = EDIT_PROFILE.columns[+el.getAttribute('data-i')] || {};
    const src = el.querySelector('.erp-src');
    return {
      key: prev.key || ERP.newId('c'),
      header: el.querySelector('.erp-hdr').value.trim() || ('Column ' + (i + 1)),
      source: src ? src.value : 'custom',
      include: el.querySelector('.erp-inc').checked,
      required: el.querySelector('.erp-req').checked
    };
  });
}

function openErpSetup(){
  EDIT_PROFILE = JSON.parse(JSON.stringify(ACTIVE));
  $('#erpProfileSel').innerHTML = ERP.listProfiles().map(p => '<option value="' + esc(p.id) + '"' + (p.id === EDIT_PROFILE.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
  $('#erpTypeSel').innerHTML = Object.keys(ERP.PRESETS).map(k => '<option value="' + k + '"' + (k === EDIT_PROFILE.erpType ? ' selected' : '') + '>' + esc(ERP.PRESETS[k].name) + '</option>').join('');
  $('#erpModeSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === EDIT_PROFILE.mode));
  $('#erpDel').disabled = !!EDIT_PROFILE.builtIn;
  erpRenderCols();
  $('#erpSetupBg').classList.add('open');
}
function closeErpSetup(){ $('#erpSetupBg').classList.remove('open'); EDIT_PROFILE = null; }
```

Extend `applyProfileUI` (from Task 2) — keep it the single source of truth (table columns come in Task 7):

```js
function applyProfileUI(){ renderRows(); updateExportNameHint(); }
```

Init wiring (~line 907) — add:

```js
$('#btnErpSetup').onclick = openErpSetup;
$('#erpSetupX').onclick = $('#erpSetupCancel').onclick = closeErpSetup;
$('#erpProfileSel').onchange = e => { erpReadCols(); const p = ERP.listProfiles().find(x => x.id === e.target.value); if(p){ EDIT_PROFILE = JSON.parse(JSON.stringify(p)); openErpSetup(); } };
$('#erpTypeSel').onchange = e => { EDIT_PROFILE.erpType = e.target.value; };
$('#erpModeSeg').onclick = e => { const b = e.target.closest('button'); if(!b) return; erpReadCols(); if(b.dataset.m !== EDIT_PROFILE.mode && !confirm('Switching mode may drop sources that do not exist in the new mode. Continue?')) return; EDIT_PROFILE.mode = b.dataset.m; $('#erpModeSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.m === EDIT_PROFILE.mode)); erpRenderCols(); };
$('#erpAddCol').onclick = () => { erpReadCols(); EDIT_PROFILE.columns.push({ key: ERP.newId('c'), header: 'New column', source: 'custom', include: true, required: false }); erpRenderCols(); };
$('#erpCols').addEventListener('click', e => { const rm = e.target.closest('.erp-rm'); if(rm){ erpReadCols(); EDIT_PROFILE.columns.splice(+rm.closest('.erpcol').getAttribute('data-i'), 1); erpRenderCols(); } });
$('#erpCols').addEventListener('input', () => { $('#erpPreview').textContent = [...$('#erpCols').querySelectorAll('.erpcol')].filter(el => el.querySelector('.erp-inc').checked).map(el => el.querySelector('.erp-hdr').value.trim()).join(',') || '(no columns included)'; });
$('#erpNew').onclick = () => { const p = ERP.saveProfile(ERP.newProfile($('#erpTypeSel').value)); ACTIVE = p; ERP.setActive(p.id); openErpSetup(); toast('New profile created'); };
$('#erpDup').onclick = () => { const p = ERP.duplicateProfile(EDIT_PROFILE.id); ACTIVE = p; ERP.setActive(p.id); openErpSetup(); toast('Profile duplicated'); };
$('#erpDel').onclick = () => { if(EDIT_PROFILE.builtIn) return; if(!confirm('Delete profile "' + EDIT_PROFILE.name + '"?')) return; ERP.deleteProfile(EDIT_PROFILE.id); ACTIVE = ERP.getActive(); applyProfileUI(); closeErpSetup(); toast('Profile deleted'); };
$('#erpSetupSave').onclick = () => {
  erpReadCols();
  if(!EDIT_PROFILE.columns.some(c => c.include)){ toast('Include at least one column'); return; }
  const headers = ERP.templateHeaders(EDIT_PROFILE);
  if(new Set(headers.map(h => h.toLowerCase())).size !== headers.length){ toast('Column headers must be unique'); return; }
  ERP.saveProfile(EDIT_PROFILE); ACTIVE = EDIT_PROFILE; ERP.setActive(EDIT_PROFILE.id);
  applyProfileUI(); closeErpSetup(); toast('Profile saved');
};
```

- [ ] **Step 4: Styles**

In `styles.css`, append:

```css
.erpcol{ display:flex; gap:8px; align-items:center; margin:5px 0; }
.erpcol .erp-hdr{ flex:1; }
.erpcol .erp-src{ min-width:180px; }
#erpSetupBg .modal{ max-width:760px; }
.seg button.on{ background:var(--ac); color:#fff; }
```

- [ ] **Step 5: Verify in the preview**

Start preview → sign in as Admin (dev mode auto-admin, so `.admin-only` should already show) → open "ERP setup".
- Duplicate the default → rename a header → preview line updates → Save → toast "Profile saved".
- Add custom field → it appears in the preview line.
- Switch mode to Flat → columns re-render as custom → Save.

Expected: no console errors; `localStorage.erp.profiles` contains the new profile (preview eval `JSON.parse(localStorage['erp.profiles']).length`).

- [ ] **Step 6: Commit**

```bash
git add src/client/index.html src/client/app.js src/client/styles.css
git commit -m "feat(erp): admin ERP setup page — profile CRUD + column editor"
```

---

## Task 5: Profile-driven blank template + client-side export

**Files:**
- Modify: `src/client/erpProfile.js` (add `buildProfileCSV`, `parseCSV`)
- Modify: `test/erpProfile.test.js`
- Modify: `src/client/app.js` (`downloadTemplate` ~605, `exportCSV` ~585; remove local `parseCSV` ~614 and import from `erpProfile`)

- [ ] **Step 1: Add `parseCSV` + `buildProfileCSV` to `erpProfile.js`**

Append to `src/client/erpProfile.js`:

```js
export function parseCSV(text){
  const rows = []; let row = [], field = '', q = false, i = 0;
  text = String(text).replace(/^﻿/, '');
  while(i < text.length){
    const c = text[i];
    if(q){
      if(c === '"'){ if(text[i + 1] === '"'){ field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if(c === '"'){ q = true; i++; continue; }
    if(c === ','){ row.push(field); field = ''; i++; continue; }
    if(c === '\r'){ i++; continue; }
    if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if(field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows;
}

// ISO custom profiles reproject the canonical buildCSV() output (parity guaranteed).
// Flat profiles read row.values directly. Both emit UTF-8 BOM + CRLF via csvCell.
export function buildProfileCSV(profile, opts){
  opts = opts || {};
  const cols = profile.columns.filter(c => c.include);
  const line = arr => arr.map(csvCell).join(',');
  const BOM = '﻿';
  if(profile.mode === 'flat'){
    const body = (opts.rows || []).map(r => cols.map(c => (r.values && r.values[c.key]) || ''));
    return BOM + [cols.map(c => c.header)].concat(body).map(line).join('\r\n') + '\r\n';
  }
  const canonical = parseCSV((opts.buildCSV || buildCSV)());
  const cHeaders = canonical[0] || [];
  const idxOf = {}; cHeaders.forEach((h, i) => { idxOf[h] = i; });
  const out = [cols.map(c => c.header)];
  canonical.slice(1).forEach(r => out.push(cols.map(c => { const i = idxOf[c.source]; return i == null ? '' : (r[i] || ''); })));
  return BOM + out.map(line).join('\r\n') + '\r\n';
}
```

- [ ] **Step 2: Extend the test (write failing assertions)**

In `test/erpProfile.test.js`, before the final `if(failures)` block, add:

```js
// flat export
const flat = EP.newProfile('generic');
const frows = [{ id: 'f1', values: {} }];
flat.columns.forEach((c, i) => { frows[0].values[c.key] = 'v' + i; });
const flatCsv = EP.buildProfileCSV(flat, { rows: frows });
check('flat CSV starts with BOM', flatCsv.charCodeAt(0) === 0xFEFF, flatCsv.charCodeAt(0));
check('flat CSV header = included headers', flatCsv.replace(/^﻿/, '').split('\r\n')[0] === flat.columns.filter(c => c.include).map(c => c.header).join(','), null);

// iso reprojection (needs data + a bound session)
initData(JSON.parse(fs.readFileSync('data/seed-dataset.json', 'utf8')));
const siteRow = { action: 'add', parent: null, levels: [], tag: 'SITE1', desc: 'Example site', classification: 'REFERENCE', classOverride: 'REFERENCE', assetNo: 'SITE1', info: {}, bom: [] };
withSession({ rows: [siteRow], PROJECT: { pm: '', number: '', start: '', end: '' }, BOM_EXISTING: [], NEW_TAX: [] }, () => {
  const iso = { id: 'x', name: 'x', erpType: 'other', mode: 'iso', builtIn: false,
    columns: [{ key: 'a', header: 'Name', source: 'ASSET / TAG NAME', include: true, required: false }], importMap: {} };
  const lines = EP.buildProfileCSV(iso, { buildCSV }).replace(/^﻿/, '').split('\r\n').filter(Boolean);
  check('iso reprojection renames header', lines[0] === 'Name', lines[0]);
  check('iso reprojection keeps one data row', lines.length === 2, lines.length);
});
```

- [ ] **Step 3: Run the test**

Run: `node test/erpProfile.test.js`
Expected: new checks PASS, `ERP GATE: PASS`.

> If `source: 'ASSET / TAG NAME'` is not present in `CSV_HEADERS`, the reprojection header check still passes (rename) but the value is blank. Confirm the exact header string from `src/shared/domain/csv.js` `CSV_HEADERS` and use a real one.

- [ ] **Step 4: Route template + export through the profile in `app.js`**

Delete `app.js`'s local `parseCSV` (~line 614) and update the call in `importCSV` (~627) to `ERP.parseCSV(text)`.

Replace `downloadTemplate` (~605) with:

```js
function downloadTemplate(){
  const headers = ERP.templateHeaders(ACTIVE);
  const guide = headers.map(() => '');
  const csv = headers.map(h => '"' + String(h).replace(/"/g, '""') + '"').join(',') + '\r\n' + guide.join(',');
  download((ACTIVE.name || 'Asset Onboarding') + ' TEMPLATE.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  showBanner('Blank template for "' + ACTIVE.name + '" downloaded. Fill it in, then Import CSV.');
  toast('Blank CSV template downloaded');
}
```

Add a profile branch at the top of `exportCSV` (~585), leaving the existing default-ISO server-side body untouched below it:

```js
function exportCSV(){
  if(!isDefaultIso()){
    const csv = ERP.buildProfileCSV(ACTIVE, { rows, buildCSV });
    download(exportFileBase() + '.csv', csv, 'text/csv;charset=utf-8');
    toast('Exported "' + ACTIVE.name + '" to CSV');
    return;
  }
  // ---- existing default-ISO server-side export below (unchanged) ----
  // window.location = '/api/export/onboarding.csv'; ...
}
```

`buildCSV` is already imported in `app.js` (line 13, from `csv.js`).

- [ ] **Step 5: Verify in the preview**

- Default profile active → Export CSV still hits `/api/export/onboarding.csv` (network log) — unchanged.
- Duplicate the ISO profile, rename a column → Blank CSV shows the renamed header; Export downloads a client-built file with the renamed header.
- Switch to a flat profile → Blank CSV shows the flat headers.

- [ ] **Step 6: Commit**

```bash
git add src/client/erpProfile.js test/erpProfile.test.js src/client/app.js
git commit -m "feat(erp): profile-driven blank template + client-side export (default stays server-side)"
```

---

## Task 6: Import header-mapping (auto-guess + modal + save)

**Files:**
- Modify: `src/client/erpProfile.js` (add `autoGuess`, `saveImportMap`, `remapGrid`, `remapFlatRows`)
- Modify: `test/erpProfile.test.js`
- Modify: `src/client/index.html` (add `#erpMapBg` modal)
- Modify: `src/client/app.js` (`readCsvFile` ~754; extract `importGrid` from `importCSV` ~625; flat import)

- [ ] **Step 1: Add mapping helpers to `erpProfile.js`**

Append:

```js
const ALIASES = {
  assetnumber: 'ASSET / TAG NAME', assetno: 'ASSET / TAG NAME', assetid: 'ASSET / TAG NAME',
  tag: 'ASSET / TAG NAME', tagname: 'ASSET / TAG NAME', name: 'ASSET / TAG NAME',
  description: 'DESCRIPTION', desc: 'DESCRIPTION', parent: 'PARENT ASSET', parentasset: 'PARENT ASSET'
};

export function autoGuess(foreignHeaders, profile){
  const cat = catalogue(profile);
  const byNorm = {}; cat.forEach(c => { byNorm[normHeader(c.label)] = c.id; byNorm[normHeader(c.id)] = c.id; });
  const valid = new Set(cat.map(c => c.id));
  const saved = profile.importMap || {};
  const map = {}; let allSaved = foreignHeaders.length > 0;
  for(const h of foreignHeaders){
    const nk = normHeader(h);
    if(saved[nk] && valid.has(saved[nk])){ map[h] = saved[nk]; continue; }
    allSaved = false;
    map[h] = byNorm[nk] || (valid.has(ALIASES[nk]) ? ALIASES[nk] : null);
  }
  return { map, allSaved };
}

export function saveImportMap(profile, confirmedMap){
  profile.importMap = profile.importMap || {};
  for(const h in confirmedMap){ if(confirmedMap[h]) profile.importMap[normHeader(h)] = confirmedMap[h]; }
  saveProfile(profile);
  return profile;
}

// ISO: produce a canonical grid ([headers, ...rows]) the existing importer understands.
export function remapGrid(grid, mapping){
  const fHeaders = grid[0] || [];
  const keep = [];
  fHeaders.forEach((h, idx) => { const t = mapping[h]; if(t) keep.push({ idx, target: t }); });
  return [keep.map(k => k.target)].concat(grid.slice(1).map(r => keep.map(k => (r[k.idx] == null ? '' : r[k.idx]))));
}

// Flat: produce row objects keyed by the profile column keys.
export function remapFlatRows(grid, mapping, profile){
  const fHeaders = grid[0] || [];
  const idxByTarget = {}; fHeaders.forEach((h, idx) => { const t = mapping[h]; if(t) idxByTarget[t] = idx; });
  return grid.slice(1).filter(r => r.some(c => (c || '').trim() !== '')).map((r, n) => {
    const values = {};
    profile.columns.forEach(c => { const idx = idxByTarget[c.key]; values[c.key] = idx == null ? '' : (r[idx] || ''); });
    return { id: 'f' + Date.now().toString(36) + n, values };
  });
}
```

- [ ] **Step 2: Extend the test**

Add before the final `if(failures)` block in `test/erpProfile.test.js`:

```js
const dprof = EP.getActive(); // default iso
const guess = EP.autoGuess(['ASSET / TAG NAME', 'Weird Col'], dprof);
check('autoGuess maps canonical 1:1', guess.map['ASSET / TAG NAME'] === 'ASSET / TAG NAME', guess.map);
check('autoGuess leaves unknown null', guess.map['Weird Col'] === null, guess.map);
check('autoGuess allSaved=false while guessing', guess.allSaved === false, guess.allSaved);
EP.saveImportMap(dprof, { 'Weird Col': 'DESCRIPTION' });
const g2 = EP.autoGuess(['Weird Col'], EP.getActive());
check('saved import mapping is reused', g2.map['Weird Col'] === 'DESCRIPTION' && g2.allSaved === true, g2);
const grid = [['ASSET / TAG NAME', 'Weird Col'], ['PUMP 01', 'hello'], ['', '']];
const canon = EP.remapGrid(grid, { 'ASSET / TAG NAME': 'ASSET / TAG NAME', 'Weird Col': 'DESCRIPTION' });
check('remapGrid renames to canonical headers', canon[0].join('|') === 'ASSET / TAG NAME|DESCRIPTION', canon[0]);
check('remapGrid keeps row data', canon[1].join('|') === 'PUMP 01|hello', canon[1]);
```

Run: `node test/erpProfile.test.js` → all PASS.

- [ ] **Step 3: Add the mapping modal**

In `index.html`, near the other modals, add:

```html
<div class="modal-bg" id="erpMapBg">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head">
      <h2>Map CSV columns</h2>
      <button class="btn ghost x" id="erpMapX" aria-label="Close">✕</button>
    </div>
    <div class="modal-body">
      <div class="subnote">Match each column in your file to an app field. Unmatched columns are ignored.</div>
      <div id="erpMapRows"></div>
    </div>
    <div class="modal-foot">
      <div class="spacer"></div>
      <button class="btn" id="erpMapCancel">Cancel</button>
      <button class="btn primary" id="erpMapImport">Import</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Extract `importGrid` and add the mapping flow in `app.js`**

Refactor `importCSV` (~625) so the header-and-row logic lives in `importGrid(grid)` and `importCSV(text)` just parses:

```js
function importCSV(text){ importGrid(ERP.parseCSV(text)); }
function importGrid(grid){
  // ---- move the existing body of importCSV here, replacing `parseCSV(text)` with `grid`
  // and removing the top-level parse. Everything else (H(...), idxLevel, imported[],
  // confirm replace/append, syncImportedRows) stays exactly as-is.
}
```

Replace `readCsvFile` (~754) so it routes through mapping:

```js
function readCsvFile(file){
  const r = new FileReader();
  r.onload = () => {
    try {
      const grid = ERP.parseCSV(r.result).filter(row => row.some(c => (c || '').trim() !== ''));
      if(grid.length < 2){ toast('CSV has no data rows'); return; }
      const { map, allSaved } = ERP.autoGuess(grid[0], ACTIVE);
      if(allSaved){ applyImport(grid, map); return; }
      openMapModal(grid, map);
    } catch(e) { toast('Could not read CSV: ' + e.message); }
  };
  r.readAsText(file);
}

function applyImport(grid, map){
  ERP.saveImportMap(ACTIVE, map);
  if(ACTIVE.mode === 'flat'){
    const newRows = ERP.remapFlatRows(grid, map, ACTIVE);
    rows = rows.concat(newRows);
    applyProfileUI(); persistLocal();
    toast('Imported ' + newRows.length + ' row(s)');
  } else {
    importGrid(ERP.remapGrid(grid, map));
  }
}

function openMapModal(grid, guess){
  const headers = grid[0];
  const cat = ERP.catalogue(ACTIVE);
  const optionsFor = sel => '<option value="">— Ignore —</option>' +
    cat.map(c => '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('');
  $('#erpMapRows').innerHTML = headers.map((h, i) =>
    '<div class="erpmaprow" data-h="' + esc(h) + '">'+
      '<div class="erpmaphdr"><b>' + esc(h) + '</b><span class="hint">' + esc((grid[1] && grid[1][i]) || '') + '</span></div>'+
      '<select class="native erp-target">' + optionsFor(guess[h] || '') + '</select>'+
    '</div>').join('');
  $('#erpMapBg').__grid = grid;
  $('#erpMapBg').classList.add('open');
}
function closeMapModal(){ $('#erpMapBg').classList.remove('open'); }
```

Init wiring (~907) — add:

```js
$('#erpMapX').onclick = $('#erpMapCancel').onclick = closeMapModal;
$('#erpMapImport').onclick = () => {
  const map = {};
  $('#erpMapRows').querySelectorAll('.erpmaprow').forEach(row => { map[row.getAttribute('data-h')] = row.querySelector('.erp-target').value || null; });
  const grid = $('#erpMapBg').__grid;
  closeMapModal();
  applyImport(grid, map);
};
```

- [ ] **Step 5: Styles**

In `styles.css`, append:

```css
.erpmaprow{ display:flex; gap:10px; align-items:center; margin:6px 0; }
.erpmaphdr{ flex:1; display:flex; flex-direction:column; }
.erpmaprow .erp-target{ min-width:220px; }
```

- [ ] **Step 6: Verify in the preview**

- With the default ISO profile, import the app's own Blank CSV → **no modal** (auto-mapped 1:1) → rows land as today.
- Create a CSV with foreign headers (e.g. `Asset Number,Item Name,Notes`) → import → mapping modal appears with guesses → set targets → Import → rows land. Re-import the same file → **no modal** (saved mapping reused).

- [ ] **Step 7: Commit**

```bash
git add src/client/erpProfile.js test/erpProfile.test.js src/client/index.html src/client/app.js src/client/styles.css
git commit -m "feat(erp): CSV import header-mapping with auto-guess + saved per-profile map"
```

---

## Task 7: Flat mode — generic add form, table rendering, engine bypass

**Files:**
- Modify: `src/client/app.js` (`renderRows`; `btnAdd` handler; export/validation already routed)
- Modify: `src/client/index.html` (add `#flatAddBg` modal)
- Modify: `src/client/styles.css`

- [ ] **Step 1: Add a generic add-row modal**

In `index.html`, add:

```html
<div class="modal-bg" id="flatAddBg">
  <div class="modal narrow" role="dialog" aria-modal="true">
    <div class="modal-head"><h2 id="flatAddTitle">Add record</h2><button class="btn ghost x" id="flatAddX" aria-label="Close">✕</button></div>
    <div class="modal-body"><div id="flatAddFields"></div><div class="valwarn" id="flatAddWarn"></div></div>
    <div class="modal-foot"><div class="spacer"></div><button class="btn" id="flatAddCancel">Cancel</button><button class="btn primary" id="flatAddSave">Save record</button></div>
  </div>
</div>
```

- [ ] **Step 2: Branch `Add asset`, add the flat form + table rendering**

In `app.js` add:

```js
let FLAT_EDIT = null;   // { index, values }

function openFlatAdd(index){
  const cols = ACTIVE.columns.filter(c => c.include);
  FLAT_EDIT = { index: index == null ? -1 : index, values: index == null ? {} : { ...rows[index].values } };
  $('#flatAddTitle').textContent = index == null ? 'Add record' : 'Edit record';
  $('#flatAddFields').innerHTML = cols.map(c =>
    '<div class="field"><label>' + esc(c.header) + (c.required ? ' <span class="req">*</span>' : '') + '</label>'+
    '<input class="text flat-in" data-k="' + esc(c.key) + '" value="' + esc(FLAT_EDIT.values[c.key] || '') + '" autocomplete="off"></div>').join('');
  $('#flatAddWarn').classList.remove('show');
  $('#flatAddBg').classList.add('open');
}
function closeFlatAdd(){ $('#flatAddBg').classList.remove('open'); FLAT_EDIT = null; }
function saveFlatRow(){
  const vals = {};
  $('#flatAddFields').querySelectorAll('.flat-in').forEach(el => { vals[el.getAttribute('data-k')] = el.value; });
  const missing = ACTIVE.columns.filter(c => c.include && c.required && !(vals[c.key] || '').trim());
  const warn = $('#flatAddWarn');
  if(missing.length){ warn.innerHTML = 'Missing required: ' + missing.map(c => esc(c.header)).join(', ') + ' (saved anyway).'; warn.classList.add('show'); }
  if(FLAT_EDIT.index >= 0) rows[FLAT_EDIT.index].values = vals;
  else rows.push({ id: 'f' + Date.now().toString(36) + rows.length, values: vals });
  applyProfileUI(); persistLocal(); closeFlatAdd(); toast('Record saved');
}

function renderFlatRows(){
  const cols = ACTIVE.columns.filter(c => c.include);
  const head = '<tr><th style="width:30px">#</th>' + cols.map(c => '<th>' + esc(c.header) + '</th>').join('') + '<th style="width:96px"></th></tr>';
  const body = rows.map((r, i) =>
    '<tr>' + '<td>' + (i + 1) + '</td>' + cols.map(c => '<td>' + esc((r.values && r.values[c.key]) || '') + '</td>').join('') +
    '<td><button class="btn ghost sm flat-edit" data-i="' + i + '">Edit</button> <button class="btn ghost danger sm flat-del" data-i="' + i + '">✕</button></td></tr>').join('');
  const table = document.querySelector('.rows');
  table.querySelector('thead').innerHTML = head;
  $('#rowsBody').innerHTML = body;
  $('#emptyState').style.display = rows.length ? 'none' : '';
  $('#rowCount').textContent = rows.length ? (rows.length + ' record' + (rows.length !== 1 ? 's' : '')) : 'No records yet';
}
```

Make `renderRows` delegate when flat (rename the existing function body to `renderIsoRows`, then add):

```js
function renderRows(){ if(ACTIVE.mode === 'flat') return renderFlatRows(); return renderIsoRows(); }
```

Branch the toolbar Add button (init ~907, where `$('#btnAdd').onclick` is set):

```js
$('#btnAdd').onclick = () => { if(ACTIVE.mode === 'flat') return openFlatAdd(null); openEditor(-1); };
```

> Executor: use the ISO codebase's real "open editor" entry point in place of `openEditor(-1)` — confirm its name near line 440 (`editing = index>=0 ? ... : blankAsset()`).

Add flat table wiring (init):

```js
$('#flatAddX').onclick = $('#flatAddCancel').onclick = closeFlatAdd;
$('#flatAddSave').onclick = saveFlatRow;
$('#rowsBody').addEventListener('click', e => {
  if(ACTIVE.mode !== 'flat') return;
  const ed = e.target.closest('.flat-edit'); const dl = e.target.closest('.flat-del');
  if(ed) openFlatAdd(+ed.getAttribute('data-i'));
  else if(dl){ rows.splice(+dl.getAttribute('data-i'), 1); applyProfileUI(); persistLocal(); }
});
```

Extend `applyProfileUI` to hide ISO-only toolbar affordances in flat mode:

```js
function applyProfileUI(){
  const flat = ACTIVE.mode === 'flat';
  const bom = $('#btnBomEx'); if(bom) bom.style.display = flat ? 'none' : '';
  const site = document.getElementById('selSite'); if(site && site.closest('.context')) site.closest('.context').style.display = flat ? 'none' : '';
  renderRows(); updateExportNameHint();
}
```

- [ ] **Step 3: Styles**

```css
#flatAddFields .field{ margin:8px 0; }
```

- [ ] **Step 4: Verify in the preview**

- Switch active profile to a flat one (ERP setup → flat → Save).
- Table header becomes the flat columns; "Add asset" opens the generic form; save a record → it appears; Edit/✕ work.
- Export CSV downloads the flat file; Blank CSV matches the flat headers.
- Switch back to default ISO → the taxonomy table + editor return unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/client/app.js src/client/index.html src/client/styles.css
git commit -m "feat(erp): flat mode — generic record form, table rendering, engine bypass"
```

---

## Task 8: Full regression + verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm test`
Expected: `GENERIC GATE: PASS` then `ERP GATE: PASS`, exit 0.

- [ ] **Step 2: Default-path regression in the preview**

With the built-in ISO profile active (clear `localStorage` for a fresh state):
- Sample rows render; add an ISO asset via the taxonomy editor; Export CSV hits `/api/export/onboarding.csv`; Update register (admin) still works.
Expected: identical to pre-change behaviour.

- [ ] **Step 3: End-to-end new-capability walk**

- Duplicate default → rename a column → export shows the rename.
- Create a flat "Generic ERP" profile → add records → export flat CSV.
- Import a foreign-header CSV → mapping modal → rows land → re-import → no modal.
- New project + Delete draft both work.

- [ ] **Step 4: Confirm the branch is ready for review**

```bash
git status   # clean
git log --oneline feature/erp-profiles   # review the task commits
```

---

## Self-review notes

- **Spec coverage:** draft buttons (Task 3) ✓; import mapping (Task 6) ✓; setup page (Task 4) ✓; flat mode (Task 7) ✓; profile-driven template/export with default server-side (Task 5) ✓; per-browser storage (Task 1) ✓; frozen engine untouched + `npm test` green (all tasks) ✓.
- **Consistency:** the profile shape (`id,name,erpType,mode,builtIn,columns[{key,header,source,include,required}],importMap`) is used identically across Tasks 1/4/5/6/7. `ACTIVE`, `applyProfileUI`, `isDefaultIso`, `importGrid`, `buildProfileCSV`, `remapGrid`, `remapFlatRows` names are consistent throughout.
- **Known execution-time confirmations (flagged inline):** exact `/api/drafts/:id` GET shape; the real ISO "open editor" entry point; the exact `CSV_HEADERS` strings used in `ALIASES`. These are anchored with line references and notes, not left vague.
