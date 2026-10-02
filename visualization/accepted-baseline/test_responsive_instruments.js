/* Resizing changes drawing geometry, never channel values, identity, or calibration. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const I=require('./instruments.js'),D=require('./domain.js');
const bundle=JSON.parse(fs.readFileSync(path.join(__dirname,'data/bundle.json'),'utf8'));
const select=id=>{const s=bundle.scenarios.find(s=>s.id===id),w=s.worlds[0],r=w.records.at(-1);return {s,w,r,p:D.partition(r),prefix:D.prefix(w,r.event_index),anchor:D.anchorFor(s,w,r.event_index,'decision')};};
const settings={clock:'native',timeChannels:['ready','unfinished','backup','completed','absent'],xChannel:'ready',yChannel:'unfinished',yMax:null};
const all=['T4M6/A','T4M6/B'].map((id,i)=>I.series(select(id),i?'b':'a',{span:4})),original=JSON.stringify(all),tests=[];
function test(name,fn){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.stack});}}
function svg(width,height){return {id:'responsive',style:{},attrs:{},innerHTML:'',getBoundingClientRect:()=>({width,height}),setAttribute(k,v){this.attrs[k]=v;},querySelectorAll(){return [];}};}
const titles=s=>[...s.matchAll(/<title>(.*?)<\/title>/g)].map(m=>m[1]);
const bounds=s=>JSON.parse(s.attrs['data-plot-bounds']);
test('Taller time and relationship panels increase numeric plot height by the added space',()=>{
 for(const kind of ['time','relationship']){const short=svg(370,480),tall=svg(370,780);I[kind](short,all,settings,()=>{});I[kind](tall,all,settings,()=>{});
 assert.equal(bounds(tall).bottom-bounds(short).bottom,300);assert.equal(bounds(short).top,bounds(tall).top);
 assert.equal(short.attrs['data-calibration'],tall.attrs['data-calibration']);assert.deepEqual(titles(short.innerHTML),titles(tall.innerHTML));}
});
test('Width changes use CSS-pixel viewBoxes and leave exact record values and shared ranges intact',()=>{
 for(const kind of ['time','relationship']){const narrow=svg(340,570),wide=svg(930,570);I[kind](narrow,all,settings,()=>{});I[kind](wide,all,settings,()=>{});
 assert.equal(narrow.attrs.viewBox,'0 0 340 570');assert.equal(wide.attrs.viewBox,'0 0 930 570');
 assert.equal(narrow.attrs['data-calibration'],wide.attrs['data-calibration']);assert.deepEqual(titles(narrow.innerHTML),titles(wide.innerHTML));
 assert.ok(bounds(narrow).bottom>bounds(narrow).top+90);assert.ok(narrow.innerHTML.includes('font-size="12"'));}
});
test('Rate lanes resize independently while both sides retain common time and rate calibration',()=>{
 const small=svg(370,220),large=svg(720,370);I.rate(small,all,()=>{},['rate','delivered']);I.rate(large,all,()=>{},['rate','delivered']);
 assert.equal(bounds(large).bottom-bounds(small).bottom,150);assert.equal(small.attrs['data-calibration'],large.attrs['data-calibration']);assert.deepEqual(titles(small.innerHTML),titles(large.innerHTML));
});
test('Minimum-width plots keep labels readable instead of shrinking the entire drawing',()=>{
 const out=svg(240,440);I.time(out,all,settings,()=>{});assert.equal(out.attrs.viewBox,'0 0 320 440');assert.ok(out.innerHTML.includes('<tspan'));assert.equal(JSON.stringify(all),original);
});
const report={passed:tests.every(t=>t.passed),tests_total:tests.length,tests_passed:tests.filter(t=>t.passed).length,scope:'Responsive geometry and numerical/identity invariance. Actual CSS pixels, interactions and readability separately checked in browser.',results:tests};
console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
