/* Independent analytic checks for the bounded observatory model. No UI claim. */
'use strict';
const assert=require('node:assert/strict'),M=require('./model.js');
const tests=[],clone=x=>JSON.parse(JSON.stringify(x));
const sourceFingerprints={oscillator:{sha256:'1'.repeat(64)},music:{sha256:'2'.repeat(64)},lake:{sha256:'3'.repeat(64)}};
const pcm={sampleRate:4,left:Float32Array.from([0,.5,1,.5,0,-.5,-1,-.5]),right:Float32Array.from([1,.5,0,-.5,-1,-.5,0,.5]),duration:2,sha256:sourceFingerprints.music.sha256};
const eq=(a,b,eps=1e-12)=>assert.ok(Math.abs(a-b)<=eps,`${a} differs from ${b}`);
function test(name,fn){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.stack});}}

test('Default state is complete and independently copied',()=>{
 const a=M.defaultState(),b=M.defaultState();M.validateState(a);a.tune.frequency=3;assert.equal(b.tune.frequency,.53);
 assert.equal(a.transport.span,8);assert.equal(a.transport.step,1/60);assert.equal(a.encoding,'envelope');assert.equal(a.camera.projection,'orthographic');
 assert.deepEqual(a.inspection,{contribution:null,openDetails:['native']});a.inspection.openDetails.push('receipt');assert.deepEqual(b.inspection.openDetails,['native']);
});
test('Fixed reference matches known sinusoid extrema and does not change under candidate edits',()=>{
 const s=M.defaultState();eq(M.sample(s,'A',0).channels.position,0);eq(M.sample(s,'A',0).channels.velocity,Math.PI);eq(M.sample(s,'A',.5).channels.position,1);eq(M.sample(s,'A',.5).channels.velocity,0);
 const before=M.sample(s,'A',.25);s.tune={frequency:2,amplitude:4,phase:1,damping:.4};s.align={shift:1,gain:-2,offset:3};assert.deepEqual(M.sample(s,'A',.25),before);
});
test('Candidate analytical velocity agrees with an independent finite difference',()=>{
 const s=M.defaultState();s.tune={frequency:.8,amplitude:2,phase:-.7,damping:.3};const t=3.2,h=1e-6;
 const finiteDifference=(M.sample(s,'B',t+h).channels.position-M.sample(s,'B',t-h).channels.position)/(2*h);
 eq(M.sample(s,'B',t).channels.velocity,finiteDifference,1e-8);
});
test('Align changes observation time/value, preserving candidate recipe and derivative semantics',()=>{
 const s=M.defaultState(),tune=clone(s.tune),native=M.sample(s,'B',2);s.align={shift:1,gain:2,offset:3};
 const mapped=M.sample(s,'B',3);eq(mapped.nativeTime,2);eq(mapped.channels.position,2*native.channels.position+3);eq(mapped.channels.velocity,2*native.channels.velocity);assert.deepEqual(s.tune,tune);
 assert.equal(mapped.derived.time_stretching,false);
});
test('Transport looping does not invent source support; missing overlap is counted',()=>{
 const s=M.defaultState();s.transport.loop=true;s.align.shift=1;assert.equal(M.sample(s,'B',.5).valid,false);assert.equal(M.sample(s,'B',.5).reason,'outside_source_support');
 const result=M.metrics(s,{start:0,end:2});assert.equal(result.coverage.requested,256);assert.equal(result.coverage.paired,128);assert.equal(result.coverage.missingCandidate,128);assert.equal(result.coverage.missingReference,0);eq(result.coverage.fraction,.5);
});
test('Exact generated match has zero pointwise discrepancy over the declared half-open window',()=>{
 const s=M.defaultState();s.tune=clone(M.reference);const r=M.metrics(s,{start:.5,end:2.5});
 for(const k of ['position','velocity']){assert.equal(r.channels[k].rmse,0);assert.equal(r.channels[k].maxAbsoluteError,0);assert.equal(r.channels[k].pairs,256);}
 assert.deepEqual(r.window,{start:.5,end:2.5});assert.equal(r.grid.firstTime,.5);assert.equal(r.grid.lastTime,2.5-1/128);assert.match(r.claim,/not whole-system equivalence/);
 s.camera.zoom=2;s.encoding='gaussian';assert.deepEqual(M.metrics(s,{start:.5,end:2.5}),r);
});
test('PCM selection is nearest stored sample, with index, quantization and exact source reference',()=>{
 const s=M.defaultState();s.source='music';const p=M.sample(s,'A',.14,pcm);
 assert.equal(p.channels.left,.5);assert.equal(p.channels.right,.5);assert.equal(p.derived.sampleIndex,1);assert.equal(p.derived.sampleTime,.25);eq(p.derived.quantizationErrorSeconds,.11);
 assert.equal(p.sourceRefs[0].sourceRevision,pcm.sha256);assert.equal(M.sample(s,'A',2,pcm).valid,false);
});
test('Music Tune is unapplied; B alignment maps both channels and metrics use native sampling',()=>{
 const s=M.defaultState();s.source='music';s.transport.end=2;s.tune.frequency=8;
 const matched=M.metrics(s,{start:0,end:2},pcm);assert.equal(matched.grid.sampleRate,4);assert.equal(matched.channels.left.rmse,0);assert.equal(matched.channels.right.rmse,0);assert.equal(matched.coverage.requested,8);
 s.align={shift:.25,gain:2,offset:-.5};const mapped=M.sample(s,'B',.5,pcm);assert.deepEqual(mapped.channels,{left:.5,right:.5});
 assert.equal(M.metrics(s,{start:0,end:2},pcm).coverage.missingCandidate,1);assert.equal(M.recipeReceipt(s).candidate.tune_applied,false);
});
test('Native-rate PCM discrepancy matches hand-computed shifted/gained sample pairs',()=>{
 const s=M.defaultState();s.source='music';s.align={shift:.26,gain:2,offset:-.5};const r=M.metrics(s,{start:0,end:2},pcm);
 // Reference indices 2..7 pair with candidate indices 1..6. The first
 // two requested candidate times are before retained sample support.
 assert.equal(r.coverage.paired,6);assert.equal(r.coverage.missingCandidate,2);
 eq(r.channels.left.rmse,Math.sqrt(5.75/6));eq(r.channels.right.rmse,Math.sqrt(7.75/6));
 assert.equal(r.channels.left.maxAbsoluteError,2);assert.equal(r.channels.right.maxAbsoluteError,2);
});
test('PCM missingness and invalid sampling are explicit; lake records do not become waveforms',()=>{
 const s=M.defaultState();s.source='music';const bad={...pcm,left:Array.from(pcm.left)};bad.left[1]=NaN;
 assert.equal(M.sample(s,'A',.25,bad).reason,'nonfinite_native_sample');assert.equal(M.metrics(s,{start:0,end:2},bad).coverage.missingEither,1);
 assert.throws(()=>M.sample(s,'A',0,{...pcm,duration:3}),/duration/);assert.throws(()=>M.sample(s,'A',0,{...pcm,right:[0]}),/equal bounded sample counts/);
 s.source='lake';s.selectedLakeId='retained-record-7';assert.equal(M.sample(s,'A',1).reason,'unsupported_temporal_signal');assert.equal(M.metrics(s,{start:0,end:2}).available,false);
});
test('Deep validation rejects extra fields, coercion, impossible bounds, unsupported stretching and excess alternatives',()=>{
 for(const mutate of [s=>{s.extra=1;},s=>{s.transport.speed='2';},s=>{s.transport.time=-1;},s=>{s.transport.span=0;},s=>{s.transport.step=0;},s=>{s.align.stretch=2;},s=>{s.camera.projection='perspective';},s=>{s.audio.mix='unknown';},s=>{s.tune.damping=-1;},s=>{s.alternatives=Array.from({length:13},()=>({name:'x',tune:clone(s.tune)}));}]){
  const s=M.defaultState();mutate(s);assert.throws(()=>M.validateState(s));
 }
 assert.throws(()=>M.metrics(M.defaultState(),{start:1,end:1}),/positive duration/);
});
test('Whole saved interaction state and generated alternatives restore without triggering playback or audio',()=>{
 const s=M.defaultState();s.transport.playing=true;s.transport.time=2;s.transport.span=4;s.transport.step=.125;s.audio={enabled:true,mix:'b'};s.panel={inspect:true,height:420};s.alternatives=[{name:'Kept candidate',tune:clone(s.tune)}];
 s.inspection={contribution:{side:'B',key:'velocity'},openDetails:['source','receipt']};
 const renderer=state=>({version:'test-renderer/1',camera:state.camera,encoding:state.encoding});
 const packet=M.save(s,{sources:sourceFingerprints,renderingRecord:renderer}),before=JSON.stringify(packet),restored=M.restore(packet,{sources:sourceFingerprints,renderingRecord:renderer});
 assert.deepEqual(restored.state,s);assert.equal(JSON.stringify(packet),before);assert.equal(restored.state.audio.enabled,true);assert.equal(restored.state.transport.playing,true);
 assert.deepEqual(restored.receipt.observation.inspection,s.inspection);restored.state.inspection.openDetails.push('native');assert.deepEqual(packet.state.inspection.openDetails,['source','receipt']);
 restored.state.tune.frequency=4;assert.equal(packet.state.tune.frequency,.53);
});

test('Contribution selection is source-appropriate and disclosure state is strict',()=>{
 const s=M.defaultState();s.inspection={contribution:{side:'A',key:'position'},openDetails:[]};M.validateState(s);
 s.source='music';assert.throws(()=>M.validateState(s),/contribution channel/);s.inspection.contribution.key='right';M.validateState(s);
 const packet=M.save(s,{sources:sourceFingerprints});assert.deepEqual(M.restore(packet,{sources:sourceFingerprints}).state.inspection,s.inspection);
 s.source='lake';assert.throws(()=>M.validateState(s),/Lake records/);s.inspection.contribution=null;s.inspection.openDetails=['lakes'];M.validateState(s);
 for(const inspection of [{contribution:null,openDetails:['native','native']},{contribution:null,openDetails:['unknown']},{contribution:null,openDetails:'native'},{contribution:{side:'C',key:'position'},openDetails:[]},{contribution:{side:'A',key:'position',value:4},openDetails:[]},{contribution:null,openDetails:[],extra:true}]){
  const state=M.defaultState();state.inspection=inspection;assert.throws(()=>M.validateState(state));
 }
 const base=M.defaultState(),saved=M.save(base,{sources:sourceFingerprints});saved.state.inspection.openDetails=['receipt'];assert.throws(()=>M.restore(saved,{sources:sourceFingerprints}),/transformation receipt/);
});
test('Restore rejects altered transformation/source/rendering receipts and never trusts a supplied capture',()=>{
 const s=M.defaultState(),render={encoding:'envelope',mesh:48},p=M.save(s,{sources:sourceFingerprints,renderingRecord:render});
 for(const change of [x=>{x.transformationReceipt.reference.parameters.frequency=4;},x=>{x.transformationReceipt.alignment.native_time='displayTime * shift';},x=>{x.state.align.gain=2;},x=>{x.sources.oscillator.sha256='f'.repeat(64);},x=>{x.renderingRecord.mesh=49;},x=>{x.replayPolicy='trusted without checks';}]){
  const bad=clone(p);change(bad);assert.throws(()=>M.restore(bad,{sources:sourceFingerprints,renderingRecord:render}));
 }
 assert.throws(()=>M.restore(p,{sources:sourceFingerprints}),/rendering record disagrees/);
 assert.throws(()=>M.save(s,{sources:{music:sourceFingerprints.music}}),/oscillator requires a SHA-256/);
});

const failed=tests.filter(t=>!t.passed);console.log(JSON.stringify({scope:'Pure model, exact source selection, bounded discrepancy and session contracts; not browser or audio acceptance.',tests:tests.length,passed:tests.length-failed.length,failed:failed.length,results:tests},null,2));if(failed.length)process.exitCode=1;
