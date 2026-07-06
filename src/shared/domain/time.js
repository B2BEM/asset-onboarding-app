const PERTH_TZ='Australia/Perth';
function perthDate(){ return new Intl.DateTimeFormat('en-CA',{timeZone:PERTH_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function perthDateTime(){ return new Date().toLocaleString('en-AU',{timeZone:PERTH_TZ}); }
function perthISO(){ const d=new Date();
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:PERTH_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const tm=new Intl.DateTimeFormat('en-GB',{timeZone:PERTH_TZ,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
  return day+'T'+tm.replace(/^24/,'00'); }
export { PERTH_TZ, perthDate, perthDateTime, perthISO };
