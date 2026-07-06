# Register structure rules + clean-slate release — design

Date: 2026-07-06 · Approach: level-derived roles, client-enforced (Approach B) · Status: approved

## Workstream 1 — Register structure

### Role rules (shared domain)
- `roleOfLevel(lvl)` in `src/shared/domain`: 1 → `SITE`, 2 → `ASSET CLASS`, 3 → `ASSET SUB CLASS`, ≥4 → `ASSET` (real asset).
- Rows at levels 1–3 are structure rows: CLASSIFICATION is forced to the role name in-app and in CSV export. Level ≥4 keeps taxonomy-derived classification.
- `structureComplete(rows)`: true when at least one full Site ▸ Class ▸ Sub Class chain exists across register assets + session rows.

### One-time wizard (classic UI)
- Replaces the empty-state panel whenever `structureComplete()` is false.
- Step 1 create Site (desc; auto-numbered) → Step 2 add Asset Classes under the site → Step 3 add Sub Classes under a class.
- Class/sub-class names: taxonomy dropdown (major/minor category values) with free-text override.
- Wizard rows are ordinary onboarding rows: draft-persisted, CSV-exported, promoted via admin register update. No schema change.
- Finish enabled once one full chain exists; wizard reappears if structure ever becomes incomplete.

### Gating
- `Add asset` and `BOM to existing asset` disabled until `structureComplete()`; tooltip explains why.
- Parent picker for new assets offers level ≥3 entries only; save-time validation rejects rows computing to level ≤3 unless created via structure flows (classification then auto-forced by level).
- CSV import forces role classification on rows landing at levels 1–3.

### Site dropdown
- Sites = top-level entries that contain others, drawn from register assets and session rows.

## Workstream 2 — Sanitization & fresh history

- Term list of client-identifying words is held outside the repo (never committed).
- Working tree scrub: genericize seed taxonomy (industry-generic categories stay; site roots, locations, addresses, org codes, source asset numbers go), clear register + `taken_nos`, reseed dev DB, delete legacy planning docs/archives containing source data, scrub code comments.
- Order: feature work → merge all branches to `main` → scrub → verify → squash.
- History: single fresh initial commit of the sanitized tree replaces all history; local + remote branches deleted; `main` force-pushed.
- Guaranteed clean break on the host: delete + recreate the remote repo under the same name, then push (owner action).
- Verification gate: case-insensitive scan of HEAD and full new history against the term list must return zero hits before push.

## Testing
- Unit tests: `roleOfLevel`, `structureComplete`, forced-classification behaviour.
- Live browser verification: wizard flow, gating, parent picker, CSV export columns, draft reload.
- Sanitization verification per gate above.
