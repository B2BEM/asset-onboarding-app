# ISO 55001 Asset Onboarding

A self-hosted, vendor-neutral asset onboarding tool framed around ISO 55000/55001
asset management. Users build an asset hierarchy (site → functional area → equipment)
against a curated asset-class taxonomy with automatic classification, abbreviation
and asset-number generation, per-asset details + bill of materials, and CSV exports
ready for an asset register / CMMS import.

The app ships with an **empty register**: the full asset-class taxonomy
(839 nodes, parent→child relationships, abbreviation codes and all rule logic)
is included, but no sites, departments, areas or assets — you create your own.

## Quick start

```bash
npm install
npm run seed     # idempotent: seeds the taxonomy into data/app.db
npm run dev      # http://localhost:8080 (AUTH_MODE=dev auto-signs you in as admin)
npm test         # generic rule-regression gate
```

## First use — creating your hierarchy

1. **Add asset** with no parent selected: this creates a top-level asset (your
   site or facility). Enter its code as the Asset / Tag name (e.g. `SITE1`) and
   set Classification to `REFERENCE` (containers with children classify as
   REFERENCE automatically).
2. Add further assets choosing the site as parent: the taxonomy cascade starts
   at the functional roots (`<ADMINISTRATION>`, `<BUILDINGS & INFRASTRUCTURE>`, …)
   and auto-fills classification, abbreviation and the next asset number
   (e.g. `SITE1-BLD01`).
3. Assets nested under a parent must sit at Level 4 or deeper (§LVL rule) —
   top-level rows are exempt, they ARE the structure.
4. Export the three CSVs (onboarding, BOM, taxonomy additions). An admin can pull
   exported CSVs into the internal register ("Update register"), after which the
   new assets appear as parents/sites for everyone.

## ISO 55001 asset attributes

Item assets carry five optional attributes: **Criticality, Condition,
Life-cycle stage, Asset function / purpose, Replacement cost**. Missing values are
flagged (warned) but never block export. The ⓘ tooltips carry the B2BEM working
definitions; edit them in `src/shared/domain/fields.js` (`FIELD_INFO`).

## Deployment

- `DEPLOY.md` — Docker + nginx TLS termination (compose file at the root).
- Auth: `AUTH_MODE=dev` (local), `oidc` (SSO via your IdP; see `.env.example`).

## Provenance

Ported from a single-file industry tool and genericized to an ISO 55001 template.
The frozen originals and the retired parity harness live in `archive/`;
the full port/dev history is `STATE.md`. Both intentionally retain references
to the original operator and are excluded from de-branding checks.
