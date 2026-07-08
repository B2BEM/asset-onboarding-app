# Prototype-key injection hardening (untrusted keys → null-proto maps)

**Date:** 2026-07-08
**Type:** correctness / security (injection-class), follow-on to the 2026-07-07 security sweep
**Scope:** `src/shared/domain/taxonomyImport.js`, `src/server/dataset.js`, `test/taxonomyImport.test.js`

## Context

A user asked us to audit for **NoSQL query injection**. The app has **no NoSQL database** — it
is backed entirely by SQLite (`better-sqlite3`). Classic NoSQL injection (smuggling `$gt`/`$ne`/
`$where`, or turning a scalar into an operator object that always matches) is therefore not
applicable: SQLite never interprets a bound value as query logic.

Auditing the real analogues instead:

- **SQL injection:** none. Every one of the ~50 statements across `routes.js`, `auth.js`,
  `dataset.js`, `rowCompute.js`, `sessionStore.js` uses `?`/`@named` bound parameters. No user
  value is ever concatenated/interpolated into SQL.
- **Object/array smuggling into a scalar bind:** already defended by `str()`/`plainObj()`/
  `normalizeRowPayload()` in `routes.js` and by `String()` coercion in the CSV parsers.
- **Prototype-key smuggling (the one real hole):** see below.

## The bug (confirmed, reproduced)

`parseTaxonomyCSV` built `nodes`, `edges`, `parentOf` as plain `{}` objects keyed by the
untrusted **TAXONOMY VALUE / PARENT** columns. A `PARENT` cell equal to an inherited
`Object.prototype` member name — `toString`, `valueOf`, `hasOwnProperty`, `constructor`,
`__proto__` — resolved that inherited member instead of `undefined`:

1. the referential-integrity guard `!nodes[parent]` (line ~100) read the inherited member as
   **truthy**, so the *"parent is not a defined TAXONOMY VALUE"* validation was **bypassed**;
2. `(edges[parent] = edges[parent] || []).push(value)` then called `.push` on the inherited
   **function**, throwing `TypeError: edges[parent].push is not a function`.

The throw propagates out of `parseTaxonomyCSV` before the route's `r.ok` check, so
`POST /api/admin/taxonomy-import` returns **HTTP 500** instead of a clean **400** validation
error. No global `Object.prototype` pollution occurs (verified). Admin-gated, but reachable —
and in default `AUTH_MODE=dev` every visitor is an admin.

**Repro:** `POST /api/admin/taxonomy-import` body
`{"csv":"TAXONOMY VALUE,TAXONOMY TYPE,CODE,DESCRIPTION,PARENT TAXONOMY VALUE\nChild,,,,toString\n"}`
→ 500. (Also `constructor`, `__proto__`, `valueOf`, `hasOwnProperty`.)

**Sibling:** `dataset.js` `buildTaxonomyNodes` (`out[r.value]`) and `buildEdges` (`out[r.parent]`)
rebuild the same maps from the DB with plain `{}`. A node validly named `toString` used as a
parent would crash `buildEdges` — and `buildDataset()` runs on every page bootstrap, so that is a
**persistent app-wide 500** rather than a single request.

## Fix (cause, not symptom)

Allocate every map keyed by an untrusted string with `Object.create(null)` so no inherited
member can masquerade as an entry. Behaviour is unchanged for all legitimate keys
(`Object.entries`/`Object.keys`/`for…in`/indexing all still work; consumers in `data.js` and
`routes.js` only index or `Object.entries` these maps — verified, none call `.hasOwnProperty`).

- `taxonomyImport.js`: `parseTaxonomyCSV` (`nodes`, `edges`, `parentOf`), `detectCycle` (`color`),
  `taxonomyToCSV` (`parentOf`).
- `dataset.js`: `buildTaxonomyNodes` (`out`), `buildEdges` (`out`).

After the fix: a prototype-member **parent** produces the correct 400 validation error; a node
whose **value** is a prototype-member name is stored as an ordinary key and round-trips.

## Test gate

`test/taxonomyImport.test.js` extended (still the 4th of 5 gates): for each of
`toString / constructor / __proto__ / valueOf / hasOwnProperty` as a PARENT — asserts no throw and
a clean validation error; a node named `toString` parses, gets its edge, and re-exports; a node
named `__proto__` becomes an own key with `Object.prototype` left unpolluted.

## Files

| File | Change |
| --- | --- |
| `src/shared/domain/taxonomyImport.js` | 3 maps → `Object.create(null)` |
| `src/server/dataset.js` | 2 maps → `Object.create(null)` |
| `test/taxonomyImport.test.js` | +12 regression checks |
