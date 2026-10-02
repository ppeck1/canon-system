/* Focused saved workspace/structure/landscape contracts; no browser usability claim. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const W=require('./workspace.js'),S=require('./session.js');
const root=__dirname,clone=x=>JSON.parse(JSON.stringify(x));
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''));
const raw=fs.readFileSync(path.join(root,'data/bundle.json')),bundle=JSON.parse(raw.toString('utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const old=read('example-native.json');
const engine=S.create(bundle,{bundleSha:hash(raw),rendererVersion:old.effective.versions.renderer});
const results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.stack});}}
function state(){
 const t=clone(old.effective.requested);
 t.a={scenarioId:'T4M6/A',worldIndex:0,eventIndex:1,anchor:'decision'};
 t.b={scenarioId:'T4M6/B',worldIndex:0,eventIndex:0,anchor:'decision'};
 t.compare=true;t.clock='native';t.perspective='now';
 t.instrument={version:'instrument-views/1',active:'system',companion:'lineage',
  timeChannels:['ready','unfinished'],xChannel:'ready',yChannel:'unfinished',yMax:null,timeOffset:0,
  labelVersion:'display-labels/1',transformVersion:'calibration-cwt/1',
  workspace:{version:W.version,arrangement:'side',primaryHeight:820,companionHeight:510,primaryShare:63},
  structure:{version:'system-lineage/1',lineageChannel:'ready',lineageSource:'queue',selectedIdentity:{side:'A',caseId:'T4M6',identity:'w2'}},
  calibration:{signal:'chirp',mode:'prefix',endSample:512,row:17,sample:320,landscapeVersion:'timescale-landscape/1',
   landscapeCamera:{yaw:-.62,pitch:.7,zoom:1.15,panX:21,panY:-17,projection:'orthographic'}}};
 return t;
}

test('Nondefault workspace, graph views, source identity and landscape camera roundtrip exactly',()=>{
 const t=state(),e=engine.compile(t),saved=engine.save(e,{checkpointId:'workspace-review'}),r=engine.restore(saved);
 assert.deepEqual(r.state,t);assert.deepEqual(r.effective,e);
 assert.deepEqual(r.effective.instrument.workspace,t.instrument.workspace);
 assert.deepEqual(r.effective.instrument.structure,t.instrument.structure);
 assert.deepEqual(r.effective.instrument.calibration,t.instrument.calibration);
 assert.equal(r.effective.instrument.selected_record_refs.A,'T4M6/A/world0/e1');
});
test('Layout resize and arrangement do not alter selected evidence, frames, values or body calibration',()=>{
 const t=state(),before=engine.compile(t);
 Object.assign(t.instrument.workspace,{arrangement:'stacked',primaryHeight:1600,companionHeight:1000,primaryShare:37});
 const after=engine.compile(t);
 for(const key of ['selected','observation','comparison','encoding','rendering','linked_views','transforms','source_revisions','preservation'])assert.deepEqual(after[key],before[key],key);
 assert.deepEqual(after.instrument.selected_record_refs,before.instrument.selected_record_refs);
 assert.deepEqual(after.instrument.prefix_record_refs,before.instrument.prefix_record_refs);
 assert.notDeepEqual(after.instrument.workspace,before.instrument.workspace);
});
test('Graph and lineage choices are display recipes, not queue-state changes',()=>{
 const t=state(),before=engine.compile(t);
 t.instrument.active='lineage';t.instrument.companion='system';
 t.instrument.structure.lineageSource='calibration';t.instrument.structure.lineageChannel='delivered';
 t.instrument.structure.selectedIdentity={side:'B',caseId:'T4M6',identity:'w2'};
 const after=engine.compile(t);
 for(const key of ['selected','observation','encoding','rendering','transforms'])assert.deepEqual(after[key],before[key],key);
 assert.deepEqual(engine.restore(engine.save(after)).effective,after);
});
test('Workspace validates explicit units, full shape, finite integer bounds and supported version',()=>{
 const d=W.describe(clone(W.defaults));assert.equal(d.units.primaryHeight,'CSS px');assert.equal(d.units.primaryShare,'percent');
 for(const mutate of [x=>{x.version='unsupported';},x=>{x.arrangement='freeform';},x=>{x.primaryHeight=399;},x=>{x.primaryHeight=1801;},
  x=>{x.companionHeight=259;},x=>{x.primaryShare=76;},x=>{x.primaryShare=35.5;},x=>{x.primaryHeight='900';},
  x=>{x.primaryHeight=NaN;},x=>{x.width=500;},x=>{delete x.companionHeight;}]){
  const x=clone(W.defaults);mutate(x);assert.throws(()=>W.validate(x));
 }
 for(const x of [null,[],{}])assert.throws(()=>W.validate(x));
});
test('Unknown structure, workspace and landscape versions are rejected rather than replaced',()=>{
 for(const mutate of [t=>{t.instrument.structure.version='new';},t=>{t.instrument.workspace.version='new';},t=>{t.instrument.calibration.landscapeVersion='new';}]){
  const t=state();mutate(t);assert.throws(()=>engine.compile(t),/version/i);
 }
});
test('Structure identity must resolve in the currently shown source case and side',()=>{
 for(const identity of [
  {side:'A',caseId:'T4M6',identity:'not-a-payload'},
  {side:'A',caseId:'N7K4',identity:'j1'},
  {side:'A',caseId:'N7K4',identity:bundle.cases.find(c=>c.case_id==='N7K4').task.required_payload_ids[0]},
  {side:'C',caseId:'T4M6',identity:'w2'},
  {side:'A',caseId:'T4M6',identity:'w2',extra:true}
 ]){const t=state();t.instrument.structure.selectedIdentity=identity;assert.throws(()=>engine.compile(t));}
 const hidden=state();hidden.compare=false;hidden.instrument.structure.selectedIdentity.side='B';assert.throws(()=>engine.compile(hidden),/not enabled/);
 const none=state();none.instrument.structure.selectedIdentity=null;assert.doesNotThrow(()=>engine.compile(none));
});
test('Graph views require their explicit recipe and reject unsupported lineage source/channel',()=>{
 for(const mutate of [t=>{delete t.instrument.structure;},t=>{t.instrument.structure.lineageSource='inferred';},
  t=>{t.instrument.structure.lineageChannel='frequency';},t=>{t.instrument.structure.extra='drop-me';}]){
  const t=state();mutate(t);assert.throws(()=>engine.compile(t));
 }
});
test('Landscape camera and coefficient selection obey explicit schema and permitted prefix',()=>{
 for(const mutate of [
  c=>{c.landscapeCamera.zoom=3.1;},c=>{c.landscapeCamera.zoom=.24;},c=>{c.landscapeCamera.pitch=.07;},
  c=>{c.landscapeCamera.projection='perspective';},c=>{c.landscapeCamera.extra=1;},
  c=>{c.landscapeCamera.panX=Infinity;},c=>{delete c.landscapeCamera;},c=>{delete c.landscapeVersion;},
  c=>{c.sample=513;},c=>{c.row=48;}
 ]){const t=state();mutate(t.instrument.calibration);assert.throws(()=>engine.compile(t));}
 const t=state();t.instrument.active='timescale';t.instrument.calibration.sample=512;assert.doesNotThrow(()=>engine.compile(t));
});
test('Saved effective layout/camera/identity tampering disagrees with its recipe and is rejected',()=>{
 const saved=engine.save(engine.compile(state()));
 for(const mutate of [
  e=>{e.instrument.workspace.primaryHeight+=1;},e=>{e.instrument.calibration.landscapeCamera.zoom+=.1;},
  e=>{e.instrument.structure.selectedIdentity.identity='w1';},e=>{e.requested.instrument.workspace.primaryShare=64;}
 ]){const changed=clone(saved);mutate(changed.effective);assert.throws(()=>engine.restore(changed),/does not match/);}
});
test('All existing examples restore exactly without injecting new presentation settings',()=>{
 for(const name of ['example-native.json','example-aligned.json','example-comparison.json','example-fit.json','example-unequal-windows.json','example-multiview.json','example-timescale-prefix.json']){
  const saved=read(name),before=JSON.stringify(saved),restored=engine.restore(saved);
  assert.deepEqual(restored.effective,saved.effective,name);assert.equal(JSON.stringify(saved),before);
  if(saved.effective.requested.instrument)assert.equal(Object.hasOwn(restored.state.instrument,'workspace'),Object.hasOwn(saved.effective.requested.instrument,'workspace'));
 }
});
test('Validation and restore leave the retained bundle byte exact',()=>{
 assert.equal(hash(fs.readFileSync(path.join(root,'data/bundle.json'))),hash(raw));
 assert.equal(hash(Buffer.from(bundle.source.raw_base64,'base64')),bundle.source.sha256);
});

const report={scope:'Focused workspace, graph-selection and landscape-camera recipe validation; no new transform or browser usability claim.',passed:results.every(x=>x.passed),tests_run:results.length,tests:results};
fs.writeFileSync(path.join(root,'workspace_checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
