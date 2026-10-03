/* Real retained records and actual presentation functions under small DOM/Canvas
 * stand-ins. These are contract checks, not browser or visual-usability evidence. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const E=require('./extension'),M=require('./model'),F=require('./form'),clone=x=>JSON.parse(JSON.stringify(x)),tests=[];
const read=name=>fs.readFileSync(path.join(__dirname,name)),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const data={localSignal:JSON.parse(read('data/local_signal.json')),transfer:JSON.parse(read('data/transfer.json')),extensionSources:{local_signal:{path:'data/local_signal.json',sha256:hash(read('data/local_signal.json'))},transfer:{path:'data/transfer.json',sha256:hash(read('data/transfer.json'))}}};
const sources={oscillator:{sha256:hash(read('model.js').toString().replace(/\r\n?/g,'\n'))},music:{sha256:hash(read('data/music.wav'))},lake:{sha256:hash(read('data/lakes.json'))}};
function test(name,fn){try{fn();tests.push({name,passed:true});}catch(error){tests.push({name,passed:false,error:error.stack});}}
const noop=()=>{};
function fixture(state=E.defaults()){
 const elements=new Map(),observers=[];let current=state,w=900,h=state.local.height;
 const context=new Proxy({},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>(t[k]=v,true)});
 const parent={getBoundingClientRect:()=>({width:w,height:h})};
 function element(id){if(!elements.has(id)){let html='';const node={id,dataset:{},style:{},parentElement:parent,queries:[],panels:[],writes:0,hidden:false,value:'',textContent:'',querySelectorAll(selector){return selector==='[data-evidence-panel]'?this.panels:this.queries;},getBoundingClientRect:()=>({width:w,height:h,left:0,top:0}),getContext:()=>context};Object.defineProperty(node,'innerHTML',{get:()=>html,set:value=>{html=value;node.writes++;node.panels=Array.from(value.matchAll(/data-evidence-panel="([^"]+)"/g),m=>({open:false,dataset:{evidencePanel:m[1]}}));}});elements.set(id,node);}return elements.get(id);}
 const env={ObservatoryExtension:E,document:{getElementById:element},devicePixelRatio:1,ResizeObserver:class {constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}}};vm.createContext(env);vm.runInContext(read('extension-ui.js').toString(),env);
 const ui=env.createEvidenceWorkspace(data,()=>current,next=>{E.validate(next,data);current=next;},noop);
 return {ui,element,observers,state:()=>current,resize:(width,height)=>{w=width;h=height;observers.at(-1).fn();}};
}
const app=read('app.js').toString();
function appFunction(name){const start=app.indexOf('function '+name+'('),end=app.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start);return app.slice(start,end);}
function appFixture(){
 const env={M,F,D:{sources},S:M.defaultState(),E:E.defaults(),clone,atob,change:noop};vm.createContext(env);
 for(const name of ['decodePCM','calibration','windowFor','sample','historyFrames','inspectionContribution','formSample','renderingRecord'])vm.runInContext(appFunction(name),env);
 env.music=env.decodePCM(read('data/music.wav').toString('base64'));env.music.sha256=sources.music.sha256;
 return env;
}

test('Native annual selection retains both channels, exact calendar labels, identities and source cells',()=>{
 const s=E.defaults();s.active='local_signal';s.local.year=1963;s.local.country='USA';s.local.channel='pop';const before=JSON.stringify(data.localSignal),selected=E.annual(s,data),receipt=E.receipt(s,data);
 assert.deepEqual(selected.time,{value:1963,unit:'calendar year',precision:'year; no invented subannual timestamp'});assert.deepEqual(selected.units,data.localSignal.units);assert.equal(selected.rows.length,2);
 for(const row of selected.rows){assert.deepEqual(row.record,data.localSignal.countries.find(c=>c.code===row.country).records.find(r=>r.year===1963));assert.ok(row.record.sourceCells.gdppc&&row.record.sourceCells.pop);assert.equal(typeof row.record.values.gdppc,'number');assert.equal(typeof row.record.values.pop,'number');}
 assert.match(receipt.rendering.alignment,/no shift, gain, offset/);assert.match(receipt.rendering.encoding,/no interpolated segments/);assert.deepEqual(receipt.rendering.axes,{year:[1950,1970],gdppc:[0,30000],pop:[0,250000]});assert.equal(JSON.stringify(data.localSignal),before);
});
test('Both actual country series fit the fixed shared native calibration without hidden rescaling',()=>{
 const s=E.defaults();s.active='local_signal';const ranges=E.receipt(s,data).rendering.axes;
 for(const country of data.localSignal.countries){assert.equal(country.records.length,21);for(const r of country.records){assert.ok(r.year>=ranges.year[0]&&r.year<=ranges.year[1]);for(const channel of ['gdppc','pop'])assert.ok(r.values[channel]>=ranges[channel][0]&&r.values[channel]<=ranges[channel][1]);}}
});
test('Whole workspace round-trips local selection, resized height, closed disclosure and suspended alignment',()=>{
 const state=M.defaultState(),s=E.defaults();state.transport.time=6.25;state.camera.yaw=.7;state.panel.height=412;s.active='local_signal';s.local={year:1968,channel:'pop',country:'USA',height:587};s.nativeRestore={shift:.75,gain:1.3,offset:-.2};s.details=false;s.openPanels=['queue','mapping','summary'];
 const base=M.save(state,{sources}),packet=E.save(base,s,data),before=JSON.stringify(packet),restored=E.unpack(packet,data);assert.deepEqual(restored.extension,s);assert.deepEqual(M.restore(restored.base,{sources}).state,state);assert.equal(JSON.stringify(packet),before);restored.extension.local.year=1955;assert.equal(packet.extension.local.year,1968);
 const legacy=E.unpack(base,data);assert.equal(legacy.legacy,true);assert.equal(legacy.base,base);assert.deepEqual(legacy.extension,E.defaults());
});
test('Workspace restore rejects altered source, evidence, selection, layout and inactive playback',()=>{
 const s=E.defaults();s.active='local_signal';const packet=E.save(M.save(M.defaultState(),{sources}),s,data);
 for(const mutate of [p=>{p.extensionSources.local_signal.sha256='f'.repeat(64);},p=>{p.extensionReceipt.selected.rows[0].record.values.gdppc++;},p=>{p.extension.local.year=1971;},p=>{p.extension.local.height=1001;},p=>{p.extension.local.height='500';},p=>{p.extension.local.smoothing=true;},p=>{p.extension.details='false';},p=>{p.extension.openPanels=['invented'];},p=>{p.extension.openPanels=['queue','queue'];},p=>{p.base.state.transport.playing=true;},p=>{p.base.state.audio.enabled=true;}]){const bad=clone(packet);mutate(bad);assert.throws(()=>E.unpack(bad,data));}
 const t=E.defaults();t.active='transfer';assert.throws(()=>E.validate(t,data),/Select a transfer case/);t.transfer.caseId=data.transfer.cases[0].id;t.transfer.actionId='invented';assert.throws(()=>E.validate(t,data),/Unknown transfer action/);
});
test('Every displayed transfer action binds its actual retained execution, case facts and both recorded decisions',()=>{
 assert.equal(data.transfer.cases.length,3);assert.equal(data.transfer.summary.relative_benefit_established,false);
 const s=E.defaults();s.active='transfer';for(const c of data.transfer.cases){s.transfer.caseId=c.id;for(const a of c.actions){s.transfer.actionId=a.id;const r=E.receipt(s,data);assert.deepEqual(r.selected,c);assert.deepEqual(r.action,a);assert.equal(typeof a.success,'boolean');assert.match(r.rendering.execution,/not browser-side packaging/);const restored=E.unpack(E.save(M.save(M.defaultState(),{sources}),s,data),data);assert.equal(restored.extension.transfer.actionId,a.id);}}
 assert.equal(data.transfer.summary.target_cases,3);assert.equal(data.transfer.summary.interventions_executed,9);
});
test('Local plot keys and slider refresh selection without replacing the active controls; resize retains calibration',()=>{
 const s=E.defaults();s.active='local_signal';const f=fixture(s);f.ui.render('inspect');const canvas=f.element('annualCanvas'),slider=f.element('annualYear'),writes=f.element('extendedWorkspace').writes;
 assert.ok(!/<details open id="extensionDetails"/.test(f.element('extendedWorkspace').innerHTML),'Closed disclosure must remain closed during inspect restore');
 for(let i=0;i<3;i++)canvas.onkeydown({key:'ArrowRight',preventDefault:noop});assert.equal(s.local.year,1953);assert.equal(f.element('extendedWorkspace').writes,writes);assert.equal(f.element('annualCanvas'),canvas);
 slider.oninput({target:{value:'1969'}});assert.equal(s.local.year,1969);assert.equal(f.element('annualYearLabel').textContent,1969);assert.equal(f.element('extendedWorkspace').writes,writes);assert.equal(canvas.dataset.interpolation,'none');assert.equal(canvas.dataset.sharedRange,'0,30000');
 const oldHeight=canvas.height;f.resize(1100,640);assert.ok(canvas.height>oldHeight);assert.equal(s.local.height,640);assert.equal(canvas.dataset.sharedRange,'0,30000');assert.equal(s.local.year,1969);
});
test('Transfer UI compares structured gate observations by value and exposes actual countercase outcomes',()=>{
 const s=E.defaults();s.active='transfer';s.transfer.caseId=data.transfer.cases[0].id;const f=fixture(s);let sawStructuredGate=false,sawFailure=false;
 for(const c of data.transfer.cases){s.transfer.caseId=c.id;s.transfer.actionId=c.actions[0].id;f.ui.invalidate();f.ui.render('inspect');const html=f.element('extendedWorkspace').innerHTML,gates=c.facts.package_constraints,passing=gates.filter(g=>E.stable(g.observed)===E.stable(g.required)).length;
  assert.ok(html.includes(passing+' / '+gates.length+' satisfied'));sawStructuredGate||=gates.some(g=>g.observed&&typeof g.observed==='object');assert.ok(!/<details open id="extensionDetails"/.test(html));
  for(const action of c.actions){s.transfer.actionId=action.id;f.ui.invalidate();f.ui.render('compare');assert.ok(f.element('extendedWorkspace').innerHTML.includes(action.success?'Target outcome achieved':'Target outcome remains blocked'));sawFailure||=!action.success;}
 }
 assert.ok(sawStructuredGate&&sawFailure);assert.equal(s.transfer.caseId,data.transfer.cases.at(-1).id);
});
test('Every transfer disclosure retains its saved open state across action changes and workspace restoration',()=>{
 const s=E.defaults();s.active='transfer';s.transfer.caseId=data.transfer.cases[0].id;s.openPanels=['facts','mapping','queue','release','summary'];const f=fixture(s);f.ui.render('inspect');
 assert.equal(f.element('extendedWorkspace').panels.length,5);assert.ok(f.element('extendedWorkspace').panels.every(panel=>panel.open));
 const panel=f.element('extendedWorkspace').panels.find(p=>p.dataset.evidencePanel==='mapping');panel.open=false;panel.ontoggle();assert.ok(!s.openPanels.includes('mapping'));
 s.transfer.actionId=data.transfer.cases[0].actions[1].id;f.ui.invalidate();f.ui.render('compare');assert.equal(f.element('extendedWorkspace').panels.find(p=>p.dataset.evidencePanel==='mapping').open,false);assert.equal(f.element('extendedWorkspace').panels.find(p=>p.dataset.evidencePanel==='queue').open,true);
 const restored=E.unpack(E.save(M.save(M.defaultState(),{sources}),s,data),data),g=fixture(restored.extension);g.ui.render('inspect');assert.deepEqual(g.element('extendedWorkspace').panels.map(p=>[p.dataset.evidencePanel,p.open]),f.element('extendedWorkspace').panels.map(p=>[p.dataset.evidencePanel,p.open]));
});
test('Native-only control temporarily removes alignment while preserving window, candidate and camera; receipt reflects the effective state',()=>{
 const env=appFixture();env.S.transport.time=9;env.S.transport.span=3;env.S.align={shift:1.25,gain:1.7,offset:-.4};env.S.camera.yaw=.8;const before=clone(env.S),window=clone(env.windowFor());
 const line=app.split('\n').find(x=>x.includes("$('nativeToggle').onclick="));assert.ok(line);let handler;env.$=()=>({set onclick(fn){handler=fn;}});vm.runInContext(line,env);handler();
 assert.deepEqual(clone(env.S.align),{shift:0,gain:1,offset:0});assert.deepEqual(clone(env.E.nativeRestore),before.align);assert.deepEqual(clone(env.windowFor()),window);assert.deepEqual(env.S.tune,before.tune);assert.deepEqual(env.S.camera,before.camera);
 const receipt=env.renderingRecord(env.S);assert.equal(receipt.selected.b.nativeTime,env.S.transport.time);assert.deepEqual(clone(receipt.signal.window),window);const packet=E.save(M.save(env.S,{sources,renderingRecord:env.renderingRecord}),env.E,data),restored=E.unpack(packet,data);M.restore(restored.base,{sources,renderingRecord:env.renderingRecord});
 handler();assert.deepEqual(clone(env.S.align),before.align);assert.equal(env.E.nativeRestore,null);assert.deepEqual(clone(env.windowFor()),window);
});
test('Camera changes only rendering coordinates; retained PCM polarity counterexample has identical body contributions and nonzero native discrepancy',()=>{
 const env=appFixture();env.S.source='music';env.S.transport.time=4.25;env.S.transport.span=8;env.S.align={shift:0,gain:-1,offset:0};const a=env.formSample('A',4.25),b=env.formSample('B',4.25),rawA=env.sample('A',4.25),rawB=env.sample('B',4.25),r=M.metrics(env.S,env.windowFor(),env.music),record=clone(env.renderingRecord(env.S));
 assert.deepEqual(clone(a.channels),clone(b.channels));assert.ok(rawA.channels.left!==rawB.channels.left||rawA.channels.right!==rawB.channels.right);assert.ok(r.channels.left.rmse>0&&r.channels.right.rmse>0);assert.equal(r.coverage.fraction,1);assert.ok(a.derived.sampleRange[1]>=a.derived.sampleRange[0]);
 env.S.camera.yaw+=.7;env.S.camera.zoom=1.7;assert.deepEqual(M.metrics(env.S,env.windowFor(),env.music),r);const rotated=clone(env.renderingRecord(env.S));assert.notDeepEqual(rotated.form.camera,record.form.camera);assert.deepEqual(rotated.selected,record.selected);assert.deepEqual(rotated.signal,record.signal);
});

const failed=tests.filter(t=>!t.passed);console.log(JSON.stringify({scope:'Retained local/transfer data, wrapper/native-state contracts and actual presentation functions under DOM/Canvas stand-ins; not browser acceptance.',tests:tests.length,passed:tests.length-failed.length,failed:failed.length,results:tests},null,2));if(failed.length)process.exitCode=1;
