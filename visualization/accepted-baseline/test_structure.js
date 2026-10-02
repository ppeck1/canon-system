'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('./evidence'),D=require('./domain'),F=require('./frames'),S=require('./structure'),UI=require('./structure-ui');
const bundle=JSON.parse(fs.readFileSync(path.join(__dirname,'data/bundle.json'),'utf8')),before=JSON.stringify(bundle),store=E.create(bundle),results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.stack});}}
function select(id,event=0,wi=0){const s=store.bundle.scenarios.find(x=>x.id===id),w=s.worlds[wi],r=event==='end'?w.records.at(-1):w.records.find(x=>x.event_index===event);return {s,w,r,anchor:D.anchorFor(s,w,r.event_index,'decision')};}
function resolveRecordPath(record,pointer){let v=record;for(const part of pointer.split('/').slice(1)){const key=part.replace(/~1/g,'/').replace(/~0/g,'~');assert.ok(v!==null&&Object.hasOwn(v,key),'Missing record path '+pointer);v=v[key];}return v;}
test('All 99 graphs reconstruct exact required/ready-rank/backup/completed relations without changing source',()=>{
 let count=0;
 for(const s of store.bundle.scenarios)for(const w of s.worlds)for(const r of w.records){const g=S.graph({s,w,r},{store}),ids=g.nodes.filter(n=>n.kind==='identity');
  assert.equal(ids.length,new Set([...r.identities.required,...r.identities.pending,...r.identities.backups,...r.identities.completed]).size);
  for(const [kind,field]of [['required','required'],['ready_fifo','pending'],['backup_copy','backups'],['completed','completed']]){
   const edges=g.edges.filter(e=>e.kind===kind);assert.equal(edges.length,r.identities[field].length);
   edges.forEach(edge=>{const id=g.nodes.find(n=>n.id===edge.from).identity;assert.ok(r.identities[field].includes(id));if(kind==='ready_fifo')assert.equal(edge.fifo_rank,r.identities.pending.indexOf(id)+1);});
  }
  const absent=r.identities.required.filter(id=>!r.identities.pending.includes(id)&&!r.identities.backups.includes(id)&&!r.identities.completed.includes(id));
  assert.deepEqual(g.edges.filter(e=>e.kind==='no_listed_copy').map(e=>g.nodes.find(n=>n.id===e.from).identity),absent);
  assert.equal(g.inference.new_hypotheses,0);assert.ok(g.supplied_claims.every(c=>c.status==='supplied_unverified_claim'&&!c.used_for_graph_state));count++;
 }
 assert.equal(count,99);assert.equal(JSON.stringify(bundle),before);
});
test('Every source pointer and record-field locator resolves to the selected revision/event',()=>{
 for(const s of store.bundle.scenarios)for(const w of s.worlds)for(const r of w.records){const g=S.graph({s,w,r},{store});
  for(const item of [...g.nodes,...g.edges,...g.supplied_claims]){
   for(const ref of item.source_refs||[])assert.equal(store.resolvePointer(ref.pointer,ref.source_revision).status,'resolved',ref.pointer);
   for(const ref of item.record_refs||[]){assert.equal(ref.record_id,r.id);assert.equal(ref.world_id,w.id);resolveRecordPath(r,ref.path);}
  }
 }
});
test('Identity click links exact case/world/event with simultaneous ready and retained backup membership',()=>{
 const z=select('T4M6/A',1),g=S.graph(z,{store,side:'A'}),node=g.nodes.find(n=>n.identity==='w2'),payload=UI.inspectionPayload(g,node,'identity');
 assert.equal(payload.caseId,'T4M6');assert.equal(payload.identity,'w2');assert.equal(payload.side,'A');assert.equal(payload.record_id,z.r.id);
 assert.equal(payload.detail.pending_fifo_rank,3);assert.equal(payload.detail.backup_copy,true);
 assert.ok(payload.detail.relations.some(x=>x.kind==='ready_fifo'));assert.ok(payload.detail.relations.some(x=>x.kind==='backup_copy'));
 const b=S.graph(select('T4M6/B',1),{store,side:'B'}),other=b.nodes.find(n=>n.identity==='w2');
 assert.equal(other.id,node.id,'Identity is case-scoped');assert.notEqual(b.selection.world_id,g.selection.world_id);
 assert.equal(other.detail.ready,false);assert.equal(other.detail.backup_copy,true);
 assert.ok(UI.systemSvg(g,{side:'A',caseId:'T4M6',identity:'w2'}).includes('#fff0b9'));
 assert.ok(!UI.systemSvg(g,{side:'B',caseId:'T4M6',identity:'w2'}).includes('#fff0b9'));
});
test('Future-only edits and completed outcome changes do not alter earlier graph or lineage',()=>{
 const z=select('T4M6/A',1),original=S.graph(z,{store}),baselineLineage=S.lineage(z,{store});
 const changed=structuredClone(z);changed.w.outcome={success:'invented future'};
 for(const r of changed.w.records.filter(r=>r.event_index>1)){Object.defineProperty(r,'identities',{get(){throw Error('Future identities read');}});Object.defineProperty(r,'values',{get(){throw Error('Future values read');}});}
 assert.deepEqual(S.graph(changed,{store}),original);assert.deepEqual(S.lineage(changed,{store}),baselineLineage);
 const pre=S.graph(select('T4M6/A',0),{store});assert.equal(pre.nodes.find(n=>n.identity==='w2').detail.ready,false);assert.equal(original.nodes.find(n=>n.identity==='w2').detail.ready,true);
});
test('Declared rules retain their exact source values, and no claim is promoted to inferred topology',()=>{
 const g=S.graph(select('B2R8/A',0),{store});
 for(const rule of g.constraints)assert.deepEqual(rule.value,store.resolvePointer(rule.source_refs[0].pointer).value);
 assert.equal(g.constraints.find(x=>x.rule_id==='selected_action').status,'declared_action_not_yet_applied');
 assert.equal(g.constraints.find(x=>x.rule_id==='deadline').value,2);
 assert.ok(!g.edges.some(e=>e.status==='inferred_hypothesis'));
 assert.equal(g.supplied_claims[0].value,store.resolvePointer(g.supplied_claims[0].source_refs[0].pointer).value);
});
test('Lineage separates native channels from required-work geometry and missing/excluded frames',()=>{
 const z=select('T4M6/A',3),frame=F.side(z,{clock:'native',span:1}),effective={observation:{A:frame},versions:{renderer:'test'},encoding:{preset:'required-work-disposition-gaussian/1'}};
 const g=S.lineage(z,{store,effective,channelKey:'ready'});
 assert.equal(g.nodes.find(n=>n.id==='channel').detail.formula,'count(identities.pending)');
 assert.ok(g.nodes.some(n=>n.id==='partition'));assert.ok(!g.edges.some(e=>e.from==='channel'&&e.to==='encoding'));
 assert.equal(g.nodes.find(n=>n.id==='frame').detail.selected_record_status,'selected_event_in_window');
 assert.equal(S.lineage(z,{store}).nodes.find(n=>n.id==='frame').detail.selected_record_status,'frame_not_supplied');
 assert.equal(S.lineage(z,{store,effective:{observation:{A:{status:'unavailable'}}}}).nodes.find(n=>n.id==='frame').detail.selected_record_status,'frame_unavailable');
 const earlier=F.side(z,{clock:'native',span:1,timeOffset:-1});
 assert.equal(S.lineage(z,{store,effective:{observation:{A:earlier}}}).nodes.find(n=>n.id==='frame').detail.selected_record_status,'selected_event_outside_window');
});
test('Calibration lineage consumes supplied support and remains outside queue evidence',()=>{
 const T=require('./timescale'),r=T.analyze(T.makeCalibration('chirp'),{mode:'prefix',asOfIndex:127}),s=T.coefficientSupport(r,0,100),k=T.inspectKernel(r,0,100);
 const g=S.calibrationLineage({result:r,support:s,kernelInspection:k,recipe:{signal:'chirp',mode:'prefix',endSample:127,row:0,sample:100}});
 assert.equal(g.kind,'calibration_lineage');assert.ok(g.separation.includes('no queue events'));assert.deepEqual(g.nodes.find(n=>n.id==='cal-coefficient').detail,s);
 assert.throws(()=>S.calibrationLineage({result:r,support:{...s,source_revision:'wrong'}}),/must match/);
 assert.throws(()=>S.calibrationLineage({result:r,support:{...s,sample_index:1000}}),/Invalid sample/);
 assert.throws(()=>S.calibrationLineage({result:r,support:{...s,mode:'retrospective',as_of_index:null}}),/differs/);
 assert.throws(()=>S.calibrationLineage({result:r,support:{...s,real:s.real+1}}),/differs/);
 assert.throws(()=>S.calibrationLineage({result:r,support:s,kernelInspection:{...k,reconstructed:{...k.reconstructed,real:17}}}),/Kernel inspection differs/);
 assert.throws(()=>S.calibrationLineage({result:r,support:s,recipe:{signal:'chirp',mode:'prefix',endSample:511}}),/endpoint differs/);
 const later=T.analyze(T.makeCalibration('chirp'),{mode:'prefix',asOfIndex:255});
 assert.throws(()=>S.calibrationLineage({result:r,support:T.coefficientSupport(later,0,100)}),/differs/);
});
test('Calibration rendering lineage validates actual camera/mesh record against the selected result and recipe',()=>{
 const T=require('./timescale'),L=require('./timescale-landscape'),r=T.analyze(T.makeCalibration('constant'),{mode:'prefix',asOfIndex:63}),s=T.coefficientSupport(r,2,40);
 const camera={...L.defaultCamera,yaw:.2},recipe={signal:'constant',mode:'prefix',endSample:63,row:2,sample:40,landscapeVersion:L.version,landscapeCamera:camera};
 const rendering=L.renderingRecord(r,{camera,row:2,sample:40});
 const g=S.calibrationLineage({result:r,support:s,recipe,rendering});
 assert.equal(g.nodes.length,6);assert.equal(g.edges.at(-1).label,'camera / mesh projection');
 assert.equal(g.nodes.at(-1).id,'cal-render');assert.equal(g.nodes.at(-1).detail.status,'available');assert.deepEqual(g.nodes.at(-1).detail.record,rendering);
 assert.ok(UI.lineageSvg(g).includes('Camera / mesh projection'));
 assert.equal(S.calibrationLineage({result:r,support:s,recipe}).nodes.at(-1).detail.status,'unavailable');
 assert.throws(()=>S.calibrationLineage({result:r,support:s,recipe,rendering:{...rendering,vertices:1}}),/Rendering record differs/);
 assert.throws(()=>S.calibrationLineage({result:r,support:s,recipe,rendering:L.renderingRecord(r,{camera:{...camera,yaw:.7},row:2,sample:40})}),/Rendering record differs/);
 assert.throws(()=>S.calibrationLineage({result:r,support:s,recipe,rendering:L.renderingRecord(r,{camera,row:2,sample:41})}),/Rendering record differs/);
 assert.throws(()=>S.calibrationLineage({result:r,support:s,recipe,rendering:{...rendering,viewport:{width:0,height:100,pixel_ratio:1}}}),/viewport is invalid/);
});
const report={passed:results.every(x=>x.passed),tests_total:results.length,tests_passed:results.filter(x=>x.passed).length,scope:'Pure structure reconstruction, reference resolution and lineage checks. Actual browser usability is separate.',results};
fs.writeFileSync(path.join(__dirname,'structure_checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
