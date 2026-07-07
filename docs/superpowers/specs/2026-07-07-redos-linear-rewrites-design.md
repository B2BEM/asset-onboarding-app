# ReDoS audit — linear rewrites of trailing-digit regexes — design

Date: 2026-07-07
Status: audit complete; two rewrites approved by the brief ("rewrite into safe
linear-time patterns or replace with non-regex parsing")

## Audit result

Full inventory of regex use across src/server, src/shared and src/client:

- **No dynamic `new RegExp(...)` anywhere** — no regex-injection surface.
- All patterns but two are linear: anchored character classes
  (`/^[=+\-@\t\r]/`), single char-class quantifiers (`/[^a-z0-9]+/g`),
  disjoint-class sequences (`/^[A-Za-z]+\d+$/`), and literal alternations
  (`/long|over|week|month|>|import/`). CSV parsing is char-by-char, not regex.
- Input length limits already exist at every user boundary BEFORE any regex
  runs: `normalizeRowPayload`/`str()` caps every row scalar (parent 300,
  tag 500, desc 4000, number 50…), `express.json({limit:'10mb'})` bounds all
  bodies, both CSV importers enforce `MAX_ROWS` + `cap()`, URLs are bounded by
  Node's 16 KB header limit.

**Two patterns are superlinear (O(n²))** — same shape, `digits$` with an
unanchored start, where the engine retries the greedy `\d+` at every position:

1. `/(\d+)$/` — src/shared/domain/numbering.js `proposedAssetDesc` (extracts
   the trailing sequence number for the auto asset name; runs server-side on
   every row recompute).
2. `/\d+$/` — src/shared/domain/rules.js `isSpecificTag`.

Empirical: on `'9'.repeat(1e6)+'X'` the match was still running after 20+
seconds (killed). At the API caps (≤ ~850 chars) worst case is ~3 ms — **not
exploitable today**; the caps are the only shield. Rewrite per the brief.

## Changes

1. **numbering.js** — replace the `/(\d+)$/` match with a backward
   character scan (charCode 48–57) that slices the trailing digit run.
   Identical semantics (`\d` without the u-flag is exactly ASCII 0-9), O(n)
   single pass, no backtracking.
2. **rules.js** — `/\d+$/.test(last)` → `/\d$/.test(last)`. "Ends with one or
   more digits" is equivalent to "last char is a digit"; O(1).

## Not changed (documented)

- Client-only regexes (`/\.[^.]+$/` filename strip, etc.): same quadratic
  shape class but run on tiny, self-supplied strings in the user's own tab —
  self-DoS at worst.
- **Matching timeout:** Node.js/V8 has no regex timeout mechanism (unlike
  .NET's MatchTimeout). The alternatives — the RE2 native addon or worker
  isolation — are unjustified once every server-reachable pattern is linear
  and every input is length-capped.

## Tests

- generic gate: `isSpecificTag` semantics pinned (trailing digit → true,
  no trailing digit → false).
- structure gate: `proposedAssetDesc` trailing-sequence extraction pinned
  ('OFFICE BUILDING 1' for the seeded leaf).
- All 5 gates must stay green.
