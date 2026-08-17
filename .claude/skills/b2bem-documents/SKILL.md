---
name: b2bem-documents
description: >
  B2BEM document creation skill. Use this skill whenever the user asks to create,
  draft, format, or update any B2BEM controlled document — including procedures,
  standards, policies, forms, templates, quotations, invoices, scope of works,
  reports, or any other document type in the B2BEM QMS. Covers entity selection
  (Enterprise Management vs Enterprise Specialists), document structure, naming
  conventions, brand formatting, ISO 9001 compliance, folder placement, and the
  docx build pattern. Always read this skill before producing any B2BEM document.
metadata:
  last_updated: 2026-08-05
  format_unchanged_since: 2026-07-11
  canonical: true
  format_basis: >
    The primary, canonical B2BEM controlled-document format — A4, B2BEM brand
    colours, dedicated cover page, real Word field TOC, and two-tone tables.
    The house standard for every B2BEM document. See Section 2A.
---

# B2BEM Document Creation Reference

This skill is the **primary, canonical toolset for all B2BEM controlled
documents** — use it for every B2BEM document. It contains everything needed to
produce correctly structured, branded, and ISO 9001-compliant documents for the
B2BEM group.

**Always read this skill before creating any B2BEM document.**

For deep reference on specific topics, see:
- `references/naming.md` — document numbering, area codes, type codes, file naming (identity — unchanged)
- `references/structure.md` — mandatory element order, cover page, header/footer spec, section templates
- `references/build.md` — docx-js build pattern, brand colours, helper functions, validation

---

## 1. Company Overview

The B2BEM group operates as **two separate legal entities**:

| Entity | ACN | Use for |
|---|---|---|
| B2BEM Enterprise Management | ACN 698 934 477 | Management-entity engagements |
| B2BEM Enterprise Specialists | ACN 698 971 550 | Specialist services engagements |

**Trading name:** B2BEM – Back to Basics
**Website:** www.b2bem.au
**Email:** services@b2bem.au
**Phone:** 0458 992 704
**Primary contact:** Sarah Ziegelaar
**Brand statement:** *"Delivering Confidence Through Risk Management, Technology, Quality & Project Support."*

### Entity Selection — MANDATORY HOLD POINT

Before creating any **quotation, invoice, or scope of works** (or any other
client-facing commercial document), you MUST stop and ask the user which
entity the document is being issued under:

1. **B2BEM Enterprise Management** — ACN 698 934 477
2. **B2BEM Enterprise Specialists** — ACN 698 971 550

Use the AskUserQuestion tool for this. Do not assume, do not default, and do
not proceed past this hold point without an explicit answer. The selected
entity's full legal name and ACN must then be used consistently in the cover
banner, Document Control table (Document Owner), Author & Reviewer table, and
the Word footer.

---

## 2. Brand Standards (apply to all documents)

### Colours
| Role | Name | HEX | Where used |
|---|---|---|---|
| Primary | Navy | `#0B2341` | Table title bars, H1/H2, primary borders, cover wordmark, running-header text, label-cell text, NOTE accent |
| Primary mid | Navy mid | `#154EB4` | Column-header rows (the second tone of the table hierarchy) |
| Highlight | Gold | `#F4B300` | H1 / section-heading underline, CONTENTS underline, CAUTION accent |
| Accent | Orange | `#F28C00` | WARNING accent, optional emphasis |
| Panel fill | Light grey | `#F2F2F2` | Label-cell fill, callout (NOTE/CAUTION/WARNING) fill |
| Grid line | Mid grey | `#E0E4EA` | Inside table gridlines |
| Body text | Dark grey | `#555555` | Body paragraphs |
| Base | White | `#FFFFFF` | Value cells, page |

### Typography
- **Font:** Arial throughout (universally supported, consistent rendering).
- **Body:** 10pt (size 20), Dark grey `#555555`, **1.15 line spacing** (`line: 276, lineRule: "auto"`), 120 DXA after.
- **H1:** Bold, 14pt (28 half-pts), Navy, UPPERCASE, **Gold** bottom border — set via the named **Heading 1** style.
- **H2:** Bold, 12pt (24 half-pts), Navy — named **Heading 2** style.
- **H3:** Bold, 11pt (22 half-pts), Navy — named **Heading 3** style.
- **Cover wordmark:** Bold, 36pt (72), Navy. **Cover type line:** Bold, 24pt (48), Navy. **Cover sub-line:** 11pt (22), Dark grey.
- **Small/caption/footer:** 7pt (14 half-pts).

**Headings must use the named Heading 1/2/3 styles** (not direct run formatting).
This is what lets a real Word Table of Contents field resolve — see Section 5.

**Spacing rule:** Never insert blank/empty paragraphs between body text and a
following H1 heading. The Heading 1 style's `spacing.before` provides the gap.

### 2A. Format basis and what changed

This is the **primary B2BEM controlled-document format** — the house standard to
use for every B2BEM document. It is built on A4 in the B2BEM brand palette
(Section 2), with a dedicated cover page, a real Word field TOC, and the two-tone
table system.

**Changes from the previous B2BEM house style (deliberate):**

1. **Dedicated cover page** with a large "B2BEM" wordmark banner + Document
   Control, Author & Reviewer, and Version History tables — replacing the old
   heavy 3-cell Navy/Orange title block on page 1.
2. **Light running header** — a borderless 3-cell header (doc number · title ·
   **B2BEM logo** `b2bem_logo.png` at 140×47, wide 2200 DXA cell) on every page,
   replacing the coloured header bar.
3. **Real Word field Table of Contents** driven by named Heading styles —
   replacing the bookmark/InternalHyperlink workaround.
4. **Two-tone table system** — Navy title bar + Navy-mid column-header row +
   Light-grey label cells — replacing the single-tone Navy header.
5. **Author & Reviewer table** (adds a *Position* column; **Author + Reviewer
   rows only, no Approver**) — replacing "Review & Approval". Author = K. Duffy
   (Director, Compliance & Engagement, signature auto-applied to the Author row); Reviewer by document type (S. Claydon —
   IT/tech/general; S. Ziegelaar — brand/marketing/website). S. Claydon's signature is
   auto-applied to the Reviewer row when he is the reviewer.
6. **Related Documents** is now its own table at the **end** of the document
   (not a row inside Document Control).
7. **Version History** is 4 columns (Version / Date / Description / Author) — the
   "Approved" column is dropped.
8. **1.15 line spacing** and **bold lead-in bullets** (`bulb`) as the default.
9. **A4 page** (11906 × 16838) — the Australian standard for all B2BEM documents.
10. The standalone orange **Scope band is removed** — Scope is body Section 2.

**B2BEM rules that are unchanged** (policy, not formatting): entity hold point +
ACN, the `B2BEM-[AREA]-[TYPE]-[NNN]` numbering, the five-tier hierarchy, filing
locations, **no ISO Reference row / no ISO mapping section**, **issue clean (no
DRAFT)**, and **no in-document Change Log**.

**Layout exemplar:** `B2BEM-COM-PRO-003 - Commissioning Management Procedure.docx`
in `02. HSEQ\02.Procedures\04. Maintenance procedures\04. commissioning procedures\`
- a live, format-verified example (9638 DXA borderless logo header, real field TOC,
two-tone tables, Author & Reviewer, A4, hyphen-only, pure builder output). When a
layout question isn't answered here, match the exemplar.

---

## 3. Document Number Format

Every B2BEM controlled document must use this format:

```
B2BEM-[AREA]-[TYPE]-[NNN] - [Short Descriptive Title]
```

**Example:** `B2BEM-MT-PRO-001 - Electrical Logbook Procedure`

Area codes, type codes, numbering rules, project codes, and the live number
register are the authoritative content of `references/naming.md` — read it before
assigning any number. A summary follows.

### Area Codes
| Code | Area | | Code | Area |
|---|---|---|---|---|
| COR | Corporate | | PM | Project Management |
| HR | Human Resources | | QA | Quality Assurance |
| HS | Health & Safety | | ACC | Accounts |
| HSE | Health, Safety & Environment | | SOW | Scope of Works |
| MT | Maintenance | | REF | Reference |
| COM | Commissioning | | INT | Internal |
| TEST | Testing | | IT | Information Technology |
| MEC | Mechanical | | CIV | Civil |
| PIP | Piping | | INS | Insulation |
| HVC | HVAC | | LFT | Lifting |
| TNK | Tanks & Vessels | | FIR | Fire Protection |
| SCF | Scaffolding | | BAL | Balancing & Cond. Monitoring |
| HVY | HV Switchyard | | MAR | Marine |
| NAV | Navigational Aids | | | |

### Document Type Codes
| Code | Type | Tier | | Code | Type | Tier |
|---|---|---|---|---|---|---|
| POL | Policy | 1 | | MAN | Manual | 3 |
| STD | Standard | 2 | | FRM | Form | 4 |
| PRO | Procedure | 3 | | TEMP | Template | 4 |
| WIN | Work Instruction | 4 | | REP | Report | 5 |
| PLN | Plan | 3 | | REG | Register | 5 |
| ITR | Inspection Test Record | 4 | | DRW | Drawing | - |

*(Full list including RFI, RFC, REC, DRW, SPC in `references/naming.md`.)*

### Numbering Rules
- Numbers start at 001 per Area Code + Type Code combination, increment sequentially.
- Numbers are never reused — retired docs marked SUPERSEDED.
- Allocated by the Document Controller before drafting begins.
- Must match: SharePoint file name, running header (left cell), and Master Document Register.
- Sub-documents use dot-suffix: `B2BEM-MT-PRO-001.1`.
- File name: `B2BEM-[AREA]-[TYPE]-[NNN] - [Title].docx` — space-hyphen-space, no revision or date in the name.
- **Policy ↔ Procedure pairing:** never combine a policy and its procedure in one document — a "policy & procedures" request is always split into two documents (the policy states the commitments; the procedure shows in full how they are met), each listing the other in its Related Documents table. Align the sequence numbers where the area/type scheme allows.

---

## 4. Document Hierarchy (Five Tiers)

| Tier | Type | ISO 9001 Clause |
|---|---|---|
| 1 | Policy (POL) | 5.2, 6.1 |
| 2 | Standard (STD) | 7.5 |
| 3 | Procedure / Plan / Manual | 7.5, 8.1, 8.5 |
| 4 | Work Instruction / Form / Template | 7.5, 8.6 |
| 5 | Record / Report / Register | 7.5.3, 9.1 |

Higher tiers always take precedence. Lower-tier documents must not contradict higher-tier documents.

### Authoring depth guide
The tier sets authority; how *deep* to author follows the document class:
- **Depth A — light:** forms, registers, checklists, simple templates (Form standard, minimal prose).
- **Depth B — standard:** standalone policies, procedures, standards, work instructions (full controlled template, concise sections).
- **Depth C — heavy:** management plans, audit reports, technical libraries (SWMS/VOC-style suites), multi-part manuals (full template plus appendices, tables and evidence).

---

## 5. Mandatory Document Structure

Every B2BEM **controlled document** (policy / procedure / standard / plan /
manual) is assembled in this order. Forms and registers use the lighter Form
standard — see Section 5A.

**COVER PAGE**
1. Lead spacer (drops content ~⅓ down the page).
2. **Cover banner** — "B2BEM" wordmark (36pt Navy) · document type/title (24pt) · sub-line `DOC-NO - Type - v1.0` (11pt).
3. **Document Control** table (2-col label/value).
4. **Author & Reviewer** table (Role / Name / Position / Signature / Date) — Author and Reviewer rows only, **no Approver**. Author = K. Duffy (Director, Compliance & Engagement); Reviewer by document type: S. Claydon (Director, IT & Communications) for IT/tech/general, S. Ziegelaar (Manager, Brand & Advertisement) for brand/marketing/website. **K. Duffy's signature is applied automatically to the Author row** from `assets/kduffy_signature.png` (copy it beside the build script alongside `b2bem_logo.png`), with the Date cell stamped from Issue Date. **S. Claydon's signature is applied automatically to the Reviewer row** from `assets/sclaydon_signature.png` (copy it beside the build script the same way), at the director's instruction (05/08/2026), with its Date cell also stamped from Issue Date. This applies **only when S. Claydon is the reviewer** - S. Ziegelaar has no signature graphic, so a brand/marketing document leaves the Reviewer signature blank for her to sign by hand.
5. **Version History** table (Version / Date / Description / Author).
6. Page break.
7. **CONTENTS** heading (Navy, Gold underline) + real Word field TOC (headings 1–3, hyperlinked).
8. Page break.

**BODY**
9. Section 1 — Purpose
10. Section 2 — Scope
11. Section 3 — References
12. Section 4 — Definitions & Abbreviations
13. Content sections (per document-type template — see `references/structure.md`).
14. Appendices (if required).

**END**
15. **Related Documents** — H1 heading + intro line + Related Documents table (Document Number / Document Name).

**RUNNING HEADER & FOOTER** repeat on every page (Word header/footer zones, not the body) — see Sections 8 and 9.

### Document Control Block (mandatory fields)
Document Number · Document Title · Document Type (e.g. `Policy (Tier 1)`) ·
Version · Issue Date · Review Date · Document Owner · Classification.

- **Document Owner** shows the issuing entity's full legal name and ACN (per the Section 1 hold point).
- **Issue documents clean (no DRAFT).** No DRAFT line, no DRAFT in the header; the Version field is the bare number (`1.0`). *(A `Status: DRAFT — for review` row may be used only while a document is out for approval; remove it on issue.)*
- **No ISO Reference row.** Documents remain fully controlled to AS/NZS ISO 9001 — only the visible row is removed, not the obligation.
- **No in-document Change Log.** The Version History row is the only in-document audit trace.
- **Related Documents** now lives in its own table at the end of the document (Section 5, item 15) — not inside Document Control.
- **Finish clean.** No `[bracketed]` placeholders may remain in a document marked final or APPROVED (the Author & Reviewer `[Name]`/`[Position]` cells awaiting a signature are the only exception). A document is never marked APPROVED while its Reviewer/Signature/Date fields are blank.

### 5A. Form / Register standard (lighter template)
Forms and registers omit the cover page, TOC, and Author & Reviewer block. They
use: a compact **form banner** (wordmark · title · `DOC-NO - Title - v1.0`),
numbered section headings with a Gold underline, `detailTable`/`gridTable` data
blocks, and a footer that carries a preparer/approver line above the uncontrolled
statement. The 5×5 risk-matrix pattern (coloured cells + checkbox selectors) is
the reference for hazard/risk forms. See `references/build.md` §Form standard.

### Version Numbering
- New documents start at `1.0`; major revision `2.0`; minor `1.1`. Never reuse or skip.

### Document States
`DRAFT` → `UNDER REVIEW` → `APPROVED` → `SUPERSEDED` / `ARCHIVED` / `VOID`.
Only **APPROVED** documents may be distributed or used in the field.

---

## 6. Filing Locations (SharePoint — B2BEM - Internal)

Paths below are verified against the library as at 23/07/2026. Note the inconsistent
spacing - `01.Policies` and `02.Procedures` have **no space** after the dot, most other
folders do. Type them exactly as shown.

| Document Type | SharePoint Path |
|---|---|
| Policies (POL) | `02. HSEQ / 01.Policies` |
| Standards - ALL areas (COR/HR/HS/MT/IT-STD) | `02. HSEQ / 02.Procedures / 03. Corporate Standards and Procedures / 01. Standards` |
| Procedures (Corporate) | `02. HSEQ / 02.Procedures / 03. Corporate Standards and Procedures / 02. Procedures` |
| Procedures (HSE) | `02. HSEQ / 02.Procedures / 01.HSE Procedures / 01. Procedures` |
| Procedures (HR) | `02. HSEQ / 02.Procedures / 02. HR procedures` |
| Procedures (Maintenance) | `02. HSEQ / 02.Procedures / 04. Maintenance procedures` |
| **Procedures (Commissioning + all discipline I&T)** | `02. HSEQ / 02.Procedures / 04. Maintenance procedures / 04. commissioning procedures` - holds COM-PRO and every discipline `-PRO-001` (MEC, CIV, PIP, INS, HVC, LFT, TNK, FIR, SCF, BAL, HVY, MAR, NAV) |
| **Procedures (IT)** | `02. HSEQ / 02.Procedures / 06. IT Procedures` |
| **Procedures (Projects / PM)** | `02. HSEQ / 02.Procedures / 07. Project Procedures` |
| Test Procedures | `02. HSEQ / 02.Procedures / 05. Electrical test procedures` |
| Management Plans | `02. HSEQ / 03. Management plans` |
| Forms & Templates (HSE) | `02. HSEQ / 04. Forms & Templates / 01.Templates / 01. HSE` |
| Templates (Corporate) | `02. HSEQ / 04. Forms & Templates / 01.Templates / 02. Corporate` |
| Forms (Corporate / HSE / HR / Maintenance) | `02. HSEQ / 04. Forms & Templates / 02. Forms / [01. Corporate ¦ 02. HSE ¦ 03. HR ¦ 04. Maintenance]` |
| **Forms (QA)** | `02. HSEQ / 04. Forms & Templates / 01.Templates / 03. QA` - QA-FRM is the one FRM series filed under Templates, not Forms |
| Specifications (SPC) | `02. HSEQ / 06. Specifications` |
| Manuals (MAN - all areas) | `02. HSEQ / 07. Manuals` |
| **Registers (REG)** | `02. HSEQ / 08. Registers` - incl. the Master Document Register and HSE Package Register |
| **Audit reports (HS-REP)** | `02. HSEQ / 09. HSE Monthly doc audits` |
| **Inspection Test Records (ITR)** | `06. Maintenance / [NN.Discipline] / Inspection Test Records` - see the ITR table below |
| Business Plans | `01. Business Management / 01. Busniess plans` *(folder name is misspelt on disk - type it exactly)* |
| Corporate Risk Register | `01. Business Management / 02. Business Risk Anaysis` *(misspelt on disk)* |
| Accounts (ACC-PRO / STD / TEMP) | `03. Accounts / [05. Procedures ¦ 04. Pricing ¦ 03. Xero Templates]` |
| SOW Templates | `04. Scope Of Works / 01. SOW -SERVICES-TEMPLATES` |
| Training register | `05. Training` |
| Project Documents | `07. Projects / [YYYYMMDD - Client - Description] / [sub-folder]` |

**ITR filing - `06. Maintenance\[folder]\Inspection Test Records`:**

| Code | Folder | Code | Folder |
|---|---|---|---|
| MEC-ITR | `02.Mechanical` | SCF-ITR | `10.Scaffolding` |
| CIV-ITR | `03.Civil` | BAL-ITR | `11.Balancing` |
| PIP-ITR | `04.Piping` | HVY-ITR | `12.HV Switchyard` |
| HVC-ITR | `05.HVAC` | MAR-ITR | `13.Marine` |
| INS-ITR | `06.Insulation` | NAV-ITR | `14.Navigational Aids` |
| LFT-ITR | `07.Lifting` | TNK-ITR | `08.Tanks` |
| FIR-ITR | `09.Fire` | | |

**Electrical ITRs are the exception** - they carry **COM-ITR** numbers (not an ELE code)
and are split across two folders that are *not* named "Inspection Test Records":
`06. Maintenance\01.Electrical\01.Installation & Maintenance\Installation Test sheets`
(COM-ITR-001..090) and `...\Commissioning Test sheets` (COM-ITR-091..152).

**Routing traps - folders that look right but are not:**
- `02. HSEQ\02.Procedures\05. HSE Standards` is **empty**; HS-STD documents live in the
  Corporate `01. Standards` folder with every other standard.
- `COR-REG-001/002` (Register of Members) are **not** in `08. Registers` - they are in
  `01. Business Management\05. Registration Docs\01. To be filed\06. Share Registers`.
- `COR-REG-004` (Corporate Risk Register) is in `01. Business Management\02. Business Risk Anaysis`.
- SOW-TEMP is split: 001/002 under HSEQ Templates, 004/005 under `04. Scope Of Works`.
- `01.Templates` has **two folders numbered 03** (`03. Asset Management`, `03. QA`).

### Filing Rules
1. **Route by document type to its specific folder** — resolve every nested level, not just the top folder.
2. **New type, no folder** — create one mirroring the sibling numbering/naming style, then file inside it.
3. **Folder-number collisions** — never renumber controlled folders automatically; assign the next unused ascending number, flag the collision to the user, and record it in the current HSE Monthly Document Audit.
4. **Verify before assigning** — confirm the path and next number against actual folder contents (folders may be cloud-only and unsynced).

---

## 7. Writing Standards

### Tone
- Professional, authoritative, direct. Active voice, sentence case, present tense for requirements.
- Short sentences — one idea per sentence. Plain, Tier-1 readable language — short and direct (e.g. *"Workers use unique credentials…"*).
- No hype ("world-class", "cutting-edge", "synergy"). Use: clear, practical, reliable, structured, evidence-based.
- Requirements use **must** (mandatory) or **should** (recommended). Avoid "ensure" as a lazy wrapper — state the action.

### Action Steps (PRO / WIN)
- Begin each step with an imperative verb: Inspect, Verify, Record, Notify, Isolate.
- One action per step; include an acceptance criterion and responsible role where relevant.

### Punctuation & Language
- **Hyphen only** — no em dashes (—) and no en dashes (–) anywhere in any document. Check `document.xml` for both characters before saving (see build.md §9).
- **Australian English** spelling throughout (organisation, authorised, analyse).
- **Legislation currency:** before issue, verify any cited act, regulation or code is current (web search) and cite the exact title and year — e.g. `WHS Act 2020 (WA)`, `Privacy Act 1988 (Cth)`.

### Callouts (standardised boxes — not bold body text)
- **NOTE** (Navy) — important information, no hazard.
- **CAUTION** (Gold) — potential equipment damage or process failure.
- **WARNING** (Orange) — potential for injury or serious harm.

---

## 8. Running Header (repeats every page)

A **light, borderless 3-cell table** in the Word **header zone** (not the body):

| Cell | Width (DXA) | Content |
|---|---|---|
| Left | 1700 | Document number — Navy `0B2341`, 9pt |
| Middle | 5738 | Document title — bold Navy, 9pt, centred |
| Right | 2200 | **B2BEM logo** `b2bem_logo.png` at 140×47 — the wide horizontal lockup (source `Website_topper Logo.png`), on a white plate that blends into the white header. The logo ships with this skill at `assets/b2bem_logo.png`. Falls back to a bold Navy "B2BEM" wordmark if the file is absent |

No fill, no borders (transparent). Widths sum to the A4 content width **9638 DXA**.

**Rules:** an empty `Paragraph` must precede the header table; the header sits
**0.2 cm (113 DXA)** from the top edge via `page.margin.header = 113`
(`footer = 454`).

---

## 9. Running Footer (every page)

Single centred paragraph, **Navy top border**, Arial 7pt, dark grey. Must carry
the issuing entity's full name and ACN:

**Enterprise Specialists:**
```
UNCONTROLLED DOCUMENT WHEN PRINTED  |  [DOC NUMBER] Rev X.X  |  © B2BEM Enterprise Specialists ACN 698 971 550  |  www.b2bem.au  |  0458 992 704  |  Page X of Y
```

**Enterprise Management:**
```
UNCONTROLLED DOCUMENT WHEN PRINTED  |  [DOC NUMBER] Rev X.X  |  © B2BEM Enterprise Management ACN 698 934 477  |  www.b2bem.au  |  0458 992 704  |  Page X of Y
```

Forms/registers add a preparer/approver line above this (see `references/build.md`).

---

## 10. Table System (two-tone hierarchy — applies to every table)

| Row / cell | Fill | Text |
|---|---|---|
| **Title row** (full width, `columnSpan` all columns) | Navy `0B2341` | White, bold, ALL CAPS, 10pt |
| **Column-header row** | Navy mid `154EB4` | White, bold, ALL CAPS, 9pt |
| **Label cell** (left column of key/value tables) | Light grey `F2F2F2` | Navy, bold |
| **Value cell** | White | Dark grey body text |

- Full-width title rows must be a `columnSpan` row **of the same table grid** — never a separate one-cell table above it, never a lone cell sized to table width.
- Borders: Navy outer, `E0E4EA` inside gridlines. Cell margins `{top:60, bottom:60, left:120, right:120}`.
- Always `WidthType.DXA` and `ShadingType.CLEAR`. `columnWidths` must sum to the table width and also be set on each cell.

See `references/build.md` for the `titleCell` / `colHdr` / `labelCell` / `valCell` helpers.

---

## 11. Workflow: Creating a New B2BEM Document

1. **HOLD POINT — for quotations, invoices, and scope of works: ask the user which entity issues the document** (Enterprise Management ACN 698 934 477 or Enterprise Specialists ACN 698 971 550) via AskUserQuestion. Do not proceed without an answer.
2. **Reuse before authoring:** check the QMS for an existing B2BEM document that covers the topic — revise/reformat it rather than writing from scratch (ask the user for the source file if it can't be found). Then confirm the document number against `references/naming.md` and the live register.
3. Select area code and type code (Section 3).
4. Identify the correct filing location (Section 6).
5. Read the `docx` skill for the general build pattern.
6. Read `references/build.md` for the B2BEM docx helpers, and `references/structure.md` for the section template of the document type.
7. Build the `.docx` with `node build_script.js` in the outputs directory (copy this skill's `assets/b2bem_logo.png` beside the script — only use the wordmark fallback if the asset is genuinely unavailable).
8. Validate (see `references/build.md` §Validation):
   - Opens; expected table count; running header has 3 cells (doc no · title · logo/wordmark); header distance ≈ 0.2 cm.
   - **Cover page present** — wordmark banner, Document Control, Author & Reviewer, Version History.
   - **Contents is a real Word field TOC** (updates on open / F9), driven by Heading 1–3 styles — not plain text, not the bookmark hack.
   - Footer carries page numbers, the uncontrolled statement, and the correct entity name + ACN.
   - No "ISO Reference" row; no "DRAFT" in header/Version; Filing Location has no `SharePoint:` prefix.
   - No blank paragraph immediately before any H1; no in-document Change Log.
   - **Related Documents** table sits at the end of the document.
   - **Punctuation & placeholders:** zero em dashes (—) / en dashes (–) in `document.xml`; no `[bracketed]` placeholders in a final document (blank signature cells excepted).
   - **Visual check:** render or open page 1 and eyeball the cover — banner in the upper half, tables aligned to one width, logo crisp — before delivering.
9. Copy to the correct SharePoint path (Section 6), and add the row to the Master
   Document Register.
10. Deliver the file to the user with the **`SendUserFile`** tool.

### Allocating a document number

**There is no number table in this skill, deliberately.** Every static snapshot that
has ever been kept here went stale and caused documents to be allocated over the top
of existing ones. Numbers come from the live register, every time, with no exception:

`02. HSEQ\08. Registers\B2BEM-COR-REG-003 - Master Document Register.xlsx`

1. Open the register (use the `xlsx` skill). **Back it up before any edit.**
2. Read the **Controlled Library** sheet (column A = Doc Number) **and** the
   **Supporting & Archive** sheet - a number retired to archive is still consumed
   and must never be reissued.
3. Take the highest number for that `AREA-TYPE` prefix across **both** sheets, add 1.
4. Cross-check the target folder on disk before writing (a file can exist that the
   register has not yet caught up with; if they disagree, the higher number wins and
   the discrepancy goes in the next audit note).
5. Record the new row in the register as you go - do not batch it up for later.

*Rule of thumb: if you did not just read the number out of the register in this
session, you do not know it.*

---

## 12. Build Engine

B2BEM documents are produced by **three** builders:

| Builder | Produces | Defined in |
|---|---|---|
| `buildDoc` | Controlled documents - cover page, field TOC, two-tone tables: policies, procedures, standards, plans, manuals | `references/build.md` |
| `buildFormDoc` | Forms and registers - compact banner + data blocks, incl. the 5x5 risk-matrix pattern | `references/build.md` §10 |
| `buildITR` | **Inspection Test Records (ITR)** - the largest document class in the library (400+ records) | `b2bem_itr_builder.js`, see below |

Each keeps: B2BEM colours (Section 2A), A4 page size, entity + ACN footer, no ISO row,
and issue-clean (no DRAFT).

**Engine locations** (`02. HSEQ\09. HSE Monthly doc audits\_build\`):
- `b2bem_docx_builder.js` - canonical copy at `_build\` root. Five working copies exist
  in the phase subfolders (`marine`, `mecciv`, `piping`, `fsbh`, `comproc`); all six are
  byte-identical, so any is safe to use.
- `b2bem_itr_builder.js` - **no canonical copy at `_build\` root.** Four copies exist and
  they are **not** identical: `mecciv` and `piping` are the baseline; `fsbh` adds
  `detailFields` / `detailExtra` / `detailTitle` / `detailHeading`; **`marine` is the
  superset** (same options, better defaults - `detailFields` implies an "ITEM DETAILS"
  title). **Use the `marine` copy.** All four export
  `{ buildITR, W, w2, w3, w4, w5, w6, blank, ENTITY }` and all four emit the current
  9638 DXA header, so switching to `marine` is safe for existing build scripts.

`buildITR(spec)` accepts: `docNo`, `docTitle`, `discipline`, `parent`, `version`,
`intro`, `crossRef`, `warning`, `caution`, `detailExtra`, `checklistTitle`, `sections`,
`tests`, `file` - plus `detailFields`, `detailTitle`, `detailHeading` on the `marine`
copy. The doc-comment inside each engine file is stale and omits several of these.

See also:
- `references/build.md` — complete docx-js code patterns and validation
- `references/structure.md` — full section template for each document type
- `references/naming.md` — exhaustive naming and numbering reference (unchanged)
