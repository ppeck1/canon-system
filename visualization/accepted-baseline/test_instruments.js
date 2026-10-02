/* Numeric direct-view and shared-frame regressions. SVG stubs do not replace browser QA. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('./domain.js'),F=require('./frames.js'),C=require('./channels.js'),I=require('./instruments.js');
const bundle=JSON.parse(fs.readFileSync(path.join(__dirname,'data/bundle.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),tests=[];
function test(name,fn){try{fn();tests.push({name,passed:true});}catch(error){tests.push({name,passed:false,error:error.stack});}}
function select(id='T4M6/A',worldIndex=0,eventIndex=null,anchor='decision',source=bundle){
 const s=source.scenarios.find(s=>s.id===id),w=s.worlds[worldIndex],r=eventIndex===null?w.records.at(-1):w.records.find(r=>r.event_index===eventIndex);
 return {s,w,r,p:D.partition(r),prefix:D.prefix(w,r.event_index),anchor:D.anchorFor(s,w,r.event_index,anchor)};
}
function svg(id='test'){
 let markup='',nodes=[];
 return {id,attributes:{},setAttribute(k,v){this.attributes[k]=v;},
  get innerHTML(){return markup;},set innerHTML(value){markup=value;nodes=[...value.matchAll(/<g\b([^>]*\bdata-event="[^"]+"[^>]*)>([\s\S]*?)<\/g>/g)].map(match=>{
   const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));
   const circle=match[2].match(/<circle\b([^>]*)>/),coords=Object.fromEntries([...(circle?.[1]||'').matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));
   return {dataset:{side:attrs['data-side'],event:attrs['data-event'],record:attrs['data-record']},cx:+coords.cx,cy:+coords.cy,r:+coords.r,title:match[2].match(/<title>([\s\S]*?)<\/title>/)?.[1]||'',body:match[2]};
  });},querySelectorAll(selector){assert.equal(selector,'[data-event]');return nodes;},get nodes(){return nodes;}};
}
const settings={clock:'native',timeChannels:['ready','unfinished'],xChannel:'ready',yChannel:'unfinished',yMax:null};
const noop=()=>{};
function paths(markup,color){return [...markup.matchAll(/<path\b([^>]*)>/g)].map(x=>Object.fromEntries([...x[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]))).filter(x=>x.stroke===color);}
function near(a,b){assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);}
function withMissing(key,index=2){
 const z=select(),a=clone(I.series(z,'a',{span:4})),row=a.rows.find(p=>p.r.event_index===index);
 row.v[key]=null;
 // Keep event references shared like an actual adapter result after JSON copying.
 a.events=a.rows.filter(p=>!p.carry);
 return {a,row};
}

test('Every retained event uses the exact independent source-channel values',()=>{
 for(const s of bundle.scenarios)for(const w of s.worlds)for(const r of w.records){
  assert.deepEqual(I.values(r),C.record(r).values,r.id);
  assert.equal(I.values(r).ready,r.identities.pending.length);
  assert.equal(I.values(r).unfinished,r.identities.required.filter(id=>!r.identities.completed.includes(id)).length);
 }
});

test('Replay pairs retain both ordered states at time zero and the no-replay alternative',()=>{
 const a=I.series(select(),'a',{span:4}),b=I.series(select('T4M6/B'),'b',{span:4});
 assert.deepEqual(a.events.map(p=>[p.v.ready,p.v.unfinished]),[[2,3],[3,3],[2,2],[1,1],[0,0]]);
 assert.deepEqual(b.events.at(-1).v.ready,0);assert.equal(b.events.at(-1).v.unfinished,1);
 assert.equal(a.events[0].time,a.events[1].time);assert.notEqual(a.events[0].r.id,a.events[1].r.id);
 assert.deepEqual(a.events.map(p=>p.r.id),select().prefix.map(r=>r.id));
});

test('Time markers retain exact values and same-time handles select distinct source events',()=>{
 const a=I.series(select(),'a',{span:4}),out=svg(),picked=[];
 const result=I.time(out,[a],settings,(side,index)=>picked.push([side,index]));
 for(const row of a.events){
  const numeric=out.nodes.filter(n=>n.dataset.record===row.r.id&&!n.title.includes('event rail'));
  assert.equal(numeric.length,2);
  near(numeric[0].cx,65+(row.time-result.domain[0])/(result.domain[1]-result.domain[0])*805);
  near(numeric[0].cy,280-row.v.ready/result.cap*243);
  near(numeric[1].cy,280-row.v.unfinished/result.cap*243);
 }
 const rail=out.nodes.filter(n=>n.title.includes('event rail'));
 assert.equal(rail.length,5);assert.notEqual(rail[0].cx,rail[1].cx);
 rail[0].onclick();let prevented=false;rail[1].onkeydown({key:'Enter',preventDefault(){prevented=true;}});
 assert.deepEqual(picked,[['a',0],['a',1]]);assert.ok(prevented);
 assert.equal(out.nodes.filter(n=>n.r===7).every(n=>n.dataset.record===a.z.r.id),true);
});

test('Relationship coordinates pair channels from the same exact event and preserve transition order',()=>{
 const a=I.series(select(),'a',{span:4}),out=svg();I.relationship(out,[a],settings,noop);
 assert.equal(out.nodes.length,a.events.length);
 const xmax=I.range([a],['ready']),ymax=I.range([a],['unfinished']);
 out.nodes.forEach((node,index)=>{const row=a.events[index];assert.equal(node.dataset.record,row.r.id);near(node.cx,75+row.v.ready/xmax*775);near(node.cy,320-row.v.unfinished/ymax*282);});
 const links=paths(out.innerHTML,'#0b7f88').filter(p=>p['marker-end']);
 assert.equal(links.length,4);assert.ok(out.nodes[0].title.includes('(2, 3)'));assert.ok(out.nodes[1].title.includes('(3, 3)'));
 assert.equal(out.nodes[0].cy,out.nodes[1].cy);assert.notEqual(out.nodes[0].cx,out.nodes[1].cx);
});

test('Different possible worlds remain separate in series, markers and shared A/B axes',()=>{
 const a=I.series(select('P5J9/A',0),'a',{span:4}),b=I.series(select('P5J9/A',1),'b',{span:4}),out=svg();
 assert.equal(a.events.at(-1).v.ready,3);assert.equal(b.events.at(-1).v.ready,0);
 I.relationship(out,[a,b],settings,noop);
 assert.deepEqual(out.nodes.filter(n=>n.dataset.side==='a').map(n=>n.dataset.record),a.events.map(p=>p.r.id));
 assert.deepEqual(out.nodes.filter(n=>n.dataset.side==='b').map(n=>n.dataset.record),b.events.map(p=>p.r.id));
 const timeOut=svg(),result=I.time(timeOut,[a,b],{...settings,yMax:8},noop);assert.equal(result.cap,8);
 const a0=timeOut.nodes.find(n=>n.dataset.side==='a'&&n.dataset.event==='0'&&!n.title.includes('event rail'));
 const b0=timeOut.nodes.find(n=>n.dataset.side==='b'&&n.dataset.event==='0'&&!n.title.includes('event rail'));assert.equal(a0.cy,b0.cy);
});

test('Aligned time translates exact native records including negative times without changing values',()=>{
 const z=select('T4M6/A',0,null,'first_completed_payload'),native=I.series(z,'a',{span:4}),aligned=I.series(z,'a',{clock:'aligned',span:4});
 assert.equal(z.anchor.anchor_s,1);assert.equal(aligned.events[0].time,-1);
 native.rows.forEach((row,index)=>{assert.deepEqual(aligned.rows[index].v,row.v);assert.equal(aligned.rows[index].r.id,row.r.id);assert.equal(aligned.rows[index].time,row.time-1);});
 assert.equal(aligned.deadline,native.deadline-1);assert.equal(aligned.action,native.action-1);
 assert.equal(aligned.nativeStart,native.nativeStart);assert.equal(aligned.start,native.start-1);
});

test('Unavailable prefix anchor withholds alignment instead of substituting native coordinates',()=>{
 const z=select('T4M6/A',0,0,'first_completed_payload'),frame=F.side(z,{clock:'aligned',span:4,timeOffset:-1}),data=I.series(z,'a',{clock:'aligned',span:4,timeOffset:-1});
 assert.equal(frame.status,'unavailable');assert.equal(data.available,false);assert.deepEqual(data.rows,[]);assert.deepEqual(frame.nativeWindow,[-5,-1]);
});

test('Panned direct series and body observation frames share exact intervals, carry-in and event rows',()=>{
 for(const clock of ['native','aligned'])for(const span of [1,2,4])for(const timeOffset of [0,-.5,-1,-2.5,-8]){
  const z=select('T4M6/A',0,null,'first_completed_payload'),options={clock,span,timeOffset},f=F.side(z,options),a=I.series(z,'a',options);
  assert.deepEqual([a.nativeStart,a.nativeEnd],f.nativeWindow);assert.deepEqual([a.start,a.end],f.displayWindow);
  assert.deepEqual(a.rows.map(p=>[p.r.id,p.r.time_s,p.time,p.carry]),f.rows.map(r=>[r.record_id,r.native_time_s,r.display_time_s,r.carry_in]),JSON.stringify(options));
  assert.ok(a.events.every(p=>p.r.time_s<=z.r.time_s+timeOffset));
 }
});

test('Exact boundary events replace carry-in and fractional boundaries retain the prior source identity',()=>{
 const z=select(),exact=F.side(z,{span:1,timeOffset:-1}),fractional=F.side(z,{span:1,timeOffset:-.5});
 assert.deepEqual(exact.nativeWindow,[1,2]);assert.equal(exact.carryIn,null);assert.deepEqual(exact.eventRows.map(r=>r.event_index),[2,3]);
 assert.deepEqual(fractional.nativeWindow,[1.5,2.5]);assert.equal(fractional.carryIn.event_index,2);
 assert.equal(fractional.carryIn.native_time_s,1);assert.equal(fractional.carryIn.display_time_s,1.5);assert.equal(fractional.carryIn.isObservedEvent,false);
 assert.equal(fractional.nativeNow,3);assert.equal(fractional.now,3);assert.equal(fractional.transform.parameters.known_at_cutoff_s,3);
 const all=F.side(z,{span:'all',timeOffset:-8});assert.deepEqual(all.nativeWindow,[-5,-5]);assert.deepEqual(all.rows,[]);
});

test('Zero pan is exactly backward compatible while nonzero frame provenance records the pan',()=>{
 const z=select(),legacy=F.side(z,{span:4}),zero=F.side(z,{span:4,timeOffset:0}),pan=F.side(z,{span:4,timeOffset:-1});
 assert.deepEqual(zero,legacy);assert.equal(Object.hasOwn(zero.transform.parameters,'pan_s'),false);
 assert.equal(pan.transform.parameters.pan_s,-1);assert.notEqual(pan.ref.id,legacy.ref.id);
 for(const timeOffset of [1,NaN,Infinity,-Infinity])assert.throws(()=>F.side(z,{timeOffset}),/timeOffset/);
});

test('Automatic shared-prefix count calibration is stable when pan hides an earlier extremum',()=>{
 // Isolated synthetic source probe: a known earlier pending extremum must remain in the selected prefix calibration.
 const source=clone(bundle),s=source.scenarios.find(s=>s.id==='T4M6/A');s.worlds[0].records[0].identities.pending=Array.from({length:9},(_,i)=>'probe-'+i);
 const z=select('T4M6/A',0,null,'decision',source),full=I.series(z,'a',{span:4}),short=I.series(z,'a',{span:1});
 const fullCap=I.time(svg(),[full],{...settings,timeChannels:['ready']},noop).cap;
 const shortCap=I.time(svg(),[short],{...settings,timeChannels:['ready']},noop).cap;
 assert.ok(fullCap>=9);assert.equal(shortCap,fullCap);
 const clipped=I.time(svg(),[full],{...settings,timeChannels:['ready'],yMax:2},noop);assert.equal(clipped.cap,2);assert.equal(clipped.clipped,true);
});

test('Missing count values create neither zero markers nor relationship transitions through the gap',()=>{
 const {a,row}=withMissing('ready'),timeOut=svg(),xyOut=svg();
 I.time(timeOut,[a],{...settings,timeChannels:['ready']},noop);
 const atMissing=timeOut.nodes.filter(n=>n.dataset.record===row.r.id);assert.equal(atMissing.length,1);assert.ok(atMissing[0].title.includes('event rail'));
 I.relationship(xyOut,[a],settings,noop);assert.equal(xyOut.nodes.filter(n=>n.dataset.record===row.r.id).length,0);
 assert.equal(paths(xyOut.innerHTML,'#0b7f88').filter(p=>p['marker-end']).length,2);
 assert.equal(/NaN|undefined|\(null,/.test(timeOut.innerHTML+xyOut.innerHTML),false);
});

test('Missing count data breaks the step path without erasing earlier valid segments',()=>{
 const {a}=withMissing('ready'),out=svg();I.time(out,[a],{...settings,timeChannels:['ready']},noop);
 const trace=paths(out.innerHTML,I.channels.ready.color).find(p=>p['stroke-width']==='2');assert.ok(trace);
 assert.equal((trace.d.match(/M/g)||[]).length,2);assert.ok(trace.d.includes('H'));
});

test('Missing configured rate does not become a zero sample or bridge unknown data',()=>{
 const {a,row}=withMissing('rate'),out=svg();I.rate(out,[a],noop,['rate']);
 assert.equal(out.nodes.filter(n=>n.dataset.record===row.r.id).length,0);
 const trace=paths(out.innerHTML,I.channels.rate.color).find(p=>p['stroke-width']==='2');assert.ok(trace);
 assert.equal((trace.d.match(/M/g)||[]).length,2);assert.equal(/NaN|undefined/.test(out.innerHTML),false);
});

test('Actual completions are supported and absent at action records rather than fabricated as zero',()=>{
 assert.deepEqual(Object.keys(I.channels).sort(),C.keys.slice().sort());
 const a=I.series(select(),'a',{span:4}),out=svg(),xyOut=svg();
 const status=I.time(svg(),[a],{...settings,timeChannels:['delivered']},noop);assert.ok(status.rates.includes('delivered'));
 I.rate(out,[a],noop,['delivered']);assert.equal(out.nodes.length,3);
 assert.deepEqual(out.nodes.map(n=>+n.dataset.event),[2,3,4]);
 assert.equal(a.events[0].v.delivered,null);assert.equal(a.events[1].v.delivered,null);
 I.relationship(xyOut,[a],{...settings,xChannel:'rate',yChannel:'delivered'},noop);assert.equal(xyOut.nodes.length,3);
 assert.ok(xyOut.nodes.every(n=>n.title.includes('no dwell inferred')));assert.equal(/held \d|retained dwell/.test(xyOut.innerHTML),false);
 const panned=I.series(select(),'a',{span:1,timeOffset:-.5}),carry=panned.rows.find(p=>p.carry);assert.ok(carry);assert.equal(carry.v.delivered,null);
 const carryPlot=svg();I.relationship(carryPlot,[panned],{...settings,xChannel:'rate',yChannel:'delivered'},noop);
 assert.deepEqual(carryPlot.nodes.map(n=>+n.dataset.event),[3]);
});

test('Stationary relationship points retain elapsed dwell and source event handles',()=>{
 const a=I.series(select('P5J9/A',0),'a',{span:4}),out=svg();I.relationship(out,[a],settings,noop);
 assert.equal(out.nodes.length,a.events.length);assert.ok(out.nodes.every(n=>n.cx===out.nodes[0].cx&&n.cy===out.nodes[0].cy));
 assert.equal(paths(out.innerHTML,'#0b7f88').filter(p=>p['marker-end']).length,0);
 assert.ok(out.nodes.every(n=>n.title.includes('retained dwell 2 s')));
});

test('Direct numeric modules execute with Gaussian access forbidden and ignore camera/softness',()=>{
 const context={module:{exports:{}},SourceChannels:C,ObservationFrames:F,require(name){assert.ok(['./channels.js','./frames.js'].includes(name),'Unexpected direct-view dependency '+name);return name==='./channels.js'?C:F;}};
 Object.defineProperty(context,'SpatialEncoding',{get(){throw Error('Numeric view accessed Gaussian encoding');}});
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'instruments.js'),'utf8'),context,{filename:'instruments.js'});
 const direct=context.module.exports,z=select(),a=direct.series(z,'a',{span:4}),before=svg(),after=svg();
 direct.time(before,[a],settings,noop);direct.time(after,[a],{...settings,h:1.1,camera:{yaw:9,zoom:2.5,panX:800}},noop);
 assert.equal(after.innerHTML,before.innerHTML);assert.deepEqual(JSON.parse(JSON.stringify(direct.values(z.r))),C.record(z.r).values);
});

const report={passed:tests.every(t=>t.passed),tests_total:tests.length,tests_passed:tests.filter(t=>t.passed).length,
 scope:'Source numeric values, ordered event SVG output, missingness and shared observation frames; browser interaction/layout has separate evidence.',results:tests};
console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
