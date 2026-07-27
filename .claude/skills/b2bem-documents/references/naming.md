# B2BEM Naming & Numbering Reference

## Standard Document Number Format

```
B2BEM-[AREA]-[TYPE]-[NNN] - [Short Descriptive Title]
```

The SharePoint file name must exactly match this format:
```
B2BEM-[AREA]-[TYPE]-[NNN] - [Title].docx
```

---

## Area Codes (full list)

| Code | Area / Discipline | Description |
|---|---|---|
| COR | Corporate | Business management, planning, corporate standards, governance, legal |
| HR | Human Resources | Recruitment, onboarding, performance management, leave, disciplinary |
| HS | Health & Safety | Safety procedures, SWMS, incident management, hazard controls |
| HSE | Health, Safety & Environment | Environmental management, combined HSE documentation |
| MT | Maintenance | Electrical, mechanical, asset maintenance, logbooks, reliability |
| COM | Commissioning | Construction, inspection, test, and commissioning stage procedures |
| TEST | Testing | Electrical and field test procedures, test reports, inspection records |
| MEC | Mechanical | Mechanical fixed plant, conveyor and materials-handling, rotating equipment inspection, test and commissioning |
| CIV | Civil | Civil, structural, earthworks, roadways and concrete inspection, test and commissioning |
| PIP | Piping | PE/HDPE and metallic piping installation, jointing and welding, and pressure / hydrostatic / leak testing inspection, test and commissioning |
| INS | Insulation | Thermal and acoustic insulation, cladding, lagging and fire-seal inspection and test |
| HVC | HVAC | HVAC and mechanical services installation, inspection, leak testing and air balancing |
| LFT | Lifting | Lifting equipment, rigging, engineered lift points and proof-load inspection and test |
| TNK | Tanks | Tanks, vessels and appurtenances - erection, welding, testing and lining inspection and test |
| FIR | Fire Protection | Fire protection systems - hydrants, sprinklers, deluge, foam and gaseous suppression, fire pumps, dampers and passive fire inspection and test |
| SCF | Scaffolding | Scaffolding and temporary works - erection, handover, periodic inspection, modification, formwork support, edge protection and dismantle |
| BAL | Balancing | Machine balancing, precision alignment and condition monitoring - dynamic balancing, laser alignment, vibration, thermography and oil analysis |
| HVY | HV Switchyard | High voltage switchyard and outdoor substation - yard earthing, outdoor switchgear, transformers, busbars, clearances and pre-energisation inspection and test |
| MAR | Marine | Marine and maritime structures - berths, jetties and wharves, pontoons and floating structures, piling, fenders and mooring hardware, marine protection, coatings, cathodic protection, scour and underwater inspection |
| NAV | Navigational Aids | Navigational aids - fixed and floating navigation lights, buoys, beacons, piles and daymarks, navaid solar / battery power systems, and characteristic commissioning and periodic inspection |
| IT | Information Technology | IT systems, cybersecurity, network, cloud, software management |
| PM | Project Management | Project plans, schedules, risk registers, progress reports |
| QA | Quality Assurance | Quality plans, audit records, NCRs, corrective actions, QMS |
| ACC | Accounts | Purchase orders, invoices, vendor records, financial documents |
| SOW | Scope of Works | Service scopes, work packages, tender documents, client briefs |
| REF | Reference | Internal reference materials, templates, style guides |
| INT | Internal | Internal-only material, pricing schedules, non-distributable working docs |

---

## Document Type Codes (full list)

| Code | Type | Tier | Description |
|---|---|---|---|
| POL | Policy | 1 | High-level commitment statement. Sets direction; does not describe tasks. |
| STD | Standard | 2 | Defines mandatory requirements, specifications, or rules. |
| PRO | Procedure | 3 | Step-by-step instructions for performing a task or process. |
| WIN | Work Instruction | 4 | Detailed task-level instructions, typically equipment-specific. |
| PLN | Plan | 3 | Management or project plan describing how objectives will be achieved. |
| FRM | Form | 4 | Structured document for capturing data at the point of activity. |
| ITR | Inspection Test Record | 4 | Inspection-and-test record sheet for a specific equipment item or construction element; issued as a blank controlled form, completed as a record in the field. Numbered per discipline area (e.g. MEC-ITR, CIV-ITR, COM-ITR). |
| TEMP | Template | 4 | Reusable blank document with the correct structure for a document type. |
| MAN | Manual | 3 | Comprehensive reference covering an entire system or management system. |
| RFI | Request for Information | — | Formal request for clarification from a client or vendor. |
| RFC | Request for Change | — | Formal request to change a specification, drawing, or scope item. |
| REP | Report | 5 | Documented summary of findings, inspections, audits, or analysis. |
| REG | Register | 5 | Controlled list or log maintained over time. |
| REC | Record | 5 | Evidence of an activity or result. Not revised — retained. |
| DRW | Drawing | — | Engineering, electrical, or layout drawings. |
| SPC | Specification | — | Technical specification defining materials, equipment, or installation. |

---

## Numbering Rules

1. Numbers start at **001** within each Area Code + Type Code combination
2. Numbers are **never reused** — retired documents marked SUPERSEDED
3. Numbers allocated by **Document Controller before drafting begins**
4. Number must match exactly in: SharePoint file name, document header, MDR
5. **Sub-documents** use dot-suffix: B2BEM-MT-PRO-001.1, B2BEM-MT-PRO-001.2

---

## Project Document Codes

Within a project, documents may use a short project/client code instead of a sequential corporate number:

```
B2BEM-[AREA]-[TYPE]-[CLIENT CODE]-[SEQ]
```

**Example:** `B2BEM-SOW-WPC-001` (SOW document 001 for Want Pest Control project)

---

## File Naming Rules

| Rule | Detail |
|---|---|
| Separator | Space-hyphen-space ` - ` between number and title |
| Title case | Every significant word capitalised |
| Max title length | 8 words |
| No version in name | Revision tracked by SharePoint version history |
| No date in name | Dates are in the Document Control table, not the file name |
| Extension | `.docx` for Word, `.pdf` for issued copies, `.xlsx` for registers |
| Prohibited chars | `/ \ : * ? " < > |` |

---

## Prohibited File Names (common mistakes)

| Non-compliant | Compliant |
|---|---|
| `fatigue procedure v3 FINAL.docx` | `B2BEM-HS-PRO-001 - Fatigue Management.docx` |
| `New Procedure (2).docx` | `B2BEM-MT-PRO-014 - Bearing Replacement Procedure.docx` |
| `B2BEM-MT-PRO-001 Rev 1.2 - 14 May 2026.docx` | `B2BEM-MT-PRO-001 - Electrical Logbook Procedure.docx` |
| `procedure_final_APPROVED.docx` | `B2BEM-HR-PRO-003 - Leave Procedure.docx` |

---

## Project Folder Naming Convention

```
YYYYMMDD - [Client / Entity Name] - [Brief Description (optional)]
```

**Example:** `20260417 - DM Services - Review & Redline Drawings`

| Element | Rule |
|---|---|
| Date | Project start date, YYYYMMDD format, no separators |
| Separator | Hyphen-space `- ` |
| Client name | Title case, max 3 words, no special characters |
| Description | Optional, title case, max 4 words |

---

## Document Number Register - live source only

**No snapshot table is kept here.** Snapshots in this file went stale twice (01/06/2026,
then 14/07/2026) and by 23/07/2026 the 14/07 table was wrong on four prefixes - it would
have allocated `MEC-ITR-041` over 18 existing live ITRs and `COM-PRO-003` over a live
procedure. A table that is right for a week and wrong thereafter is worse than no table,
because it reads as authoritative.

**Allocate from the live register, every time:**

`02. HSEQ\08. Registers\B2BEM-COR-REG-003 - Master Document Register.xlsx`

- Sheet **Controlled Library** (column A = Doc Number) - the live documents.
- Sheet **Supporting & Archive** - retired/superseded numbers. **These are still
  consumed.** A number that appears only here must never be reissued.
- Take the highest number for the `AREA-TYPE` prefix across **both** sheets, add 1.
- Then confirm against the target folder on disk. If disk and register disagree, the
  higher number wins and the discrepancy is recorded in the next audit note.
- Back the register up before editing it, and add the new row as you allocate.

Gaps are normal and are **not** free numbers - `HS-REP-013` is reserved, and several
sequences have deliberate holes. Never fill a gap; always take the next number above
the highest.

**MEC and CIV are new discipline area codes (added 13/07/2026):** Mechanical fixed-plant /
conveyor and Civil / structural / earthworks / roadways inspection-and-test packs, each with
its own `-PRO-001` procedure and its own `-ITR-001..` record library. The electrical
inspection-and-test packs remain under `COM` (`COM-PRO-001/002` + `COM-ITR-001..152`).

**PIP, INS, HVC, LFT and TNK are new discipline area codes (added 13/07/2026):** Piping
(PE/HDPE and metallic piping, jointing and welding, plus pressure / hydrostatic / leak
testing), Insulation and lagging, HVAC and mechanical services, Lifting equipment and
rigging, and Tanks and vessels. Each has its own `-PRO-001` inspection-and-test procedure
and its own `-ITR-001..` record library, mirroring the MEC/CIV pattern.

**FIR, SCF, BAL and HVY are new discipline area codes (added 14/07/2026):** Fire
Protection Systems, Scaffolding and Temporary Works, Machine Balancing / Alignment /
Condition Monitoring, and High Voltage Switchyard / outdoor substation. Each has its own
`-PRO-001` inspection-and-test procedure and its own `-ITR-001..` record library,
mirroring the MEC/CIV and piping-batch pattern. HVY covers the yard-specific items only -
shared HV equipment records (transformer, protection relay, CT, VT, HV cable) remain
under `COM`.

**MAR and NAV are new discipline area codes (added 14/07/2026):** Marine structures
(berths, jetties and wharves, pontoons and floating structures, piling, fenders and mooring
hardware, marine protection and underwater inspection) and Navigational aids (fixed and
floating navigation lights, buoys, beacons, daymarks, navaid power systems and characteristic
commissioning). Each has its own `-PRO-001` inspection-and-test procedure and its own
`-ITR-001..` record library, mirroring the MEC/CIV and piping-batch pattern. MAR carries the
marine structures library (`MAR-ITR-001..022`); NAV carries the navigational-aids library
(`NAV-ITR-001..006`). Structural steel and concrete acceptance cross-references
`B2BEM-CIV-PRO-001`; berth electrical and lighting interfaces cross-reference `B2BEM-COM`;
proof-load of mooring hardware cross-references `B2BEM-LFT-ITR-010`.
