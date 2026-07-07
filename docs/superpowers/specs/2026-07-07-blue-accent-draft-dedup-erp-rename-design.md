# Blue accent, red required markers, draft dedup & single open project, ERP profile rename — design

**Date:** 2026-07-07 · **Status:** Approved (K. Duffy) · **Scope:** `src/client/styles.css`, `src/client/app.js`, `src/server/routes.js`, `src/server/db.js`

## Motivation

1. All orange UI must become blue — the only orange survivor is the **Update** action tab in the asset editor.
2. Mandatory-field asterisks (`*`) must read as errors do: red.
3. Drafts pile up (one orphan `autosave` per page open; every explicit save/New inserts another same-named row). One user on one project must converge to a handful of rows, and a *new* project and an *opened draft* must never both appear "open".
4. An admin must be able to change the ERP **Profile** and **Profile name** — today the name field is hard-disabled for the built-in profile.

## A. Colour sweep: orange → mid blue

Swap the accent token family (`styles.css:9`) — every orange element (primary buttons, ADD/equipment chips, checked toggles, focus rings, wizard tints, `--teal*` legacy aliases) recolours at once:

| Token | Now | Becomes |
|---|---|---|
| `--ac` | `#F28C00` | `#154eb4` |
| `--acs` | `#d97a00` | `#0f3d8f` |
| `--act` | `#FCEBD3` | `#E3ECFA` |
| `--acb` | `rgba(242,140,0,.32)` | `rgba(21,78,180,.32)` |

Comment on that line updates to `Accent (B2BEM blue)`.

- **Carve-out:** after the `.seg` rules add `#segAction button.on[data-a="update"]{color:var(--orange-dark)}`. *Add new* stays green (`.on.add`), *Retire* stays red (`.on.retire`).
- `#btnAdd` keeps its brand-navy special case (`styles.css:130`) — unchanged.
- The uncommitted inline `--navy-mid` links (`tx-link`, `txe-link`) are the same hex as the new accent — kept as-is.
- Unchanged on purpose: `--orange`/`--orange-dark` stay defined (carve-out uses them), `--gold` header accents, amber `--warn*` recommendation colours, `--danger` reds.

## B. Mandatory `*` → red

`styles.css:108`: `.field .req{color:var(--ac)}` → `color:var(--danger)`.

## C. Drafts: overwrite + cleanup + one open project

**Defects (verified):** `routes.js:194` POST always INSERTs; `app.js:855-866` deletes the previous autosave only by an in-memory id, so every page open orphans one row; `app.js:808` New explicitly re-saves a same-named draft; a blank workspace autosaves itself 2 s after New.

1. **Server upsert** — `POST /api/drafts` runs in one better-sqlite3 transaction: `DELETE FROM drafts WHERE user = ? AND name = ?` then `INSERT`. Same-named saves overwrite per user. Audit logging unchanged (new id).
2. **Startup cleanup** — in `db.js` after the `drafts` table DDL: `DELETE FROM drafts WHERE id NOT IN (SELECT MAX(id) FROM drafts GROUP BY user, name)`. Idempotent; runs each boot; collapses the existing pile to the newest per (user, name).
3. **One autosave slot per project** — `autosaveNow()` names the draft `autosave — <PROJECT.number>`, falling back to `autosave` when no project number is set yet. (A numbered project therefore owns its slot; un-numbered work shares the generic slot — filling in the project number early is what protects it.)
4. **Pristine guard (no empty drafts, ever)** — *pristine* := no rows, no BOM lines, no session taxonomy, and all project header fields blank (`pm, number, start, end, exportName`). `autosaveNow()` on a pristine workspace POSTs nothing — and if a slot id is held (workspace emptied after having content), it DELETEs that slot and clears the id. Explicit **Save draft** on a pristine workspace toasts `Nothing to save yet` and does not POST.
5. **Switching parks the outgoing project** — both `newProject()` and `loadDraftObj()` cancel the pending autosave timer, flush non-pristine work immediately (New already `saveDraft()`s; loading a draft flushes `autosaveNow()` first), then reset `AUTOSAVE_ID = null` so the incoming project can never delete the outgoing project's slot. The delete-previous-id logic inside `autosaveNow()` stays — it reaps the old slot when a project number is typed mid-session (renaming the slot), and its 404 after an upsert replacement is already swallowed.

**Net effect:** the drafts list holds at most one autosave slot per project plus deliberate named saves; “New → Open draft” shows no phantom empty project.

## D. ERP setup: admin can change Profile and Profile name

- Remove the built-in lock on the name field (`app.js:1268`, `$('#erpName').disabled = !!EDIT_PROFILE.builtIn`) — the field is always editable; the modal is already admin-only.
- **Delete stays locked** for the built-in profile (`app.js:1271` and the engine guard `erpProfile.js:86`), so the canonical column set can't vanish; **New**/**Duplicate** already exist beside the dropdown.
- Rename safety verified: the byte-identical server-side export is selected by `isDefaultIso()` = `builtIn && mode==='iso'` (`app.js:24`) — the name is cosmetic; `saveProfile()` persists by id with no built-in guard (`erpProfile.js:76-82`).
- Existing semantics unchanged: profiles live in browser storage per machine; drafts referencing a missing profile already fall back with a banner.

## Error handling

- Autosave stays best-effort silent; explicit save keeps its error toast.
- Startup-cleanup SQL failure aborts server start like any schema error — surfaces DB corruption early instead of hiding it.

## Verification

1. `npm test` — all four suites stay green.
2. Live preview: computed `.btn.primary` background = `rgb(21,78,180)`; `.req` colour = `rgb(179,64,58)`; editor seg — *Update* selected shows orange, *Add new* green; toolbar Add asset still brand navy.
3. Drafts: POST same name twice → list shows one; reload page, autosave again → still one slot; New → Open draft shows no phantom; seeded duplicates collapse after server restart; pristine workspace saves nothing and explicit save toasts.
4. ERP: built-in profile name editable and persists across reopen; `isDefaultIso()` still true after rename (export path unchanged).

## Out of scope

React UI branch; folder sync; taxonomy CSV import; gold/amber semantic colours; multi-browser profile sync.
