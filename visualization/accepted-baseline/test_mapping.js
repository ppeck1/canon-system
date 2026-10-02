/* Independent numeric/data checks. These do not prove browser or perceptual usability. */
'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const root=__dirname, mapping=require('./mapping.js');
const readJson=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const bundle=readJson('data/bundle.json');
const originalBundle=JSON.stringify(bundle), results=[];
function test(name,fn) { const started=Date.now(); try {fn();results.push({name,passed:true,elapsed_ms:Date.now()-started});} catch(e) {results.push({name,passed:false,error:e.stack});} }
const scenario=id=>{const s=bundle.scenarios.find(s=>s.id===id); assert.ok(s,id); return s;};
const world=(id,index=0)=>scenario(id).worlds[index];
const record=(id,index,worldIndex=0)=>world(id,worldIndex).records[index];
const last=(id,worldIndex=0)=>world(id,worldIndex).records.at(-1);
const weight=r=>mapping.partition(r).weights;
function expectedPartition(r) {
  // Enumerate each required identity independently; never use the view's counts.
  const out={ready:[],backup_only:[],absent:[],completed:[]};
  r.identities.required.forEach(id=>{
    let label='absent';
    if(r.identities.backups.includes(id)) label='backup_only';
    if(r.identities.pending.includes(id)) label='ready';
    if(r.identities.completed.includes(id)) label='completed';
    out[label].push(id);
  });
  return out;
}
function deepFreeze(obj) { if(obj && typeof obj==='object' && !Object.isFrozen(obj)) {Object.freeze(obj);Object.values(obj).forEach(deepFreeze);} return obj; }
deepFreeze(bundle);

test('All 99 records: independently derived disjoint exhaustive required-identity membership',()=>{
  let count=0;
  for(const s of bundle.scenarios) for(const w of s.worlds) for(const r of w.records) {
    const p=mapping.partition(r), expected=expectedPartition(r);
    assert.deepEqual(p.identities,expected);
    const all=Object.values(p.identities).flat();
    assert.equal(new Set(all).size,r.identities.required.length);
    assert.deepEqual(all.slice().sort(),r.identities.required.slice().sort());
    for(const [k,ids] of Object.entries(expected)) assert.equal(p.weights[k],ids.length);
    assert.equal(p.total,r.identities.required.length);
    assert.deepEqual(p.source_refs,r.source_refs);
    count++;
  }
  assert.equal(count,99);
});
test('V01 replay moves w2 backup-only to ready at the same native time; no-replay retains it',()=>{
  const pre=record('T4M6/A',0),post=record('T4M6/A',1);
  assert.equal(pre.time_s,0);assert.equal(post.time_s,0);
  assert.ok(pre.event_index<post.event_index);
  assert.deepEqual(weight(pre),{ready:2,backup_only:1,absent:0,completed:0});
  assert.deepEqual(weight(post),{ready:3,backup_only:0,absent:0,completed:0});
  assert.deepEqual(mapping.partition(pre).identities.backup_only,['w2']);
  assert.ok(mapping.partition(post).identities.ready.includes('w2'));
  assert.deepEqual(weight(last('T4M6/B')),{ready:0,backup_only:1,absent:0,completed:2});
  assert.deepEqual(weight(last('T4M6/A')),{ready:0,backup_only:0,absent:0,completed:3});
});
test('V02 empty ready differs: absent versus backup-only remains distinguishable',()=>{
  const h=weight(last('H9C3/A')),t=weight(last('T4M6/B'));
  assert.equal(h.ready,0);assert.equal(t.ready,0);
  assert.equal(h.absent,1);assert.equal(h.backup_only,0);
  assert.equal(t.absent,0);assert.equal(t.backup_only,1);
});
test('V03 coincident disposition does not erase distinct source identities, actions or histories',()=>{
  const a=world('D8V1/C').records,b=world('T4M6/A').records;
  for(let i=1;i<a.length;i++) assert.deepEqual(weight(a[i]),weight(b[i]));
  assert.notDeepEqual(a[0].identities,b[0].identities);
  assert.notDeepEqual(a[1].source_refs,b[1].source_refs);
  assert.notDeepEqual(scenario('D8V1/C').action,scenario('T4M6/A').action);
  assert.notDeepEqual(mapping.partition(a[2]).identities,mapping.partition(b[2]).identities);
});
test('V04 zero/two-rate alternatives remain distinct worlds with separate endpoint partitions',()=>{
  const w=scenario('P5J9/B').worlds;
  assert.deepEqual(w.map(x=>x.rate),[0,2]);
  assert.equal(w.length,2);
  assert.equal(weight(w[0].records.at(-1)).ready,3);
  // Action B pauses one service tick: the rate-two alternative completes two,
  // leaving one, unlike action C's no-pause rate-two endpoint.
  assert.equal(weight(w[1].records.at(-1)).ready,1);
  assert.equal(weight(w[1].records.at(-1)).completed,2);
  assert.equal(weight(last('P5J9/C',1)).completed,3);
  assert.notEqual(w[0].id,w[1].id);
  w.forEach(x=>assert.equal(x.uncertainty.do_not_average,true));
});
test('V05 original two-second deadline leaves three ready under B and zero under C',()=>{
  assert.equal(scenario('B2R8/B').deadline_s,2);
  assert.equal(scenario('B2R8/C').deadline_s,2);
  assert.deepEqual(weight(last('B2R8/B')),{ready:3,backup_only:0,absent:0,completed:4});
  assert.deepEqual(weight(last('B2R8/C')),{ready:0,backup_only:0,absent:0,completed:7});
});
test('Rendering softness changes density only; exact source and partition remain unchanged',()=>{
  const r=record('T4M6/A',0),p=mapping.partition(r), before=JSON.stringify(p);
  const narrow=mapping.field(-1.2,-1.1,p.weights,.35),soft=mapping.field(-1.2,-1.1,p.weights,1.1);
  assert.notEqual(narrow,soft);
  assert.equal(JSON.stringify(mapping.partition(r)),before);
  assert.equal(JSON.stringify(bundle),originalBundle);
  assert.ok(mapping.field(1.2,-1.1,p.weights,.35)>mapping.field(0,-1.1,p.weights,.35),'two lobes, no forced single Gaussian');
});
test('Fixed native categorical anchors and one count-density scale, no total normalization',()=>{
  assert.deepEqual(mapping.categories.map(k=>[k.key,k.u,k.v]),[['ready',-1.2,-1.1],['backup_only',1.2,-1.1],['absent',1.2,1.1],['completed',-1.2,1.1]]);
  const one={ready:1,backup_only:0,absent:0,completed:0},two={ready:2,backup_only:0,absent:0,completed:0};
  for(const h of [.35,.7,1.2]) assert.equal(mapping.field(.5,.25,two,h),2*mapping.field(.5,.25,one,h));
  assert.equal(mapping.field(0,0,{ready:0,backup_only:0,absent:0,completed:0},.7),0);
});
test('Finite crop mass agrees with independent Simpson quadrature; whole-plane integral equals source total',()=>{
  const weights={ready:2,backup_only:1,absent:3,completed:1},h=1.2,b=[-3.6,3.6,-3.6,3.6];
  function integral(lo,hi,center) {
    const n=2000,step=(hi-lo)/n;
    let s=0;
    for(let i=0;i<=n;i++) {const x=lo+i*step; s+=(i===0||i===n?1:i%2?4:2)*Math.exp(-.5*((x-center)/h)**2)/(Math.sqrt(2*Math.PI)*h);}
    return s*step/3;
  }
  let reference=0;
  for(const k of mapping.categories) reference+=weights[k.key]*integral(b[0],b[1],k.u)*integral(b[2],b[3],k.v);
  const actual=mapping.cropInfo(weights,h,b);
  assert.ok(Math.abs(actual.inside_mass_approx-reference)<=actual.absolute_error_bound);
  assert.ok(actual.inside_mass_approx<7);assert.ok(actual.outside_mass_approx>0);
  assert.ok(Math.abs(mapping.cropMass(weights,h,[-100,100,-100,100])-7)<1e-12);
  assert.equal(mapping.cropInfo({ready:0,backup_only:0,absent:0,completed:0},h).inside_fraction,null);
});
test('Kernel, partition and selection reject invalid values rather than impute facts',()=>{
  const r=structuredClone(record('T4M6/A',0)); delete r.identities.backups;
  assert.throws(()=>mapping.partition(r),/Missing identity array/);
  const duplicate=structuredClone(record('T4M6/A',0));duplicate.identities.required.push('w1');
  assert.throws(()=>mapping.partition(duplicate),/Duplicate identity/);
  assert.throws(()=>mapping.field(0,0,{ready:0,backup_only:0,absent:0,completed:0},0),/positive/);
  assert.throws(()=>mapping.field(0,0,{ready:-1,backup_only:0,absent:0,completed:0},1),/nonnegative/);
  assert.throws(()=>mapping.prefix(world('T4M6/A'),999),/does not exist/);
});
test('Every selected prefix preserves duplicate-time pre/post ordering and excludes future event/time/knowledge',()=>{
  for(const s of bundle.scenarios) for(const w of s.worlds) for(const selected of w.records) {
    const result=mapping.prefix(w,selected.event_index);
    assert.deepEqual(result.map(r=>r.id),w.records.filter(r=>r.event_index<=selected.event_index&&r.time_s<=selected.time_s&&r.known_at_s<=selected.time_s).map(r=>r.id));
  }
  assert.deepEqual(mapping.prefix(world('T4M6/A'),0).map(r=>r.event_kind),['pre_action']);
  assert.deepEqual(mapping.prefix(world('T4M6/A'),1).map(r=>r.event_kind),['pre_action','post_action']);
  const delayed=structuredClone(world('T4M6/A'));delayed.records[0].known_at_s=2;
  assert.deepEqual(mapping.prefix(delayed,2).map(r=>r.event_index),[1,2]);
  assert.throws(()=>mapping.prefix(delayed,0),/not known/);
});
test('Future records, full-world segments and outcomes are not consulted by selected partition/anchor',()=>{
  const w=structuredClone(world('T4M6/A'));
  Object.defineProperty(w,'segments',{get(){throw Error('future segments read');}});
  Object.defineProperty(w,'outcome',{get(){throw Error('future outcome read');}});
  for(const r of w.records.filter(r=>r.event_index>1)) Object.defineProperty(r,'identities',{get(){throw Error('future identities read');}});
  assert.equal(mapping.prefix(w,1).length,2);
  assert.equal(mapping.anchorFor(scenario('T4M6/A'),w,1,'first_completed_payload').available,false);
});
test('Registration anchor known-at semantics preserve no-completion alternatives and native seconds',()=>{
  const s=scenario('T4M6/A'),w=s.worlds[0];
  assert.equal(mapping.anchorFor(s,w,0,'native').anchor_s,0);
  assert.equal(mapping.anchorFor(s,w,0,'decision').anchor_s,0);
  assert.equal(mapping.anchorFor(s,w,0,'first_service_boundary').anchor_s,1);
  assert.equal(mapping.anchorFor(s,w,1,'first_completed_payload').available,false);
  const completed=mapping.anchorFor(s,w,2,'first_completed_payload');
  assert.equal(completed.anchor_s,1);assert.equal(completed.basis_record_id,w.records[2].id);
  const zero=world('P5J9/B',0);
  assert.equal(mapping.anchorFor(scenario('P5J9/B'),zero,zero.records.at(-1).event_index,'first_completed_payload').available,false);
  assert.equal(mapping.anchorFor(s,w,3,'invented_recovery').available,false);
  for(const native of [0,1,2,3]) assert.equal((native-completed.anchor_s)+completed.anchor_s,native);
});
test('Exact copied source artifacts and source envelope agree with independently recomputed SHA-256',()=>{
  const manifest=readJson('copied_source_manifest.json'); assert.equal(manifest.files.length,6);
  for(const entry of manifest.files) {
    const raw=fs.readFileSync(path.join(root,entry.copied_path));
    assert.equal(raw.length,entry.byte_length);
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),entry.sha256);
    if(fs.existsSync(entry.original_path)) assert.ok(raw.equals(fs.readFileSync(entry.original_path)));
  }
  const raw=Buffer.from(bundle.source.raw_base64,'base64');
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),bundle.source.sha256);
  assert.ok(raw.equals(fs.readFileSync(path.join(root,'data/sources/cases.json'))));
  assert.deepEqual(JSON.parse(raw.toString('utf8')),bundle.source.packet);
});
test('Retained source scope still exposes 670 nodes and unaligned sensor evidence',()=>{
  assert.equal(bundle.ledger.length,670);
  const sourceNodeCount=node=>1+(node.type==='object'?node.members.reduce((n,x)=>n+sourceNodeCount(x.node),0):node.type==='array'?node.items.reduce((n,x)=>n+sourceNodeCount(x),0):0);
  assert.equal(sourceNodeCount(bundle.source.tree),670);
  assert.equal(bundle.source.packet.cases.length,12);
  assert.ok(bundle.ledger.some(x=>x.structural_status==='preserved_unaligned'));
  assert.ok(bundle.ledger.some(x=>x.model_usage==='not_used_in_queue_model'));
});
test('Rendering contract records proposed mapping, finite crop, shared calibration and unrepresented fields',()=>{
  const c=readJson('rendering_contract.json');
  assert.equal(c.mapping_version,mapping.mappingVersion);
  assert.equal(c.kernel.version,mapping.kernelVersion);
  assert.deepEqual(c.kernel.crop_bounds,Array.from(mapping.defaultBounds));
  assert.equal(c.comparison.maximum_simultaneous_worlds,2);
  assert.ok(c.comparison.required_shared_parameters.includes('kernel_width'));
  assert.ok(c.comparison.required_shared_parameters.includes('value_scale'));
  assert.ok(c.information_not_geometrically_represented.length>=5);
  assert.ok(c.acceptance.browser.includes('non-browser'));
  assert.ok(c.provenance.equation_status.includes('not a recovered'));
});

const report={passed:results.every(x=>x.passed),tests_passed:results.filter(x=>x.passed).length,tests_total:results.length,
  records_checked:99,worlds_checked:21,source_nodes_retained:670,
  scope:'Pure data/mapping and preservation checks only. Browser rendering, interaction, export/restore and human perceptual acceptance require separate evidence.',
  checked_at:new Date().toISOString(),results};
fs.writeFileSync(path.join(root,'checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exitCode=report.passed?0:1;
