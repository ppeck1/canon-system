/* Small custody/interface checks. Browser/perceptual testing is separate. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('./evidence'),D=require('./domain'),V=require('./encoding'),F=require('./frames'),W=require('./mapping');
const bundle=JSON.parse(fs.readFileSync(path.join(__dirname,'data/bundle.json'),'utf8')),tests=[];
function test(name,fn){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.stack});}}
test('Evidence snapshot preserves every retained node and rejects source substitution',()=>{
  const input=structuredClone(bundle);input.extra_unmodeled_evidence={unit:null,relationship:{from:'A',to:'B'},empty:[],lexical:'0007'};
  const before=JSON.stringify(input),store=E.create(input,{bundleSha256:'test-revision'});
  assert.equal(JSON.stringify(input),before);
  assert.equal(JSON.stringify(store.bundle),before);
  assert.equal(store.bundleRevision,'test-revision');
  assert.ok(Object.isFrozen(store.bundle.source.tree));
  assert.ok(Object.isFrozen(store.bundle.extra_unmodeled_evidence.relationship));
  assert.deepEqual(store.bundle.extra_unmodeled_evidence,input.extra_unmodeled_evidence);
  input.extra_unmodeled_evidence.relationship.to='changed-outside-store';
  assert.equal(store.bundle.extra_unmodeled_evidence.relationship.to,'B');
  assert.equal(store.resolveSource('not-loaded').status,'missing_source');
  assert.equal(store.resolveSource('not-loaded').value,null);
  assert.equal(store.resolvePointer('/cases/0','not-loaded').status,'missing_source');
  assert.equal(store.resolvePointer('/cases/99999').status,'missing_pointer');
});
test('All ledger pointers resolve, including containers/nulls/unused content; raw bytes stay accessible',()=>{
  const store=E.create(bundle);
  assert.equal(store.bundle.ledger.length,670);
  for(const node of bundle.ledger){const found=store.resolvePointer(node.pointer);assert.equal(found.status,'resolved',node.pointer);assert.deepEqual(store.resolveLedger(node.pointer).value,node);}
  const source=store.resolveSource(bundle.source.sha256);
  assert.equal(source.status,'resolved');
  assert.equal(source.value.raw_base64,bundle.source.raw_base64);
  assert.deepEqual(source.value.tree,bundle.source.tree);
  assert.equal(store.resolvePointer('').value,store.bundle.source.packet);
  assert.equal(store.resolvePointer('/cases/~3').status,'missing_pointer');
  assert.equal(store.resolveRecord('not-loaded').status,'missing_record');
});
test('Record refs and independent origin, uncertainty, lineage, world and alignment are source-linked',()=>{
  const store=E.create(bundle),s=store.bundle.scenarios.find(x=>x.id==='P5J9/A'),w=s.worlds[1],r=w.records.at(-1);
  const selection={s,w,r,anchor:D.anchorFor(s,w,r.event_index,'first_completed_payload')};
  const m=D.describe(selection,store.bundle);
  assert.equal(m.origin.record_origin,'simulated_state');
  assert.equal(m.origin.producer.version,'sha256:'+bundle.metadata.behavior_copy_sha256);
  assert.equal(m.claim.world_uncertainty.actual_rate_unknown,true);
  assert.equal(m.alignment.status,'available');
  assert.equal(m.lineage.output_ref.kind,'derived_partition');
  assert.equal(m.world.world_id,w.id);
  assert.equal(m.claim.source_custody_is_world_truth,false);
  const record=store.resolveRecord(r.id);
  assert.equal(record.status,'resolved');assert.equal(record.value.id,r.id);
  assert.equal(record.ref.source_revision,bundle.source.sha256);
  assert.equal(record.world.id,w.id);assert.equal(record.scenario.id,s.id);
});
test('Compatibility facade delegates original functions rather than copying domain/encoding implementations',()=>{
  assert.equal(W.partition,D.partition);assert.equal(W.prefix,D.prefix);assert.equal(W.anchorFor,D.anchorFor);
  assert.equal(W.field,V.field);assert.equal(W.cropInfo,V.cropInfo);assert.equal(W.categories,V.categories);
  const code=fs.readFileSync(path.join(__dirname,'mapping.js'),'utf8');
  assert.ok(!code.includes('Math.exp'));assert.ok(!code.includes('identities.required'));
});
test('Encoding contract is separate, versioned and declares crop/units/loss without changing counts',()=>{
  const r=bundle.scenarios.find(x=>x.id==='T4M6/A').worlds[0].records[0],p=D.partition(r),before=JSON.stringify(p);
  const contract=V.contract({inputRef:{kind:'derived_partition',id:r.id+'#'+D.mappingVersion},weights:p.weights,h:.6,gain:1.35});
  assert.equal(contract.id,'required-work-disposition-gaussian/1');
  assert.equal(contract.input_refs[0].kind,'derived_partition');
  assert.equal(contract.parameters.shared_height_gain,1.35);
  assert.equal(contract.reversibility.status,'lossy_visual_encoding');
  assert.ok(contract.uncertainty_effect.includes('not probability'));
  assert.ok(contract.crop.outside_mass_approx>0);
  assert.equal(JSON.stringify(p),before);
});
test('Frame transform records ordered execution, references, loss and untouched source timestamps',()=>{
  const s=bundle.scenarios.find(x=>x.id==='H9C3/A'),w=s.worlds[0],r=w.records.at(-1),z={s,w,r,anchor:D.anchorFor(s,w,r.event_index,'first_service_boundary')};
  const frame=F.side(z,{clock:'aligned',span:1.5});
  assert.deepEqual(frame.nativeWindow,[2.5,4]);assert.deepEqual(frame.displayWindow,[1.5,3]);
  assert.equal(frame.carryIn.time_s,2);assert.equal(frame.carryIn.aligned_time_s,1);assert.equal(frame.carryIn.display_time_s,1.5);
  assert.equal(frame.carryIn.isObservedEvent,false);
  assert.equal(frame.transform.input_refs[0].source_revision,bundle.source.sha256);
  assert.equal(frame.transform.implementation_version,F.version);
  assert.ok(frame.transform.composition[0].includes('as-of'));
  assert.ok(frame.transform.reversibility.selection.includes('lossy view selection'));
  assert.ok(frame.transform.output_refs.some(x=>x.kind==='held_state_boundary'));
  assert.equal(F.side({...z,anchor:{name:'nonexistent'}},{clock:'aligned',span:1}).status,'unavailable');
  assert.equal(F.combine(frame,F.side({...z,anchor:{name:'nonexistent'}},{clock:'aligned',span:1})).status,'unavailable');
});
const report={passed:tests.every(x=>x.passed),tests_total:tests.length,tests_passed:tests.filter(x=>x.passed).length,
  scope:'Custody and pure module contracts only; not browser or perceptual usability evidence.',results:tests};
fs.writeFileSync(path.join(__dirname,'boundary_checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
