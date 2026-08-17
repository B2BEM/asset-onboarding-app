# B2BEM Document Structure Reference (B2BEM colours · A4)

## Entity Selection (read first)

B2BEM operates as two legal entities. Every quotation, invoice, and scope of
works MUST state the issuing entity, confirmed with the user before drafting
(mandatory hold point — see SKILL.md Section 1):

| Entity | ACN |
|---|---|
| B2BEM Enterprise Management | ACN 698 934 477 |
| B2BEM Enterprise Specialists | ACN 698 971 550 |

The selected entity's name and ACN appear in: the Document Control **Document
Owner** row, the **Author & Reviewer** table, and the Word **footer**.

---

## Mandatory Element Order (controlled documents)

Policies, procedures, standards, plans and manuals are assembled in this exact
order. Forms and registers use the lighter Form standard (Section H).

**COVER PAGE**
1. Lead spacer (drops content ~⅓ down the page)
2. Cover banner — "B2BEM" wordmark · document type/title · sub-line `DOC-NO - Type - v1.0`
3. Document Control table
4. Author & Reviewer table
5. Version History table
6. Page break

**CONTENTS**
7. CONTENTS heading (Navy, Gold underline)
8. Word field Table of Contents (headings 1–3, hyperlinked)
9. Page break

**BODY**
10. Section 1 — Purpose
11. Section 2 — Scope
12. Section 3 — References
13. Section 4 — Definitions & Abbreviations
14. Content sections (see document-type templates, Section H)
15. Appendices (if required)

**END**
16. Related Documents — H1 heading + intro line + Related Documents table

The **running header and footer** repeat on every page (Word header/footer
zones, not the body). **No Change Log appendix** — the Version History row is the
only in-document audit trace. There is **no standalone Scope band** — Scope is
body Section 2.

---

## A. Running Header (repeating page header)

**Light, borderless** 3-cell table in the Word **header zone** (not the body).
Appears on every page. No fill colour.

```
[Left]                 [Middle: centred]              [Right]
B2BEM-XX-PRO-001       DOCUMENT TITLE                 [B2BEM logo] (or "B2BEM")
```

| Cell | Width (DXA) | Content |
|---|---|---|
| Left | 1700 | Document number — Navy `0B2341`, 9pt |
| Middle | 5738 | Document title — bold Navy, 9pt, centred |
| Right | 2200 | `b2bem_logo.png` at 140×47 — the wide horizontal lockup (source `Website_topper Logo.png`), on a white plate that blends into the white header. Bold Navy "B2BEM" wordmark fallback if the file is absent |

Widths sum to the A4 content width **9638 DXA**.

**Rules:** an empty `Paragraph` must precede the header table; the header sits
**0.2 cm (113 DXA)** from the top edge — `page.margin.header = 113`, with
`footer = 454`.

---

## B. Cover Banner (page 1, body)

Centred block, no border:

```
B2BEM                       (36pt bold, Navy — wordmark)
[Document Type / Title]      (24pt bold, Navy)
DOC-NO - Type - v1.0         (11pt, dark grey)
```

Preceded by a lead spacer so the banner sits roughly one-third down page 1.

---

## C. Document Control Table

2-column label/value. The "DOCUMENT CONTROL" title row is part of the same table,
spanning both columns via `columnSpan: 2` (Navy title bar). Column headers are
not used here; the left column uses Light-grey **label cells**.

| Field | Detail |
|---|---|
| Document Number | B2BEM-[AREA]-[TYPE]-[NNN] |
| Document Title | [Full document title] |
| Document Type | [e.g. Policy (Tier 1) / Procedure (Tier 3)] |
| Version | 1.0 |
| Issue Date | DD/MM/YYYY |
| Review Date | DD/MM/YYYY (12 months from issue by default) |
| Document Owner | [Issuing entity full name + ACN] |
| Classification | CONTROLLED |

Column widths: HALF + HALF = 4819 + 4819 = 9638 DXA.

- **No ISO Reference row** — not in Document Control or any cover block. ISO 9001 control still applies; only the visible row is removed.
- **No DRAFT on issue.** A `Status: DRAFT — for review and approval` row may be shown only while the document is out for approval; remove it on issue.
- **Related Documents is NOT a row here** — it is its own table at the end of the document (Section G).

---

## D. Author & Reviewer Table

5-column table with **two role rows — Author and Reviewer (no Approver row).**
Title row "AUTHOR & REVIEWER" spans all 5 columns (Navy); the
Role/Name/Position/Signature/Date header row uses Navy-mid column headers.

| Role | Name | Position | Signature | Date |
|---|---|---|---|---|
| Author | K. Duffy | Director, Compliance & Engagement | *(signature auto-applied)* | *(issue date)* |
| Reviewer | *(by document type — see below)* | | *(auto-applied for S. Claydon only)* | *(issue date, if signed)* |

Column widths: 1927 + 1927 + 1927 + 1927 + 1930 = 9638 DXA.

**The Reviewer is chosen by the document's domain:**

| Document domain | Reviewer | Position |
|---|---|---|
| IT / cyber / data / communications / technology — and general/default | S. Claydon | Director, IT & Communications |
| Brand / marketing / advertising / website / social | S. Ziegelaar | Manager, Brand & Advertisement |

Author defaults to **K. Duffy** for controlled documents; change it only when
someone else genuinely authored the document. There is **no Approver row**.

**Signatures.** K. Duffy's signature is auto-applied to the Author row, and
S. Claydon's to the Reviewer row when he is the reviewer (both stamped with the
issue date). S. Ziegelaar has no signature graphic, so a brand/marketing document
leaves the Reviewer signature and date blank for her to sign by hand. Because the
Reviewer row now auto-signs, the build no longer proves review took place — only
issue a document S. Claydon has actually reviewed.

---

## E. Version History Table

4-column table (no "Approved" column). Title row "VERSION HISTORY" spans all 4
columns (Navy); the header row uses Navy-mid column headers.

| Version | Date | Description | Author |
|---|---|---|---|
| 1.0 | DD/MM/YYYY | Initial issue | K. Duffy |

Column widths: 2409 + 2409 + 2411 + 2409 = 9638 DXA.

- **Description** is concise: `Initial issue`, or for an audit fix `Audit remediation — see <REP doc number>`. Never a verbose change list.
- **Author** is the name only (e.g. `K. Duffy`) — no `(HSE)` or title suffix.
- This row is the **only** in-document audit trace. No in-document Change Log appendix.

---

## F. Contents (Word field TOC)

A **real Word Table of Contents field** — not plain text, not a bookmark
workaround:

- A "CONTENTS" heading (Navy 14pt, Gold bottom border).
- `new TableOfContents("Table of Contents", { hyperlink:true, headingStyleRange:"1-3" })`.
- Document built with `features:{ updateFields:true }` so Word offers to update the field on open.

This works because all body headings use the named **Heading 1/2/3** styles. In
Word, accept the "update fields" prompt (or Ctrl+A → F9) so the Contents
paginates.

---

## G. Related Documents Table (end of document)

H1 heading "Related Documents" + one intro line + a 2-column table (Navy title
bar, Navy-mid headers):

| Document Number | Document Name |
|---|---|
| B2BEM-XX-PRO-00X | [Related document title] |
| [TBA] | [Document Not Yet Created] |

Column widths: 2700 + 6938 = 9638 DXA. Flag any not-yet-created related document
as `[TBA]` / `[DOCUMENT NOT YET CREATED]` so the gap is visible.

---

## H. Section Content Templates

All content headings use the named Heading styles (`h1`/`h2`/`h3`).

### Policy (POL)
1. Purpose · 2. Scope · 3. References · 4. Definitions & Abbreviations
- **5 — Policy Statement** (numbered commitment statements)
- **6 — Responsibilities** (`dataTable`: Role | Responsibility)
- **7 — Compliance & Consequences**
- **8 — Review** (cycle, trigger events)

### Procedure (PRO)
1–4 as above, then:
- **5 — Prerequisites** (PPE, permits, tools, isolation requirements)
- **6 — Safety Precautions** (hazards, controls, referenced risk assessment; use `warningBox`/`cautionBox`)
- **7 — Procedure Steps** (`dataTable`: Step | Action | Responsible | Acceptance Criterion)
- **8 — Completion Requirements** (sign-off, records, reinstatement)
- **Appendix A — Related Forms / Records**

### Standard (STD)
1–4 as above, then:
- **5–N — Topical requirement sections** (rules, specifications, tables)
- **N+1 — Responsibilities** (`dataTable`: Role | Responsibilities)
- **Appendix A — Quick Reference**
- **Appendix B — Prohibited Practices / Common Mistakes**

No ISO/Regulatory Compliance Mapping section (obligation unchanged; visible
mapping removed, same principle as the removed ISO Reference row).

### Plan (PLN)
1–4 as above, then:
- **5 — Objectives & Targets** (measurable outcomes the plan delivers)
- **6 — Management Arrangements** (topical H2 sub-sections — resources, communication, training, monitoring — as fits the plan)
- **7 — Risk Management** (`dataTable`: Risk | Control | Owner; reference the risk assessment)
- **8 — Roles & Responsibilities** (`dataTable`: Role | Responsibilities)
- **9 — Monitoring, Review & Reporting** (KPIs, inspection/audit schedule, review triggers)
- **Appendices** — registers, forms, flow diagrams referenced by the plan

### Manual (MAN)
1–4 as above, then topical H1 chapters (one per subject area), each opening with
a one-paragraph overview before its H2 detail; a Responsibilities table; and
appendices. Manuals are navigational documents — keep chapters parallel in
structure so the TOC reads as a system map.

### Report (REP) — incl. audit reports
Full controlled-document structure (cover, field TOC). Body per
`B2BEM-AUD-MRT-001` (the reference audit report):
- **1 — Executive Summary** (plain-English overview + a **Gap Summary** `dataTable`: Category | Documents Reviewed | Compliant | Gaps | Rating)
- **2 — Scope & Methodology** (what was assessed, standards applied, how)
- **3 — Findings** (H2 per category, each with a findings `dataTable`: Ref | Finding | Risk/Impact | Rating). Rating cells use the functional traffic-light fills (build.md §10A): Compliant green, Minor gap yellow, Major gap orange, Critical red.
- **4 — Recommended Actions** (`dataTable`: Ref | Action | Priority | Responsible | Due). If actions are costed, close with Subtotal / GST 10% / **Grand Total** rows — bold labels, amounts right-aligned.
- **5 — Conclusion**
- **Appendices** — evidence register, document list, methodology detail

### Work Instruction (WIN)
A compact controlled document — keep it under ~6 pages (the TOC page may be
dropped for very short WINs):
- **1 — Task & Purpose** (one paragraph)
- **2 — PPE & Tools Required** (bullets or a 2-column table)
- **3 — Step-by-Step Instruction** (`dataTable`: Step | Action | Key Point)
- **4 — Records** (what is signed/filed on completion)
Steps follow the PRO writing rules — imperative verb, one action per step.

### Request for Information (RFI) / Request for Change (RFC)
Client-facing; structure per `B2BEM-RFI-MRT-001`. Full cover block, then:
- **1 — Purpose & Context** (why the information/change is requested; reference the originating SOW or contract by number)
- **2 — How to Complete** (who completes what, return-by date, return address)
- **Sections A, B, C…** — one lettered H1 per topic area, each a `detailTable` (Detail | Entry) with blank Entry cells for the client to fill; checkbox selectors `☐ Option` for single-select questions
- **Final section — Sign-off** (`gridTable`: Role | Name | Signature | Date)

For an **RFC**, Section A is always the change description (Current state |
Proposed change | Reason | Impact if not made), followed by an impact assessment
`dataTable` (Area | Impact | Rating) and an Approval sign-off block.

### Meeting Minutes (PM-FRM) — Form standard
Built with the Form builder, structure per `08072026-PM-FRM-001`:
- **Meeting Details** (`detailTable`: Date, Time, Location, Chair, Minute-taker, Attendees, Apologies)
- **Distribution** (who receives the minutes)
- **Safety Share** (topic + key point — first agenda item for site-related meetings)
- **Previous Minutes** (confirmation + carried-over actions)
- **Discussion Items** (numbered `formH` sections, or `gridTable`: Item | Discussion | Outcome)
- **Action Item Register** (`gridTable`: # | Action | Responsible | Due | Status — values Open / In Progress / Closed)
- **Next Meeting** (date, time, location)
Minutes file-name pattern: `DDMMYYYY-PM-FRM-NNN - [Meeting Title].docx`.

### Register (.xlsx)
Registers that live as spreadsheets (Master Document Register, audit registers,
plant/asset registers) carry the same identity in Excel:
- Tab 1 is the register; extra tabs only for genuinely separate lists (e.g. `Document Register` / `Gap & Action List`).
- Row 1 title band: register name, white bold on Navy `0B2341`; row 2 column headers white bold on Navy-mid `154EB4`; freeze panes below the header row.
- A **Status** column with a fixed value list (Current / Under Review / Superseded, or Open / Closed) — updated whenever documents are issued.
- Arial 10 throughout; borders on the table range only; one register per sheet.
- File name: `B2BEM-[AREA]-REG-[NNN] - [Title].xlsx` (same numbering rules as .docx).

### Scope of Works (SOW) — entity hold point applies
Confirm the issuing entity before drafting. 1–3 as above, then:
- **4 — Client Information**
- **5 — Deliverables** (`dataTable`: Item | Description | Deliverable | Timeline)
- **6 — Inclusions & Exclusions**
- **7 — Assumptions & Dependencies**
- **8 — Investment Summary** (pricing table)
- **9 — Terms & Conditions** (issued by [entity full name] ACN [number])
- **10 — Acceptance** (sign-off naming the issuing entity + ACN)

### Quotation — entity hold point applies
Confirm the issuing entity before drafting. Quotations use the
controlled-document builder with a commercial body:
- **1 — Introduction** (who the quote is for, what was requested, validity period — default 30 days)
- **2 — Scope of Services** (what is included, summarised; reference the SOW by number if one exists)
- **3 — Pricing** (`dataTable`: Item | Description | Qty | Unit Price (ex GST) | Total (ex GST); then **Subtotal / GST 10% / Total (inc GST)** rows — bold labels, amounts right-aligned)
- **4 — Exclusions** (bulleted — anything not priced)
- **5 — Payment Terms** (terms days, invoicing schedule/milestones, method)
- **6 — Acceptance** (sign-off block naming the issuing entity + ACN)

All amounts AUD; state ex/inc GST explicitly on every figure. The entity's full
legal name and ACN appear in the Document Control **Document Owner** row,
Section 6 Acceptance, and the footer.

### Invoice — entity hold point applies
Where an invoice document is required (rather than one issued from the
accounting system), mirror the Quotation pricing table and GST breakdown, and
carry: invoice number, issue date, due date, payment details (bank / BSB /
account), and the issuing entity's full name + ACN in the body and footer.

### Form / Register (FRM / REG / TEMP) — Form standard
Built with the **Form builder** (`buildFormDoc`), not the cover-page builder:
- Compact **form banner** (wordmark · title · `DOC-NO - Title - v1.0`)
- Numbered section headings (`formH`, Navy caps + Gold underline)
- `detailTable` (Detail | Entry) and/or `gridTable` (arbitrary grid) data blocks
- Checkbox selectors `☐ Option` for single-select fields
- Sign-off block (`gridTable`: Role | Name | Signature | Date)
- Footer carries a preparer/approver line above the uncontrolled statement
- **Hazard / risk forms:** include the coloured 5×5 risk matrix (build.md §10A) and close with a `cautionBox` confirming the client's endorsed matrix/thresholds

---

## I. Table Formatting Rules (two-tone hierarchy)

| Element | Specification |
|---|---|
| Title row | Full width via `columnSpan` on the SAME grid (Navy `0B2341`, white bold ALL CAPS 10pt) — never a separate one-cell table above the data table |
| Column-header row | Navy-mid `154EB4`, white bold ALL CAPS 9pt |
| Label cell (key column) | Light-grey `F2F2F2`, Navy bold text |
| Value cell | White, dark-grey body text |
| Outer border | Navy `0B2341` |
| Inside gridlines | Mid-grey `E0E4EA` |
| Cell padding | `{top:60, bottom:60, left:120, right:120}` DXA |
| Shading | Always `ShadingType.CLEAR` — never `ShadingType.SOLID` |
| Width type | Always `WidthType.DXA` — never `WidthType.PERCENTAGE` |
| Column widths | Must sum to the table width (9638 DXA); set on table AND each cell |
| Alternating rows (optional) | Long data tables/registers (~15+ rows): fill alternate data rows Light-grey `F2F2F2` to aid row tracking |
| Wide tables | If a register cannot fit 9638 DXA legibly, use a landscape A4 section for those pages (build.md §10B) — never shrink text below 8pt to force portrait |
| Risk-band cells | Functional traffic-light colours (green `C6E0B4` / yellow `FFE699` / orange `F4B183` / red `E06666`) — kept, they signal severity not brand |

---

## J. Paragraph & List Rules

| Element | Specification |
|---|---|
| Body text | Arial 10pt (size 20), dark grey `555555`, **1.15 line spacing** (`line:276, lineRule:"auto"`), 120 DXA after |
| H1 | Arial 14pt (size 28), Navy, UPPERCASE, bold, **Gold** bottom border — via the named **Heading 1** style |
| H1 spacing | NO blank/empty paragraph before an H1 — the style's `spacing.before` (300 DXA) provides the gap |
| H2 | Arial 12pt (size 24), Navy, title case, bold — **Heading 2** style |
| H3 | Arial 11pt (size 22), Navy, title case, bold — **Heading 3** style |
| Bullets | `LevelFormat.BULLET` numbering — never a literal `•`. Use `bulb(lead,rest)` for bold lead-in bullets |
| Numbered lists | `LevelFormat.DECIMAL` numbering |
| List indent | left 620 DXA, hanging 300 DXA |
| Line breaks | Separate `Paragraph` elements — never `\n` in a TextRun |
| Page breaks | `new Paragraph({children:[new PageBreak()]})` |

---

## K. Word Footer Zone (every page)

Single centred paragraph, **Navy top border**, Arial 7pt, dark grey. Must include
the issuing entity's full name and ACN:

**Enterprise Specialists:**
```
UNCONTROLLED DOCUMENT WHEN PRINTED  |  B2BEM-XX-PRO-NNN Rev X.X  |  © B2BEM Enterprise Specialists ACN 698 971 550  |  www.b2bem.au  |  0458 992 704  |  Page X of Y
```

**Enterprise Management:**
```
UNCONTROLLED DOCUMENT WHEN PRINTED  |  B2BEM-XX-PRO-NNN Rev X.X  |  © B2BEM Enterprise Management ACN 698 934 477  |  www.b2bem.au  |  0458 992 704  |  Page X of Y
```

Forms/registers add a preparer/approver line above this:
`Author: K. Duffy, [entity]     Approver: [Name], Director`.

---

## L. Cross-Reference Standards

- Reference related documents by full number and title: `Refer to B2BEM-HSE-TEMP-001 Job Hazard Analysis`.
- Reference sections within the same document: `See Section 7.2` — not "see above/below".
- Reference tables by their title-bar label: `Refer to the Security Responsibilities table`.
- Always include the document number in text — never a bare hyperlink.

---

## M. Acronyms & Definitions

- Spell out every acronym on first use: `Lock Out / Tag Out (LOTO)`.
- Every acronym must also appear in the Section 4 Definitions & Abbreviations block (use `bulb("ACRONYM - ","expansion")`).
- Do not use acronyms not defined in the document.
