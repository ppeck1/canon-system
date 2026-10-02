/* Body receipt replay and historical capture separation; no pixel claim. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Renderer=require('./renderer.js'),Session=require('./session.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const raw=fs.readFileSync(path.join(__dirname,'data/bundle.json'));
const session=Session.create(JSON.parse(raw),{bundleSha:crypto.createHash('sha256').update(raw).digest('hex'),rendererVersion:Renderer.version,cameraLimits:Renderer.cameraLimits});
const old=read('example-aligned.json'),tests=[];
function test(name,fn){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.stack});}}

for(const [name,change] of [
 ['field formula',r=>{r.encoding.field_formula='invented probability density';}],
 ['mesh resolution',r=>{r.mesh.intervals_per_axis=104;r.mesh.vertices_per_axis=105;}],
 ['coordinate unit description',r=>{r.coordinate_roles.z='physical stress in pascals';}],
 ['history timestamp',r=>{r.history.per_side_records.A[0].native_time_s+=0.125;}]
])test('Reject modified '+name+' in both legacy and newly split receipts',()=>{
 const originalEffective=clone(old.effective);
 const badLegacy=clone(old);change(badLegacy.rendering_record);
 assert.throws(()=>session.restore(badLegacy),/body rendering record disagrees/);
 assert.deepEqual(badLegacy.effective,originalEffective);
 const split=session.save(old.effective,{renderingRecord:old.rendering_record});
 change(split.rendering_record);
 assert.throws(()=>session.restore(split),/body rendering record disagrees/);
});

test('All ten retained saved examples replay their original effective configuration',()=>{
 const examples=fs.readdirSync(__dirname).filter(x=>/^example-.*\.json$/.test(x));
 assert.ok(examples.length>=10);
 for(const name of examples){const saved=read(name),before=JSON.stringify(saved);assert.deepEqual(session.restore(saved).effective,saved.effective,name);assert.equal(JSON.stringify(saved),before,name+' remains untouched');}
});

test('New exports segregate viewport, clipping and fit captures without changing the recipe',()=>{
 const before=JSON.stringify(old),saved=session.save(old.effective,{renderingRecord:old.rendering_record});
 assert.equal(saved.rendering_record.projection.viewport,null);
 assert.ok(!Object.hasOwn(saved.rendering_record,'actual_bounds'));
 assert.ok(!Object.hasOwn(saved.rendering_record,'last_shared_fit'));
 assert.equal(saved.rendering_capture.validation,'unvalidated_historical_capture');
 assert.deepEqual(saved.rendering_capture.viewport,old.rendering_record.projection.viewport);
 assert.deepEqual(saved.rendering_capture.actual_bounds,old.rendering_record.actual_bounds);
 assert.deepEqual(saved.rendering_capture.last_shared_fit,old.rendering_record.last_shared_fit);
 assert.match(saved.replay_claims.body_rendering,/unvalidated historical capture/);
 assert.deepEqual(session.restore(saved).effective,old.effective);
 assert.equal(JSON.stringify(old),before);
});

test('Historical capture is informational and cannot claim validation or alter replay',()=>{
 const saved=session.save(old.effective,{renderingRecord:old.rendering_record});
 saved.rendering_capture.viewport={width:123,height:456,pixel_ratio:9};
 saved.rendering_capture.actual_bounds={historical_note:'not independently reproduced'};
 const restored=session.restore(saved);
 assert.deepEqual(restored.effective,old.effective);
 assert.equal(restored.renderingCapture.validation,'unvalidated_historical_capture');
 assert.deepEqual(restored.renderingCapture.actual_bounds,saved.rendering_capture.actual_bounds);
 saved.rendering_capture.validation='validated';
 assert.throws(()=>session.restore(saved),/explicitly labeled unvalidated/);
 const legacy=session.restore(old);
 assert.equal(legacy.renderingCapture.validation,'unvalidated_historical_capture');
 assert.deepEqual(legacy.renderingCapture.viewport,old.rendering_record.projection.viewport);
});

test('Other renderer contract fields are validated, including missing or extra semantic fields',()=>{
 for(const change of [r=>{r.contours.units='invented';},r=>{r.projection.pan_units='seconds';},r=>{r.history.per_side_records.A.reverse();},r=>{delete r.mesh;},r=>{r.unrecognized_semantics=true;}]){
  const bad=clone(old);change(bad.rendering_record);assert.throws(()=>session.restore(bad),/body rendering record disagrees/);
 }
 const bad=clone(old.rendering_record);bad.encoding.field_formula='inconsistent export';
 assert.throws(()=>session.save(old.effective,{renderingRecord:bad}),/body rendering record disagrees/);
});

const failed=tests.filter(t=>!t.passed);
console.log(JSON.stringify({scope:'Canonical body rendering receipt replay; historical viewport/clipping/fit metadata explicitly excluded from validation.',tests_run:tests.length,passed:tests.length-failed.length,failed:failed.length,tests},null,2));
if(failed.length)process.exitCode=1;
