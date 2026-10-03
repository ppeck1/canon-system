/* Execute actual application functions with minimal DOM/Canvas stand-ins.
 * These checks cover cache/commit contracts, not browser rendering or usability.
 */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),M=require('./model');
const code=fs.readFileSync(require('node:path').join(__dirname,'app.js'),'utf8'),tests=[];
function body(name){const start=code.indexOf('function '+name+'(');assert.ok(start>=0,'Missing actual app function '+name);const end=code.indexOf('\nfunction ',start+1);assert.ok(end>start,'Missing next function boundary for '+name);return code.slice(start,end);}
function test(name,fn){try{fn();tests.push({name,passed:true});}catch(error){tests.push({name,passed:false,error:error.stack});}}
const noop=()=>{};
function context2d(){return new Proxy({drawImage:noop},{get:(target,key)=>target[key]||noop,set:(target,key,value)=>(target[key]=value,true)});}
function signalFixture(){
 let width=600,height=240,sampleCalls=0;
 const canvas={width:0,height:0,dataset:{},getBoundingClientRect:()=>({width,height}),getContext:context2d,setAttribute:noop},hint={};
 const s=M.defaultState(),music={sampleRate:4,left:[0,.5,1,.5,0,-.5,-1,-.5],right:[1,.5,0,-.5,-1,-.5,0,.5],duration:2};
 const env={M,S:s,music,D:{sources:{oscillator:{sha256:'1'.repeat(64)},music:{sha256:'2'.repeat(64)}}},$:id=>id==='signalCanvas'?canvas:hint,devicePixelRatio:2,document:{createElement:()=>({width:0,height:0,getContext:context2d})},signalPlotCache:null,signalPlotBuilds:0};
 env.sample=(side,time)=>{sampleCalls++;return M.sample(env.S,side,time,music);};
 env.windowFor=()=>{const t=env.S.transport,end=Math.min(t.end,Math.max(t.time,t.start+t.span));return {start:Math.max(t.start,end-t.span),end};};
 vm.createContext(env);vm.runInContext(body('paintSignal'),env);
 return {env,canvas,hint,samples:()=>sampleCalls,resize:(w,h)=>{width=w;height=h;}};
}
function exactFixture(){
 const elements={},messages=[];let changes=0;
 for(const key of ['shift','gain','offset','frequency','amplitude','phase','damping'])elements[key]={closest:()=>({querySelector:()=>({appendChild:el=>{elements[el.id]=el;}})})};
 const env={M,S:M.defaultState(),$:id=>elements[id],clone:x=>JSON.parse(JSON.stringify(x)),change:()=>{changes++;},status:(message,error)=>messages.push({message,error}),document:{createElement:()=>({style:{},attributes:{},setAttribute(name,value){this.attributes[name]=value;}})}};
 vm.createContext(env);vm.runInContext(body('ensureExactInputs')+'\n'+body('setRange'),env);env.ensureExactInputs();
 return {env,elements,messages,changes:()=>changes};
}

test('Unchanged signal window reuses plotted evidence while cursor and camera change',()=>{
 const f=signalFixture();f.env.paintSignal();const initial=f.samples();assert.ok(initial>2000);assert.equal(f.canvas.dataset.plotBuilds,'1');
 f.env.S.transport.time=1.234;f.env.paintSignal();assert.equal(f.samples(),initial);assert.equal(f.canvas.dataset.selection,'1.234');assert.equal(f.canvas.dataset.plotCache,'reused');
 f.env.S.camera.zoom=2;f.env.paintSignal();assert.equal(f.samples(),initial);assert.equal(f.canvas.dataset.plotBuilds,'1');
 assert.deepEqual(JSON.parse(f.canvas.dataset.window),{start:0,end:8});
});
test('Signal cache invalidates for changed model, alignment, time window, dimensions and source',()=>{
 const f=signalFixture();f.env.paintSignal();f.env.S.tune.frequency=1.5;f.env.S.tune.amplitude=2;f.env.paintSignal();assert.equal(f.canvas.dataset.plotBuilds,'2');assert.equal(f.canvas.dataset.clipped,'true');assert.match(f.hint.textContent,/exceed fixed axes/);
 const changes=[()=>f.resize(600,400),()=>{f.env.S.align.shift=.2;},()=>{f.env.S.transport.time=10;},()=>{f.env.S.source='music';},()=>{f.env.devicePixelRatio=1;}];
 let builds=2;for(const change of changes){change();f.env.paintSignal();assert.equal(f.canvas.dataset.plotBuilds,String(++builds));assert.equal(f.canvas.dataset.plotCache,'rebuilt');}
 assert.equal(JSON.parse(f.canvas.dataset.window).end,10);assert.equal(f.canvas.dataset.selection,'10');
});
test('Exact fields expose distinct names and Enter commits a staged value once',()=>{
 const f=exactFixture(),field=f.elements.frequencyExact;
 assert.equal(field.attributes['aria-label'],'Exact candidate model frequency');assert.equal(f.elements.shiftExact.attributes['aria-label'],'Exact candidate time shift');assert.equal(f.elements.gainExact.attributes['aria-label'],'Exact candidate gain');
 field.value='0.5';assert.equal(f.env.S.tune.frequency,.53);let prevented=false;field.onkeydown({key:'Enter',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(f.env.S.tune.frequency,.5);assert.equal(f.changes(),1);
 field.onchange();field.onblur();assert.equal(f.changes(),1,'Later change/blur must not apply the same edit again');
});
test('Blur commits exact zero phase; invalid and blank values retain the previous recipe',()=>{
 const f=exactFixture(),field=f.elements.phaseExact;field.value='0';field.onblur();assert.equal(f.env.S.tune.phase,0);assert.equal(f.changes(),1);
 for(const value of ['','NaN','Infinity','99']){field.value=value;field.onkeydown({key:'Enter',preventDefault:noop});assert.equal(f.env.S.tune.phase,0);assert.equal(field.value,'0');assert.equal(f.messages.at(-1).error,true);}
 const gain=f.elements.gainExact;gain.value='1.125';gain.onchange();assert.equal(f.env.S.align.gain,1.125);assert.equal(f.changes(),2);
});
test('Off-grid actual values keep exact range values instead of browser step rounding',()=>{
 const f=exactFixture(),phase={min:String(-Math.PI),max:String(Math.PI),step:'.01'};f.env.setRange(phase,.45);assert.equal(phase.step,'any');assert.equal(Number(phase.value),.45);
 const gain={min:'0',max:'2',step:'.01'};f.env.setRange(gain,3);assert.equal(Number(gain.max),3);assert.equal(Number(gain.value),3);
});
test('Displayed persistence frames and replay receipt share exact source-linked samples',()=>{
 const elements={},s=M.defaultState();s.transport.time=4;s.transport.persistence=2;s.align.shift=.5;let rendered=null;
 const env={M,F:require('./form'),S:s,music:null,$:id=>elements[id]||(elements[id]={style:{},dataset:{}}),scene:{render:value=>{rendered=value;}},performance:{now:()=>1000},valuesHtml:()=>'',paintSignal:noop,cameraStatus:noop,lastMetric:0,metricKey:'',metric:null,audioContext:null,audioNode:null,formTime:0};
 vm.createContext(env);for(const name of ['sample','historyFrames','formSample','inspectionContribution','calibration','windowFor','renderingRecord','paint'])vm.runInContext(body(name),env);
 env.number=String;env.esc=String;env.paint(true);
 const receipt=env.renderingRecord(s),frames=receipt.history.frames;assert.equal(frames.length,2);
 assert.deepEqual(Array.from(frames,f=>f.displayTime),[2,3]);assert.deepEqual(Array.from(frames,f=>f.sample.nativeTime),[1.5,2.5]);
 assert.deepEqual(Array.from(rendered.trail,t=>JSON.stringify(t.channels)),Array.from(frames,f=>JSON.stringify(f.sample.channels)));
 assert.ok(frames.every(f=>f.sample.sourceRefs.length&&f.sample.sourceRefs[0].recipe==='candidate-tune'));
 const sources={oscillator:{sha256:'1'.repeat(64)}},saved=M.save(s,{sources,renderingRecord:env.renderingRecord});M.restore(saved,{sources,renderingRecord:env.renderingRecord});
 saved.renderingRecord.history.frames[0].sample.channels.position+=.1;assert.throws(()=>M.restore(saved,{sources,renderingRecord:env.renderingRecord}),/rendering record disagrees/);
 s.transport.time=0;assert.equal(env.historyFrames(s).frames.length,0);assert.equal(env.historyFrames(s).omitted.length,2);
 s.transport.persistence=0;assert.equal(env.historyFrames(s).status,'disabled');s.source='music';assert.equal(env.historyFrames(s).status,'unsupported');
});
test('Source drill-down links only bundled local lake paths and explicit music/model files',()=>{
 const good={bundled:true,path:'data/lakes/sot/manifest_pull.json'},template={bundled:true,path:'data/lakes/mm/music_map_specimen_template.md'};
 const env={S:M.defaultState(),D:{lakes:{selectedSubset:{sourceFiles:[good,{bundled:false,path:'data/lakes/scm/not-bundled.json'}]},entryPoints:[{inspectedFiles:[good,template,{bundled:true,path:'data/lakes/../../outside.json'},{bundled:true,path:'https://example.org/external.json'},{bundled:true,path:'data/lakes/sot/%2e%2e/escape.json'}]}]}},esc:x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
 vm.createContext(env);vm.runInContext(body('sourceLinkHtml'),env);env.S.source='lake';const html=env.sourceLinkHtml();assert.equal((html.match(/<a /g)||[]).length,2);assert.ok(html.includes('Retained raw file: manifest_pull.json'));assert.ok(html.includes('target="_blank" rel="noopener"'));assert.ok(!/outside|external|not-bundled|escape/.test(html));
 env.S.source='music';assert.ok(env.sourceLinkHtml().includes('href="data/music.wav"'));assert.ok(env.sourceLinkHtml().includes('href="data/music.json"'));env.S.source='oscillator';assert.ok(env.sourceLinkHtml().includes('href="model.js"'));
});
test('Selected contribution and disclosure state restore and recompute from the saved native selection',()=>{
 const details=Object.fromEntries(['native','source','receipt','lake'].map(k=>[k+'Details',{parentElement:{open:false}}])),s=M.defaultState(),sources={oscillator:{sha256:'1'.repeat(64)}};
 s.task='inspect';s.panel.inspect=true;s.transport.time=.75;s.inspection={contribution:{side:'B',key:'velocity'},openDetails:['native','receipt']};
 const env={M,F:require('./form'),S:s,music:null,D:{sources},$:id=>details[id],inspect:noop};vm.createContext(env);
 for(const name of ['sample','formSample','calibration','inspectionContribution','syncInspectionDetails','historyFrames','windowFor','renderingRecord'])vm.runInContext(body(name),env);
 const before=env.inspectionContribution(s);assert.equal(before.side,'B');assert.equal(before.key,'velocity');assert.equal(before.displayTime,.75);assert.equal(before.value,M.sample(s,'B',.75).channels.velocity);assert.ok(before.sourceRefs.length);
 env.syncInspectionDetails();assert.equal(details.nativeDetails.parentElement.open,true);assert.equal(details.receiptDetails.parentElement.open,true);assert.equal(details.sourceDetails.parentElement.open,false);
 details.sourceDetails.parentElement.open=true;details.sourceDetails.parentElement.ontoggle();details.sourceDetails.parentElement.ontoggle();assert.deepEqual(Array.from(env.S.inspection.openDetails),['native','source','receipt']);
 const saved=M.save(env.S,{sources,renderingRecord:env.renderingRecord});env.S=M.defaultState();env.S=M.restore(saved,{sources,renderingRecord:env.renderingRecord}).state;env.syncInspectionDetails();
 assert.deepEqual(JSON.parse(JSON.stringify(env.inspectionContribution(env.S))),JSON.parse(JSON.stringify(before)));assert.equal(details.sourceDetails.parentElement.open,true);assert.equal(details.lakeDetails.parentElement.open,false);
 env.S.transport.time=1.25;assert.equal(env.inspectionContribution(env.S).value,M.sample(env.S,'B',1.25).channels.velocity);assert.equal(env.inspectionContribution(env.S).displayTime,1.25);
});

const failed=tests.filter(t=>!t.passed);console.log(JSON.stringify({scope:'Actual application signal-cache and exact-field functions under DOM/Canvas stubs; not browser acceptance.',tests:tests.length,passed:tests.length-failed.length,failed:failed.length,results:tests},null,2));if(failed.length)process.exitCode=1;
