/* ===========================================================
   RULES ENGINE  (port of assetRules.ts — §1–§7, all bug fixes)
=========================================================== */
const RULES = (function(){
  const MAX_ABBR_LEN=4, MAX_NUM_LEN=4;
  const PLURAL_HINTS=["lights","power outlets","smoke detectors","hose reels","doors","cables","fittings","panels","supports","luminaires","delineators"];
  const SPECIFIC_NUMBER=/^[A-Za-z]+\d+$/;
  const ALL_DIGITS=/^\d+$/;
  function hasPluralDescription(desc){ const d=(desc||'').toLowerCase(); return PLURAL_HINTS.some(p=>d.includes(p)); }
  function isSpecificTag(tag){ const last=(tag||'').split('-').pop()||''; return /\d+$/.test(last); }
  function civilClassification(desc){
    const d=(desc||'').toLowerCase();
    const P=['column','beam','load-bearing','road finish','wearing course','deck top','asphalt','kerb','line marking'];
    const S=['support','stringer','walkway','handrail','guarding','road base','subbase','fill','culvert','drainage','table drain','shoulder'];
    if(P.some(k=>d.includes(k))) return 'PRIMARY (P)';
    if(S.some(k=>d.includes(k))) return 'SECONDARY (S)';
    return null;
  }
  function classify(a){
    a=a||{};
    const hasChildren = (a.childCount!=null) ? a.childCount>0 : (a.childTags ? a.childTags.length>0 : false);
    if(a.hasConcreteAssetsBeneath===false) return 'REFERENCE';
    const grouping = hasChildren || a.isGrouping===true || a.groupsMinorItems===true || a.isSystem===true || hasPluralDescription(a.description);
    if(grouping) return (a.workOrderable===false) ? 'REFERENCE' : 'REFERENCE - SUB';
    const civil = civilClassification(a.description); if(civil) return civil;
    return 'EQUIPMENT GROUP - EQUIPMENT TYPE';
  }
  function needsNumber(c){ return c==='PRIMARY (P)'||c==='SECONDARY (S)'||c==='EQUIPMENT GROUP - EQUIPMENT TYPE'; }
  function buildAbbreviation(assetType, duty, taken){
    taken = taken || new Set();
    const words=(assetType||'').trim().split(/\s+/).filter(Boolean);
    if(words.length===0) return '';
    let abbr='';
    if(words.length===1){
      const w=words[0].toUpperCase();
      if(w.length<=1){ abbr=w; }
      else { abbr=w[0]+w[w.length-1];
        if(taken.has(abbr) && w.length>2){ const inner=w.substring(1,w.length-1);
          for(let k=0;k<inner.length;k++){ const cand=w[0]+inner[k]+w[w.length-1]; abbr=cand; if(!taken.has(cand)) break; } } }
    } else {
      abbr=words.map(w=>w[0]).join('').toUpperCase();
      if(abbr.length>MAX_ABBR_LEN){ let extra=''; for(const w of words){ if(w.length>2) extra+=w[Math.floor(w.length/2)]; }
        abbr=(words.map(w=>w[0]).join('')+extra).toUpperCase().slice(0,MAX_ABBR_LEN); }
    }
    if(duty && duty.trim()){ abbr=(duty.trim()[0]+abbr).toUpperCase(); }
    return abbr.toUpperCase().slice(0,MAX_ABBR_LEN);
  }
  function resolveNumber(input){
    input=input||{};
    if(input.number && SPECIFIC_NUMBER.test(input.number)) return input.number;
    if(input.number && ALL_DIGITS.test(input.number)) return input.number;
    if((input.number==null||input.number==='') && input.parentTag) return '01';
    return (input.number==null||input.number==='') ? null : input.number;
  }
  function validate(a, allTags){
    a=a||{}; allTags=allTags||new Set();
    const issues=[]; const c = a.classOverride || classify(a);
    const who = a.tag || '(row)';
    if(needsNumber(c) && !resolveNumber(a)) issues.push({rule:'3.1',severity:'high',message:who+': '+c+' requires a number.'});
    if(!needsNumber(c) && a.number && !SPECIFIC_NUMBER.test(a.number)) issues.push({rule:'1',severity:'high',message:who+': '+c+' must not carry a number.'});
    if(a.abbreviation && a.abbreviation.length>MAX_ABBR_LEN) issues.push({rule:'3.2',severity:'high',message:who+': abbreviation exceeds '+MAX_ABBR_LEN+' letters.'});
    if(a.number && ALL_DIGITS.test(a.number) && a.number.length>MAX_NUM_LEN) issues.push({rule:'3.2',severity:'high',message:who+': number exceeds '+MAX_NUM_LEN+' digits.'});
    if(a.tag && allTags.has(a.tag)) issues.push({rule:'3.10',severity:'high',message:a.tag+': duplicate Asset No.'});
    if(c==='REFERENCE' && a.workOrderable===true) issues.push({rule:'7.2',severity:'medium',message:who+': REFERENCE marked work-orderable — set to REFERENCE - SUB.'});
    const liveChildCount = (a.transformedChildCount!=null) ? a.transformedChildCount : ((a.childTags?a.childTags.length:0) || (a.childCount||0));
    if(c==='REFERENCE' && liveChildCount===0) issues.push({rule:'WO',severity:'medium',message:who+': REFERENCE leaf cannot host work orders — set work-orderable to Yes (→ REFERENCE - SUB) or add a numbered child.'});
    return issues;
  }
  return {classify,civilClassification,buildAbbreviation,resolveNumber,needsNumber,validate,hasPluralDescription,isSpecificTag,SPECIFIC_NUMBER,ALL_DIGITS,MAX_ABBR_LEN,MAX_NUM_LEN};
})();
export { RULES };
