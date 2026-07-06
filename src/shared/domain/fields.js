import { classOf } from './engine.js';
import { leafEnumerable } from './numbering.js';
const INFO_FIELDS=[['location','LOCATION',1],['lat','LAT DDM'],['long','LONG DDM'],['make','MAKE',1],['model','MODEL',1],['serial','SERIAL NO.',1],['rego','REGISTRATION / APPROVAL NUMBER'],['supplier','SUPPLIER',1],['supplierAddr','SUPPLIER ADDRESS'],['supplierContact','SUPPLIER CONTACT NO.'],['mfgDate','MANUFACTURE DATE',1,'date'],['acqDate','ACQUIRED DATE',1,'date'],['warrStart','WARRANTY START DATE',1,'date'],['warrPeriod','WARRANTY PERIOD'],['warrCond','WARRANTY SPECIAL CONDITIONS'],['isoCriticality','CRITICALITY',1],['isoCondition','CONDITION',1],['isoLifecycle','LIFE-CYCLE STAGE',1],['isoFunction','ASSET FUNCTION / PURPOSE',1],['isoValue','VALUE TO ORGANIZATION',1]];
const INFO_REQUIRED=INFO_FIELDS.filter(f=>f[2]).map(f=>f[0]);
const ITEM_TYPE_LABEL={purchaseBuilt:'Purchase Build Item', longLead:'Lead Item', held:'Held Item'};
const ITEM_TYPE_RELAXED={purchaseBuilt:1, longLead:1};
const ITEM_TYPE_RELAXED_FIELDS=['location','model','serial','mfgDate','acqDate','warrStart'];
function requiredFieldsFor(e){ const t=e&&e.itemType; if(t && ITEM_TYPE_RELAXED[t]) return INFO_REQUIRED.filter(k=>ITEM_TYPE_RELAXED_FIELDS.indexOf(k)<0); return INFO_REQUIRED; }
// ISO wording: working definitions pending verbatim AS ISO 55000/55001 clause text (PDF access blocked
// at authoring time — see the 2026-07-03 design spec §3). Swap the strings here when supplied.
const FIELD_INFO={ make:'Manufacturer — the OEM company that made the item.', supplier:'Supplier — the vendor used to purchase the item.',
  isoCriticality:'Criticality — the relative importance of this asset, from the consequence of its failure (safety, operational and cost impact). Supports risk-based asset management decisions (ISO 55001 cl. 6.1). Working definition (AM practice).',
  isoCondition:'Condition — the asset\'s current physical state relative to its expected state; informs life-cycle and maintenance decisions. Working definition (AM practice).',
  isoLifecycle:'Life-cycle stage — the stage this asset occupies in its life cycle, e.g. planned / acquired / operating / maintained / disposed. Based on the ISO 55000 term "life cycle".',
  isoFunction:'Asset function / purpose — the function the asset performs or the service it delivers to the organization. Based on ISO 55000 value realization.',
  isoValue:'Value — the value this asset provides to the organization: financial, or its contribution to organizational objectives. Based on the ISO 55000 terms "asset" and "value".' };
const BOM_FIELDS=[['mfgItem','MANUFACTURER ITEM NUMBER'],['mfgName','MANUFACTURER NAME'],['supPart','SUPPLIER PART NUMBER'],['supName','SUPPLIER NAME'],['currentSupplier','CURRENT SUPPLIER Y/N','yn'],['poTerms','PO TERMS AND CONDITIONS'],['itemDesc','ITEM DESCRIPTION'],['qty','BOM QUANTITY'],['uom','PRIMARY UNIT OF MEASURE'],['critical','CRITICAL ITEM?','yn'],['criticality','WHAT IS THE ASSET CRITICALITY?'],['failureStops','DOES FAILURE STOP THE MACHINE?','yn'],['backup','IS THERE A BACKUP SYSTEM?','yn'],['availability','WHAT IS THE PART AVAILABILITY?'],['toStock','ITEM TO BE STOCKED?','yn'],['minStock','MINIMUM STOCK LEVEL'],['maxStock','MAXIMUM STOCK LEVEL'],['quoteLink','STORE STOCK QUOTE LINK'],['unitPrice','UNIT PRICE'],['projectSpares','PROJECT SPARES PROVIDED?','yn'],['oracleExists','ITEM EXISTS IN ORACLE?','yn']];
function isItemRow(e){
  if(!e || !leafEnumerable(e)) return false;                 // numbered EQUIPMENT/CLASS leaf …
  const cls = e.classification || classOf(e);                // … but Reference / Reference-Sub are containers, not items
  return cls!=='REFERENCE' && cls!=='REFERENCE - SUB';       // (no make/model/serial/BOM for them)
}
function infoMissing(e){ if(!isItemRow(e)) return []; const info=e.info||{}; return requiredFieldsFor(e).filter(k=>!(info[k]&&String(info[k]).trim())); }
// Provisional stocking score (thresholds per master: <8 Do Not Hold / 8-17 Vendor Held / >=17 Hold). Reconcile formula when Oracle template lands.
function bomScore(b){ let s=0; b=b||{};
  if((b.critical||'')==='Yes')s+=6; if((b.failureStops||'')==='Yes')s+=6; if((b.backup||'')==='No')s+=3;
  const av=(b.availability||'').toLowerCase(); if(/long|over|week|month|>|import/.test(av))s+=6; else if(/med|few|day/.test(av))s+=3;
  const cr=(b.criticality||'').toLowerCase(); if(/high|crit/.test(cr))s+=4; else if(/med/.test(cr))s+=2; return s; }
function stockRec(s){ return s>=17?'Hold Stock':(s>=8?'Vendor Held Stock':'Do Not Hold Stock'); }
function bomStockIssues(list){ const out=[];
  (list||[]).forEach((b,i)=>{ if((b&&b.toStock)==='Yes'){ const miss=[];
    if(!(b.minStock&&String(b.minStock).trim())) miss.push('minimum stock');
    if(!(b.maxStock&&String(b.maxStock).trim())) miss.push('maximum stock');
    if(!(b.quoteLink&&String(b.quoteLink).trim())) miss.push('store-stock quote link');
    if(miss.length) out.push({rule:'BOM',severity:'high',message:'Part '+(i+1)+' is store-stocked — '+miss.join(', ')+' required.'}); } });
  return out; }
export { INFO_FIELDS, INFO_REQUIRED, ITEM_TYPE_LABEL, ITEM_TYPE_RELAXED, ITEM_TYPE_RELAXED_FIELDS, requiredFieldsFor, FIELD_INFO, BOM_FIELDS, isItemRow, infoMissing, bomScore, stockRec, bomStockIssues };
