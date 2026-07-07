# Company level above sites — register ladder & wizard redesign

**Date:** 2026-07-07 · **Status:** Approved (K. Duffy) · **Scope:** `src/shared/domain/structure.js`, `src/client/app.js`, `src/client/index.html`, `src/client/styles.css`, `test/structure.test.js`

## Decision

The register ladder gains a **Company** level at the top and drops **Asset Sub Class** as a forced structure role:

| Depth | Was | Becomes |
|---|---|---|
| 1 | SITE | **COMPANY** |
| 2 | ASSET CLASS | **SITE** |
| 3 | ASSET SUB CLASS | **ASSET CLASS** |
| 4+ | real assets | real assets (unchanged) |

`structureComplete` keeps its shape (a complete chain = some entry at depth 3). Sub-classes (e.g. `BLD01`) are created via **Add asset** under a class and take taxonomy-derived classification, exactly like today's depth-4 rows.

## Wizard (3 cards)

1. **Create a Company** — name only, top level (`wizAddCompany`, fallback code `CO`)
2. **Add Sites** — company dropdown + site name; company is the parent (`wizAddSite`, fallback `SITE`)
3. **Add Asset Classes** — site dropdown + taxonomy-roots pick / custom text — the previous class card one level down (`wizAddClass` unchanged in behaviour)

`wizSubTaxEntries`/`wizAddSub` deleted. Tree renders COMPANY ▸ SITE ▸ ASSET CLASS. Intro/gate copy: "one complete chain of **Company ▸ Site ▸ Asset Class**". The toolbar **New site** button already just opens this wizard — it now lands on the site card whose company dropdown defaults to the only company (the chosen "company-aware" behaviour), no extra code.

## Scoping & copy

- `buildSites()` lists **level-2** entries (register or session, with ≥1 child) — implemented via `wizardEntriesAtLevel(2)`. Prefix scoping for parent pickers / BOM search is unchanged (site numbers become `CO-SITE-…`).
- Copy sweeps: "top-level asset such as a site" → "such as a company"; "pick the Asset Sub Class" → "pick the Asset Class"; button titles, comments, wizard-finish toast.

## Explicitly unchanged

CSV LEVEL columns and the byte-identical ISO export (taxonomy levels are independent of register depth); parent-picker depth thresholds (`assetLevel ≥ 3`); server code (roles flow through the shared engine); numbering.

## Tests

`test/structure.test.js` updated: roles = COMPANY/SITE/ASSET CLASS; fixtures `CO1 ▸ CO1-S1 ▸ CO1-S1-B&I ▸ leaf`; register-spanning fixture `RS`(1=COMPANY)/`RS-FL`(2=SITE) with session class at depth 3 forced ASSET CLASS; depth-4 row keeps taxonomy classification; structure rows carry no blocking issues.

## Data cleanup (workstation instance)

After deploying: delete the old-ladder test rows (`B2BE` and `SOMW` trees) via `DELETE /api/rows/:id` (list via `GET /api/rows`) and the two leftover drafts via `DELETE /api/drafts/:id` — the drafts snapshot the same rows and would restore them. Verified empty afterwards; the user starts at "Create a Company".
