/* Independent integration contract probes. Canvas stubs do not establish usability. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, '');
const clone = value => JSON.parse(JSON.stringify(value));
const bundleText = read('data/bundle.json'), bundle = JSON.parse(bundleText);
const bundleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/bundle.json'))).digest('hex');
const E = require('./evidence.js'), D = require('./domain.js'), V = require('./encoding.js'), F = require('./frames.js'), Session = require('./session.js');
const tests = [];
function test(name, fn) { try { fn(); tests.push({name,passed:true}); } catch(e) { tests.push({name,passed:false,error:e.stack}); } }
function scenario(id, data=bundle) { const s=data.scenarios.find(s=>s.id===id); assert.ok(s); return s; }
function atTime(id,time, data=bundle) { const records=scenario(id,data).worlds[0].records.filter(r=>r.time_s===time); assert.ok(records.length); return records.at(-1).event_index; }
function state() { return {version:'state-body-view/2',preset:'required-work-disposition-gaussian/1',
  a:{scenarioId:'H9C3/A',worldIndex:0,eventIndex:atTime('H9C3/A',4),anchor:'decision'},
  b:{scenarioId:'T4M6/A',worldIndex:0,eventIndex:atTime('T4M6/A',3),anchor:'decision'},
  compare:true,mode:'overlay',perspective:'history',clock:'native',span:1,h:.6,valueGain:1.35,
  layers:{surface:true,contours:true,exact:true},slice:{axis:'u',offset:-1.1},
  camera:{yaw:-.68,pitch:.69,zoom:1,panX:0,panY:0,projection:'orthographic'}}; }

function loadRenderer() {
  const window={devicePixelRatio:1,addEventListener(){},removeEventListener(){}};
  const context={window,console,Math,Number,Object,Array,Map,Set,JSON,Error};
  vm.runInNewContext(read('renderer.js'),context,{filename:'renderer.js'});
  assert.ok(window.BodyRenderer);
  return window.BodyRenderer;
}
const Renderer=loadRenderer();
const makeSession = data => Session.create(data,{bundleSha,rendererVersion:Renderer.version,cameraLimits:Renderer.cameraLimits});
const session=makeSession(bundle);
const rowIds = rows => rows.map(r=>r.recordId);

test('Native windows are bounded independently before union; A4/B3 span1',()=>{
  const eff=session.compile(state()),a=eff.observation.A,b=eff.observation.B;
  assert.deepEqual(a.nativeWindow,[3,4]);assert.deepEqual(b.nativeWindow,[2,3]);
  assert.deepEqual(eff.observation.shared_display_domain,[2,4]);
  assert.deepEqual(a.eventRows.map(r=>r.time_s),[3,4]);
  assert.deepEqual(b.eventRows.map(r=>r.time_s),[2,3]);
  assert.ok(a.eventRows.every(r=>r.time_s>=3));
});
test('Fractional windows retain source-linked carry-ins, not invented observations',()=>{
  const s=state();s.span=1.5;const eff=session.compile(s);
  for(const [side,lower,carryTime] of [[eff.observation.A,2.5,2],[eff.observation.B,1.5,1]]){
    assert.equal(side.nativeWindow[0],lower);assert.ok(side.carryIn);
    assert.equal(side.carryIn.time_s,carryTime);assert.equal(side.carryIn.display_time_s,lower);
    assert.equal(side.carryIn.row_kind,'carry_in');assert.equal(side.carryIn.isObservedEvent,false);
    assert.ok(!rowIds(side.eventRows).includes(side.carryIn.recordId));
    assert.ok(side.eventRows.every(r=>r.time_s>=lower));
    const resolved=session.store.resolveRecord(side.carryIn.recordId);assert.equal(resolved.status,'resolved');
    assert.equal(resolved.value.time_s,carryTime);
  }
});
test('Native and aligned clocks use the same retained evidence, with independent translations',()=>{
  const s=state();s.span=1.5;s.a.anchor='first_service_boundary';
  s.b={scenarioId:'N7K4/C',worldIndex:0,eventIndex:atTime('N7K4/C',3),anchor:'first_completed_payload'};
  const native=session.compile(s);s.clock='aligned';const aligned=session.compile(s);
  assert.notEqual(aligned.selected[0].anchor.anchor_s,aligned.selected[1].anchor.anchor_s);
  for(const key of ['A','B']){
    const n=native.observation[key],a=aligned.observation[key];
    assert.deepEqual(rowIds(n.rows),rowIds(a.rows));
    assert.deepEqual(n.rows.map(r=>r.time_s),a.rows.map(r=>r.time_s));
    assert.deepEqual(n.rows.map(r=>r.weights),a.rows.map(r=>r.weights));
    const anchor=aligned.selected.find(x=>x.label===key).anchor.anchor_s;
    assert.deepEqual(a.displayWindow,n.nativeWindow.map(t=>t-anchor));
  }
});
test('An unavailable observed-event anchor blocks aligned history without native substitution',()=>{
  const s=state();s.a={scenarioId:'D8V1/A',worldIndex:0,eventIndex:atTime('D8V1/A',3),anchor:'first_completed_payload'};s.clock='aligned';
  const eff=session.compile(s);
  assert.equal(eff.observation.A.status,'unavailable');assert.equal(eff.observation.A.displayWindow,null);
  assert.deepEqual(eff.observation.A.rows,[]);assert.equal(eff.observation.shared_display_domain,null);
  assert.equal(eff.rendering.history,null);assert.equal(eff.rendering_status,'alignment_unavailable_history_withheld');
  assert.equal(eff.rendering.visible,false);
  assert.equal(eff.rendering.perspective,'now');assert.equal(eff.requested.perspective,'history');
  // Exercise the actual renderer boundary after an earlier valid display so an
  // unavailable history cannot leave stale weights by throwing during render.
  const scene=new Renderer.Scene(canvasStub());
  scene.render(session.renderConfig(session.compile(state())));
  scene.render(session.renderConfig(eff));
  assert.deepEqual(scene.config.a.weights,eff.selected[0].partition.weights);
  assert.equal(scene.config.a.weights.ready,3);assert.equal(scene.config.history,null);
  const saved=session.save(eff,{checkpointId:'unavailable-anchor-review',renderingRecord:scene.manifest()});
  const restored=session.restore(saved);
  assert.deepEqual(restored.effective,eff);
  assert.equal(saved.rendering_record.history,null);
  scene.destroy();
});
test('Same-time pre/post action events are separate ordered prefixes',()=>{
  const w=scenario('T4M6/A').worlds[0];
  assert.equal(w.records[0].time_s,w.records[1].time_s);
  assert.deepEqual(D.prefix(w,0).map(r=>r.event_index),[0]);
  assert.deepEqual(D.prefix(w,1).map(r=>r.event_index),[0,1]);
  assert.equal(D.partition(w.records[0]).weights.backup_only,1);
  assert.equal(D.partition(w.records[1]).weights.backup_only,0);
  const s=state();s.a={scenarioId:'T4M6/A',worldIndex:0,eventIndex:0,anchor:'decision'};s.compare=false;
  const first=session.compile(s);s.a.eventIndex=1;const second=session.compile(s);
  assert.equal(first.observation.A.eventRows.length,1);assert.equal(second.observation.A.eventRows.length,2);
  assert.deepEqual(second.observation.A.eventRows.map(r=>r.display_time_s),[0,0]);
});
test('Future suffix state, segments and outcome cannot change a prior effective view',()=>{
  const s=state();s.a.eventIndex=atTime(s.a.scenarioId,1);s.b.eventIndex=atTime(s.b.scenarioId,1);
  const original=makeSession(clone(bundle)).compile(s), altered=clone(bundle);
  for(const sc of altered.scenarios)for(const w of sc.worlds){
    w.segments=[{future:'arbitrary'}];w.outcome={future:'arbitrary'};
    for(const r of w.records)if(r.time_s>1){r.values={future:'arbitrary'};r.identities={future:'arbitrary'};r.conditions={future:'arbitrary'};}
  }
  assert.deepEqual(makeSession(altered).compile(s),original);
});
test('Evidence resolver and compilation share one immutable retained snapshot and trace revision',()=>{
  const input=clone(bundle),engine=makeSession(input),s=state(),before=engine.compile(s);
  const selected=before.selected[0],ref=engine.store.recordRef(selected.record_id);
  assert.equal(ref.bundle_revision,bundleSha);
  const record=scenario(s.a.scenarioId,input).worlds[0].records.find(r=>r.event_index===s.a.eventIndex);
  record.identities.required.push('new-unretained-payload');
  assert.deepEqual(engine.compile(s),before);
  assert.ok(!engine.store.resolveRecord(selected.record_id).value.identities.required.includes('new-unretained-payload'));
});
test('Missing evidence remains explicit; missing identity arrays are rejected',()=>{
  const store=E.create(bundle,{bundleSha256:bundleSha});
  for(const result of [store.resolveSource('f'.repeat(64)),store.resolvePointer('/missing'),store.resolveRecord('not-present')]){
    assert.notEqual(result.status,'resolved');assert.equal(result.value,null);
  }
  const r=clone(scenario('H9C3/A').worlds[0].records[0]);delete r.identities.backups;
  assert.throws(()=>D.partition(r),/Missing identity array/);
});
test('Save/restore rejects changed versions, missing revisions and any changed effective computation',()=>{
  const effective=session.compile(state(),{viewport:{width:900,height:600}});
  const renderingRecord=Renderer.describe(session.renderConfig(effective),effective.presentation.camera,effective.presentation.viewport);
  const saved=session.save(effective,{checkpointId:'integration-review',renderingRecord});
  assert.deepEqual(session.restore(saved).effective,effective);
  for(const key of Object.keys(effective.versions)){
    const bad=clone(saved);bad.effective.versions[key]='unsupported-test-version';
    assert.throws(()=>session.restore(bad),/version/i,key);
  }
  const missing=clone(saved);missing.effective.source_revisions[0].sha256='f'.repeat(64);
  assert.throws(()=>session.restore(missing),/Missing source revision/);
  const changes=[
    e=>{e.encoding.categories[0].u+=.1;},
    e=>{e.rendering.calibration.h+=.1;},
    e=>{e.observation.A.nativeWindow[0]-=1;},
    e=>{e.selected[0].partition.weights.ready+=1;}
  ];
  for(const change of changes){const bad=clone(saved);change(bad.effective);assert.throws(()=>session.restore(bad),/does not match/);}
  const badRecord=clone(saved);badRecord.rendering_record.renderer_version='old';assert.throws(()=>session.restore(badRecord),/version/i);
  for(const change of [
    r=>{r.encoding.kernel_version='unsupported-kernel';},
    r=>{r.camera.zoom+=.1;},
    r=>{r.calibration.h+=.1;},
    r=>{r.encoding.categories[0].u+=.1;},
    r=>{r.history.windows.a.native[0]-=1;}
  ]){
    const bad=clone(saved);change(bad.rendering_record);
    assert.throws(()=>session.restore(bad),/version|disagree/i);
  }
});
test('Strict state validation rejects silent coercion or camera clamping; render config is exported config',()=>{
  for(const change of [s=>{s.layers.surface='true';},s=>{s.h='0.6';},s=>{s.camera.zoom=999;},s=>{s.camera.projection='fish-eye';},s=>{s.compare=1;}]){
    const s=state();change(s);assert.throws(()=>session.compile(s));
  }
  const s=state();s.perspective='history';s.layers={surface:false,contours:false,exact:false};
  const e=session.compile(s),render=session.renderConfig(e),serial={...render};delete serial.encoding;
  assert.deepEqual(serial,e.rendering);
  assert.equal(render.encoding.version,e.encoding.version);assert.equal(render.encoding.kernelVersion,e.encoding.kernel_version);
  assert.deepEqual(render.camera,e.presentation.camera);assert.deepEqual(render.history,e.rendering.history);
});

function canvasStub() {
  const context=new Proxy({measureText:text=>({width:String(text).length*7}),createLinearGradient:()=>({addColorStop(){}})},
    {get:(target,key)=>key in target?target[key]:(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  return {style:{},width:900,height:600,clientWidth:900,clientHeight:600,
    getContext:()=>context,getBoundingClientRect:()=>({x:0,y:0,left:0,top:0,width:900,height:600}),
    addEventListener(){},removeEventListener(){},setPointerCapture(){},releasePointerCapture(){}};
}
test('Renderer programmatic cameras reject invalid values and generic encoding is actually consumed',()=>{
  const scene=new Renderer.Scene(canvasStub());
  assert.throws(()=>scene.setCamera({zoom:999}));assert.throws(()=>scene.setCamera({projection:'fish-eye'}));
  const s=state();s.perspective='now';const config=session.renderConfig(session.compile(s));
  let calls=0;
  config.encoding={id:'review-two-category',version:'1',kernelVersion:'review-kernel/1',
    categories:[{key:'left',label:'Left',u:-1,v:0},{key:'right',label:'Right',u:1,v:0}],
    field:(u,v,w,h)=>{calls++;return (w.left*Math.exp(-((u+1)**2+v*v)/(2*h*h))+w.right*Math.exp(-((u-1)**2+v*v)/(2*h*h)))/(2*Math.PI*h*h);}};
  config.a={weights:{left:1,right:2},label:'synthetic renderer contract probe',recordId:'renderer-test'};config.b=null;config.history=null;
  config.mode='soloA';scene.render(config);assert.ok(calls>0);scene.destroy();
});
test('Solo A and B use equal materials; fitting changes only one shared camera',()=>{
  const scene=new Renderer.Scene(canvasStub()),s=state();s.perspective='now';s.h=.35;s.valueGain=2;
  const config=session.renderConfig(session.compile(s)),seen=[];
  scene.surface=function(p,o,cal){seen.push({method:'surface',style:o.style,color:clone(o.color)});};
  scene.wire=function(p,o,cal){seen.push({method:'wire',style:o.style,color:clone(o.color)});};
  scene.render({...config,mode:'soloA'});const a=clone(seen);seen.length=0;
  scene.render({...config,mode:'soloB'});const b=clone(seen);
  assert.deepEqual(a,b);assert.ok(a.some(x=>x.method==='surface'));
  const before=JSON.stringify({a:config.a,b:config.b,cal:config.calibration,history:config.history});
  scene.fitBoth({margin:60});
  assert.equal(JSON.stringify({a:config.a,b:config.b,cal:config.calibration,history:config.history}),before);
  const camera=scene.getCamera();assert.ok(Number.isFinite(camera.zoom)&&camera.zoom>0);
  assert.deepEqual(clone(scene.manifest().camera),clone(camera));
  assert.equal(scene.getClippingStatus().clipped,false);scene.destroy();
});

const failed=tests.filter(x=>!x.passed);
console.log(JSON.stringify({scope:'Independent integration contract checks; canvas stub tests are not visual or perceptual acceptance.',tests_run:tests.length,passed:tests.length-failed.length,failed:failed.length,tests},null,2));
if(failed.length)process.exitCode=1;
