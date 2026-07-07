// Asset Onboarding Tool — client app (Phase 2 split of the single-file original).
// UI layer only: all domain logic is imported from the frozen shared modules below.
// Storage seams replaced per the port packet: embedded dataset -> GET /api/bootstrap;
// folder sync -> rows API; browser-storage drafts -> drafts API;
// fake admin password gate -> server-authenticated role.
import { initData, NODES, EDGES, ROOTS, ASSETS, DEPTS, SITES, LOCS, ASSET_NOS, TAKEN_NOS, ASSET_BY_NO, CONTAINER_NOS, rebuildAssetIndex, assetLevel, nodeOf, childrenOf, descOf, rootByCode } from '../shared/domain/data.js';
import { bindSession } from '../shared/domain/session.js';
import { RULES } from '../shared/domain/rules.js';
import { cleanName, isGroupNode, plainNode, transformedChildren, childrenOfRules, descOfRules } from '../shared/domain/cascade.js';
import { parentTx, levelCode, inheritedLen, newLeafLevel, leafCodeOf, newSegments, basePrefix, leafEnumerable, noTaken, nextSequence, autoAssetNo, proposedAssetNo, proposedAssetDesc } from '../shared/domain/numbering.js';
import { lastLevel, assetTypeOf, taxChildCountOf, rowChildCount, engineInput, takenAbbrevs, classOf, dataIssuesFor, computeForRow, rowStructLevel, structRoleOf } from '../shared/domain/engine.js';
import { STRUCTURE_ROLES, roleOfLevel, structureComplete, hierarchyOrder, inSiteScope } from '../shared/domain/structure.js';
import { INFO_FIELDS, INFO_REQUIRED, ITEM_TYPE_LABEL, ITEM_TYPE_RELAXED, ITEM_TYPE_RELAXED_FIELDS, requiredFieldsFor, FIELD_INFO, BOM_FIELDS, isItemRow, infoMissing, bomScore, stockRec, bomStockIssues } from '../shared/domain/fields.js';
import { CSV_HEADERS, csvCell, buildCSV, BOM_CSV_HEADERS, buildBOMCSV, buildTaxCSV, sanitizeFileName, exportFileBase, draftFileName } from '../shared/domain/csv.js';
import { PERTH_TZ, perthDate, perthDateTime, perthISO } from '../shared/domain/time.js';
import * as ERP from './erpProfile.js';

/* ---------- server-authenticated user (replaces the client password admin gate) ---------- */
let CURRENT_USER = null;
let IS_ADMIN = false;

/* ---------- active ERP profile (I/O adapter — frozen engine untouched) ---------- */
let ACTIVE = ERP.getActive();                 // seeds + activates the built-in ISO profile on first run
function isDefaultIso(){ return !!(ACTIVE && ACTIVE.builtIn && ACTIVE.mode === 'iso'); }
function applyProfileUI(){
  const flat = ACTIVE.mode === 'flat';
  const bom = document.getElementById('btnBomEx'); if(bom) bom.style.display = flat ? 'none' : '';
  const site = document.getElementById('selSite'); if(site && site.closest('.context')) site.closest('.context').style.display = flat ? 'none' : '';
  const io = document.getElementById('chkIssuesOnly'); if(io && io.closest('.ctx-check')) io.closest('.ctx-check').style.display = flat ? 'none' : '';
  renderRows(); updateExportNameHint(); applyAdminUI();
}

const $ = s => document.querySelector(s);
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2800);}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function showBanner(msg, warn){ const b=$('#banner'); $('#bannerMsg').innerHTML=msg; b.className='banner show'+(warn?' warn':''); }
function hideBanner(){ $('#banner').className='banner'; }
/* ---------- date-or-free-text input (a text field you can type into, plus a calendar picker) ---------- */
function dateFieldHTML(opts){
  opts=opts||{};
  const raw=opts.value||'';
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(raw)?esc(raw):'';
  return '<div class="datefield"><input class="text d-text" '+(opts.attrs||'')+' value="'+esc(raw)+'" autocomplete="off" placeholder="'+esc(opts.placeholder||'date or free text')+'">'+
         '<input type="date" class="d-pick" value="'+iso+'" tabindex="-1" aria-label="Pick a date"></div>';
}
function wireDateField(wrap){
  const t=wrap.querySelector('.d-text'), p=wrap.querySelector('.d-pick'); if(!t||!p) return;
  p.addEventListener('change',()=>{ if(p.value){ t.value=p.value; t.dispatchEvent(new Event('input',{bubbles:true})); } });
  p.addEventListener('click',()=>{ try{ if(p.showPicker) p.showPicker(); }catch(e){} });
  t.addEventListener('input',()=>{ if(/^\d{4}-\d{2}-\d{2}$/.test(t.value)) p.value=t.value; else if(!t.value) p.value=''; });
}

const VALID_CLS = ['PRIMARY (P)','SECONDARY (S)','REFERENCE','REFERENCE - SUB','EQUIPMENT GROUP - EQUIPMENT TYPE'];

/* ---------- state ---------- */
let rows = [];
let BOM_EXISTING = [];   // BOM captured for EXISTING register assets: [{no,desc,bom:[...]}]
let BOMEX = null;        // working state for the Add-BOM-to-existing modal
let cmbBomEx = null;
let editing = null;
let editIndex = -1;

/* ---------- session sync: rebind the six UI globals into the shared domain session ---------- */
function syncSession(){ bindSession({rows, editing, editIndex, PROJECT, BOM_EXISTING, NEW_TAX}); }

/* ===========================================================
   Combobox
=========================================================== */
function Combo(host, opts){
  const o = Object.assign({placeholder:'Select…', max:300, onChange:()=>{}}, opts);
  host.classList.add('combo');
  host.innerHTML = `<input class="combo-input" placeholder="${esc(o.placeholder)}" autocomplete="off" spellcheck="false">
    <button class="combo-clear" tabindex="-1" title="Clear">✕</button>
    <div class="combo-pop"></div>`;
  const input = host.querySelector('.combo-input');
  const pop = host.querySelector('.combo-pop');
  const clearBtn = host.querySelector('.combo-clear');
  let options = o.options || [];
  let value = null, label = '', active = -1, visible = [];
  function getOptions(){ return typeof options==='function' ? options() : options; }
  function setOptions(arr){ options = arr || []; }
  function render(filter){
    const f = (filter||'').toLowerCase().trim();
    const all = getOptions(); visible = [];
    for(const op of all){ const hay = (op.label+' '+(op.sub||'')+' '+(op.value||'')).toLowerCase();
      if(!f || hay.includes(f)) visible.push(op); if(visible.length > o.max) break; }
    let html='';
    if(!all.length){ html = `<div class="opt-none">No options available</div>`; }
    else if(!visible.length){ html = `<div class="opt-none">No matches for “${esc(filter)}”</div>`; }
    else { html = visible.map((op,i)=>`<div class="opt ${i===active?'active':''}" data-i="${i}">
        <div class="o-main">${esc(op.label)}${op.badge?`<span class="o-badge badge-${esc(op.badge)}">${esc(op.badge)}</span>`:''}</div>
        ${op.sub?`<div class="o-sub">${esc(op.sub)}</div>`:''}</div>`).join('');
      if(all.length > visible.length && (filter||'').length<1){ html += `<div class="opt-more">Showing first ${o.max}. Type to search ${all.length} options…</div>`; }
      else if(visible.length>o.max){ html += `<div class="opt-more">Refine your search to narrow results…</div>`; } }
    pop.innerHTML = html;
  }
  function open(){ render(input.value===label?'':input.value); pop.classList.add('open'); }
  function close(){ pop.classList.remove('open'); active=-1; input.value = label; }
  function choose(op){ value=op.value; label=op.label; input.value=label; host.classList.add('has-val'); input.classList.add('filled'); close(); o.onChange(value, op); }
  function clear(silent){ value=null;label='';input.value='';host.classList.remove('has-val');input.classList.remove('filled'); if(!silent) o.onChange(null,null); }
  function scrollActive(){ const el=pop.querySelector('.opt.active'); if(el)el.scrollIntoView({block:'nearest'}); }
  input.addEventListener('focus',open);
  input.addEventListener('input',()=>{ active=-1; render(input.value); if(!pop.classList.contains('open'))pop.classList.add('open'); });
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(active+1,visible.length-1);render(input.value===label?'':input.value);scrollActive();}
    else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(active-1,0);render(input.value===label?'':input.value);scrollActive();}
    else if(e.key==='Enter'){e.preventDefault();if(active>=0&&visible[active])choose(visible[active]);}
    else if(e.key==='Escape'){close();input.blur();}
  });
  pop.addEventListener('mousedown',e=>{ const d=e.target.closest('.opt'); if(d){e.preventDefault();choose(visible[+d.dataset.i]);}});
  clearBtn.addEventListener('mousedown',e=>{e.preventDefault();clear();input.focus();});
  document.addEventListener('mousedown',e=>{ if(!host.contains(e.target)) close(); });
  return { setOptions, render, getValue:()=>value, getLabel:()=>label,
    setValue:(v)=>{ if(v==null||v===''){clear(true);return;} const op=getOptions().find(x=>x.value===v)||{value:v,label:v}; value=op.value;label=op.label;input.value=label;host.classList.add('has-val');input.classList.add('filled'); },
    clear:()=>clear(true), focus:()=>input.focus() };
}

/* ===========================================================
   Option sets
=========================================================== */
function nodeBadge(v){ return (NODES[v]||{}).type||''; }
function entryLabel(e){ if(e.display!==e.value) return cleanName(e.display); const n=NODES[e.value]||{}; return n.desc || n.levelDesc || cleanName(e.value); }
function taxOptionsFromEntries(entries){ return entries.map(e=>({value:e.value, label:entryLabel(e), sub:e.display, badge:nodeBadge(e.value)})).sort((a,b)=>a.label.localeCompare(b.label)); }
// §parent picker — only reference / reference-sub containers (assets with children), and only
// entries belonging to the selected site. Site membership = the site sits on the entry's ancestor
// chain (inSiteScope; chains span register assets AND session rows), so scoping holds even when
// an entry's number doesn't carry the site prefix (e.g. imported registers).
function assetOptions(){
  const s=currentSite(); const k = s ? s.name : '';
  const sessParent = new Map(); rows.forEach(r=>{ const n=r.assetNo||''; if(n && !sessParent.has(n)) sessParent.set(n, r.parent||''); });
  const parentOf = n => sessParent.has(n) ? sessParent.get(n) : ((ASSET_BY_NO.get(n)||{}).parent || '');
  let list = ASSETS.filter(a=>CONTAINER_NOS.has(a.no) && assetLevel(a.no)>=3);   // §structure — assets parent at Level 3+ (Asset Class or deeper)
  if(k){ list=list.filter(a=>inSiteScope({no:a.no, parent:a.parent||''}, k, parentOf)); }
  const out = list.map(a=>({value:a.no, label:a.no, sub:a.desc}));
  // #1 — REFERENCE / REFERENCE-SUB / PRIMARY (P) / SECONDARY (S) assets added (or imported) this session
  // become selectable parents — but only those inside the selected site's subtree.
  const REF=new Set(['REFERENCE','REFERENCE - SUB','PRIMARY (P)','SECONDARY (S)']);
  rows.forEach((r,idx)=>{
    if(idx===editIndex || r.action!=='add') return;
    const lvl=rowStructLevel(r);
    if(lvl<3) return;                                            // sites / asset classes never parent assets
    if(lvl>3 && !REF.has(r.classification||classOf(r))) return;  // level-3 asset classes always qualify
    const no=r.assetNo; if(!no) return;
    if(k && !inSiteScope({no, parent:r.parent||''}, k, parentOf)) return;
    if(out.some(o=>o.value===no)) return;
    out.push({value:no, label:no, sub:((r.desc||r.tag||'')+' · added this session').trim()});
  });
  return out;
}
function deptOptions(){
  const seen=new Set(), out=[];
  SITES.forEach(s=>{ const dd=s.deptDesc; if(dd && !seen.has(dd)){ seen.add(dd); out.push({value:dd,label:dd,sub:s.dept?('Dept '+s.dept):''}); } });
  if(out.length) return out.sort((a,b)=>a.label.localeCompare(b.label));
  return DEPTS.map(d=>({value:d.desc,label:d.desc,sub:'Dept '+d.code}));
}
function locOptions(){
  const seen=new Set(), out=[];
  SITES.forEach(s=>{ const ld=s.locDesc; if(ld && !seen.has(ld)){ seen.add(ld); out.push({value:ld,label:ld,sub:s.locCode||(s.locArea?('Area '+s.locArea):'')}); } });
  if(out.length) return out.sort((a,b)=>a.label.localeCompare(b.label));
  const sn=new Set(),o=[]; for(const l of LOCS){ if(!l.desc||sn.has(l.desc))continue; sn.add(l.desc); o.push({value:l.desc,label:l.desc,sub:l.code||('Area '+l.area)}); } return o;
}

let cmbParent, cmbDept, cmbLoc;
function initCombos(){
  cmbParent = Combo($('#cmbParent'), {placeholder:'Search by asset no. or description…', options:()=>assetOptions(), onChange:()=>{ editing.parent=cmbParent.getValue(); editing.levels = (parentTx(editing.parent)||[]).slice(); renderCascade(); }});
  cmbDept   = Combo($('#cmbDept'),   {placeholder:'Default (auto)…', options:()=>deptOptions(), onChange:()=>{ editing.dept=cmbDept.getValue(); }});
  cmbLoc    = Combo($('#cmbLoc'),    {placeholder:'Default (auto)…', options:()=>locOptions(), onChange:()=>{ editing.loc=cmbLoc.getValue(); }});
}

/* ===========================================================
   Cascade rendering
=========================================================== */
const cascadeCombos = [];
/* ---------- session taxonomy overrides (user-added values, auto-mapped parent/child) ---------- */
let NEW_TAX = [];   // {value,type,code,desc,parent} added this session
function suggestCode(name){ const w=cleanName(name).toUpperCase().replace(/[^A-Z0-9 ]/g,' ').split(/\s+/).filter(Boolean); if(!w.length) return ''; return (w.length===1?w[0].slice(0,4):w.map(x=>x[0]).join('').slice(0,4)); }
function registerTaxValue(value, opts, parentVal, track){
  value=(value==null?'':String(value)).trim(); if(!value) return null; opts=opts||{};
  const type=(opts.type||'REFERENCE').toUpperCase();
  const code=(opts.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
  const desc=(opts.desc!=null&&opts.desc!=='')?String(opts.desc).trim():cleanName(value);
  NODES[value]={value:value,type:type,code:code,desc:desc,levelDesc:'',suffix:'',src:'override'};
  if(parentVal){ const lst=EDGES[parentVal]||(EDGES[parentVal]=[]); if(lst.indexOf(value)<0) lst.push(value); }
  else if(ROOTS.indexOf(value)<0){ ROOTS.push(value); }
  if(track!==false && !NEW_TAX.some(t=>t.value===value && (t.parent||'')===(parentVal||''))){
    NEW_TAX.push({value:value,type:type,code:code,desc:desc,parent:parentVal||''});
    // persist the addition server-side (fire-and-forget; local NODES/EDGES/NEW_TAX stay authoritative in-session)
    fetch('/api/taxonomy/additions',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({value:value,type:type,code:code,desc:desc,parent:parentVal||''})})
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); })
      .catch(()=>toast('Taxonomy addition not saved to the server'));
  }
  return value;
}
function reapplyOverrides(){ NEW_TAX.slice().forEach(t=>registerTaxValue(t.value,{type:t.type,code:t.code,desc:t.desc},t.parent||null,false)); }
function makeTaxAdd(i, parentVal, expanded){
  const lvlNo=i+3, wrap=document.createElement('div'); wrap.className='taxadd';
  wrap.innerHTML=
    '<a href="#" class="tx-link" style="font-size:12px;color:var(--navy-mid);text-decoration:none;font-weight:600">＋ '+(expanded?('No standard sub-levels here — add a Level '+lvlNo+' taxonomy value to go deeper, or leave blank to stop'):('Value not listed? Add a Level '+lvlNo+' value'))+'</a>'+
    '<div class="tx-form" style="display:'+(expanded?'block':'none')+';margin-top:8px;border:1px solid var(--line-strong);border-radius:8px;padding:10px;background:var(--panel-2)">'+
      '<div class="grid2"><div class="field"><label>New taxonomy value <span class="req">*</span></label><input class="text tx-name" autocomplete="off" placeholder="e.g. &lt;DRAINAGE&gt; or PUMP STATION"></div>'+
      '<div class="field"><label>Type <span class="req">*</span></label><select class="native tx-type"><option value="REFERENCE">Reference / grouping (container — no number)</option><option value="CLASS">Class (numbered group)</option><option value="EQUIPMENT">Equipment (numbered item — needs make/model/serial)</option></select></div></div>'+
      '<div class="grid2" style="margin-top:8px"><div class="field"><label>Code <span class="req">*</span> <span class="hint" style="text-transform:none;letter-spacing:0;font-weight:400">asset-no segment, ≤4 chars</span></label><input class="text tx-code" maxlength="4" autocomplete="off" placeholder="auto from name"></div>'+
      '<div class="field"><label>Description</label><input class="text tx-desc" autocomplete="off" placeholder="defaults to the value name"></div></div>'+
      '<div style="margin-top:10px;display:flex;gap:8px;align-items:center"><button type="button" class="btn primary sm tx-add">Add to taxonomy</button>'+(expanded?'':'<button type="button" class="btn sm tx-cancel">Cancel</button>')+'<span class="tx-warn hint" style="color:var(--red);display:none"></span></div>'+
    '</div>';
  const link=wrap.querySelector('.tx-link'), form=wrap.querySelector('.tx-form');
  const nameI=wrap.querySelector('.tx-name'), typeS=wrap.querySelector('.tx-type'), codeI=wrap.querySelector('.tx-code'), descI=wrap.querySelector('.tx-desc'), warn=wrap.querySelector('.tx-warn');
  link.onclick=e=>{ e.preventDefault(); const show=form.style.display==='none'; form.style.display=show?'block':'none'; if(show) nameI.focus(); };
  nameI.oninput=()=>{ if(codeI.dataset.auto!=='0'){ codeI.value=suggestCode(nameI.value); codeI.dataset.auto='1'; } };
  codeI.oninput=()=>{ codeI.dataset.auto='0'; };
  const cancel=wrap.querySelector('.tx-cancel'); if(cancel) cancel.onclick=()=>{ form.style.display='none'; };
  wrap.querySelector('.tx-add').onclick=()=>{
    const name=nameI.value.trim(), code=(codeI.value.trim()||suggestCode(name)), type=typeS.value, desc=descI.value.trim();
    if(!name){ warn.textContent='Enter a taxonomy value.'; warn.style.display='inline'; return; }
    if(!code){ warn.textContent='Enter a code.'; warn.style.display='inline'; return; }
    registerTaxValue(name,{type:type,code:code,desc:desc},parentVal||null);
    editing.levels.length=i; editing.levels[i]=name;
    toast('Added taxonomy value “'+name+'”'); renderCascade();
  };
  return wrap;
}
// Level 3 is taken from the selected parent asset. An asset no is SITE-<L3 code>-<L4 code>-…,
// so the 2nd segment is the Level-3 code, which maps uniquely to one taxonomy root.
function unregisterTaxValue(value, parentVal){
  if(!value) return;
  delete NODES[value]; delete EDGES[value];
  if(parentVal && EDGES[parentVal]){ const k=EDGES[parentVal].indexOf(value); if(k>=0) EDGES[parentVal].splice(k,1); }
  const r=ROOTS.indexOf(value); if(r>=0) ROOTS.splice(r,1);
  let tracked=false;
  for(let j=NEW_TAX.length-1;j>=0;j--){ if(NEW_TAX[j].value===value){ NEW_TAX.splice(j,1); tracked=true; } }
  if(tracked){
    // remove the addition server-side too (fire-and-forget)
    fetch('/api/taxonomy/additions/'+encodeURIComponent(value),{method:'DELETE'})
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); })
      .catch(()=>toast('Taxonomy removal not saved to the server'));
  }
}
// inline editor for a taxonomy value YOU added this session — change its value/type/code/description
// (or remove it) any time before the asset is saved; edits flow straight into the cascade + asset no.
function makeTaxEdit(i, value){
  const n=NODES[value]||{}, nt=NEW_TAX.find(t=>t.value===value), parentVal = nt ? (nt.parent||null) : (i>0?editing.levels[i-1]:null);
  const wrap=document.createElement('span'); wrap.className='taxedit-wrap'; wrap.style.cssText='display:inline-block;position:relative';
  wrap.innerHTML=
    '<a href="#" class="txe-link" title="Edit the value you added this session" style="margin-left:6px;font-size:13px;font-weight:700;color:var(--navy-mid);text-decoration:none">✎ edit</a>'+
    '<div class="txe-form" style="display:none;position:absolute;z-index:30;top:20px;left:0;width:430px;max-width:80vw;border:1px solid var(--line-strong);border-radius:8px;padding:10px;background:var(--panel-2);box-shadow:0 6px 18px rgba(0,0,0,.18)">'+
      '<div class="grid2"><div class="field"><label>Value <span class="req">*</span></label><input class="text txe-name" autocomplete="off"></div>'+
      '<div class="field"><label>Type <span class="req">*</span></label><select class="native txe-type"><option value="REFERENCE">Reference / grouping (container — no number)</option><option value="CLASS">Class (numbered group)</option><option value="EQUIPMENT">Equipment (numbered item — needs make/model/serial)</option></select></div></div>'+
      '<div class="grid2" style="margin-top:8px"><div class="field"><label>Code <span class="req">*</span> <span class="hint" style="text-transform:none;letter-spacing:0;font-weight:400">≤4 chars</span></label><input class="text txe-code" maxlength="4" autocomplete="off"></div>'+
      '<div class="field"><label>Description</label><input class="text txe-desc" autocomplete="off"></div></div>'+
      '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="btn primary sm txe-save">Save changes</button><button type="button" class="btn danger sm txe-remove">Remove</button><button type="button" class="btn sm txe-cancel">Close</button><span class="txe-warn hint" style="color:var(--red);display:none"></span></div>'+
    '</div>';
  const link=wrap.querySelector('.txe-link'), form=wrap.querySelector('.txe-form');
  const nameI=wrap.querySelector('.txe-name'), typeS=wrap.querySelector('.txe-type'), codeI=wrap.querySelector('.txe-code'), descI=wrap.querySelector('.txe-desc'), warn=wrap.querySelector('.txe-warn');
  nameI.value=value; typeS.value=(n.type||'REFERENCE'); codeI.value=(n.code||''); descI.value=(n.desc||'');
  link.onclick=e=>{ e.preventDefault(); form.style.display = form.style.display==='none'?'block':'none'; };
  wrap.querySelector('.txe-cancel').onclick=()=>{ form.style.display='none'; };
  wrap.querySelector('.txe-save').onclick=()=>{
    const nn=nameI.value.trim(), tp=typeS.value, cd=(codeI.value.trim()||suggestCode(nn)), ds=descI.value.trim();
    if(!nn){ warn.textContent='Enter a value.'; warn.style.display='inline'; return; }
    if(!cd){ warn.textContent='Enter a code.'; warn.style.display='inline'; return; }
    if(nn!==value && NODES[nn] && !NEW_TAX.some(t=>t.value===nn)){ warn.textContent='That value already exists in the standard taxonomy.'; warn.style.display='inline'; return; }
    unregisterTaxValue(value, parentVal);
    registerTaxValue(nn,{type:tp,code:cd,desc:ds},parentVal||null);
    editing.levels.length=i; editing.levels[i]=nn;
    toast('Updated taxonomy value “'+nn+'”'); renderCascade();
  };
  wrap.querySelector('.txe-remove').onclick=()=>{
    unregisterTaxValue(value, parentVal);
    editing.levels.length=i;
    toast('Removed taxonomy value “'+value+'”'); renderCascade();
  };
  return wrap;
}
function level3FromParent(parentNo){ const t=parentTx(parentNo); return (t&&t.length)?t[0]:null; }
function renderCascade(){
  const host = $('#cascade'); host.innerHTML=''; cascadeCombos.length=0;
  const lv = editing.levels;
  const inh = (parentTx(editing.parent)||[]).length;   // levels inherited from the parent — shown as context, never re-picked
  // req #12 — a parent's taxonomy path is inherited; the cascade only offers the levels BELOW the
  // selected parent. Without a parent the row is a top-level structure asset and the cascade starts at the roots.
  if(!editing.parent){
    const note=document.createElement('div'); note.className='lvl leafnote';
    note.innerHTML='<div class="hint">No parent selected — this row will be a top-level asset (e.g. a site or facility). Enter the Asset / Tag name (and optionally a top category below), or select a parent asset above to nest under it.</div>';
    host.appendChild(note);
  } else if(inh>0){
    const note=document.createElement('div'); note.className='lvl leafnote';
    const path=lv.slice(0,inh).map(v=>descOf(v)||cleanName(v)).filter(Boolean).join(' ▸ ');
    note.innerHTML='<div class="hint">Adding under <b>'+esc(editing.parent)+'</b>'+(path?' · '+esc(path):'')+' — choose the level below (next is Level '+(inh+3)+').</div>';
    host.appendChild(note);
  }
  for(let i=inh;i<13;i++){
    let entries; const parentVal = i>0 ? lv[i-1] : null;
    if(i===0){ entries = ROOTS.map(v=>({value:v,display:v})); }
    else { if(!parentVal) break; entries = childrenOfRules(parentVal, lv.slice(0,i)); }
    if(i>0 && entries.length===0){
      // No taxonomy children here (genuine leaf, or a value outside the lookup). Let the user TYPE a
      // deeper level so child assets can still be created under this parent.
      const drow=document.createElement('div'); drow.className='lvl'; drow.style.alignItems='start';
      drow.innerHTML='<div class="lname">Level '+(i+3)+'</div><div class="taxslot"></div>';
      host.appendChild(drow);
      drow.querySelector('.taxslot').appendChild(makeTaxAdd(i, parentVal, true));
      if(!lv[i]) break;
      continue;
    }
    const row = document.createElement('div'); row.className='lvl';
    row.innerHTML = '<div class="lname">Level '+(i+3)+'</div><div class="lvlbody" style="display:flex;flex-direction:column;gap:5px"><div class="combo cmb"></div><div class="taxslot"></div></div>';
    host.appendChild(row);
    const c = Combo(row.querySelector('.cmb'), { placeholder: i===0?'Choose top category…':'Choose…',
      options: taxOptionsFromEntries(entries),
      onChange:(val)=>{ lv.length=i; if(val){lv[i]=val;} renderCascade(); } });
    if(lv[i]) c.setValue(lv[i]); cascadeCombos.push(c);
    if(lv[i] && NEW_TAX.some(t=>t.value===lv[i])) row.querySelector('.lname').appendChild(makeTaxEdit(i, lv[i]));
    row.querySelector('.taxslot').appendChild(makeTaxAdd(i, parentVal, false));
    if(!lv[i]) break;
  }
  recompute();
}



/* ===========================================================
   recompute + panels
=========================================================== */
function recompute(){
  syncSession();
  if(!editing) return;
  const ein = engineInput(editing);
  editing._classDerived = RULES.classify(ein);
  editing.classification = editing.classOverride || editing._classDerived;
  // §structure — levels 1–3 are structure rows: classification is the role name, overrides don't apply
  const sRole = structRoleOf(editing);
  if(sRole){ editing._classDerived = sRole; editing.classification = sRole; }
  editing._abbrDerived = RULES.buildAbbreviation(ein.assetType, ein.duty, takenAbbrevs());
  editing.abbreviation = editing.abbrOverride || editing._abbrDerived;
  editing._numberDefault = RULES.resolveNumber(ein) || '';
  editing.assetNo = proposedAssetNo(editing);
  editing.assetName = proposedAssetDesc(editing);
  renderNameplate();
  renderEnginePanel();
  renderEngineIssues();
  toggleInfoSections();
}
function renderNameplate(){
  const npno=$('#npNo');
  npno.textContent = editing.assetNo || (editing.parent ? '—' : 'enter an Asset / Tag name (or pick a category) to build the number');
  $('#npDesc').textContent = editing.assetName || '';
  // item asset = numbered leaf (EQUIPMENT / CLASS instance) — make the number a one-click fill button
  const item = !!(editing.assetNo && leafEnumerable(editing));
  npno.classList.toggle('clickable', item);
  npno.title = item ? 'Click to auto-fill tag name, asset type & description' : '';
  $('#npHint').style.display = item ? 'block' : 'none';
}
// req #4 — click the proposed asset no. to auto-fill the editable fields for an item asset
function autofillFromProposed(){
  if(!editing) return;
  const auto=autoAssetNo(editing); if(!auto || !leafEnumerable(editing)) return;
  const parent=editing.parent||'';
  const seg=(parent && auto.indexOf(parent+'-')===0) ? auto.slice(parent.length+1) : auto;   // last segment only
  editing.tag=seg; $('#inpTag').value=seg;
  const leaf=lastLevel(editing); const ld=leaf?descOf(leaf):'';
  if(ld && (!editing.assetType || !editing.assetType.trim())){ editing.assetType=ld; $('#inpAssetType').value=ld; }
  const nm = proposedAssetDesc(editing);
  if(nm && (!editing.desc || !editing.desc.trim())){ editing.desc=nm; $('#inpDesc').value=nm; }
  recompute();
  toast('Auto-filled tag, type & description');
}
const CLS_KEY = {'REFERENCE':'cls-ref','REFERENCE - SUB':'cls-refsub','EQUIPMENT GROUP - EQUIPMENT TYPE':'cls-equip','PRIMARY (P)':'cls-p','SECONDARY (S)':'cls-s'};
function renderEnginePanel(){
  const cls = editing.classification, over=!!editing.classOverride;
  const showNum = RULES.needsNumber(cls);
  let html='<div class="echip '+(CLS_KEY[cls]||'')+'"><span class="k">Class</span><span class="v">'+esc(cls)+'</span>'+(over?'<span class="over">override</span>':'')+'</div>';
  html+='<div class="echip"><span class="k">Abbrev</span><span class="v">'+esc(editing.abbreviation||'—')+'</span></div>';
  const numShown = showNum ? ((editing.number!=null&&editing.number!=='')?editing.number:(editing._numberDefault||'(auto)')) : '— none';
  html+='<div class="echip"><span class="k">Seq</span><span class="v">'+esc(numShown)+'</span></div>';
  $('#enginePanel').innerHTML = html;
  const showWO = (editing._classDerived==='REFERENCE'||editing._classDerived==='REFERENCE - SUB'||cls==='REFERENCE'||cls==='REFERENCE - SUB');
  $('#woWrap').style.display = showWO ? 'block':'none';
  document.querySelectorAll('#segWO button').forEach(b=>{ const yes=b.dataset.wo==='yes'; b.className = ((editing.workOrderable!==false)===yes) ? 'on':''; });
  const ni=$('#inpNumber'); if(document.activeElement!==ni){ ni.placeholder = showNum ? 'auto next sequence' : '(none for reference)'; }
  const sel=$('#selClass'); if(sel && sel.options.length){ sel.options[0].text='Auto: '+editing._classDerived; sel.disabled = STRUCTURE_ROLES.indexOf(editing.classification)>=0; sel.value = sel.disabled ? '' : (editing.classOverride||''); }
}
function renderEngineIssues(){
  const a = engineInput(editing); a.abbreviation=editing.abbreviation; a.number=editing.number||''; a.classOverride=editing.classOverride||null; a.tag=editing.tag;
  const allTags = new Set();   // asset-no uniqueness is enforced via modalDupIssues/computeForRow (tags are last-segments now)
  const issues = RULES.validate(a, allTags).concat(dataIssuesFor(editing.levels, editing.parent, editing.tag)).concat(modalDupIssues()).concat(structuralLevelIssue());
  const box=$('#engineIssues');
  if(!issues.length){ box.innerHTML='<div class="eissue ok"><span class="rl">OK</span><span>Passes all Rule Standard checks.</span></div>'; return; }
  box.innerHTML = issues.map(i=>'<div class="eissue '+esc(i.severity)+'"><span class="rl">§'+esc(i.rule)+'</span><span>'+esc(i.message)+'</span></div>').join('');
}
function otherRows(){ return rows.filter((r,idx)=>idx!==editIndex); }
// req #5 — block the editing row from duplicating an existing asset no / tag name (master data carries no class field)
function modalDupIssues(){
  const e=editing, out=[]; if(!e || e.action!=='add') return out;
  const others=otherRows(), no=e.assetNo;
  if(no && (ASSET_NOS.has(no) || others.some(r=>r.assetNo===no)))
    out.push({rule:'3.10',severity:'high',message:'Asset no. “'+no+'” already exists — change the last section (Asset / tag name).'});
  return out;
}
// req #3 — assets may only be created at Level 4 or deeper (structure rows — parent at
// structure levels, i.e. another site or asset class being added — are exempt)
function structuralLevelIssue(){
  if(editing && editing.action==='add' && editing.parent && editing.levels.length<2 && !structRoleOf(editing))
    return [{rule:'LVL',severity:'high',message:'Assets must be created at Level 4 or deeper — choose a sub-level under this Level 3 category.'}];
  return [];
}
function buildClassSelect(){
  const sel=$('#selClass');
  const opts=['','REFERENCE','REFERENCE - SUB','EQUIPMENT GROUP - EQUIPMENT TYPE'];
  sel.innerHTML = opts.map((o,i)=> i===0 ? '<option value="">Auto</option>' : '<option value="'+esc(o)+'">'+esc(o)+'</option>').join('');
}

/* ===========================================================
   ASSET INFORMATION + BILL OF MATERIALS  (item assets only)
   Mirrors master sheets ASSET DETAILS + ASSET BILL OF MATERIAL.
=========================================================== */
const YN=['','Yes','No'];
function sbClass(s){ return s>=17?'sb-hold':(s>=8?'sb-vendor':'sb-no'); }
function toggleInfoSections(){
  const item=isItemRow(editing);
  $('#assetInfoSection').style.display=item?'block':'none';
  $('#bomSection').style.display=item?'block':'none';
  if(item){ const miss=infoMissing(editing), h=$('#aiHint');
    h.textContent = miss.length ? ('— '+miss.length+" required field(s) not yet supplied (won't block export)") : '— complete ✓';
    h.style.color = miss.length ? 'var(--amber)' : 'var(--green)'; }
}
function renderAssetInfo(){
  editing.info=editing.info||{};
  document.querySelectorAll('#segItemType button').forEach(b=>{ b.className = (editing.itemType===b.dataset.it) ? 'on' : ''; });
  const req=requiredFieldsFor(editing);
  $('#assetInfoGrid').innerHTML = INFO_FIELDS.map(f=>{
    const need = req.indexOf(f[0])>=0;
    const finf = FIELD_INFO[f[0]] ? ' <span class="fieldinfo" title="'+esc(FIELD_INFO[f[0]])+'" style="cursor:help;opacity:.6">ⓘ</span>' : '';
    const lab=esc(f[1])+(need?' <span class="req">*</span>':'')+finf;
    const body = f[3]==='date'
      ? dateFieldHTML({attrs:'data-ik="'+f[0]+'"', value:editing.info[f[0]]||''})
      : '<input class="text" data-ik="'+f[0]+'" value="'+esc(editing.info[f[0]]||'')+'" autocomplete="off">';
    return '<div class="field"><label>'+lab+'</label>'+body+'</div>';
  }).join('');
  $('#assetInfoGrid').querySelectorAll('input[data-ik]').forEach(inp=>{ inp.oninput=()=>{ editing.info[inp.dataset.ik]=inp.value; toggleInfoSections(); }; });
  $('#assetInfoGrid').querySelectorAll('.datefield').forEach(wireDateField);
}
function bomCardHtml(b,i){
  const sc=bomScore(b), rec=stockRec(sc);
  const fld=f=>{ const v=b[f[0]]||''; return f[2]==='yn'
      ? `<label>${esc(f[1])}<select data-bk="${f[0]}" data-bi="${i}">${YN.map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`
      : `<label>${esc(f[1])}<input data-bk="${f[0]}" data-bi="${i}" value="${esc(v)}"></label>`; };
  return `<div class="bomcard"><div class="bomhead"><span class="bi">Part ${i+1}</span><span class="scorebadge ${sbClass(sc)}">Score ${sc} · ${esc(rec)}</span><button class="btn sm danger" data-bd="${i}" type="button">✕</button></div><div class="bomgrid">${BOM_FIELDS.map(fld).join('')}</div></div>`;
}
function renderBOM(){
  editing.bom=editing.bom||[];
  const w=$('#bomWrap');
  w.innerHTML = editing.bom.length ? editing.bom.map(bomCardHtml).join('') : '<div class="subnote">No parts yet — add the asset’s spare/BOM items (optional).</div>';
  w.querySelectorAll('[data-bk]').forEach(inp=>{ inp.oninput=inp.onchange=()=>{ const i=+inp.dataset.bi, k=inp.dataset.bk; editing.bom[i][k]=inp.value;
    if(['critical','failureStops','backup','availability','criticality'].indexOf(k)>=0){ const b=editing.bom[i], sc=bomScore(b), badge=inp.closest('.bomcard').querySelector('.scorebadge'); badge.className='scorebadge '+sbClass(sc); badge.textContent='Score '+sc+' · '+stockRec(sc); b.score=sc; b.stockRec=stockRec(sc); } }; });
  w.querySelectorAll('[data-bd]').forEach(btn=>{ btn.onclick=()=>{ editing.bom.splice(+btn.dataset.bd,1); renderBOM(); }; });
}
function addBomLine(){ editing.bom=editing.bom||[]; editing.bom.push({}); renderBOM(); }
function finalizeBom(e){ (e.bom||[]).forEach(b=>{ b.score=bomScore(b); b.stockRec=stockRec(b.score); }); }

/* ===========================================================
   Modal
=========================================================== */
function blankAsset(){ return {action:'add', parent:null, levels:[], tag:'', desc:'', dept:null, loc:null,
  assetType:null, duty:null, number:null, workOrderable:true, classOverride:null, abbrOverride:null, itemType:null,
  groupsMinorItems:false, hasConcreteAssetsBeneath:true, classification:null, abbreviation:null, assetNo:'', assetName:'', info:{}, bom:[]}; }
function openModal(index){
  editIndex = index;
  editing = index>=0 ? JSON.parse(JSON.stringify(rows[index])) : blankAsset();
  syncSession();
  if(editing.workOrderable===undefined) editing.workOrderable=true;
  $('#modalTitle').textContent = index>=0 ? 'Edit asset' : 'Add asset';
  $('#btnDelete').style.display = index>=0 ? 'inline-flex' : 'none';
  setAction(editing.action);
  cmbParent.setOptions(()=>assetOptions());
  cmbParent.setValue(editing.parent);
  cmbDept.setValue(editing.dept);
  cmbLoc.setValue(editing.loc);
  $('#inpTag').value = editing.tag||'';
  $('#inpDesc').value = editing.desc||'';
  $('#inpAssetType').value = editing.assetType||'';
  $('#inpDuty').value = editing.duty||'';
  $('#inpNumber').value = editing.number||'';
  buildClassSelect();
  $('#valwarn').classList.remove('show');
  renderCascade();
  recompute();
  renderAssetInfo(); renderBOM(); toggleInfoSections();
  $('#modalBg').classList.add('open');
  setTimeout(()=>{ if(cascadeCombos[0] && !editing.levels.length) cascadeCombos[0].focus(); },60);
}
function closeModal(){ $('#modalBg').classList.remove('open'); editing=null; editIndex=-1; syncSession(); }
function setAction(a){
  editing.action=a;
  document.querySelectorAll('#segAction button').forEach(b=>{ b.className = b.dataset.a===a ? ('on '+a) : ''; });
  $('#parentLbl').innerHTML = (a==='add')
     ? 'Select parent asset <span class="hint">(optional — leave empty to create a top-level asset such as a company)</span>'
     : 'Select existing asset to '+a+' <span class="req">*</span>';
}
function validateStructural(){
  const e=editing, probs=[];
  if(e.action==='add'){
    // §structure — a parent at level 1/2 means this row is deliberately a structure row
    // (another Site / Asset Class): classification is auto-forced, shallow levels allowed.
    const sRole=structRoleOf(e);
    if(!e.parent && editIndex<0) probs.push('select a parent asset (new top-level Sites are created in the structure wizard)');
    if(e.parent && e.levels.length<2 && !sRole) probs.push('choose at least a Level 4 under the parent (assets cannot be created at Level 3)');
    if((!e.tag||!e.tag.trim()) && !(sRole && newLeafLevel(e))) probs.push('enter an Asset / Tag name');
  } else { if(!e.parent) probs.push('select the existing asset to '+e.action); }
  return probs;
}
async function saveRow(addAnother){
  editing.tag = $('#inpTag').value.trim();
  editing.desc = $('#inpDesc').value.trim();
  const probs = validateStructural(), w=$('#valwarn');
  if(probs.length){ w.innerHTML='Please '+probs.join(', and ')+'.'; w.classList.add('show'); return; }
  recompute();
  const a = engineInput(editing); a.abbreviation=editing.abbreviation; a.number=editing.number||''; a.classOverride=editing.classOverride||null; a.tag=editing.tag;
  const allTags = new Set();   // asset-no uniqueness is enforced via modalDupIssues/computeForRow (tags are last-segments now)
  const issues = RULES.validate(a, allTags).concat(dataIssuesFor(editing.levels, editing.parent, editing.tag)).concat(modalDupIssues()).concat(structuralLevelIssue());
  const highs = issues.filter(i=>i.severity==='high');
  const warns = issues.filter(i=>i.severity!=='high');
  if(highs.length){ w.innerHTML='Fix before saving — '+highs.map(i=>'[§'+esc(i.rule)+'] '+esc(i.message)).join(' · '); w.classList.add('show'); return; }
  if(warns.length){ if(!confirm('Save with '+warns.length+' warning(s)?\n\n'+warns.map(i=>'• ['+i.rule+'] '+i.message).join('\n'))) return; }
  editing.classification = structRoleOf(editing) || classOf(editing);
  editing.abbreviation = editing.abbrOverride || editing.abbreviation || RULES.buildAbbreviation(assetTypeOf(editing), editing.duty, takenAbbrevs());
  editing.number = (editing.number==null||editing.number==='') ? null : editing.number;
  editing.assetNo = proposedAssetNo(editing);
  editing.assetName = proposedAssetDesc(editing);
  finalizeBom(editing);
  const wasEdit = editIndex>=0;
  // --- storage seam: rows persist via the server API; the server's recomputed row is authoritative ---
  const rowId = wasEdit && rows[editIndex] ? rows[editIndex].id : null;
  let serverRow;
  try{
    const res = await fetch(rowId!=null ? '/api/rows/'+rowId : '/api/rows', {
      method: rowId!=null ? 'PUT' : 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(Object.assign({}, editing, {project: PROJECT}))
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    serverRow = (await res.json()).row;
  }catch(err){ toast('Save failed — server unreachable'); return; }   // keep the modal open; nothing lost
  if(wasEdit) rows[editIndex]=serverRow; else rows.push(serverRow);
  syncSession();
  const savedNo = serverRow.assetNo||serverRow.tag;
  if(addAnother){
    // keep the parent + its inherited taxonomy pre-fill; clear everything entered below it
    const parent=editing.parent;
    editIndex=-1; editing=blankAsset(); editing.action='add'; editing.parent=parent; editing.levels=(parentTx(parent)||[]).slice();
    syncSession();
    cmbParent.setValue(parent); cmbDept.clear(); cmbLoc.clear();
    $('#inpTag').value=''; $('#inpDesc').value=''; $('#inpAssetType').value=''; $('#inpDuty').value=''; $('#inpNumber').value='';
    $('#btnDelete').style.display='none'; $('#modalTitle').textContent='Add asset';
    setAction('add'); buildClassSelect(); $('#valwarn').classList.remove('show');
    renderCascade(); renderAssetInfo(); renderBOM(); toggleInfoSections();
    renderRows(); persistLocal(); toast('Saved '+savedNo+' — add the next under '+(parent||'—'));
    setTimeout(()=>$('#inpTag').focus(),40);
    return;
  }
  closeModal(); renderRows(); persistLocal(); toast(wasEdit?'Asset updated':('Asset added · '+savedNo));
}

/* ===========================================================
   Per-row compute
=========================================================== */

/* ===========================================================
   Rows table
=========================================================== */
function taxPathHtml(levels){
  if(!levels.length) return '<span class="muted">—</span>';
  const parts = levels.map((v,i)=>{ const label = NODES[v]?descOf(v):v+' ⚠';
    return i===levels.length-1 ? `<span class="leaf">${esc(label)}</span>` : esc(label); });
  return `<div class="tax-path">${parts.join(' <span class="muted">›</span> ')}</div>`;
}
/* ---------- flat mode: generic record form + table (ISO engine bypassed) ---------- */
let FLAT_EDIT = null;   // { index, values }
let ISO_THEAD = null;   // original ISO table header, restored when leaving flat mode

function openFlatAdd(index){
  const cols = ACTIVE.columns.filter(c => c.include);
  FLAT_EDIT = { index: index == null ? -1 : index, values: index == null ? {} : Object.assign({}, rows[index].values) };
  $('#flatAddTitle').textContent = index == null ? 'Add record' : 'Edit record';
  $('#flatAddFields').innerHTML = cols.map(c =>
    '<div class="field"><label>' + esc(c.header) + (c.required ? ' <span class="req">*</span>' : '') + '</label>'+
    '<input class="text flat-in" data-k="' + esc(c.key) + '" value="' + esc(FLAT_EDIT.values[c.key] || '') + '" autocomplete="off"></div>').join('');
  $('#flatAddWarn').classList.remove('show');
  $('#flatAddBg').classList.add('open');
  setTimeout(()=>{ const f=$('#flatAddFields .flat-in'); if(f) f.focus(); },60);
}
function closeFlatAdd(){ $('#flatAddBg').classList.remove('open'); FLAT_EDIT = null; }
function saveFlatRow(){
  const vals = {};
  $('#flatAddFields').querySelectorAll('.flat-in').forEach(el => { vals[el.getAttribute('data-k')] = el.value; });
  const missing = ACTIVE.columns.filter(c => c.include && c.required && !(vals[c.key] || '').trim());
  const warn = $('#flatAddWarn');
  if(missing.length){ warn.innerHTML = 'Missing required: ' + missing.map(c => esc(c.header)).join(', ') + ' (saved anyway).'; warn.classList.add('show'); }
  if(FLAT_EDIT.index >= 0) rows[FLAT_EDIT.index].values = vals;
  else rows.push({ id: 'f' + Date.now().toString(36) + rows.length, values: vals });
  applyProfileUI(); persistLocal(); closeFlatAdd(); toast('Record saved');
}
function flatMissingRequired(r){
  return ACTIVE.columns.filter(c => c.include && c.required && !((r.values && r.values[c.key]) || '').trim()).length;
}
function renderFlatRows(){
  const cols = ACTIVE.columns.filter(c => c.include);
  const head = '<tr><th style="width:30px">#</th>' + cols.map(c => '<th>' + esc(c.header) + '</th>').join('') + '<th style="width:96px"></th></tr>';
  const body = rows.map((r, i) =>
    '<tr class="rowitem"><td class="muted">' + (i + 1) + '</td>' + cols.map(c => '<td>' + esc((r.values && r.values[c.key]) || '') + '</td>').join('') +
    '<td><div class="rowact"><button class="btn sm flat-edit" data-i="' + i + '">Edit</button> <button class="btn sm danger flat-del" data-i="' + i + '">✕</button></div></td></tr>').join('');
  document.querySelector('.rows thead').innerHTML = head;
  $('#rowsBody').innerHTML = body;
  $('#emptyState').style.display = rows.length ? 'none' : 'block';
  $('#rowCount').innerHTML = rows.length ? ('<b>' + rows.length + '</b> record' + (rows.length !== 1 ? 's' : '')) : 'No records yet';
}

function renderRows(){
  const thead = document.querySelector('.rows thead');
  if(ISO_THEAD == null) ISO_THEAD = thead.innerHTML;
  if(ACTIVE.mode === 'flat'){ const wz=$('#structWizard'); if(wz) wz.style.display='none'; refreshAddBtn(); return renderFlatRows(); }
  if(thead.innerHTML !== ISO_THEAD) thead.innerHTML = ISO_THEAD;
  // reconcile the site dropdown (buildSites, inside updateWizard) BEFORE scoping the table:
  // if the selected site was just deleted, #selSite resets to "All sites" first so renderIsoRows
  // scopes to the reconciled value instead of the vanished one (edge fix 2026-07-07).
  updateWizard();
  renderIsoRows();
}
function renderIsoRows(){
  syncSession();
  const body=$('#rowsBody'), q=($('#rowSearch').value||'').toLowerCase(), issuesOnly=$('#chkIssuesOnly').checked;
  // Site scope + hierarchical order (design 2026-07-07): rows display cascading from LVL 1
  // (children under their parent, whatever order they were entered) and only the selected
  // site's subtree — plus its company ancestors — is shown. Chains span session rows AND
  // register assets, so rows parented into the register scope correctly.
  const noOf = r => r.assetNo || proposedAssetNo(r) || '';
  const sessParent = new Map(); rows.forEach(r=>{ const n=noOf(r); if(n && !sessParent.has(n)) sessParent.set(n, r.parent||''); });
  const parentOf = n => sessParent.has(n) ? sessParent.get(n) : ((ASSET_BY_NO.get(n)||{}).parent || '');
  const site = currentSite(); const siteNo = site ? site.name : '';
  const order = hierarchyOrder(rows.map(r=>({no:noOf(r), parent:r.parent||''})));
  const items = order.map(i=>({r:rows[i],i})).filter(({r})=>{
    if(!inSiteScope({no:noOf(r), parent:r.parent||''}, siteNo, parentOf)) return false;
    if(issuesOnly && !computeForRow(r).hasIssue) return false;
    if(!q) return true;
    const hay=[r.tag,r.desc,r.parent,r.classification,proposedAssetNo(r),...(r.levels||[]).map(descOf)].join(' ').toLowerCase();
    return hay.includes(q);
  });
  body.innerHTML = items.map(({r,i},n)=>{
    const cf=computeForRow(r);
    const dot = cf.hasHigh ? '<span class="dot" title="has blocking rule issues"></span>' : (cf.hasIssue?'<span class="dot" style="background:var(--amber)" title="has warnings"></span>':'');
    return `<tr class="rowitem">
      <td class="muted">${n+1}</td>
      <td><span class="pill ${esc(r.action)}">${esc((r.action||'add').toUpperCase())}</span></td>
      <td><span class="assetno">${esc(cf.assetNo)||'<span class="muted">—</span>'}</span></td>
      <td>${taxPathHtml(r.levels||[])}</td>
      <td><b>${esc(r.tag)||'<span class="muted">—</span>'}</b>${r.desc?`<div class="hint">${esc(r.desc)}</div>`:''}</td>
      <td class="classcell">${dot}${esc(cf.cls)}</td>
      <td class="codecell">${esc(r.parent)||'<span class="muted">—</span>'}</td>
      <td><div class="rowact">
        <button class="btn sm" data-edit="${i}">Edit</button>
        <button class="btn sm danger" data-del="${i}">✕</button>
      </div></td>
    </tr>`;
  }).join('');
  let badge='';
  if(rows.length){ let high=0,warn=0; rows.forEach(r=>{const cf=computeForRow(r); if(cf.hasHigh)high++; else if(cf.hasIssue)warn++;});
    if(high) badge=` · <span style="color:var(--red)">${high} to fix</span>`; else if(warn) badge=` · <span style="color:var(--amber)">${warn} warning${warn>1?'s':''}</span>`; else badge=` · <span style="color:var(--green)">all clear</span>`; }
  $('#rowCount').innerHTML = rows.length ? `<b>${rows.length}</b> asset${rows.length>1?'s':''}`+badge+(items.length!==rows.length?` · ${items.length} shown`:'') : 'No assets yet';
}

/* ===========================================================
   CSV export / import / blank template
=========================================================== */
function download(name, text, mime){
  const blob=new Blob([text],{type:mime||'text/plain'}), url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1500);
}
// req #4 — free-text export file name: a non-empty PROJECT.exportName overrides the auto-generated base
function exportNameOverride(){ return (PROJECT.exportName||'').trim(); }
function currentExportBase(){ const o=exportNameOverride(); return o ? sanitizeFileName(o) : exportFileBase(); }
function exportCSV(){
  syncSession();
  if(!rows.length){toast('Add at least one asset first');return;}
  if(!isDefaultIso()){
    // custom/flat profiles export client-side from the active profile; the built-in
    // ISO profile keeps the byte-identical server-side export below
    if(ACTIVE.mode === 'flat'){
      const short = rows.filter(r => flatMissingRequired(r) > 0).length;
      if(short && !confirm('Export with ' + short + ' record(s) missing required fields?')) return;
    }
    const csv = ERP.buildProfileCSV(ACTIVE, { rows, buildCSV });
    download(currentExportBase() + '.csv', csv, 'text/csv;charset=utf-8');
    toast('Exported “' + ACTIVE.name + '” to CSV');
    return;
  }
  // Use the SAME issue set as the table indicator + modal Save gate (includes §LVL Level-4 and §3.10 master/cross-row dup checks)
  let blocking=0, warnN=0;
  for(const r of rows){
    computeForRow(r).issues.forEach(i=>{ if(i.severity==='high') blocking++; else warnN++; });
  }
  BOM_EXISTING.forEach(e=>{ bomStockIssues(e.bom).forEach(()=>blocking++); });
  if(blocking){ toast(blocking+' blocking issue(s) — tick “Issues only” and fix the flagged rows before export'); return; }
  if(warnN){ if(!confirm('Export with '+warnN+' warning(s)?')) return; }
  const anyBom = rows.some(r=>isItemRow(r) && r.bom && r.bom.length) || BOM_EXISTING.some(e=>e.bom && e.bom.length);
  const tail=rows.length+' asset'+(rows.length>1?'s':'')+(anyBom?' + BOM':'')+(NEW_TAX.length?' + '+NEW_TAX.length+' new taxonomy':'');
  // storage seam: the server assembles the CSVs (and adds the UTF-8 BOM); sequential navigations with small delays
  const nameQ = exportNameOverride() ? ('?name='+encodeURIComponent(exportNameOverride())) : '';
  window.location = '/api/export/onboarding.csv'+nameQ;
  let delay=800;
  if(anyBom){ setTimeout(()=>{ window.location = '/api/export/bom.csv'+nameQ; }, delay); delay+=800; }
  if(NEW_TAX.length){ setTimeout(()=>{ window.location = '/api/export/taxonomy.csv'+nameQ; }, delay); }
  toast('Exported '+tail+' to CSV');
}
function downloadTemplate(){
  if(!isDefaultIso()){
    // custom/flat profiles: template = the profile's included headers + one empty guide row
    const headers = ERP.templateHeaders(ACTIVE);
    const csv = headers.map(csvCell).join(',') + '\r\n' + headers.map(()=> '').join(',');
    download(sanitizeFileName(ACTIVE.name || 'Asset Onboarding') + ' TEMPLATE.csv', '﻿'+csv, 'text/csv;charset=utf-8');
    showBanner('Blank template for “'+esc(ACTIVE.name)+'” downloaded. Fill it in, then Import CSV.');
    toast('Blank CSV template downloaded');
    return;
  }
  const guide = ['', 'TRUE','FALSE','FALSE',
    '<OUTLOAD>', '*FIXED PLANT - *SHIPLOADER [PRIMARY]', '', '', '', '', '', '', '', '', '',
    'EXAMPLE — delete this row', 'free text', '', '', '', '', '', '', '', ''];
  const csv = CSV_HEADERS.map(csvCell).join(',') + '\r\n' + guide.map(csvCell).join(',');
  download('Asset Onboarding TEMPLATE.csv', '﻿'+csv, 'text/csv;charset=utf-8');
  showBanner('Blank template downloaded. Fill the input columns (LEVEL 3–13 use exact taxonomy values, or leave blank and set them in-app after importing). CLASSIFICATION / ABBREVIATION / NUMBER / ASSET NO auto-fill if left blank. Delete the EXAMPLE row before importing.');
  toast('Blank CSV template downloaded');
}
function importCSV(text){ importGrid(ERP.parseCSV(text).filter(r=>r.some(c=>(c||'').trim()!==''))); }
function importGrid(grid){
  syncSession();
  if(!grid || grid.length<2){ toast('CSV has no data rows'); return; }
  const hdr = grid[0].map(h=>(h||'').trim().toUpperCase());
  const H = name => hdr.indexOf(name.toUpperCase());
  const idxLevel = []; for(let n=3;n<=13;n++) idxLevel.push(H('LEVEL '+n));
  const get = (c,name)=>{ const i=H(name); return i>=0 ? (c[i]||'').trim() : ''; };
  if(H('ASSET / TAG NAME')<0 && idxLevel.every(i=>i<0)){ toast('Unrecognised CSV — use the Blank CSV template'); return; }
  const imported=[]; let skipped=0;
  for(let r=1;r<grid.length;r++){
    const c=grid[r];
    const tag=get(c,'ASSET / TAG NAME');
    const levels=[]; for(const li of idxLevel){ if(li>=0){ const v=(c[li]||'').trim(); if(v) levels.push(v); } }
    const parent=get(c,'SELECT PARENT ASSET');
    if(/^EXAMPLE/i.test(tag)) { skipped++; continue; }
    if(!tag && !levels.length && !parent){ skipped++; continue; }
    const upd=get(c,'UPDATE ASSET?'), ret=get(c,'RETIRE ASSET?');
    let action='add'; if(/^true$/i.test(upd)) action='update'; else if(/^true$/i.test(ret)) action='retire';
    const row=blankAsset();
    row.action=action; row.parent=parent||null; row.levels=levels;
    row.tag=tag; row.desc=get(c,'SPECIFIC ASSET DESCRIPTION');
    row.dept=get(c,'MAINTAINING DEPARTMENT - OVERRIDE')||null;
    row.loc=get(c,'INTERNAL LOCATION CODE - OVERRIDE')||null;
    row.assetType=get(c,'ASSET TYPE')||null; row.duty=get(c,'DUTY')||null;
    const numRaw=get(c,'NUMBER');
    const autoNum=RULES.resolveNumber(Object.assign(engineInput(row),{number:''}))||'';
    row.number = (numRaw && numRaw!==autoNum) ? numRaw : null;
    const clsRaw=get(c,'CLASSIFICATION');
    const clsMatch=VALID_CLS.find(x=>x.toUpperCase()===clsRaw.toUpperCase());
    const woRaw=get(c,'WORK-ORDERABLE');
    if(/^true$/i.test(woRaw)) row.workOrderable=true; else if(/^false$/i.test(woRaw)) row.workOrderable=false;
    const derivedCls=RULES.classify(engineInput(row));
    row.classOverride = (clsMatch && clsMatch!==derivedCls) ? clsMatch : null;
    const abbrRaw=get(c,'ABBREVIATION');
    const derivedAbbr=RULES.buildAbbreviation(assetTypeOf(row), row.duty, new Set());
    row.abbrOverride = (abbrRaw && abbrRaw.toUpperCase()!==derivedAbbr.toUpperCase()) ? abbrRaw : null;
    imported.push(row);
  }
  if(!imported.length){ toast('No data rows found to import'); return; }
  let removedRows=[];
  if(rows.length){
    const replace = confirm('Replace the current '+rows.length+' row(s) with the '+imported.length+' imported row(s)?\n\nOK = replace · Cancel = append.');
    if(replace) removedRows = rows.filter(r=>r.id!=null);
    rows = replace ? imported : rows.concat(imported);
  } else { rows = imported; }
  syncSession();
  // persist each add row's computed asset no so cross-row duplicate detection can see imported siblings
  rows.forEach(r=>{ if(r.action==='add' && !r.assetNo) r.assetNo=proposedAssetNo(r); });
  // §structure — imported rows landing at levels 1–3 take the forced role classification
  rows.forEach(r=>{ if(r.action==='add'){ const lvl=rowStructLevel(r); if(lvl<=3){ r.classification=roleOfLevel(lvl); r.classOverride=null; } } });
  syncImportedRows(imported, removedRows);   // storage seam: push imports to the server (async)
  if(grid.length>1){ const d=grid[1], gp=(name)=>{ const i=H(name); return i>=0?(d[i]||'').trim():''; };
    if(!PROJECT.number && gp('PROJECT NUMBER')) PROJECT.number=gp('PROJECT NUMBER');
    if(!PROJECT.pm && gp('PROJECT MANAGER')) PROJECT.pm=gp('PROJECT MANAGER');
    if(!PROJECT.start && gp('PROJECT START DATE')) PROJECT.start=gp('PROJECT START DATE');
    if(!PROJECT.end && gp('PROJECT EXPECTED COMPLETION DATE')) PROJECT.end=gp('PROJECT EXPECTED COMPLETION DATE');
    fillProjectInputs(); persistProject(); }
  renderRows(); persistLocal();
  let high=0,warn=0; rows.forEach(r=>{const cf=computeForRow(r); if(cf.hasHigh)high++; else if(cf.hasIssue)warn++;});
  if(high) showBanner('Imported '+imported.length+' row(s)'+(skipped?' ('+skipped+' skipped)':'')+'. <b>'+high+' need fixing</b> before export — tick “Issues only”, open each flagged row, and correct it.', true);
  else if(warn) showBanner('Imported '+imported.length+' row(s). '+warn+' have warnings — review the flagged rows.', true);
  else showBanner('Imported '+imported.length+' row(s) — no blocking issues. Review and export when ready.');
  toast('Imported '+imported.length+' asset row(s)');
}
// storage seam: imported rows must reach the server (exports are built server-side).
// DELETE any replaced server rows first, then POST imports in order (insertion order = sequence invariant R4).
async function syncImportedRows(imported, removedRows, errMsg){
  try{
    for(const r of (removedRows||[])){ if(r.id!=null) await fetch('/api/rows/'+r.id,{method:'DELETE'}); }
    for(const r of imported){
      const res=await fetch('/api/rows',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(Object.assign({}, r, {project: PROJECT}))});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const saved=(await res.json()).row;
      const k=rows.indexOf(r); if(k>=0) rows[k]=saved;
    }
    syncSession(); renderRows();
  }catch(e){ toast(errMsg||'Imported rows could not all be saved to the server — unsaved rows will be missing from exports'); }
}

/* ===========================================================
   Draft + local autosave + data refresh (file + live URL)
=========================================================== */
function persistLocal(){ syncSession(); scheduleAutosave(); }   // storage seam: debounced server autosave replaces browser storage
/* ---------- project header (PM, number, start/completion dates) — also drives the export file name ---------- */
let PROJECT = {pm:'', number:'', start:'', end:'', exportName:''};
function fillProjectInputs(){ const m={pmName:'pm',pmNumber:'number',pmStart:'start',pmEnd:'end',exportNameInput:'exportName'}; for(const id in m){ const el=$('#'+id); if(el) el.value=PROJECT[m[id]]||''; } }
function persistProject(){ syncSession(); scheduleAutosave(); updateExportNameHint(); }
/* ---------- all generated dates/times use Perth (AWST, UTC+8), not the machine clock or UTC ---------- */
// req #4 — the field is now an editable override; show the auto-generated name as its placeholder
function updateExportNameHint(){ const el=$('#exportNameInput'); if(el) el.placeholder=exportFileBase()+'.csv'; }
async function newProject(){
  if(rows.length && !confirm('Start a new project? Your current '+rows.length+' row(s) will be cleared.\n\n(Your current work is auto-saved as a draft first.)')) return;
  // park the outgoing project as a named draft, then detach the autosave slot so the fresh workspace can't reap it
  try{ if(!workspacePristine()) await saveDraft(); }catch(_){}
  resetAutosaveSlot();
  const prevServerRows=rows.filter(r=>r.id!=null);
  rows=[]; BOM_EXISTING=[]; NEW_TAX=[]; PROJECT={pm:'',number:'',start:'',end:'',exportName:''};   // keep the active ERP profile
  syncSession(); reapplyOverrides(); fillProjectInputs(); updateExportNameHint(); applyProfileUI(); persistLocal(); persistProject();
  // server-side exports read server rows, so the cleared rows must be removed there too
  syncImportedRows([], prevServerRows, 'Old rows could not all be removed from the server — they may still appear in exports');
  toast('New project started');
}
async function saveDraft(){
  syncSession();
  if(workspacePristine()){ toast('Nothing to save yet'); return; }
  const name=draftFileName(PROJECT);
  try{
    const res=await fetch('/api/drafts',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:name, project:Object.assign({}, PROJECT, {profileId: ACTIVE.id}), rows:rows, bomExisting:BOM_EXISTING, newTax:NEW_TAX})});
    if(!res.ok) throw new Error('HTTP '+res.status);
    await res.json();
    toast('Draft saved — '+name);
  }catch(e){ toast('Draft save failed — server unreachable'); }
}
async function loadDraftObj(o){ if(!o) return;
  // park the outgoing project in its own autosave slot before it is replaced, then detach the slot
  try{ if(!workspacePristine()) await autosaveNow(); }catch(_){}
  resetAutosaveSlot();
  const prevServerRows=rows.filter(r=>r.id!=null); rows=(o&&o.rows)||[]; BOM_EXISTING=(o&&o.bomExisting)||[]; PROJECT=Object.assign({pm:'',number:'',start:'',end:'',exportName:''}, (o&&o.project)||{}); NEW_TAX=(o&&o.newTax)||[];
  // restore the draft's ERP profile (profileId rides inside project_json — server schema unchanged)
  const pid=(o&&o.profileId)||(o&&o.project&&o.project.profileId)||null;
  delete PROJECT.profileId;
  if(pid && pid!==ACTIVE.id){
    const p=ERP.listProfiles().find(x=>x.id===pid);
    if(p){ ACTIVE=p; ERP.setActive(p.id); }
    else showBanner('This draft was made with an ERP profile that is not in this browser — using “'+esc(ACTIVE.name)+'” instead.', true);
  }
  syncSession(); reapplyOverrides(); fillProjectInputs(); updateExportNameHint(); applyProfileUI(); persistLocal(); persistProject();
  // storage seam: exports are server-built, so a loaded draft must also replace the server rows
  syncImportedRows(rows, prevServerRows, 'Draft rows could not all be saved to the server — unsaved rows will be missing from exports');
  toast('Draft loaded — '+rows.length+' asset'+(rows.length!==1?'s':'')); }
function loadDraftFile(file){ const r=new FileReader(); r.onload=()=>{ try{ const o=JSON.parse(r.result); loadDraftObj((o&&o.rows)?o:{rows:(Array.isArray(o)?o:[]), project:{}}); }catch(e){ toast('Could not read draft file'); } }; r.readAsText(file); }
async function openDrafts(){ const list=$('#draftsList'); if(!list) return;
  let arr=[];
  try{ arr=((await (await fetch('/api/drafts')).json()).drafts)||[]; }
  catch(e){ toast('Could not load drafts — server unreachable'); }
  if(!arr.length){ list.innerHTML='<div class="hint">No saved drafts yet. A draft is saved automatically while you work, or when you click <b>Save draft</b>.</div>'; }
  else { list.innerHTML=arr.map(o=>
    '<div class="draftrow">'+
      '<button class="btn ghost draft-open" data-draft-id="'+esc(String(o.id))+'">'+esc(o.name||'draft')+' · '+esc(String(o.ts||'').slice(0,16).replace('T',' '))+'</button>'+
      '<button class="btn ghost danger sm draft-del" data-draft-del="'+esc(String(o.id))+'" title="Delete this draft" aria-label="Delete draft">✕</button>'+
    '</div>').join(''); }
  $('#draftsBg').classList.add('open'); }
function closeDrafts(){ const b=$('#draftsBg'); if(b) b.classList.remove('open'); }

/* ---------- debounced server autosave (replaces the browser-storage autosave) ---------- */
let AUTOSAVE_ID=null, AUTOSAVE_T=null, AUTOSAVE_EPOCH=0;
function scheduleAutosave(){ clearTimeout(AUTOSAVE_T); AUTOSAVE_T=setTimeout(autosaveNow, 2000); }
/* pristine = nothing worth saving: no rows/BOM/session taxonomy and a blank project header */
function workspacePristine(){ return !rows.length && !BOM_EXISTING.length && !NEW_TAX.length && !(PROJECT.pm||PROJECT.number||PROJECT.start||PROJECT.end||PROJECT.exportName); }
/* one autosave slot per project — the server upserts drafts by (user, name) */
function autosaveSlotName(){ return PROJECT.number ? 'autosave — '+PROJECT.number : 'autosave'; }
/* detach the slot when the workspace switches projects (New / draft load) so the incoming
   project can never reap the outgoing project's slot; the epoch voids in-flight saves */
function resetAutosaveSlot(){ clearTimeout(AUTOSAVE_T); AUTOSAVE_ID=null; AUTOSAVE_EPOCH++; }
async function autosaveNow(){
  syncSession();
  const epoch=AUTOSAVE_EPOCH;
  try{
    if(workspacePristine()){
      // never save an empty workspace; reap the slot if the workspace was emptied after having content
      if(AUTOSAVE_ID!=null){ const prev=AUTOSAVE_ID; AUTOSAVE_ID=null; fetch('/api/drafts/'+prev,{method:'DELETE'}).catch(()=>{}); }
      return;
    }
    const res=await fetch('/api/drafts',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:autosaveSlotName(), project:Object.assign({}, PROJECT, {profileId: ACTIVE.id}), rows:rows, bomExisting:BOM_EXISTING, newTax:NEW_TAX})});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const o=await res.json();
    if(epoch!==AUTOSAVE_EPOCH) return;   // workspace switched while this save was in flight — its slot id is stale
    const prev=AUTOSAVE_ID; AUTOSAVE_ID=o.id;
    // server upserts by (user,name); this delete only matters when the slot NAME changed (project number typed mid-session)
    if(prev!=null && prev!==AUTOSAVE_ID) fetch('/api/drafts/'+prev,{method:'DELETE'}).catch(()=>{});
  }catch(e){ /* autosave is best-effort; explicit Save draft surfaces errors */ }
}
function readCsvFile(file){ const r=new FileReader(); r.onload=()=>{ try{
  const grid=ERP.parseCSV(r.result).filter(row=>row.some(c=>(c||'').trim()!==''));
  if(grid.length<2){ toast('CSV has no data rows'); return; }
  const { map, allSaved, allExact } = ERP.autoGuess(grid[0], ACTIVE);
  // straight through when every header is already saved or resolved exactly (the
  // app's own template / a re-imported file never shows the modal)
  if(allSaved || allExact){ applyImport(grid, map); return; }
  openMapModal(grid, map, file.name);
}catch(e){ toast('Could not read CSV: '+e.message); } }; r.readAsText(file); }

function applyImport(grid, map){
  ERP.saveImportMap(ACTIVE, map);
  if(ACTIVE.mode==='flat'){
    const newRows=ERP.remapFlatRows(grid, map, ACTIVE);
    if(!newRows.length){ toast('No data rows found to import'); return; }
    rows=rows.concat(newRows);
    applyProfileUI(); persistLocal();
    toast('Imported '+newRows.length+' row(s)');
  } else {
    importGrid(ERP.remapGrid(grid, map));
  }
}

function openMapModal(grid, guess, fname){
  const headers=grid[0];
  const cat=ERP.catalogue(ACTIVE);
  const optionsFor=sel=>'<option value="">— Ignore —</option>'+
    cat.map(c=>'<option value="'+esc(c.id)+'"'+(c.id===sel?' selected':'')+'>'+esc(c.label)+'</option>').join('');
  $('#erpMapRows').innerHTML=headers.map((h,i)=>
    '<div class="erpmaprow" data-h="'+esc(h)+'">'+
      '<div class="erpmaphdr"><b>'+esc(h)+'</b><span class="hint">'+esc((grid[1]&&grid[1][i])||'')+'</span></div>'+
      '<select class="native erp-target">'+optionsFor(guess[h]||'')+'</select>'+
    '</div>').join('');
  $('#erpMapBg').__grid=grid;
  $('#erpMapBg').__fname=fname||'';
  $('#erpMapBg').classList.add('open');
}
function closeMapModal(){ $('#erpMapBg').classList.remove('open'); $('#erpMapBg').__grid=null; $('#erpMapBg').__fname=null; }
// "Adopt this file's format": turn the loaded CSV's own headers into a new flat profile, make it
// active, and load the file's rows as flat records. New records + exports then match the file exactly.
function adoptCsvFormat(){
  const grid=$('#erpMapBg').__grid;
  if(!grid || !grid[0] || !grid[0].length){ toast('No CSV to adopt'); return; }
  const fname=$('#erpMapBg').__fname||'';
  const baseName=fname.replace(/\.[^.]+$/,'').trim() || 'Imported format';
  const profile=ERP.profileFromHeaders(grid[0], baseName);
  const newRows=ERP.flatRowsFromGrid(grid, profile);
  if(rows.length && !confirm('Adopt “'+baseName+'” as the active format and replace the current '+rows.length+' row(s) with '+newRows.length+' row(s) from the file?\n\nOK = adopt & replace · Cancel = keep current format')) return;
  ERP.saveProfile(profile); ACTIVE=profile; ERP.setActive(profile.id);
  rows=newRows;
  closeMapModal(); syncSession(); applyProfileUI(); persistLocal();
  showBanner('Adopted “'+esc(baseName)+'” as the active format — '+profile.columns.length+' column(s), '+newRows.length+' record(s) imported. New records and exports now use this exact format.');
  toast('Format adopted: '+baseName);
}

/* ---------- admin: register CSV import (file picker) + dataset refresh ---------- */
async function refreshBootstrap(){
  const b = await (await fetch('/api/bootstrap')).json();
  initData(b.dataset);
  reapplyOverrides();
  if(cmbDept){cmbDept.setOptions(()=>deptOptions());} if(cmbLoc){cmbLoc.setOptions(()=>locOptions());}
  if(cmbParent){cmbParent.setOptions(()=>assetOptions());}
  buildSites(); refreshAddBtn(); renderRows();
}
// Update register = pick an onboarding-export CSV, then merge its new assets into the
// register (mirrors importTaxonomy → #fileTaxonomy). The picker is wired to importRegisterFile.
function updateRegister(){ if(!IS_ADMIN){ toast('Admin sign-in required to update the register'); return; } $('#fileRegister').click(); }
async function importRegisterFile(file){
  if(!IS_ADMIN){ toast('Admin sign-in required to update the register'); return; }
  let text; try{ text=await file.text(); }catch(e){ toast('Could not read the register CSV'); return; }
  if(!confirm('Import assets from “'+file.name+'” into the register?\n\nNew asset numbers are added; ones already in the register are skipped. (The taxonomy is unaffected.)')) return;
  try{
    const res=await fetch('/api/admin/register-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv:text})});
    const o=await res.json().catch(()=>({}));
    if(!res.ok){ const errs=(o&&o.errors)||['Import failed (HTTP '+res.status+')']; showBanner('Register import rejected — '+errs.slice(0,8).map(esc).join(' · ')+(errs.length>8?' · +'+(errs.length-8)+' more':''), true); return; }
    await refreshBootstrap();
    hideBanner();
    updateDsInfo('register +'+o.added+' · '+perthDateTime());
    if(o.added) toast('Register updated (+'+o.added+' asset'+(o.added>1?'s':'')+(o.skipped?', '+o.skipped+' skipped':'')+')');
    else toast('No new assets to add'+(o.skipped?' — '+o.skipped+' already in the register':''));
  }catch(e){ toast('Register import failed — server unreachable'); }
}

/* ---------- admin: taxonomy CSV import / export (full-replace the classification tree) ---------- */
async function importTaxonomyFile(file){
  if(!IS_ADMIN){ toast('Admin sign-in required to import a taxonomy'); return; }
  let text; try{ text=await file.text(); }catch(e){ toast('Could not read the taxonomy CSV'); return; }
  if(!confirm('Replace the ENTIRE classification taxonomy with “'+file.name+'”?\n\nThis replaces the taxonomy for all users. The current taxonomy is overwritten (the asset register is unaffected).')) return;
  try{
    const res=await fetch('/api/admin/taxonomy-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv:text})});
    const o=await res.json().catch(()=>({}));
    if(!res.ok){ const errs=(o&&o.errors)||['Import failed (HTTP '+res.status+')']; showBanner('Taxonomy import rejected — '+errs.slice(0,8).map(esc).join(' · ')+(errs.length>8?' · +'+(errs.length-8)+' more':''), true); return; }
    await refreshBootstrap();
    hideBanner();
    toast('Taxonomy replaced ('+(o.stats?o.stats.nodes:'?')+' nodes, '+(o.stats?o.stats.roots:'?')+' roots)');
  }catch(e){ toast('Taxonomy import failed — server unreachable'); }
}
function importTaxonomy(){ if(!IS_ADMIN){ toast('Admin sign-in required to import a taxonomy'); return; } $('#fileTaxonomy').click(); }
function downloadTaxonomy(){ if(!IS_ADMIN){ toast('Admin sign-in required'); return; } window.location='/api/admin/taxonomy.csv'; }

/* ---------- admin visibility = server-authenticated role (replaces the SHA-256 password gate) ---------- */
function applyAdminUI(){ const DEAD=new Set(['btnSettings','btnImportData','btnFolder']); /* features replaced by the server — permanently hidden */ document.querySelectorAll('.admin-only').forEach(el=>{ const isoOnly=el.classList.contains('iso-only'); const modeOk=!isoOnly || (typeof ACTIVE!=='undefined' && ACTIVE && ACTIVE.mode!=='flat'); el.style.display = (IS_ADMIN && !DEAD.has(el.id) && modeOk) ? 'inline-flex' : 'none'; }); const b=$('#btnAdmin'); if(b) b.style.display='none'; }

/* ===========================================================
   Site context — level-2 register/session entries (under a company) act as sites
=========================================================== */
function buildSites(){
  const sel=$('#selSite'); const cur=sel.value;
  syncSession();
  // sites = every level-2 entry (register OR session). A level-2 row under a company IS a
  // site by definition — childless sites (no asset class yet) must still appear here.
  const tops=wizardEntriesAtLevel(2);
  sel.innerHTML='<option value="">All sites</option>'+tops.map(s=>`<option value="${esc(s.no)}">${esc(s.desc||s.no)}</option>`).join('');
  if(cur && tops.some(t=>t.no===cur)) sel.value=cur;
}
function currentSite(){ const n=$('#selSite').value; if(!n) return null; const a=ASSET_BY_NO.get(n)||{}; return {name:n, desc:a.desc||''}; }
function refreshAddBtn(){
  const ok=structureOk();
  const gate='Complete the register structure first (Company ▸ Site ▸ Asset Class)';
  const b=$('#btnAdd'); b.disabled=!ok; b.title=ok?'Add a new asset':gate;
  const b2=$('#btnBomEx'); if(b2){ b2.disabled=!ok; b2.title=ok?'Attach BOM items to an existing asset':gate; }
}
function updateDsInfo(extra){ $('#dsInfo').textContent = `${Object.keys(NODES).length} taxonomy · ${ASSETS.length} assets`+(extra?` · ${extra}`:''); }

/* ===========================================================
   Register structure wizard — Company ▸ Site ▸ Asset Class bootstrap + gating
=========================================================== */
let WIZ_OPEN=false;
const WIZ={co:'', site:''};   // step 2/3 selections, kept across re-renders
function structureOk(){
  if(ACTIVE.mode==='flat') return true;   // flat profiles carry no hierarchy to bootstrap
  syncSession();
  return structureComplete(e => e.no ? assetLevel(e.no) : rowStructLevel(e),
    ASSETS.concat(rows.filter(r=>r.action==='add')));
}
function wizardEntriesAtLevel(lvl){
  const out=ASSETS.filter(a=>assetLevel(a.no)===lvl).map(a=>({no:a.no, desc:a.desc||a.no}));
  rows.forEach(r=>{ if(r.action==='add' && rowStructLevel(r)===lvl){ const no=r.assetNo||r.tag; if(no && !out.some(o=>o.no===no)) out.push({no:no, desc:r.desc||proposedAssetDesc(r)||no}); } });
  return out;
}
// auto number for wizard rows: code suggested from the name, uniquified against the register,
// taken numbers and in-session rows via the shared noTaken (the leaf becomes the tag segment)
function wizardUniqueNo(prefix, name, fallback){
  const base=suggestCode(name)||fallback;
  const full=t=>prefix?prefix+'-'+t:t;
  if(!noTaken(full(base), null)) return base;
  let n=1; while(noTaken(full(base+String(n).padStart(2,'0')), null) && n<999) n++;
  return base+String(n).padStart(2,'0');
}
// wizard rows are ordinary onboarding rows — same storage seam as saveRow (server row is authoritative)
async function wizardPostRow(row, okMsg){
  syncSession();
  row.assetNo=proposedAssetNo(row); row.assetName=proposedAssetDesc(row);
  const sRole=structRoleOf(row); if(sRole) row.classification=sRole;
  try{
    const res=await fetch('/api/rows',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(Object.assign({}, row, {project: PROJECT}))});
    if(!res.ok) throw new Error('HTTP '+res.status);
    rows.push((await res.json()).row);
  }catch(err){ toast('Save failed — server unreachable'); return null; }
  syncSession();
  const saved=rows[rows.length-1];
  renderRows(); persistLocal();
  if(okMsg) toast(okMsg+' · '+(saved.assetNo||saved.tag));
  return saved;
}
async function wizAddCompany(){
  const name=(($('#wizCoName')||{}).value||'').trim();
  if(!name){ toast('Enter a company name'); return; }
  const row=blankAsset(); row.desc=name; row.tag=wizardUniqueNo('', name, 'CO');
  const saved=await wizardPostRow(row, 'Company created');
  if(saved) WIZ.co=saved.assetNo||saved.tag;
}
async function wizAddSite(){
  const co=(($('#wizSiteCo')||{}).value||''); if(!co){ toast('Choose a company first'); return; }
  const name=(($('#wizSiteName')||{}).value||'').trim();
  if(!name){ toast('Enter a site name'); return; }
  const row=blankAsset(); row.parent=co; row.desc=name; row.tag=wizardUniqueNo(co, name, 'SITE');
  WIZ.co=co;
  const saved=await wizardPostRow(row, 'Site created');
  if(saved) WIZ.site=saved.assetNo||saved.tag;
}
async function wizAddClass(){
  const site=(($('#wizClsSite')||{}).value||''); if(!site){ toast('Choose a site first'); return; }
  const tax=(($('#wizClsTax')||{}).value||''), free=(($('#wizClsName')||{}).value||'').trim();
  if(!tax && !free){ toast('Pick an asset class or type one'); return; }
  const row=blankAsset(); row.parent=site;
  if(free){ row.desc=free; row.tag=wizardUniqueNo(site, free, 'AC'); }              // free text overrides the dropdown
  else { row.levels=[tax]; if(!levelCode(tax)) row.tag=wizardUniqueNo(site, cleanName(tax), 'AC'); }
  const no=proposedAssetNo(row);
  if(no && noTaken(no, null)){ toast('“'+(free||cleanName(tax))+'” already exists under this site'); return; }
  WIZ.site=site;
  await wizardPostRow(row, 'Asset class added');
}
function wizTreeHtml(){
  const kidsOf=no=>{
    const out=ASSETS.filter(a=>a.parent===no).map(a=>({no:a.no, desc:a.desc||''}));
    rows.forEach(r=>{ if(r.action==='add' && r.parent===no){ const rn=r.assetNo||r.tag; if(rn && !out.some(o=>o.no===rn)) out.push({no:rn, desc:r.desc||proposedAssetDesc(r)||''}); } });
    return out;
  };
  const line=(ind,role,e)=>'<div class="wz-node" style="padding-left:'+(ind*22)+'px"><span class="wz-role">'+esc(role)+'</span><span class="assetno">'+esc(e.no)+'</span>'+(e.desc?' <span class="muted">· '+esc(e.desc)+'</span>':'')+'</div>';
  const companies=wizardEntriesAtLevel(1);
  if(!companies.length) return '<div class="hint">Nothing yet — create your company in step 1.</div>';
  let html='';
  companies.forEach(co=>{ html+=line(0,'COMPANY',co);
    kidsOf(co.no).forEach(s=>{ html+=line(1,'SITE',s);
      kidsOf(s.no).forEach(c=>{ html+=line(2,'ASSET CLASS',c); }); }); });
  return html;
}
function renderWizard(ok){
  const host=$('#structWizard'); if(!host) return;
  const companies=wizardEntriesAtLevel(1), sites=wizardEntriesAtLevel(2);
  if(!WIZ.co || !companies.some(c=>c.no===WIZ.co)) WIZ.co = companies.length?companies[0].no:'';
  if(!WIZ.site || !sites.some(s=>s.no===WIZ.site)) WIZ.site = sites.length?sites[0].no:'';
  const selOpts=(arr,cur)=>arr.map(o=>'<option value="'+esc(o.no)+'"'+(o.no===cur?' selected':'')+'>'+esc(o.desc||o.no)+' ('+esc(o.no)+')</option>').join('');
  // class names = major categories (taxonomy siteRoots / cascade top level) — free text overrides
  const clsTaxOpts='<option value="">— pick from taxonomy —</option>'+ROOTS.slice().sort((a,b)=>descOf(a).localeCompare(descOf(b))).map(v=>'<option value="'+esc(v)+'">'+esc(descOf(v))+'</option>').join('');
  host.innerHTML=
    '<div class="wz-title">Set up your register structure</div>'+
    '<div class="wz-sub">Assets need one complete chain of <b>Company ▸ Site ▸ Asset Class</b> before they can be added. Each step creates a normal onboarding row — saved to drafts, exported to CSV and promoted to the register like any other.</div>'+
    '<div class="wz-steps">'+
      '<div class="wz-step"><div class="wz-n">1</div><b>Create a Company</b><span>Top level — no parent needed</span>'+
        '<input class="text" id="wizCoName" placeholder="Company name, e.g. B2BEM" autocomplete="off">'+
        '<button class="btn primary sm" id="wizAddCo" type="button">＋ Create company</button></div>'+
      '<div class="wz-step'+(companies.length?'':' off')+'"><div class="wz-n">2</div><b>Add Sites</b><span>Locations under the company</span>'+
        '<select class="native" id="wizSiteCo"'+(companies.length?'':' disabled')+'>'+selOpts(companies,WIZ.co)+'</select>'+
        '<input class="text" id="wizSiteName" placeholder="Site name, e.g. NORTH PLANT" autocomplete="off"'+(companies.length?'':' disabled')+'>'+
        '<button class="btn primary sm" id="wizAddSite" type="button"'+(companies.length?'':' disabled')+'>＋ Add site</button></div>'+
      '<div class="wz-step'+(sites.length?'':' off')+'"><div class="wz-n">3</div><b>Add Asset Classes</b><span>Major categories under a site</span>'+
        '<select class="native" id="wizClsSite"'+(sites.length?'':' disabled')+'>'+selOpts(sites,WIZ.site)+'</select>'+
        '<select class="native" id="wizClsTax"'+(sites.length?'':' disabled')+'>'+clsTaxOpts+'</select>'+
        '<input class="text" id="wizClsName" placeholder="…or type a custom class" autocomplete="off"'+(sites.length?'':' disabled')+'>'+
        '<button class="btn primary sm" id="wizAddCls" type="button"'+(sites.length?'':' disabled')+'>＋ Add class</button></div>'+
    '</div>'+
    '<div class="wz-tree">'+wizTreeHtml()+'</div>'+
    '<div class="wz-foot">'+(ok
      ?'<button class="btn primary" id="wizFinish" type="button">Finish — start adding assets</button>'
      :'<span class="hint">Complete one full Company ▸ Site ▸ Asset Class chain to finish.</span>')+'</div>';
  $('#wizAddCo').onclick=wizAddCompany;
  $('#wizAddSite').onclick=wizAddSite;
  $('#wizAddCls').onclick=wizAddClass;
  const co=$('#wizSiteCo'); if(co) co.onchange=()=>{ WIZ.co=co.value; };
  const cs=$('#wizClsSite'); if(cs) cs.onchange=()=>{ WIZ.site=cs.value; };
  const fin=$('#wizFinish'); if(fin) fin.onclick=()=>{ WIZ_OPEN=false; renderRows(); toast('Structure complete — add assets under your asset classes'); };
}
function updateWizard(){
  const wiz=$('#structWizard'); if(!wiz) return;
  buildSites();   // site dropdown tracks session rows too (level-2 entries with children)
  const ok=structureOk();
  if(!ok) WIZ_OPEN=true;   // wizard reappears whenever the structure becomes incomplete again
  const show=WIZ_OPEN && ACTIVE.mode!=='flat';
  wiz.style.display=show?'block':'none';
  if(show) renderWizard(ok);
  $('#emptyState').style.display=(!show && !rows.length)?'block':'none';
  refreshAddBtn();
}

/* ===========================================================
   Wire up
=========================================================== */
/* ===========================================================
   BOM for EXISTING register assets  (＋ BOM to existing asset)
=========================================================== */
function bomKeyMatch(a,b){ const n=s=>String(s==null?'':s).trim().toLowerCase();
  return ['itemDesc','mfgItem','supPart'].some(f=>{ const av=n(a[f]); return av && av===n(b[f]); }); }
let BOMEX_ASSETS = null;   // register assets (lvl>=4) from GET /api/assets/search; null -> fall back to bootstrap ASSETS
function bomExAssetOptions(){ const s=currentSite(), k=s&&s.name;
  let list = BOMEX_ASSETS ? BOMEX_ASSETS : ASSETS.filter(a=>assetLevel(a.no)>=4);   // hide ports/sites/Level-3 groupings — BOM attaches at Level 4+
  // same chain-based site scope as the parent picker; /api/assets/search rows carry .parent,
  // so entries chain-climb even before they exist in the bootstrap ASSET_BY_NO index
  if(k){ const parentOf = n => (ASSET_BY_NO.get(n)||{}).parent || '';
    list=list.filter(a=>inSiteScope({no:a.no, parent:a.parent||''}, k, parentOf)); }
  return list.map(a=>({value:a.no, label:a.no, sub:a.desc})); }
function findBomEx(no){ return BOM_EXISTING.find(e=>e.no===no)||null; }
function closeBomEx(){ const b=$('#bomExBg'); if(b) b.classList.remove('open'); BOMEX=null; }
function openBomEx(){
  BOMEX=null;
  // storage seam: refresh the searchable register asset list from the server
  fetch('/api/assets/search?q=&limit=100000').then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(o=>{ BOMEX_ASSETS=o.assets||[]; if(cmbBomEx) cmbBomEx.setOptions(()=>bomExAssetOptions()); })
    .catch(()=>{ BOMEX_ASSETS=null; });   // fall back to the bootstrap dataset list
  if(!cmbBomEx){ cmbBomEx=Combo($('#cmbBomEx'), {placeholder:'Search by asset no. or description…', options:()=>bomExAssetOptions(), onChange:onBomExPick}); }
  else { cmbBomEx.setOptions(()=>bomExAssetOptions()); cmbBomEx.clear(); }
  $('#bomExModeWrap').style.display='none';
  $('#bomExSection').style.display='none';
  $('#bomExWarn').classList.remove('show');
  $('#bomExBg').classList.add('open');
  setTimeout(()=>{ if(cmbBomEx) cmbBomEx.focus(); },60);
}
function onBomExPick(no){
  if(!no){ BOMEX=null; $('#bomExModeWrap').style.display='none'; $('#bomExSection').style.display='none'; return; }
  const existing=findBomEx(no), a=ASSET_BY_NO.get(no)||{};
  const cur = existing ? JSON.parse(JSON.stringify(existing.bom||[])) : [];
  BOMEX={ no:no, desc:(existing&&existing.desc)||a.desc||'', items:cur, draft:[], mode:(cur.length?'edit':'add') };
  $('#bomExModeWrap').style.display='block';
  $('#bomExWarn').classList.remove('show');
  setBomMode(BOMEX.mode);
}
function setBomMode(m){
  if(!BOMEX) return;
  BOMEX.mode = (m==='edit'?'edit':'add');
  document.querySelectorAll('#segBomMode button').forEach(b=>b.className=(b.dataset.bm===BOMEX.mode?'on':''));
  if(BOMEX.mode==='add' && !BOMEX.draft.length) BOMEX.draft=[{}];
  $('#bomExSection').style.display='block';
  $('#bomExWarn').classList.remove('show');
  renderBomEx();
}
function renderBomEx(){
  if(!BOMEX) return;
  const add=BOMEX.mode==='add', list=add?BOMEX.draft:BOMEX.items, w=$('#bomExWrap');
  $('#bomExHead').textContent = add ? ('New BOM items for '+BOMEX.no) : ('Current BOM items on '+BOMEX.no);
  $('#bomExNote').innerHTML = add
    ? 'Enter the new spare / BOM part(s). On save, duplicates (same description or part number already on this asset) are blocked. Set <b>ITEM TO BE STOCKED? = Yes</b> to make min/max + a quote link required.'
    : (BOMEX.items.length ? 'Edit or remove the parts already captured on this asset.' : 'No BOM items captured for this asset yet — switch to <b>Add BOM items</b>.');
  w.innerHTML = list.length ? list.map(bomCardHtml).join('') : ('<div class="subnote">'+(add?'Click “＋ Add part”.':'No parts yet.')+'</div>');
  $('#btnBomExAdd').style.display = add ? 'inline-flex' : 'none';
  w.querySelectorAll('[data-bk]').forEach(inp=>{ inp.oninput=inp.onchange=()=>{ const i=+inp.dataset.bi, k=inp.dataset.bk; list[i][k]=inp.value;
    if(['critical','failureStops','backup','availability','criticality'].indexOf(k)>=0){ const b=list[i], sc=bomScore(b), badge=inp.closest('.bomcard').querySelector('.scorebadge'); badge.className='scorebadge '+sbClass(sc); badge.textContent='Score '+sc+' · '+stockRec(sc); } }; });
  w.querySelectorAll('[data-bd]').forEach(btn=>{ btn.onclick=()=>{ list.splice(+btn.dataset.bd,1); renderBomEx(); }; });
}
function bomExAddPart(){ if(!BOMEX) return; BOMEX.draft=BOMEX.draft||[]; BOMEX.draft.push({}); renderBomEx(); }
function saveBomEx(){
  if(!BOMEX){ return; }
  syncSession();
  const w=$('#bomExWarn'); const nonEmpty=b=>Object.keys(b).some(k=>String(b[k]==null?'':b[k]).trim()!=='');
  let toPersist;
  if(BOMEX.mode==='add'){
    const draft=BOMEX.draft.filter(nonEmpty);
    if(!draft.length){ w.innerHTML='Enter at least one part (or switch to Edit BOM items).'; w.classList.add('show'); return; }
    for(let i=0;i<draft.length;i++){ const against=BOMEX.items.concat(draft.slice(0,i)); const hit=against.find(x=>bomKeyMatch(draft[i],x));
      if(hit){ w.innerHTML='Part '+(i+1)+' looks like a duplicate of an item already on '+esc(BOMEX.no)+' (matching description or part number). Remove or amend it.'; w.classList.add('show'); return; } }
    toPersist=BOMEX.items.concat(draft);
  } else {
    toPersist=BOMEX.items.filter(nonEmpty);
  }
  const si=bomStockIssues(toPersist);
  if(si.length){ w.innerHTML='Fix before saving — '+si.map(x=>esc(x.message)).join(' · '); w.classList.add('show'); return; }
  toPersist.forEach(b=>{ b.score=bomScore(b); b.stockRec=stockRec(b.score); });
  let e=findBomEx(BOMEX.no);
  if(toPersist.length){ if(!e){ e={no:BOMEX.no, desc:BOMEX.desc, bom:[]}; BOM_EXISTING.push(e); } e.desc=BOMEX.desc; e.bom=toPersist; }
  else { BOM_EXISTING=BOM_EXISTING.filter(x=>x.no!==BOMEX.no); syncSession(); }
  persistLocal();
  // storage seam: persist this asset's BOM list server-side (upsert by asset no)
  fetch('/api/bom-existing',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({assetNo: BOMEX.no, bom: toPersist})})
    .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); })
    .catch(()=>toast('BOM save failed — server unreachable'));
  const savedNo=BOMEX.no, n=toPersist.length;
  closeBomEx();
  toast('Saved '+n+' BOM item'+(n!==1?'s':'')+' for '+savedNo);
}
/* ===========================================================
   ERP setup (admin) — edit the active profile's columns/mode
=========================================================== */
let EDIT_PROFILE = null;   // working copy while the setup modal is open

function erpSourceOptions(sel){
  const cat = ERP.catalogue(EDIT_PROFILE);
  return '<option value="custom"' + (sel === 'custom' || !sel ? ' selected' : '') + '>— blank / custom —</option>' +
    cat.map(c => '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('');
}
function erpRenderCols(){
  $('#erpCols').innerHTML = EDIT_PROFILE.columns.map((c, i) =>
    '<div class="erpcol" data-i="' + i + '">'+
      '<input type="checkbox" class="erp-inc"' + (c.include ? ' checked' : '') + ' title="Include in template/export">'+
      '<input class="text erp-hdr" value="' + esc(c.header) + '" placeholder="Column header">'+
      (EDIT_PROFILE.mode === 'flat'
        ? '<span class="hint">custom</span>'
        : '<select class="native erp-src">' + erpSourceOptions(c.source) + '</select>')+
      '<label class="ctx-check"><input type="checkbox" class="erp-req"' + (c.required ? ' checked' : '') + '> req</label>'+
      '<button class="btn ghost sm erp-up" type="button" title="Move up">↑</button>'+
      '<button class="btn ghost sm erp-dn" type="button" title="Move down">↓</button>'+
      '<button class="btn ghost danger sm erp-rm" type="button" title="Remove">✕</button>'+
    '</div>').join('');
  $('#erpPreview').textContent = ERP.templateHeaders(EDIT_PROFILE).join(',') || '(no columns included)';
}
function erpReadCols(){
  const els = [...$('#erpCols').querySelectorAll('.erpcol')];
  EDIT_PROFILE.name = $('#erpName').value.trim() || EDIT_PROFILE.name;
  EDIT_PROFILE.columns = els.map((el, i) => {
    const prev = EDIT_PROFILE.columns[+el.getAttribute('data-i')] || {};
    const src = el.querySelector('.erp-src');
    return {
      key: prev.key || ERP.newId('c'),
      header: el.querySelector('.erp-hdr').value.trim() || ('Column ' + (i + 1)),
      source: src ? src.value : 'custom',
      include: el.querySelector('.erp-inc').checked,
      required: el.querySelector('.erp-req').checked
    };
  });
}
function openErpSetup(p){
  EDIT_PROFILE = JSON.parse(JSON.stringify(p || ACTIVE));
  $('#erpProfileSel').innerHTML = ERP.listProfiles().map(x => '<option value="' + esc(x.id) + '"' + (x.id === EDIT_PROFILE.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
  $('#erpName').value = EDIT_PROFILE.name || '';
  $('#erpName').disabled = false;   // admins may rename any profile — built-in included (export path keys on builtIn+mode, not name)
  $('#erpTypeSel').innerHTML = Object.keys(ERP.PRESETS).map(k => '<option value="' + k + '"' + (k === EDIT_PROFILE.erpType ? ' selected' : '') + '>' + esc(ERP.PRESETS[k].name) + '</option>').join('');
  $('#erpModeSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === EDIT_PROFILE.mode));
  $('#erpDel').disabled = !!EDIT_PROFILE.builtIn;
  erpRenderCols();
  $('#erpSetupBg').classList.add('open');
}
function closeErpSetup(){ $('#erpSetupBg').classList.remove('open'); EDIT_PROFILE = null; }
function saveErpSetup(){
  erpReadCols();
  if(!EDIT_PROFILE.columns.some(c => c.include)){ toast('Include at least one column'); return; }
  const headers = ERP.templateHeaders(EDIT_PROFILE);
  if(new Set(headers.map(h => h.toLowerCase())).size !== headers.length){ toast('Column headers must be unique'); return; }
  ERP.saveProfile(EDIT_PROFILE); ACTIVE = EDIT_PROFILE; ERP.setActive(EDIT_PROFILE.id);
  applyProfileUI(); closeErpSetup(); toast('Profile saved');
}

function init(){
  initCombos();
  rebuildAssetIndex();
  fillProjectInputs(); updateExportNameHint();
  $('#pmName').oninput=()=>{ PROJECT.pm=$('#pmName').value; persistProject(); };
  $('#pmNumber').oninput=()=>{ PROJECT.number=$('#pmNumber').value; persistProject(); };
  $('#pmStart').oninput=()=>{ PROJECT.start=$('#pmStart').value; persistProject(); };
  $('#pmEnd').oninput=()=>{ PROJECT.end=$('#pmEnd').value; persistProject(); };
  $('#exportNameInput').oninput=()=>{ PROJECT.exportName=$('#exportNameInput').value; persistProject(); };
  document.querySelectorAll('#projectBar .datefield').forEach(wireDateField);
  buildSites();
  updateDsInfo();
  renderRows();

  $('#btnAdd').onclick=()=>{ if(ACTIVE.mode==='flat') return openFlatAdd(null); openModal(-1); };
  $('#flatAddX').onclick=$('#flatAddCancel').onclick=closeFlatAdd;
  $('#flatAddSave').onclick=saveFlatRow;
  $('#flatAddBg').addEventListener('mousedown',e=>{ if(e.target===$('#flatAddBg')) closeFlatAdd(); });
  $('#btnBomEx').onclick=openBomEx;
  $('#bomExX').onclick=closeBomEx;
  $('#bomExCancel').onclick=closeBomEx;
  $('#btnBomExSave').onclick=saveBomEx;
  $('#btnBomExAdd').onclick=bomExAddPart;
  document.querySelectorAll('#segBomMode button').forEach(b=>b.onclick=()=>setBomMode(b.dataset.bm));
  $('#bomExBg').addEventListener('mousedown',e=>{ if(e.target===$('#bomExBg')) closeBomEx(); });
  $('#npNo').onclick=autofillFromProposed;
  $('#btnAddBom').onclick=addBomLine;
  $('#btnExport').onclick=exportCSV;
  $('#btnTemplate').onclick=downloadTemplate;
  $('#btnImportCsv').onclick=()=>$('#fileCsv').click();
  if($('#btnSettings')) $('#btnSettings').style.display='none';   // data-source settings are server-owned now
  applyAdminUI();   // admin visibility comes from the server-authenticated role
  $('#modalX').onclick=closeModal;
  $('#btnCancel').onclick=closeModal;
  $('#btnSaveRow').onclick=()=>saveRow(false);
  $('#btnSaveAdd').onclick=()=>saveRow(true);
  $('#btnDelete').onclick=async ()=>{ if(editIndex>=0 && confirm('Delete this asset?')){ const r=rows[editIndex]; if(r && r.id!=null){ try{ const res=await fetch('/api/rows/'+r.id,{method:'DELETE'}); if(!res.ok) throw new Error('HTTP '+res.status); }catch(err){ toast('Delete failed — server unreachable'); return; } } rows.splice(editIndex,1);closeModal();renderRows();persistLocal();toast('Asset deleted');} };
  document.querySelectorAll('#segAction button').forEach(b=>b.onclick=()=>{setAction(b.dataset.a);recompute();});
  document.querySelectorAll('#segWO button').forEach(b=>b.onclick=()=>{ if(editing){ editing.workOrderable=(b.dataset.wo==='yes'); recompute(); } });
  document.querySelectorAll('#segItemType button').forEach(b=>b.onclick=()=>{ if(editing){ editing.itemType=(editing.itemType===b.dataset.it)?null:b.dataset.it; renderAssetInfo(); toggleInfoSections(); } });
  $('#inpAssetType').oninput=()=>{ if(editing){ editing.assetType=$('#inpAssetType').value.trim()||null; recompute(); } };
  $('#inpDuty').oninput=()=>{ if(editing){ editing.duty=$('#inpDuty').value.trim()||null; recompute(); } };
  $('#inpNumber').oninput=()=>{ if(editing){ editing.number=$('#inpNumber').value.trim()||null; recompute(); } };
  $('#inpTag').oninput=()=>{ if(editing){ editing.tag=$('#inpTag').value.trim(); recompute(); } };
  $('#inpDesc').oninput=()=>{ if(editing){ editing.desc=$('#inpDesc').value.trim(); recompute(); } };
  $('#selClass').onchange=()=>{ if(editing){ editing.classOverride=$('#selClass').value||null; recompute(); } };
  $('#modalBg').addEventListener('mousedown',e=>{ if(e.target===$('#modalBg')) closeModal(); });
  $('#rowSearch').oninput=renderRows;
  $('#chkIssuesOnly').onchange=renderRows;
  $('#bannerX').onclick=hideBanner;
  $('#rowsBody').addEventListener('click',async e=>{
    if(ACTIVE.mode==='flat'){
      const fe=e.target.closest('.flat-edit'), fd=e.target.closest('.flat-del');
      if(fe) openFlatAdd(+fe.getAttribute('data-i'));
      else if(fd && confirm('Delete record #'+(+fd.getAttribute('data-i')+1)+'?')){ rows.splice(+fd.getAttribute('data-i'),1); applyProfileUI(); persistLocal(); toast('Record deleted'); }
      return;
    }
    const ed=e.target.closest('[data-edit]'), de=e.target.closest('[data-del]');
    if(ed) openModal(+ed.dataset.edit);
    if(de){ const i=+de.dataset.del; const r=rows[i]; const label=(r&&(r.assetNo||r.tag))?(r.assetNo||r.tag):('#'+(i+1)); if(confirm('Delete asset '+label+'?')){ if(r && r.id!=null){ try{ const res=await fetch('/api/rows/'+r.id,{method:'DELETE'}); if(!res.ok) throw new Error('HTTP '+res.status); }catch(err){ toast('Delete failed — server unreachable'); return; } } rows.splice(i,1);renderRows();persistLocal();toast('Asset deleted');} }
  });
  $('#selSite').onchange=()=>{ refreshAddBtn(); renderRows(); };   // site change re-scopes the table, not just the Add gate
  // req #5 — reopen the structure wizard to add another company / site / asset class
  const bns=$('#btnNewSite'); if(bns) bns.onclick=()=>{ WIZ_OPEN=true; updateWizard(); const w=$('#structWizard'); if(w) w.scrollIntoView({behavior:'smooth',block:'center'}); };
  refreshAddBtn();
  $('#btnSave').onclick=saveDraft;
  $('#btnNew').onclick=newProject;
  $('#btnLoad').onclick=openDrafts;
  $('#draftsX').onclick=closeDrafts;
  $('#btnDraftFile').onclick=()=>{ closeDrafts(); $('#fileDraft').click(); };
  $('#draftsList').addEventListener('click',async e=>{
    const del=e.target.closest('[data-draft-del]');
    if(del){
      if(!confirm('Delete this draft permanently?')) return;
      try{ const res=await fetch('/api/drafts/'+encodeURIComponent(del.getAttribute('data-draft-del')),{method:'DELETE'}); if(!res.ok) throw new Error('HTTP '+res.status); }
      catch(err){ toast('Delete failed — server unreachable'); return; }
      toast('Draft deleted');
      openDrafts();
      return;
    }
    const b=e.target.closest('[data-draft-id]'); if(b){ let o=null; try{ const res=await fetch('/api/drafts/'+b.dataset.draftId); if(!res.ok) throw new Error('HTTP '+res.status); o=await res.json(); }catch(err){ toast('Could not load draft — server unreachable'); return; } loadDraftObj(o); closeDrafts(); } });
  $('#draftsBg').addEventListener('mousedown',e=>{ if(e.target===$('#draftsBg')) closeDrafts(); });
  if($('#btnImportData')) $('#btnImportData').style.display='none';   // dataset is served by /api/bootstrap
  if($('#btnRegister')) $('#btnRegister').onclick=updateRegister;
  if($('#btnTaxImport')) $('#btnTaxImport').onclick=importTaxonomy;
  if($('#btnTaxExport')) $('#btnTaxExport').onclick=downloadTaxonomy;
  /* ---------- CSV import column-mapping ---------- */
  $('#erpMapX').onclick=$('#erpMapCancel').onclick=closeMapModal;
  { const a=$('#erpMapAdopt'); if(a) a.onclick=adoptCsvFormat; }
  $('#erpMapBg').addEventListener('mousedown',e=>{ if(e.target===$('#erpMapBg')) closeMapModal(); });
  $('#erpMapImport').onclick=()=>{
    const map={};
    $('#erpMapRows').querySelectorAll('.erpmaprow').forEach(row=>{ map[row.getAttribute('data-h')]=row.querySelector('.erp-target').value||null; });
    const grid=$('#erpMapBg').__grid;
    closeMapModal();
    if(grid) applyImport(grid, map);
  };
  /* ---------- ERP setup (admin) ---------- */
  $('#btnErpSetup').onclick=()=>openErpSetup();
  $('#erpSetupX').onclick=$('#erpSetupCancel').onclick=closeErpSetup;
  $('#erpSetupSave').onclick=saveErpSetup;
  $('#erpSetupBg').addEventListener('mousedown',e=>{ if(e.target===$('#erpSetupBg')) closeErpSetup(); });
  $('#erpProfileSel').onchange=e=>{ const p=ERP.listProfiles().find(x=>x.id===e.target.value); if(p) openErpSetup(p); };
  $('#erpTypeSel').onchange=e=>{
    const t=e.target.value; EDIT_PROFILE.erpType=t;
    const p=ERP.PRESETS[t];
    if(p && (p.schema||p.headers) && confirm('Load the "'+p.name+'" column set into this profile? This replaces the current columns.')){
      const seeded=ERP.newProfile(t);
      EDIT_PROFILE.mode=seeded.mode; EDIT_PROFILE.columns=seeded.columns;
      $('#erpModeSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.m===EDIT_PROFILE.mode));
      erpRenderCols();
    }
  };
  $('#erpModeSeg').onclick=e=>{
    const b=e.target.closest('button'); if(!b || !EDIT_PROFILE) return;
    if(b.dataset.m===EDIT_PROFILE.mode) return;
    erpReadCols();
    if(!confirm('Switching mode may drop sources that do not exist in the new mode. Continue?')) return;
    EDIT_PROFILE.mode=b.dataset.m;
    if(EDIT_PROFILE.mode==='flat') EDIT_PROFILE.columns.forEach(c=>{ c.source='custom'; });
    $('#erpModeSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.m===EDIT_PROFILE.mode));
    erpRenderCols();
  };
  $('#erpAddCol').onclick=()=>{ erpReadCols(); EDIT_PROFILE.columns.push({key:ERP.newId('c'), header:'New column', source:'custom', include:true, required:false}); erpRenderCols(); };
  $('#erpCols').addEventListener('click',e=>{
    const rm=e.target.closest('.erp-rm'), up=e.target.closest('.erp-up'), dn=e.target.closest('.erp-dn');
    if(!rm && !up && !dn) return;
    const i=+e.target.closest('.erpcol').getAttribute('data-i');
    erpReadCols();
    if(rm) EDIT_PROFILE.columns.splice(i,1);
    else { const j=up?i-1:i+1; if(j<0||j>=EDIT_PROFILE.columns.length) return; const t=EDIT_PROFILE.columns[i]; EDIT_PROFILE.columns[i]=EDIT_PROFILE.columns[j]; EDIT_PROFILE.columns[j]=t; }
    erpRenderCols();
  });
  $('#erpCols').addEventListener('input',()=>{ $('#erpPreview').textContent=[...$('#erpCols').querySelectorAll('.erpcol')].filter(el=>el.querySelector('.erp-inc').checked).map(el=>el.querySelector('.erp-hdr').value.trim()).join(',')||'(no columns included)'; });
  $('#erpNew').onclick=()=>{ const p=ERP.saveProfile(ERP.newProfile($('#erpTypeSel').value)); ACTIVE=p; ERP.setActive(p.id); openErpSetup(p); toast('New profile created'); };
  $('#erpDup').onclick=()=>{ const p=ERP.duplicateProfile(EDIT_PROFILE.id); ACTIVE=p; ERP.setActive(p.id); openErpSetup(p); toast('Profile duplicated'); };
  $('#erpDel').onclick=()=>{ if(EDIT_PROFILE.builtIn) return; if(!confirm('Delete profile "'+EDIT_PROFILE.name+'"?')) return; ERP.deleteProfile(EDIT_PROFILE.id); ACTIVE=ERP.getActive(); applyProfileUI(); closeErpSetup(); toast('Profile deleted'); };
  if($('#btnFolder')) $('#btnFolder').style.display='none';   // folder sync replaced by server persistence
  $('#fileDraft').onchange=e=>{ if(e.target.files[0])loadDraftFile(e.target.files[0]); e.target.value=''; };
  $('#fileCsv').onchange=e=>{ if(e.target.files[0])readCsvFile(e.target.files[0]); e.target.value=''; };
  if($('#fileTaxonomy')) $('#fileTaxonomy').onchange=e=>{ if(e.target.files[0]) importTaxonomyFile(e.target.files[0]); e.target.value=''; };
  if($('#fileRegister')) $('#fileRegister').onchange=e=>{ if(e.target.files[0]) importRegisterFile(e.target.files[0]); e.target.value=''; };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if($('#modalBg').classList.contains('open'))closeModal(); if($('#draftsBg').classList.contains('open'))closeDrafts(); if($('#bomExBg').classList.contains('open'))closeBomEx(); if($('#erpSetupBg').classList.contains('open'))closeErpSetup(); if($('#erpMapBg').classList.contains('open'))closeMapModal(); if($('#flatAddBg').classList.contains('open'))closeFlatAdd(); }});

  try{ window.RULES=RULES; window.__test={transformedChildren,isGroupNode,childrenOfRules,parseCSV:ERP.parseCSV,importCSV,proposedAssetNo,proposedAssetDesc,newSegments,classify:RULES.classify,buildAbbreviation:RULES.buildAbbreviation,resolveNumber:RULES.resolveNumber,validate:RULES.validate,needsNumber:RULES.needsNumber,getRows:()=>rows,buildCSV,assetOptions,deptOptions,locOptions,leafEnumerable,noTaken,nextSequence,level3FromParent,parentTx,autoAssetNo,newLeafLevel,inheritedLen,rootByCode,renderCascade,containerNos:()=>CONTAINER_NOS,assetNos:()=>ASSET_NOS,openModal,closeModal,recompute,validateStructural,structuralLevelIssue,modalDupIssues,autofillFromProposed,getEditing:()=>editing,setEditing:(o)=>{editing=o;syncSession();},isItemRow,infoMissing,requiredFieldsFor,bomScore,stockRec,buildBOMCSV,addBomLine,renderAssetInfo,renderBOM,INFO_REQUIRED,ITEM_TYPE_LABEL,registerTaxValue,reapplyOverrides,buildTaxCSV,suggestCode,getNewTax:()=>NEW_TAX,makeTaxEdit,unregisterTaxValue,childrenOf,nodeOf,computeForRow,dataIssuesFor,saveRow,renderRows,wireDateField,dateFieldHTML,getProject:()=>PROJECT,setProject:(o)=>{PROJECT=Object.assign(PROJECT,o);fillProjectInputs();updateExportNameHint();},exportFileBase,sanitizeFileName,isAdmin:()=>IS_ADMIN,getUser:()=>CURRENT_USER,draftFileName,loadDraftObj,openDrafts,saveDraft,updateRegister,refreshBootstrap,openBomEx,closeBomEx,onBomExPick,setBomMode,renderBomEx,bomExAddPart,saveBomEx,bomKeyMatch,bomStockIssues,bomExAssetOptions,findBomEx,getBomExisting:()=>BOM_EXISTING,setBomExisting:(a)=>{BOM_EXISTING=a||[];syncSession();},getBomex:()=>BOMEX,setBomex:(o)=>{BOMEX=o;},syncSession}; }catch(e){}
}

/* ===========================================================
   Boot — storage seam: dataset + rows + BOM-existing come from the server
=========================================================== */
async function loadBomExisting(){
  const o = await (await fetch('/api/bom-existing')).json();
  BOM_EXISTING = (o.items||[]).map(it=>({no:it.assetNo, desc:(ASSET_BY_NO.get(it.assetNo)||{}).desc||'', bom:it.bom||[]}));
  syncSession();
}
async function boot(){
  const bootRes = await fetch('/api/bootstrap');
  if(bootRes.status===401){ window.location='/login'; return; }   // SSO session missing/expired
  const b = await bootRes.json();
  initData(b.dataset);
  CURRENT_USER = b.user;
  IS_ADMIN = !!(CURRENT_USER && CURRENT_USER.role==='admin');
  const serverRows = await (await fetch('/api/rows')).json();
  rows = serverRows.rows.map(r => ({...r}));
  // restore the project header from the newest persisted row (matches the server's export context)
  const lastRow = rows.length ? rows[rows.length-1] : null;
  if(lastRow && lastRow.project && Object.keys(lastRow.project).length) PROJECT = Object.assign({pm:'',number:'',start:'',end:''}, lastRow.project);
  syncSession();
  try{ await loadBomExisting(); }catch(e){}   // BOM-existing is non-critical at boot
  init();
}
boot().catch(e=>{ try{ showBanner('Could not load data from the server — '+esc((e&&e.message)||String(e)), true); }catch(_e){} });
