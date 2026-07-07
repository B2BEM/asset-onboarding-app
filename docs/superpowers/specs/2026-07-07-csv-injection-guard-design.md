# CSV / formula injection guard — security fix

Date: 2026-07-07
Status: from a security sweep of the whole project; the one genuine finding.

## Finding (Medium)

The CSV exporters (`buildCSV`/`buildBOMCSV`/`buildTaxCSV` in csv.js, `taxonomyToCSV`
in taxonomyImport.js) quote cells containing `, " \n \r` but do NOT neutralise cells
that *begin* with `= + - @` (or a leading tab/CR). A spreadsheet treats such a cell
as a formula. So a user who types an asset description like
`=HYPERLINK("http://evil","click")` or a legacy DDE payload has that formula execute
on the machine of whoever opens the exported register in Excel/LibreOffice —
a user→admin lateral attack across the export trust boundary.

Everything else in the sweep was clean: parameterized SQL throughout, `esc()` on all
interpolated HTML, strict CSP (no inline script), row/draft/bom queries scoped by
`user`, admin endpoints behind `requireAdmin`, prod fail-fast on default session
secret / dev-auth, `.env` + certs gitignored, `npm audit` = 0.

## Fix

Neutralise on export, strip on import so round-trips (the app re-imports its own
onboarding/taxonomy CSVs) stay lossless.

- `csv.js`: `CSV_RISK = /^[=+\-@\t\r]/`; `csvGuard(v)` prefixes a single `'` when the
  value is risk-leading; `csvUnguard(v)` removes it. `csvCell` now guards before
  quoting. Export `csvGuard`/`csvUnguard`.
- `taxonomyImport.js`: local `csvGuard` in its `csvCell` (guards `taxonomyToCSV`);
  `csvUnguard` on the value/type/code/desc/parent reads in `parseTaxonomyCSV`.
- `registerImport.js`: `csvUnguard` inside `cell()` so every parsed field is
  de-guarded (`parseRegisterCSV`).

A `'` is only added/removed when the following character is risk-leading, so ordinary
values (`B2BE-STH`, `Building & Infrastructure`, `<PUMPING>`, `*FIXED PLANT`) are
untouched and the existing round-trip gates stay green.

## Tests (registerImport gate)

`csvGuard` neutralises `= + - @`; leaves safe values; `csvUnguard∘csvGuard` is identity;
a guarded onboarding CSV re-imports to the original value.

## Not fixed (accepted / low)

- No rate limiting on admin import/reseed — requires the admin role; internal app.
- `/api/drafts` stores JSON blobs with no per-array cap (bounded only by the 10 MB
  body limit) — authenticated storage growth, low impact.
- Dev auth = every visitor is admin — by design for local use; prod start-up refuses
  it unless `ALLOW_DEV_AUTH_IN_PROD=true`.

## Verification

`npm test` (5 gates) → rebuild → live: import an onboarding CSV whose asset name is
`=cmd`, export the register, confirm the exported cell is `'=cmd` (neutralised), and
re-importing recovers `=cmd`.
