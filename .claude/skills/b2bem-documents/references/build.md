# B2BEM docx-js Build Reference (B2BEM colours · A4)

This reference defines the **primary B2BEM build engine** — the canonical house
standard for every B2BEM controlled document, on A4 in the B2BEM brand palette.
Two builders:

- **Controlled-document builder** (§1–§9): cover page, field TOC, two-tone tables — for policies, procedures, standards, plans, manuals.
- **Form / Register builder** (§10): compact banner + data blocks, no cover/TOC — for forms and registers, incl. the 5×5 risk-matrix pattern.

Requires `npm install docx` (tested on docx v9). Run with `node build_script.js`
from the outputs directory; place `b2bem_logo.png` beside the script (optional —
a wordmark fallback is used if absent).

---

## 1. Entity Selection (do this FIRST)

For quotations, invoices, and scope of works, confirm the issuing entity with
the user before writing any build script (mandatory hold point). Then set:

```javascript
// Pick ONE based on the user's answer:
const ENTITY = {
  name: "B2BEM Enterprise Specialists",
  short: "Enterprise Specialists",
  acn: "ACN 698 971 550",
};
// OR
// const ENTITY = {
//   name: "B2BEM Enterprise Management",
//   short: "Enterprise Management",
//   acn: "ACN 698 934 477",
// };
```

`ENTITY` drives the Document Owner row and the footer. For internal HSEQ
documents that are not entity-scoped, default to Enterprise Specialists.

---

## 2. Setup — page geometry & B2BEM palette

```javascript
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak, Header, Footer, LevelFormat, TableOfContents, HeadingLevel,
} = require("docx");
const fs = require("fs");

// A4 — the Australian standard for all B2BEM documents.
const PAGE_W = 11906, PAGE_H = 16838;         // A4 in DXA
const M_TOP = 1474, M_LR = 1134, M_BOT = 850; // page margins
const CONTENT_W = PAGE_W - M_LR * 2;          // 9638 DXA

// B2BEM brand palette
const NAVY      = "0B2341";  // primary — title bars, headings, borders, wordmark
const NAVY_MID  = "154EB4";  // second tone — column-header rows
const GOLD      = "F4B300";  // accent — H1/section underline, CAUTION
const ORANGE    = "F28C00";  // WARNING accent
const LIGHT_GREY= "F2F2F2";  // label & callout fill
const GRID      = "E0E4EA";  // inside gridlines
const BODY      = "555555";  // body text
const WHITE     = "FFFFFF";
const BLACK     = "000000";
```

---

## 3. Text, paragraph & list helpers

```javascript
const t  = (x,o={}) => new TextRun({ text:x, font:"Arial", size:20, color:BODY, ...o });
const tb = (x,o={}) => t(x,{ bold:true, ...o });
const body = (ch,o={}) => new Paragraph({ spacing:{after:120,line:276,lineRule:"auto"}, children:Array.isArray(ch)?ch:[ch], ...o });

// Headings use the NAMED Heading styles (defined in §8) so a real Word TOC resolves.
const h1 = (x)=> new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun({text:x.toUpperCase(),font:"Arial",size:28,bold:true,color:NAVY})] });
const h2 = (x)=> new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun({text:x,font:"Arial",size:24,bold:true,color:NAVY})] });
const h3 = (x)=> new Paragraph({ heading:HeadingLevel.HEADING_3, children:[new TextRun({text:x,font:"Arial",size:22,bold:true,color:NAVY})] });

// Bullets: bul = plain; bulb = bold lead-in + rest (the default B2BEM bullet).
const bul  = (x)=> new Paragraph({ numbering:{reference:"b2-bullets",level:0}, spacing:{after:60,line:276,lineRule:"auto"}, children:[t(x)] });
const bulb = (lead,rest)=> new Paragraph({ numbering:{reference:"b2-bullets",level:0}, spacing:{after:60,line:276,lineRule:"auto"}, children:[tb(lead),t(rest)] });
const num  = (x)=> new Paragraph({ numbering:{reference:"b2-numbers",level:0}, spacing:{after:60,line:276,lineRule:"auto"}, children:[t(x)] });

const spacer = (sz=120)=> new Paragraph({ spacing:{after:sz}, children:[new TextRun({text:"",font:"Arial",size:8})] });
```

**RULE — no blank lines before H1:** never place `spacer()` (or any empty
paragraph) immediately before `h1(...)`. The Heading 1 style's `spacing.before`
provides the gap. Sequence is `body(...)` then directly `h1(...)`.

---

## 4. Borders & the two-tone cell system

```javascript
const B = (c,sz=4) => ({ style:BorderStyle.SINGLE, size:sz, color:c });
const noB = B(WHITE,0);
// Accent tables: Navy outer edge, soft grey inside gridlines.
const tableBorders = { top:B(NAVY), bottom:B(NAVY), left:B(NAVY), right:B(NAVY), insideHorizontal:B(GRID), insideVertical:B(GRID) };

function cell(ch,w,o={}) {
  return new TableCell({
    width:{size:w,type:WidthType.DXA}, columnSpan:o.span,
    margins:{top:60,bottom:60,left:120,right:120},
    verticalAlign:o.valign||VerticalAlign.CENTER,
    shading:o.fill?{fill:o.fill,type:ShadingType.CLEAR}:undefined,
    children:Array.isArray(ch)?ch:[ch],
  });
}

// Title row — Navy, spans the whole grid. span = number of columns.
const titleCell = (label,span)=> cell(
  new Paragraph({children:[new TextRun({text:label,font:"Arial",size:20,bold:true,color:WHITE,allCaps:true})]}),
  CONTENT_W, {fill:NAVY, span});

// Column header — Navy-mid (the second tone).
const colHdr = (label,w)=> cell(
  new Paragraph({children:[new TextRun({text:label,font:"Arial",size:18,bold:true,color:WHITE,allCaps:true})]}),
  w, {fill:NAVY_MID});

// Label cell (key column) — Light-grey fill, Navy bold text.
const labelCell = (label,w)=> cell(new Paragraph({children:[tb(label,{color:NAVY})]}), w, {fill:LIGHT_GREY});

// Value cell — white.
const valCell = (v,w,o={})=> cell(new Paragraph({spacing:{line:276,lineRule:"auto"},children:[t(v)]}), w, {valign:VerticalAlign.TOP,...o});
```

---

## 5. Callouts (NOTE · CAUTION · WARNING)

Single-row bordered table, Light-grey fill, coloured edge + coloured label.
Three callouts: NOTE (Navy), CAUTION (Gold), WARNING (Orange).

```javascript
function callout(kind,text,edge,label){
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[CONTENT_W],
    borders:{top:B(edge),bottom:B(edge),left:B(edge),right:B(edge)},
    rows:[new TableRow({children:[ cell(new Paragraph({spacing:{line:276,lineRule:"auto"},children:[
      new TextRun({text:kind+":  ",font:"Arial",size:20,bold:true,color:label}), t(text)
    ]}), CONTENT_W, {fill:LIGHT_GREY, valign:VerticalAlign.TOP}) ]})] });
}
const noteBox    = (x)=> callout("NOTE",x,NAVY,NAVY);
const cautionBox = (x)=> callout("CAUTION",x,GOLD,GOLD);
const warningBox = (x)=> callout("WARNING",x,ORANGE,ORANGE);
```

---

## 6. Running header & footer

Header is **light and borderless**: doc number · title · logo (or "B2BEM"
wordmark fallback). Footer carries the entity + ACN.

```javascript
const HDR_W = [1700, CONTENT_W - 1700 - 2200, 2200]; // [1700, 5738, 2200] — wide right cell for the horizontal logo
const LOGO  = fs.existsSync("b2bem_logo.png") ? fs.readFileSync("b2bem_logo.png") : null;
// b2bem_logo.png = the wide horizontal lockup (source: "Website_topper Logo.png"),
// trimmed to content, ~3:1 on a white plate that blends into the white header.

function headerRightCell(){
  const child = LOGO
    ? new ImageRun({ type:"png", data:LOGO, transformation:{width:140,height:47}, // ~3:1 wide lockup
        altText:{title:"B2BEM", description:"B2BEM logo", name:"B2BEMLogo"} })
    : new TextRun({ text:"B2BEM", font:"Arial", size:22, bold:true, color:NAVY });
  return new TableCell({ width:{size:HDR_W[2],type:WidthType.DXA}, verticalAlign:VerticalAlign.CENTER,
    margins:{top:20,bottom:20,left:40,right:40},
    children:[new Paragraph({alignment:AlignmentType.RIGHT, children:[child]})] });
}

function makeHeader(docNo,docTitle){ return new Header({children:[ new Paragraph({children:[]}), // REQUIRED empty para first
  new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:HDR_W,
    borders:{top:noB,bottom:noB,left:noB,right:noB,insideHorizontal:noB,insideVertical:noB},
    rows:[new TableRow({children:[
      new TableCell({width:{size:HDR_W[0],type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,margins:{top:20,bottom:20,left:40,right:40},
        children:[new Paragraph({alignment:AlignmentType.LEFT,children:[new TextRun({text:docNo,font:"Arial",size:18,color:NAVY})]})]}),
      new TableCell({width:{size:HDR_W[1],type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,margins:{top:20,bottom:20,left:40,right:40},
        children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:docTitle,font:"Arial",size:18,bold:true,color:NAVY})]})]}),
      headerRightCell(),
    ]})] })
]}); }

function makeFooter(docNo){ return new Footer({children:[ new Paragraph({
  alignment:AlignmentType.CENTER, spacing:{before:40},
  border:{top:{style:BorderStyle.SINGLE,size:6,color:NAVY,space:2}},
  children:[
    new TextRun({text:`UNCONTROLLED DOCUMENT WHEN PRINTED  |  ${docNo} Rev 1.0  |  © ${ENTITY.name} ${ENTITY.acn}  |  www.b2bem.au  |  0448 883 312  |  Page `, font:"Arial",size:14,color:BODY}),
    new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:14,color:BODY}),
    new TextRun({text:" of ",font:"Arial",size:14,color:BODY}),
    new TextRun({children:[PageNumber.TOTAL_PAGES],font:"Arial",size:14,color:BODY}),
  ]})]}); }
```

---

## 7. Cover blocks — banner, Document Control, Author & Reviewer, Version History, Related Documents

```javascript
// Big cover banner: B2BEM wordmark + document type/title + sub-line.
function makeBanner(typeLine, subLine){
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[CONTENT_W],
    borders:{top:noB,bottom:noB,left:noB,right:noB},
    rows:[new TableRow({children:[ new TableCell({ width:{size:CONTENT_W,type:WidthType.DXA}, margins:{top:120,bottom:120,left:80,right:80}, children:[
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:40},children:[new TextRun({text:"B2BEM",font:"Arial",size:72,bold:true,color:NAVY})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:60},children:[new TextRun({text:typeLine,font:"Arial",size:48,bold:true,color:NAVY})]}),
      new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:subLine,font:"Arial",size:22,color:BODY})]}),
    ]})]})] });
}

// Document Control — 2-col label/value. Owner MUST be `${ENTITY.name} ${ENTITY.acn}`.
// NO ISO Reference row. Issue clean (no DRAFT) — the Status row is optional and only for docs out for review.
const HALF = CONTENT_W/2;
function docControl(rows){
  const trs=[ new TableRow({children:[titleCell("Document Control",2)]}) ];
  rows.forEach(([l,v])=> trs.push(new TableRow({children:[ labelCell(l,HALF), valCell(v,HALF) ]})));
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[HALF,HALF], borders:tableBorders, rows:trs });
}

// Author & Reviewer — Role / Name / Position / Signature / Date. Author + Reviewer rows only (NO Approver).
// Author is fixed; the Reviewer is chosen by the document's domain.
const AUTHOR = { name:"K. Duffy", position:"Director, Governance & Engagement" };
const REVIEWERS = {
  it:    { name:"S. Claydon",   position:"Director, IT & Communications" },   // IT / cyber / data / comms / technology + general default
  brand: { name:"S. Ziegelaar", position:"Manager, Brand & Advertisement" },  // brand / marketing / advertising / website / social
};
const FIFTH = Math.floor(CONTENT_W/5), AR_W=[FIFTH,FIFTH,FIFTH,FIFTH,CONTENT_W-FIFTH*4];
function authorReviewer(reviewer){   // reviewer = REVIEWERS.it (default) or REVIEWERS.brand
  const rev = reviewer || REVIEWERS.it;
  const ar=(r,n,p)=> new TableRow({children:[ valCell(r,AR_W[0]), valCell(n,AR_W[1]), valCell(p,AR_W[2]), valCell("",AR_W[3]), valCell("",AR_W[4]) ]});
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:AR_W, borders:tableBorders, rows:[
    new TableRow({children:[titleCell("Author & Reviewer",5)]}),
    new TableRow({children:[colHdr("Role",AR_W[0]),colHdr("Name",AR_W[1]),colHdr("Position",AR_W[2]),colHdr("Signature",AR_W[3]),colHdr("Date",AR_W[4])]}),
    ar("Author",AUTHOR.name,AUTHOR.position),
    ar("Reviewer",rev.name,rev.position),
  ]});
}

// Version History — 4 cols (no "Approved" column). Description concise; Author = name only.
const Q = Math.floor(CONTENT_W/4), VH_W=[Q,Q,CONTENT_W-Q*3,Q];
function versionHistory(){
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:VH_W, borders:tableBorders, rows:[
    new TableRow({children:[titleCell("Version History",4)]}),
    new TableRow({children:[colHdr("Version",VH_W[0]),colHdr("Date",VH_W[1]),colHdr("Description",VH_W[2]),colHdr("Author",VH_W[3])]}),
    new TableRow({children:[valCell("1.0",VH_W[0]),valCell("DD/MM/YYYY",VH_W[1]),valCell("Initial issue",VH_W[2]),valCell("K. Duffy",VH_W[3])]}),
  ]});
}

// Related Documents — dedicated table at the END of the document.
const RD_W=[2700, CONTENT_W-2700];
function relatedDocs(rows){
  const trs=[ new TableRow({children:[titleCell("Related Documents",2)]}),
    new TableRow({children:[colHdr("Document Number",RD_W[0]),colHdr("Document Name",RD_W[1])]}) ];
  rows.forEach(([no,name])=> trs.push(new TableRow({children:[ valCell(no,RD_W[0]), valCell(name,RD_W[1]) ]})));
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:RD_W, borders:tableBorders, rows:trs });
}

// Generic data table with a Navy title bar + Navy-mid column headers.
function dataTable(title,headers,rows,widths){
  const trs=[ new TableRow({children:[titleCell(title,headers.length)]}),
    new TableRow({children:headers.map((h,i)=>colHdr(h,widths[i]))}) ];
  rows.forEach(r=> trs.push(new TableRow({children:r.map((c,i)=> valCell(c,widths[i]))})));
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:widths, borders:tableBorders, rows:trs });
}
```

---

## 8. Document assembly (cover → field TOC → body → related)

```javascript
function buildDoc(cfg){
  // cfg: { docNo, docTitle, bannerType, control:[[label,val]...], related:[[no,name]...], content:[...paras], file, reviewer? }
  const leadSpacer = new Paragraph({ spacing:{line:2700,lineRule:"exact",before:0,after:0}, children:[new TextRun({text:"",font:"Arial"})] });

  const cover = [
    leadSpacer,
    makeBanner(cfg.bannerType, `${cfg.docNo} - ${cfg.bannerType} - v1.0`),
    spacer(240), docControl(cfg.control),
    spacer(120), authorReviewer(cfg.reviewer),   // pass REVIEWERS.brand for brand/marketing docs; omit for IT/general
    spacer(120), versionHistory(),
    new Paragraph({children:[new PageBreak()]}),
    new Paragraph({ spacing:{after:120}, border:{bottom:{style:BorderStyle.SINGLE,size:8,color:GOLD,space:4}},
      children:[new TextRun({text:"CONTENTS",font:"Arial",size:28,bold:true,color:NAVY})] }),
    new TableOfContents("Table of Contents",{hyperlink:true,headingStyleRange:"1-3"}),
    new Paragraph({children:[new PageBreak()]}),
  ];

  const relatedSection = [
    h1("Related Documents"),
    body(t("These controlled documents are read together with this document.")),
    relatedDocs(cfg.related),
  ];

  const doc = new Document({
    creator: ENTITY.name, title: cfg.docTitle, description:`B2BEM controlled document ${cfg.docNo}`,
    features:{ updateFields:true },   // Word offers to update the TOC field on open
    numbering:{ config:[
      { reference:"b2-bullets", levels:[{level:0,format:LevelFormat.BULLET,text:"•",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:620,hanging:300}}}}] },
      { reference:"b2-numbers", levels:[{level:0,format:LevelFormat.DECIMAL,text:"%1.",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:620,hanging:300}}}}] },
    ]},
    styles:{ default:{document:{run:{font:"Arial",size:20,color:BODY}}}, paragraphStyles:[
      { id:"Heading1", name:"Heading 1", basedOn:"Normal", next:"Normal", quickFormat:true,
        run:{size:28,bold:true,font:"Arial",color:NAVY,allCaps:true},
        paragraph:{spacing:{before:300,after:120},outlineLevel:0,border:{bottom:{style:BorderStyle.SINGLE,size:8,color:GOLD,space:4}}} },
      { id:"Heading2", name:"Heading 2", basedOn:"Normal", next:"Normal", quickFormat:true,
        run:{size:24,bold:true,font:"Arial",color:NAVY}, paragraph:{spacing:{before:220,after:80},outlineLevel:1} },
      { id:"Heading3", name:"Heading 3", basedOn:"Normal", next:"Normal", quickFormat:true,
        run:{size:22,bold:true,font:"Arial",color:NAVY}, paragraph:{spacing:{before:160,after:60},outlineLevel:2} },
    ]},
    sections:[{
      properties:{ page:{ size:{width:PAGE_W,height:PAGE_H},
        margin:{top:M_TOP,right:M_LR,bottom:M_BOT,left:M_LR,header:113,footer:454} } },
      headers:{default:makeHeader(cfg.docNo,cfg.docTitle)},
      footers:{default:makeFooter(cfg.docNo)},
      children: cover.concat(cfg.content, relatedSection),
    }],
  });

  return Packer.toBuffer(doc).then(buf=>{ fs.writeFileSync(cfg.file,buf); console.log("OK",cfg.file,buf.length); });
}
```

**Calling it** (a policy example; `content` is your array of `h1/h2/body/bul/bulb/dataTable/...`):

```javascript
buildDoc({
  docNo:"B2BEM-COR-POL-021", docTitle:"Example Policy", bannerType:"Example Policy",
  control:[
    ["Document Number","B2BEM-COR-POL-021"],
    ["Document Title","Example Policy"],
    ["Document Type","Policy (Tier 1)"],
    ["Version","1.0"],
    ["Issue Date","DD/MM/YYYY"],
    ["Review Date","DD/MM/YYYY (12 months from issue)"],
    ["Document Owner",`${ENTITY.name} ${ENTITY.acn}`],
    ["Classification","CONTROLLED"],
  ],
  related:[
    ["B2BEM-COR-PRO-00X","Related Procedure Title"],
    ["[TBA]","Document Not Yet Created"],
  ],
  content:[ h1("1. Purpose"), body(t("...")), h1("2. Scope"), body(t("...")) /* ... */ ],
  file:"B2BEM-COR-POL-021 - Example Policy.docx",
});
```

---

## 9. Validation after build

Use `python` on this machine, **not** `python3`.

```bash
python - <<'PY'
from docx import Document
import os
f = "B2BEM-COR-POL-021 - Example Policy.docx"
doc = Document(f)
print("Paragraphs:", len([p for p in doc.paragraphs if p.text.strip()]))
print("Tables:", len(doc.tables))
print("Size:", os.path.getsize(f), "bytes")
for s in doc.sections:
    print("Header tables:", len(s.header.tables))
    for tb in s.header.tables:
        print("  Header cells:", [c.text[:24] for c in tb.rows[0].cells])
    for p in s.footer.paragraphs:
        if p.text.strip(): print("Footer:", p.text[:120])
# No ISO Reference row anywhere
for tbl in doc.tables:
    for row in tbl.rows:
        assert "ISO Reference" not in row.cells[0].text, "ISO Reference row found!"
print("No ISO Reference row: OK")
# No DRAFT in header; Filing Location has no 'SharePoint:' prefix
for s in doc.sections:
    ht = " ".join(p.text for p in s.header.paragraphs)
    ht += " ".join(c.text for tb in s.header.tables for r in tb.rows for c in r.cells)
    assert "DRAFT" not in ht.upper(), "DRAFT in header"
for tbl in doc.tables:
    for row in tbl.rows:
        if row.cells[0].text.strip()=="Version":
            assert "DRAFT" not in row.cells[1].text.upper(), "DRAFT in Version"
print("Header/Version clean: OK")
# Field TOC present
xml = doc.element.body.xml
assert "TOC \\o" in xml or "Table of Contents" in xml, "No TOC field found"
print("TOC field present: OK")
# Punctuation lock: zero em/en dashes anywhere in the body
assert "—" not in xml and "–" not in xml, "em/en dash found - hyphen only"
print("No em/en dashes: OK")
# Bracketed placeholders — must be empty for a FINAL document (blank signature cells excepted)
import re
ph = set(re.findall(r"\[[^\]\n]{1,40}\]", "\n".join(p.text for p in doc.paragraphs)))
ph |= set(re.findall(r"\[[^\]\n]{1,40}\]", "\n".join(c.text for tb2 in doc.tables for r in tb2.rows for c in r.cells)))
ph -= {"[Name]", "[Position]"}   # allowed until signing
print("Bracketed placeholders:", sorted(ph) if ph else "none")
PY
```

**Expected:** header table with 3 cells (doc-no · title · logo/wordmark); footer
carries the uncontrolled statement + `ENTITY.name` + ACN; no ISO Reference row;
no DRAFT; a real TOC field is present.

> **Open once in Word and press Ctrl+A then F9** (or accept the "update fields"
> prompt on open) so the Contents field paginates. `features.updateFields:true`
> triggers the prompt automatically.

**Visual QA (mandatory last step):** the structural checks above can all pass while
the page still looks wrong, so the document must be seen before it is delivered.

**Do NOT attempt headless docx-to-PDF rendering on this machine** - `soffice
--convert-to pdf`, `pdftoppm` and non-interactive Word COM automation all hang here.
That is a known, repeatedly-confirmed constraint, not a per-case failure to retry.

The supported route is: run the structural validation above, then have the owner
open the file in Word and eyeball page 1 - banner in the upper half of the cover,
all cover tables to one width, header logo crisp, nothing overflowing to page 2.
(A Word COM render is only viable in a foreground, interactive session.)

---

## 10. Form / Register standard

Forms and registers use a **lighter** template: compact banner, numbered
sections with a Gold underline, `detailTable`/`gridTable` data blocks, no
cover/TOC/Author-Reviewer. The footer adds a preparer/approver line.

```javascript
// Section heading for forms — Navy caps with a Gold underline.
const formH = (x)=> new Paragraph({ spacing:{before:240,after:100},
  border:{bottom:{style:BorderStyle.SINGLE,size:8,color:GOLD,space:4}},
  children:[new TextRun({text:x,font:"Arial",size:28,bold:true,color:NAVY,allCaps:true})] });

// Compact form banner.
function formBanner(docNo,docTitle){
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[CONTENT_W],
    borders:{top:noB,bottom:noB,left:noB,right:noB},
    rows:[new TableRow({children:[ new TableCell({width:{size:CONTENT_W,type:WidthType.DXA},margins:{top:60,bottom:60,left:80,right:80},children:[
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:20},children:[new TextRun({text:"B2BEM",font:"Arial",size:36,bold:true,color:NAVY})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:30},children:[new TextRun({text:docTitle,font:"Arial",size:24,bold:true,color:NAVY})]}),
      new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${docNo} - ${docTitle} - v1.0`,font:"Arial",size:22,color:BODY})]}),
    ]})]})] });
}

// Detail table (Detail / Entry).
const DET_L=3400, DET_R=CONTENT_W-DET_L;
function detailTable(title,rows){
  const trs=[ new TableRow({children:[titleCell(title,2)]}),
    new TableRow({children:[colHdr("Detail",DET_L),colHdr("Entry",DET_R)]}) ];
  rows.forEach(([l,v])=> trs.push(new TableRow({children:[ valCell(l,DET_L), valCell(v||"",DET_R) ]})));
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[DET_L,DET_R], borders:tableBorders, rows:trs });
}
// gridTable(title, headers, rows, widths) — identical to dataTable() in §7.

function makeFormFooter(docNo){ return new Footer({children:[
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:20},children:[new TextRun({text:`Author: K. Duffy, ${ENTITY.name}          Approver: [Name], Director`,font:"Arial",size:14,color:BODY})]}),
  new Paragraph({alignment:AlignmentType.CENTER,border:{top:{style:BorderStyle.SINGLE,size:6,color:NAVY,space:2}},children:[
    new TextRun({text:`UNCONTROLLED DOCUMENT WHEN PRINTED  |  ${docNo} Rev 1.0  |  © ${ENTITY.name} ${ENTITY.acn}  |  Page `,font:"Arial",size:14,color:BODY}),
    new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:14,color:BODY}),
    new TextRun({text:" of ",font:"Arial",size:14,color:BODY}),
    new TextRun({children:[PageNumber.TOTAL_PAGES],font:"Arial",size:14,color:BODY}),
  ]})]}); }

function buildFormDoc(cfg){
  const children=[ formBanner(cfg.docNo,cfg.docTitle), spacer(160) ].concat(cfg.blocks);
  const doc=new Document({ creator:ENTITY.name, title:cfg.docTitle, description:`B2BEM controlled form ${cfg.docNo}`,
    numbering:{config:[{reference:"b2f-bullets",levels:[{level:0,format:LevelFormat.BULLET,text:"•",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:620,hanging:300}}}}]}]},
    styles:{default:{document:{run:{font:"Arial",size:20,color:BODY}}}},
    sections:[{ properties:{page:{size:{width:PAGE_W,height:PAGE_H},margin:{top:M_TOP,right:M_LR,bottom:M_BOT,left:M_LR,header:113,footer:454}}},
      headers:{default:makeHeader(cfg.docNo,cfg.docTitle)}, footers:{default:makeFormFooter(cfg.docNo)}, children }],
  });
  return Packer.toBuffer(doc).then(buf=>{ fs.writeFileSync(cfg.file,buf); console.log("OK",cfg.file,buf.length); });
}
```

### 10A. 5×5 risk-matrix reference (hazard/risk forms)

The B2BEM hazard / risk form renders a coloured 5×5 matrix and checkbox
selectors. Risk-band cell colours are a functional traffic-light scale (they
signal severity, not brand):

```javascript
const RISK = { L:"C6E0B4" /*low/green*/, M:"FFE699" /*med/yellow*/, H:"F4B183" /*high/orange*/, E:"E06666" /*extreme/red*/ };
const cons = ["Insignificant","Minor","Moderate","Major","Catastrophic"];
const like = ["Almost Certain","Likely","Possible","Unlikely","Rare"];
const matrix = {
  "Almost Certain":["M","H","H","E","E"], "Likely":["M","M","H","H","E"],
  "Possible":["L","M","H","H","E"], "Unlikely":["L","M","M","H","H"], "Rare":["L","L","M","M","H"],
};
// Build: title row "RISK ASSESSMENT (5 X 5 RISK MATRIX)", a Navy "Likelihood \ Consequence"
// corner + Navy-mid consequence headers, then one row per likelihood with each band cell
// filled RISK[band] (white text on E, Navy text otherwise). Follow the two-tone helpers in §4.
```

Always finish a risk form with:
```javascript
cautionBox("The 5×5 risk matrix shown is a standard scoring model. Confirm the client's endorsed risk matrix and acceptance thresholds before this form is issued as controlled.");
```

### 10B. Landscape section (wide registers) & alternating rows

A register that cannot fit 9638 DXA legibly gets a **landscape A4 section** for
those pages — never shrink table text below 8pt to force a portrait fit:

```javascript
const { PageOrientation } = require("docx");
// Landscape A4: swap the dimensions AND declare the orientation.
const L_PAGE = { size:{ width:PAGE_H, height:PAGE_W, orientation:PageOrientation.LANDSCAPE },
                 margin:{ top:M_TOP, right:M_LR, bottom:M_BOT, left:M_LR, header:113, footer:454 } };
const L_CONTENT_W = PAGE_H - M_LR*2;   // 14570 DXA of landscape content width

// Add the wide content as a SECOND section with the same header/footer:
// sections:[
//   { properties:{ page:{ size:{width:PAGE_W,height:PAGE_H}, margin:{...} } }, headers, footers, children:[ ...portrait pages ] },
//   { properties:{ page:L_PAGE }, headers:{default:makeHeader(docNo,docTitle)},
//     footers:{default:makeFormFooter(docNo)}, children:[ ...gridTable with widths summing to L_CONTENT_W ] },
// ]
```

**Alternating rows** for long tables (~15+ data rows): fill every second data
row Light-grey so rows track across wide grids:

```javascript
rows.forEach((r,i)=> trs.push(new TableRow({
  children: r.map((c,j)=> valCell(c, widths[j], i%2 ? {fill:LIGHT_GREY} : {})),
})));
```

---

## 11. Critical rules checklist

| Rule | Detail |
|---|---|
| Entity hold point | Quotations / invoices / SOWs: confirm entity (Management ACN 698 934 477 or Specialists ACN 698 971 550) BEFORE building |
| Page size | A4 — width 11906, height 16838 DXA (Australian standard) |
| Palette | Navy `0B2341`, Navy-mid `154EB4`, Gold `F4B300`, Orange `F28C00`, Light-grey `F2F2F2`, grid `E0E4EA`, body `555555` |
| Cover page | leadSpacer → banner → Document Control → Author & Reviewer → Version History → pagebreak → CONTENTS + field TOC → pagebreak |
| Named headings | h1/h2/h3 use `HeadingLevel` + the Heading 1/2/3 styles, so the field TOC resolves — no bookmark hack |
| Field TOC | `new TableOfContents(..,{hyperlink:true,headingStyleRange:"1-3"})` + `features.updateFields:true` |
| Two-tone tables | Title row Navy (`titleCell`, columnSpan) · column headers Navy-mid (`colHdr`) · label cells Light-grey (`labelCell`) |
| Title rows | Full-width via `columnSpan` on the SAME grid — never a separate one-cell table |
| Related Documents | Its own table at the END of the document — not a Document Control row |
| Version History | 4 columns (Version/Date/Description/Author) — no "Approved" column |
| Author & Reviewer | Role/Name/Position/Signature/Date; **Author + Reviewer only, no Approver**. Author = K. Duffy (Director, Governance & Engagement); Reviewer by domain — `REVIEWERS.it` S. Claydon (IT/tech/general) or `REVIEWERS.brand` S. Ziegelaar (brand/marketing/website) |
| ISO row | NO "ISO Reference" row (ISO 9001 control obligation still applies) |
| No DRAFT | Issue clean — no DRAFT in header/Version; the optional `Status` row is removed on issue |
| No Change Log | Version History row is the only in-document audit trace |
| H1 spacing | No empty paragraph before `h1(...)` — the Heading 1 style's `spacing.before` handles it |
| Line spacing | Body uses `line:276, lineRule:"auto"` (1.15) |
| Header | Light borderless 3-cell: doc-no (1700) · title (5738) · logo (2200). Logo `b2bem_logo.png` at 140×47 (source "Website_topper Logo.png"); "B2BEM" wordmark fallback if absent; empty `Paragraph` before the table; `header:113` |
| Footer | Entity name + ACN + www.b2bem.au + 0448 883 312 + Page X of Y; `footer:454` |
| Widths | `WidthType.DXA` only; `columnWidths` sum to table width AND set on each cell; `ShadingType.CLEAR` |
| Bullets | `LevelFormat.BULLET`; use `bulb(lead,rest)` for bold lead-in bullets |
| Forms | Use `buildFormDoc` — compact banner, `formH`, `detailTable`/`gridTable`, preparer/approver footer line |
| Punctuation | Hyphen only — zero em dashes (—) / en dashes (–) in `document.xml` |
| Finish clean | No `[bracketed]` placeholders in finals (blank signature cells excepted); never APPROVED with blank Reviewer/Signature/Date |
| Wide registers | Landscape A4 section (§10B) — never sub-8pt text to force portrait |
| Long tables | Optional alternating Light-grey data rows for ~15+ row tables |
| Visual QA | Render/open page 1 and eyeball banner, tables, logo before delivering |
| Build | Write JS to outputs dir, `node build_script.js` (place `b2bem_logo.png` beside it — it ships with this skill at `assets/b2bem_logo.png`), validate, copy to SharePoint |

---

## 12. Build engine files

The engines live in `02. HSEQ\09. HSE Monthly doc audits\_build\`. Reuse them - do
not re-derive a builder from this document.

```
_build\b2bem_docx_builder.js          - controlled documents + forms/registers   -> §2-§10
                                        (canonical copy; buildDoc and buildFormDoc
                                         are both defined here)
_build\marine\b2bem_itr_builder.js    - Inspection Test Records (buildITR)       -> see SKILL.md §12
```

Then write one `build_<job>.js` per job beside them, requiring the engine.

**Notes:**
- `b2bem_docx_builder.js` also exists in five phase subfolders (`marine`, `mecciv`,
  `piping`, `fsbh`, `comproc`). All six are byte-identical - any is safe.
- `b2bem_itr_builder.js` has **no** canonical root copy and its four copies differ.
  Use the **`marine`** one; it is the functional superset. See SKILL.md §12.
- There is no `b2bem_form_builder.js` and no `b2bem_build_reference_hazard.js` -
  earlier versions of this file named them, but the form builder and the 5x5
  risk-matrix pattern (§10, §10A) are inside `b2bem_docx_builder.js`.

Keep `b2bem_logo.png` beside the build script (§6). Every document keeps: B2BEM
colours (§2), A4 page size, `ENTITY` + ACN footer, no ISO row, and issue-clean
(no DRAFT).
