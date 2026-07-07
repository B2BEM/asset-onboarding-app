import { INFO_FIELDS, BOM_FIELDS, ITEM_TYPE_LABEL, isItemRow, bomScore, stockRec } from './fields.js';
import { computeForRow } from './engine.js';
import { proposedAssetNo, proposedAssetDesc } from './numbering.js';
import { RULES } from './rules.js';
import { ASSET_BY_NO } from './data.js';
import { rows, PROJECT, BOM_EXISTING, NEW_TAX } from './session.js';
import { perthDate } from './time.js';
const CSV_HEADERS = ["SELECT PARENT ASSET","ADD ROW?","UPDATE ASSET?","RETIRE ASSET?",
  "LEVEL 3","LEVEL 4","LEVEL 5","LEVEL 6","LEVEL 7","LEVEL 8","LEVEL 9","LEVEL 10","LEVEL 11","LEVEL 12","LEVEL 13",
  "ASSET / TAG NAME","SPECIFIC ASSET DESCRIPTION","MAINTAINING DEPARTMENT - OVERRIDE","INTERNAL LOCATION CODE - OVERRIDE",
  "CLASSIFICATION","ABBREVIATION","NUMBER","WORK-ORDERABLE","ASSET NO (AUTO)","ASSET NAME (AUTO)","ITEM TYPE"]
  .concat(INFO_FIELDS.map(f=>f[1]))   // + ASSET DETAILS columns (LOCATION … WARRANTY SPECIAL CONDITIONS)
  .concat(["PROJECT MANAGER","PROJECT NUMBER","PROJECT START DATE","PROJECT EXPECTED COMPLETION DATE"]);
// CSV / formula injection guard: a spreadsheet treats a cell beginning with = + - @ (or a
// leading tab/CR) as a formula, so user-entered asset text like =HYPERLINK(...) would execute
// when the exported register is opened in Excel. Prefix a single quote to neutralise it; the
// app's importers strip this guard back off (csvUnguard) so round-trips stay lossless.
const CSV_RISK = /^[=+\-@\t\r]/;
function csvGuard(v){ v=(v==null?'':String(v)); return CSV_RISK.test(v) ? "'"+v : v; }
function csvUnguard(v){ v=(v==null?'':String(v)); return (v[0]==="'" && CSV_RISK.test(v.slice(1))) ? v.slice(1) : v; }
function csvCell(v){ v=csvGuard(v==null?'':String(v)); return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function buildCSV(){
  const lines=[CSV_HEADERS.map(csvCell).join(',')];
  for(const r of rows){
    const lv=r.levels||[]; const cf=computeForRow(r);
    const wo = RULES.needsNumber(cf.cls) ? '' : (cf.cls==='REFERENCE - SUB'?'TRUE':(cf.cls==='REFERENCE'?'FALSE':''));
    const row=[ r.parent||'',
      r.action==='add'?'TRUE':'FALSE', r.action==='update'?'TRUE':'FALSE', r.action==='retire'?'TRUE':'FALSE',
      ...Array.from({length:11},(_,i)=>lv[i]||''),
      r.tag||'', r.desc||'', r.dept||'', r.loc||'',
      cf.cls||'', cf.abbr||'', cf.num||'', wo, cf.assetNo||'', proposedAssetDesc(r)||'', ITEM_TYPE_LABEL[r.itemType]||'' ]
      .concat(INFO_FIELDS.map(f=>(r.info&&r.info[f[0]])||''))
      .concat([PROJECT.pm||'',PROJECT.number||'',PROJECT.start||'',PROJECT.end||'']);
    lines.push(row.map(csvCell).join(','));
  }
  return lines.join('\r\n');
}
const BOM_CSV_HEADERS=["ASSET MAKE AND MODEL","ASSET NO.","ASSET DESCRIPTION"].concat(BOM_FIELDS.map(f=>f[1])).concat(["SCORE","STOCKING RECOMMENDATION"]);
function buildBOMCSV(){
  const lines=[BOM_CSV_HEADERS.map(csvCell).join(',')];
  for(const r of rows){
    if(!isItemRow(r) || !(r.bom && r.bom.length)) continue;
    const mm=(((r.info&&r.info.make)||'')+' '+((r.info&&r.info.model)||'')).trim();
    const no=proposedAssetNo(r), desc=proposedAssetDesc(r);
    for(const b of r.bom){ const sc=bomScore(b);
      lines.push(([mm,no,desc].concat(BOM_FIELDS.map(f=>b[f[0]]||'')).concat([String(sc),stockRec(sc)])).map(csvCell).join(',')); }
  }
  for(const e of BOM_EXISTING){
    if(!e.bom || !e.bom.length) continue;
    const xno=e.no, xdesc=(ASSET_BY_NO.get(xno)||{}).desc||e.desc||'';
    for(const b of e.bom){ const sc=bomScore(b);
      lines.push((['',xno,xdesc].concat(BOM_FIELDS.map(f=>b[f[0]]||'')).concat([String(sc),stockRec(sc)])).map(csvCell).join(',')); }
  }
  return lines.join('\r\n');
}
function buildTaxCSV(){
  const H=['TAXONOMY VALUE','TAXONOMY TYPE','CODE','DESCRIPTION','PARENT TAXONOMY VALUE'];
  const lines=[H.map(csvCell).join(',')];
  for(const t of NEW_TAX) lines.push([t.value,t.type,t.code,t.desc,t.parent||''].map(csvCell).join(','));
  return lines.join('\r\n');
}
function sanitizeFileName(s){ return String(s==null?'':s).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim(); }
function exportFileBase(stamp){ stamp=stamp||perthDate(); const pn=sanitizeFileName((PROJECT.number||'').trim()); return (pn?pn+' - ':'')+stamp+' - Asset hierarchy'; }
function draftFileName(proj){ proj=proj||PROJECT; const stamp=perthDate(); const pn=sanitizeFileName(((proj&&proj.number)||'').trim()); return (pn?pn+' - ':'')+stamp+' - Asset onboarding draft.json'; }
export const CSV_BOM = '﻿';
export function withBom(text){ return CSV_BOM + text; }
export { CSV_HEADERS, csvCell, csvGuard, csvUnguard, buildCSV, BOM_CSV_HEADERS, buildBOMCSV, buildTaxCSV, sanitizeFileName, exportFileBase, draftFileName };
