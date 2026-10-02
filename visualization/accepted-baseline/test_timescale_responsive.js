'use strict';
const assert=require('node:assert/strict');
const UI=require('./timescale-ui.js'),L=require('./timescale-landscape.js');
const checks=[];function test(name,fn){fn();checks.push({name,passed:true});}

test('Panel height grows every numeric plot while widths choose paired or stacked presentation',()=>{
  const a=UI.layoutDimensions(900,900),b=UI.layoutDimensions(900,1200),narrow=UI.layoutDimensions(500,1200);
  for(const key of ['mapHeight','rawHeight','sectionHeight','kernelHeight'])assert.ok(b[key]>a[key],key+' gains plotting height');
  assert.equal(a.stacked,false);assert.equal(narrow.stacked,true);assert.equal(a.labelSize,12);assert.equal(narrow.labelSize,12);
  assert.throws(()=>UI.layoutDimensions(NaN,900));assert.throws(()=>UI.layoutDimensions(900,0));
});

// These DOM/canvas stand-ins exercise dimensions and render inputs, not usability.
let width=900,height=900;const observers=[],classes=new Set(),nodes=new Map();
const outer={getBoundingClientRect:()=>({width,height})};
const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
const paired=new Set(['calMap','calLandscape','calTimeSection','calFrequencySection']);
function makeNode(id){return {id,style:{},dataset:{},attributes:{},textContent:'',innerHTML:'',getBoundingClientRect(){return {width:paired.has(id)&&!classes.has('ts-stacked')?(width-74)/2:width-62,height:parseFloat(this.style.height)||200,left:0,top:0};},setAttribute(k,v){this.attributes[k]=v;},getContext:()=>ctx,addEventListener(){},removeEventListener(){}};}
const panel={getBoundingClientRect:()=>({width,height:1800}),closest:()=>outer,classList:{toggle(name,value){value?classes.add(name):classes.delete(name);}},querySelector(selector){return nodes.get(selector.slice(1))||null;},set innerHTML(html){for(const match of html.matchAll(/id="([^"]+)"/g))nodes.set(match[1],makeNode(match[1]));}};
global.ResizeObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){}};
const recipe={signal:'chirp',mode:'prefix',endSample:127,row:24,sample:64,landscapeVersion:L.version,landscapeCamera:{...L.defaultCamera}};
let initialResult,initialRuns,initialSupport,initialCamera,initialBounds;
test('SVG viewBoxes match measured CSS pixels, retaining readable labels',()=>{
  UI.render(panel,recipe,()=>{});
  for(const id of ['calRaw','calTimeSection','calFrequencySection','calKernel']){
    const n=nodes.get(id),b=n.getBoundingClientRect(),g=JSON.parse(n.dataset.geometry);
    assert.equal(n.attributes.viewBox,`0 0 ${b.width} ${b.height}`);assert.equal(g.label_size_css_px,12);
    const fontSizes=[...n.innerHTML.matchAll(/font-size="([\d.]+)"/g)].map(x=>+x[1]);assert.ok(fontSizes.length>0);assert.ok(fontSizes.every(x=>x>=12));
  }
  const selected=UI.getSelection(recipe);initialResult=selected.result;initialRuns=UI.cacheStats().analysisRuns;initialSupport=nodes.get('calSupport').textContent;initialCamera=nodes.get('calLandscape').dataset.camera;initialBounds=nodes.get('calTimeSection').dataset.magnitudeBounds;
});
test('Resize redraw uses cached coefficients and keeps selection, camera and shared bounds exact',()=>{
  const before=JSON.parse(nodes.get('calTimeSection').dataset.geometry);height=1200;observers.forEach(o=>o.callback());
  const after=JSON.parse(nodes.get('calTimeSection').dataset.geometry);assert.ok(after.height>before.height);assert.equal(after.width,before.width);
  assert.equal(UI.cacheStats().analysisRuns,initialRuns);assert.equal(UI.getSelection(recipe).result,initialResult);assert.equal(nodes.get('calSupport').textContent,initialSupport);assert.equal(nodes.get('calLandscape').dataset.camera,initialCamera);
  assert.equal(nodes.get('calTimeSection').dataset.magnitudeBounds,initialBounds);assert.equal(nodes.get('calFrequencySection').dataset.magnitudeBounds,initialBounds);assert.equal(nodes.get('calMap').dataset.selection,nodes.get('calLandscape').dataset.selection);
});
test('Container width change stacks panels without shrinking SVG fonts or recomputing analysis',()=>{
  width=500;observers.forEach(o=>o.callback());assert.ok(classes.has('ts-stacked'));
  for(const id of ['calRaw','calTimeSection','calFrequencySection','calKernel']){const n=nodes.get(id),b=n.getBoundingClientRect();assert.equal(n.attributes.viewBox,`0 0 ${b.width} ${b.height}`);assert.equal(JSON.parse(n.dataset.geometry).label_size_css_px,12);}
  assert.equal(UI.cacheStats().analysisRuns,initialRuns);assert.equal(nodes.get('calMap').dataset.selection,nodes.get('calLandscape').dataset.selection);
});
delete global.ResizeObserver;
console.log(JSON.stringify({passed:checks.length,failed:0,checks,scope:'Responsive geometry and preserved analytic inputs. Browser inspection is still required for usability.'},null,2));
