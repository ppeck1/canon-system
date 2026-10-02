/* Saved-view recipe checks; numeric transforms and browser behavior have separate evidence. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Session=require('./session.js'),D=require('./domain.js');
const Labels=require('./labels.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8').replace(/^\uFEFF/,''));
const bytes=fs.readFileSync(path.join(__dirname,'data/bundle.json'));
const bundle=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
const bundleSha=crypto.createHash('sha256').update(bytes).digest('hex');
const legacyNames=['example-native.json','example-aligned.json','example-comparison.json','example-fit.json','example-unequal-windows.json'];
const example=read(legacyNames[0]);
const session=Session.create(bundle,{bundleSha,rendererVersion:example.effective.versions.renderer});
const clone=value=>JSON.parse(JSON.stringify(value));
const tests=[];
function test(name,fn){try{fn();tests.push({name,passed:true});}catch(error){tests.push({name,passed:false,error:error.stack});}}
function base(){
 const t=clone(example.effective.requested);
 t.a={scenarioId:'T4M6/A',worldIndex:0,eventIndex:1,anchor:'decision'};
 t.b={scenarioId:'T4M6/B',worldIndex:0,eventIndex:0,anchor:'decision'};
 t.compare=false;t.clock='native';t.perspective='now';
 return t;
}
function instrument(){return {version:'instrument-views/1',active:'time',companion:'relationship',
 timeChannels:['ready','unfinished'],xChannel:'ready',yChannel:'unfinished',yMax:null,timeOffset:0,
 labelVersion:'display-labels/1',transformVersion:'calibration-cwt/1'};}
function configured(){return {...base(),instrument:instrument()};}

test('All retained /2 examples restore to their exact original effective configuration',()=>{
 for(const name of legacyNames){
  const saved=read(name),before=JSON.stringify(saved),restored=session.restore(saved);
  assert.deepEqual(restored.effective,saved.effective,name);
  assert.deepEqual(restored.state,saved.effective.requested,name);
  assert.equal(JSON.stringify(saved),before,'Restore must not mutate '+name);
  assert.equal(Object.hasOwn(restored.effective,'instrument'),false);
  assert.equal(Object.hasOwn(restored.state,'instrument'),false);
 }
});

test('Optional instrument settings change only their metadata and body display labels',()=>{
 const legacy=session.compile(base()),modern=session.compile(configured());
 const comparable=clone(modern);delete comparable.instrument;delete comparable.requested.instrument;
 comparable.rendering.a.label=legacy.rendering.a.label;
 assert.deepEqual(comparable,legacy);
 assert.deepEqual(modern.versions,legacy.versions);
});

test('Instrument body titles use verified case names and ordinary ordered-event labels on both sides',()=>{
 const t=configured();t.compare=true;
 const e=session.compile(t);
 for(const [key,selection] of [['a',t.a],['b',t.b]]){
  const scenario=bundle.scenarios.find(s=>s.id===selection.scenarioId);
  const record=scenario.worlds[selection.worldIndex].records.find(r=>r.event_index===selection.eventIndex);
  const label=Labels.caseLabel(bundle,scenario.case_id);
  assert.equal(label.status,'verified');assert.ok(e.rendering[key].label.startsWith('Initial case: '+label.label));
  assert.ok(e.rendering[key].label.includes(Labels.eventLabel(record).label));
  assert.ok(e.rendering[key].label.endsWith('event '+record.event_index));
  assert.equal(e.rendering[key].recordId,record.id);
 }
 assert.deepEqual(session.restore(session.save(e)).effective,e);
});

test('Every primary and companion view roundtrips with explicit calibration and pan settings',()=>{
 for(const active of ['body','time','relationship','timescale'])for(const companion of ['none','time','relationship']){
  const t=configured();Object.assign(t.instrument,{active,companion,yMax:9.5,timeOffset:-1.5,
   timeChannels:['completed','backup','absent'],xChannel:'rate',yChannel:'delivered',
   calibration:{signal:'chirp',mode:'prefix',endSample:512}});
  const before=JSON.stringify(t),effective=session.compile(t,{viewport:{width:1100,height:700}});
  const saved=session.save(effective,{checkpointId:'multi-view',parentId:'previous'}),restored=session.restore(saved);
  assert.deepEqual(restored.state,t);assert.deepEqual(restored.effective,effective);
  assert.equal(restored.checkpoint.parent_id,'previous');
  assert.equal(JSON.stringify(t),before);
  assert.equal(saved.effective.instrument.calibration.endSample,512);
 }
});

test('Same-time replay states retain distinct exact record identities in the saved prefix',()=>{
 const t=configured(),world=bundle.scenarios.find(s=>s.id===t.a.scenarioId).worlds[0];
 assert.equal(world.records[0].time_s,world.records[1].time_s);
 const e=session.compile(t);
 assert.deepEqual(e.instrument.prefix_record_refs.A,D.prefix(world,1).map(r=>r.id));
 assert.equal(e.instrument.selected_record_refs.A,world.records[1].id);
 assert.notEqual(e.instrument.prefix_record_refs.A[0],e.instrument.prefix_record_refs.A[1]);
 assert.deepEqual(e.instrument.prefix_record_refs.B,[]);assert.equal(e.instrument.selected_record_refs.B,null);
 assert.equal(e.instrument.source_revision,bundleSha);
 t.a.eventIndex=0;const beforeAction=session.compile(t);
 assert.deepEqual(beforeAction.instrument.prefix_record_refs.A,[world.records[0].id]);
});

test('A and B references preserve separate alternative worlds instead of pairing their records',()=>{
 const scenario=bundle.scenarios.find(s=>s.worlds.length>1);assert.ok(scenario);
 const t=configured();t.compare=true;
 t.a={scenarioId:scenario.id,worldIndex:0,eventIndex:scenario.worlds[0].records[1].event_index,anchor:'decision'};
 t.b={scenarioId:scenario.id,worldIndex:1,eventIndex:scenario.worlds[1].records[0].event_index,anchor:'decision'};
 const e=session.compile(t);
 assert.deepEqual(e.instrument.prefix_record_refs.A,D.prefix(scenario.worlds[0],t.a.eventIndex).map(r=>r.id));
 assert.deepEqual(e.instrument.prefix_record_refs.B,D.prefix(scenario.worlds[1],t.b.eventIndex).map(r=>r.id));
 assert.notEqual(e.instrument.selected_record_refs.A,e.instrument.selected_record_refs.B);
 assert.deepEqual(session.restore(session.save(e)).effective,e);
});

test('Camera and spatial softness changes do not alter analytical settings or exact evidence selection',()=>{
 const t=configured(),first=session.compile(t);t.h=.95;t.valueGain=1.8;t.camera.yaw+=.4;t.camera.panX+=35;
 assert.deepEqual(session.compile(t).instrument,first.instrument);
});

test('All calibration signals and modes retain their explicit inclusive prefix endpoint',()=>{
 for(const signal of ['chirp','sinusoid','constant'])for(const mode of ['retrospective','prefix'])for(const endSample of [63,512,1023]){
  const t=configured();t.instrument.active='timescale';t.instrument.calibration={signal,mode,endSample};
  assert.deepEqual(session.restore(session.save(session.compile(t))).state.instrument.calibration,{signal,mode,endSample});
 }
});

test('Optional calibration cursors roundtrip with pinned calibration source and implementation',()=>{
 for(const mode of ['prefix','retrospective'])for(const row of [0,24,47]){
  const t=configured();t.instrument.calibration={signal:'chirp',mode,endSample:512,row,sample:mode==='prefix'?512:1023};
  const effective=session.compile(t),saved=session.save(effective),restored=session.restore(saved);
  assert.deepEqual(restored.state.instrument.calibration,t.instrument.calibration);
  assert.deepEqual(effective.instrument.calibration_source,{revision:'calibration-signals/1',implementation:'cmor-sampled-convolution/1',channel:'calibration_amplitude'});
  assert.deepEqual(restored.effective,effective);
 }
 const withoutCursor=configured();withoutCursor.instrument.calibration={signal:'constant',mode:'prefix',endSample:63};
 const restored=session.restore(session.save(session.compile(withoutCursor)));
 assert.equal(Object.hasOwn(restored.state.instrument.calibration,'row'),false);assert.equal(Object.hasOwn(restored.state.instrument.calibration,'sample'),false);
 for(const field of ['revision','implementation','channel']){
  const saved=session.save(session.compile(withoutCursor));saved.effective.instrument.calibration_source[field]='unsupported-value';
  assert.throws(()=>session.restore(saved),/does not match a replay/);
 }
});

test('Calibration cursor validates row and sample against the actual permitted signal prefix',()=>{
 const calibration={signal:'sinusoid',mode:'prefix',endSample:63,row:24,sample:63};
 for(const row of [-1,48,.5,NaN]){const t=configured();t.instrument.calibration={...calibration,row};assert.throws(()=>session.compile(t),/cursor row/);}
 for(const sample of [-1,64,1024,.5,NaN]){const t=configured();t.instrument.calibration={...calibration,sample};assert.throws(()=>session.compile(t),/cursor sample/);}
 const zero=configured();zero.instrument.calibration={...calibration,row:0,sample:0};assert.deepEqual(session.restore(session.save(session.compile(zero))).state,zero);
 const retrospective=configured();retrospective.instrument.calibration={...calibration,mode:'retrospective',sample:1023};assert.deepEqual(session.restore(session.save(session.compile(retrospective))).state,retrospective);
 retrospective.instrument.calibration.sample=1024;assert.throws(()=>session.compile(retrospective),/cursor sample/);
});

test('Unsupported label, transform and instrument versions fail explicitly in requested and effective recipes',()=>{
 for(const [field,value,message] of [['version','instrument-views/999',/Unsupported instrument version/],
  ['labelVersion','display-labels/999',/Unsupported display-label version/],
  ['transformVersion','calibration-cwt/999',/Unsupported calibration transform version/]]){
  const input=configured();input.instrument[field]=value;assert.throws(()=>session.compile(input),message);
  for(const location of ['requested','effective']){
   const saved=session.save(session.compile(configured()));
   (location==='requested'?saved.effective.requested.instrument:saved.effective.instrument)[field]=value;
   assert.throws(()=>session.restore(saved),message);
  }
 }
});

test('Malformed or unsupported channel, range and view settings are rejected without clamping',()=>{
 const invalid=[null,[],{...instrument(),active:'spectrogram'},{...instrument(),companion:'body'},
  {...instrument(),timeChannels:[]},{...instrument(),timeChannels:['ready','ready']},
  {...instrument(),timeChannels:['unknown']},{...instrument(),xChannel:'voltage'},{...instrument(),yChannel:'unknown'},
  {...instrument(),yMax:0},{...instrument(),yMax:-1},{...instrument(),yMax:Infinity},
  {...instrument(),timeOffset:.01},{...instrument(),timeOffset:NaN},{...instrument(),timeOffset:-Infinity},
  {...instrument(),undocumentedNormalization:true}];
 for(const value of invalid)assert.throws(()=>session.compile({...base(),instrument:value}));
});

test('Timescale saves require supported calibration inputs and sufficient bounded sample indices',()=>{
 const invalid=[null,{},[],{signal:'queue',mode:'prefix',endSample:512},
  {signal:'chirp',mode:'future',endSample:512},
  ...[0,62,1024,512.5,NaN].map(endSample=>({signal:'chirp',mode:'prefix',endSample})),
  {signal:'chirp',mode:'prefix',endSample:512,resample:'implicit'}];
 for(const calibration of invalid){const t=configured();t.instrument.calibration=calibration;assert.throws(()=>session.compile(t));}
 const missing=configured();missing.instrument.active='timescale';assert.throws(()=>session.compile(missing),/explicit calibration/);
});

test('Instrument pan changes the body history frame while preserving the selected event and saved replay',()=>{
 const t=configured();t.a.eventIndex=4;t.perspective='history';t.span=1;t.instrument.timeOffset=-.5;
 const e=session.compile(t);
 assert.deepEqual(e.observation.A.nativeWindow,[1.5,2.5]);
 assert.deepEqual(e.rendering.history.windows.a.native,[1.5,2.5]);
 assert.deepEqual(e.rendering.history.a.map(r=>[r.event_index,r.carry_in]),[[2,true],[3,false]]);
 assert.equal(e.observation.A.nativeNow,3);assert.equal(e.selected[0].event_index,4);
 assert.equal(e.instrument.selected_record_refs.A,e.selected[0].record_id);
 assert.equal(e.transforms.frames[0].parameters.pan_s,-.5);
 assert.deepEqual(session.restore(session.save(e)).effective,e);
});

test('Restore recomputes all instrument references and rejects altered settings or source bindings',()=>{
 const effective=session.compile(configured());
 for(const mutate of [e=>{e.instrument.selected_record_refs.A='invented';},
  e=>{e.instrument.prefix_record_refs.A.push('future-record');},e=>{e.instrument.source_revision='0'.repeat(64);},
  e=>{e.instrument.yMax=99;},e=>{e.requested.instrument.timeOffset=-2;},e=>{delete e.instrument;}]){
  const saved=session.save(effective);mutate(saved.effective);
  assert.throws(()=>session.restore(saved),/does not match a replay/);
 }
 assert.deepEqual(session.restore(session.save(effective)).effective,effective);
});

const report={passed:tests.every(t=>t.passed),tests_total:tests.length,tests_passed:tests.filter(t=>t.passed).length,
 scope:'Saved configuration validation and exact recomputation only; not numeric transform accuracy or browser usability.',results:tests};
console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
