/* Bounded evidence workspaces. No changes to the oscillator, PCM, or CANON core. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ObservatoryExtension=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const stable=x=>JSON.stringify(sort(x));
 function sort(x){return Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;}
 function defaults(){return {version:'observatory-extension-state/1',active:'existing',nativeRestore:null,local:{year:1950,channel:'gdppc',country:'CAN',height:300},transfer:{caseId:null,actionId:null},details:false,openPanels:[]};}
 function validate(s,data){
  const exact=(x,keys)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join('|')!==keys.sort().join('|'))throw Error('Unexpected extension state fields');};
  exact(s,['version','active','nativeRestore','local','transfer','details','openPanels']);exact(s.local,['year','channel','country','height']);exact(s.transfer,['caseId','actionId']);
  if(!Array.isArray(s.openPanels)||s.openPanels.some(x=>!['queue','release','mapping','facts','summary'].includes(x))||new Set(s.openPanels).size!==s.openPanels.length)throw Error('Unsupported evidence disclosure');
  if(s.version!=='observatory-extension-state/1'||!['existing','local_signal','transfer'].includes(s.active)||typeof s.details!=='boolean')throw Error('Unsupported evidence workspace');
  if(s.nativeRestore!==null){exact(s.nativeRestore,['shift','gain','offset']);if(!Object.values(s.nativeRestore).every(Number.isFinite)||Math.abs(s.nativeRestore.shift)>120||Math.abs(s.nativeRestore.gain)>5||Math.abs(s.nativeRestore.offset)>5)throw Error('Invalid saved alignment');}
  if(!['gdppc','pop'].includes(s.local.channel)||!Number.isInteger(s.local.year)||!Number.isFinite(s.local.height)||s.local.height<250||s.local.height>1000||!data.localSignal.countries.some(c=>c.code===s.local.country&&c.records.some(r=>r.year===s.local.year)))throw Error('Native annual selection is unavailable');
  if(s.active==='transfer'&&s.transfer.caseId===null)throw Error('Select a transfer case before restoring it');
  if(s.transfer.caseId!==null){const c=data.transfer.cases.find(c=>c.id===s.transfer.caseId);if(!c)throw Error('Unknown transfer case');if(s.transfer.actionId!==null&&!c.actions.some(a=>a.id===s.transfer.actionId))throw Error('Unknown transfer action');}else if(s.transfer.actionId!==null)throw Error('Action needs a case');
  return s;
 }
 function annual(s,data){const rows=data.localSignal.countries.map(c=>({country:c.code,name:c.name,record:c.records.find(r=>r.year===s.local.year)}));return {time:{value:s.local.year,unit:'calendar year',precision:'year; no invented subannual timestamp'},rows,units:data.localSignal.units};}
 function receipt(s,data){validate(s,data);return {version:'observatory-extension-receipt/1',active:s.active,selected:s.active==='local_signal'?annual(s,data):s.active==='transfer'?data.transfer.cases.find(c=>c.id===s.transfer.caseId)||null:null,action:s.active==='transfer'?(data.transfer.cases.find(c=>c.id===s.transfer.caseId)?.actions.find(a=>a.id===s.transfer.actionId)||null):null,rendering:s.active==='local_signal'?{encoding:'discrete points; no interpolated segments',channel:s.local.channel,axes:{year:[1950,1970],gdppc:[0,30000],pop:[0,250000]},calibration:'One fixed native value axis shared by both countries per named channel',alignment:'Native calendar year equality; no shift, gain, offset, stretching, normalization or smoothing',unused:'Other workbook years/countries/sheets remain in the retained original workbook; both selected channels remain in every record',limitations:data.localSignal.limitations}:s.active==='transfer'?{encoding:'Typed roles, evidence links, and recorded process outcomes',execution:'Results are retained isolated native-script executions, not browser-side packaging',omitted:'No geometry, numerical core, L_P, empirical workflow history or population-level effectiveness claim'}:null,nativeRestore:s.nativeRestore};}
 function save(base,s,data){return {schema:'observatory-workspace/2',base,extension:clone(s),extensionSources:clone(data.extensionSources),extensionReceipt:receipt(s,data)};}
 function unpack(packet,data){
  if(packet.schema!=='observatory-workspace/2')return {base:packet,extension:defaults(),legacy:true};
  if(Object.keys(packet).sort().join('|')!==['schema','base','extension','extensionSources','extensionReceipt'].sort().join('|'))throw Error('Unexpected workspace fields');
  if(stable(packet.extensionSources)!==stable(data.extensionSources))throw Error('Extension source fingerprints differ');
  validate(packet.extension,data);if(stable(packet.extensionReceipt)!==stable(receipt(packet.extension,data)))throw Error('Extension rendering/evidence receipt disagrees');
  if(packet.extension.active!=='existing'&&(packet.base.state.transport.playing||packet.base.state.audio.enabled))throw Error('Inactive temporal source cannot play in an evidence workspace');
  return {base:packet.base,extension:clone(packet.extension),legacy:false};
 }
 return {defaults,validate,annual,receipt,save,unpack,stable};
});
