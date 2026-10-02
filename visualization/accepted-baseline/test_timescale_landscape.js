'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const T=require('./timescale.js'),L=require('./timescale-landscape.js'),UI=require('./timescale-ui.js');
const checks=[];function test(name,fn){fn();checks.push({name,passed:true});}
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const recipe={signal:'chirp',mode:'prefix',endSample:127,row:24,sample:64,landscapeVersion:L.version,landscapeCamera:{...L.defaultCamera}};
let selection,result,geometry,scene;
test('Exact-value formatter preserves exponent zeros and integer place value',()=>{
  for(const value of[5.39408971e-20,2.3456789e-10,1e20,1e10,100000000,0,-1e-20])assert.equal(Number(UI.formatNumber(value)),value);
  assert.equal(UI.formatNumber(5.39408971e-20),'5.39408971e-20');assert.equal(UI.formatNumber(1e20),'1e+20');
});
test('One analysis result is reused across selection and camera changes',()=>{
  selection=UI.getSelection(recipe);result=selection.result;const runs=UI.cacheStats().analysisRuns;
  const moved=UI.getSelection({...recipe,row:13,sample:90,landscapeCamera:{...recipe.landscapeCamera,yaw:1.2,zoom:1.5}});
  assert.equal(moved.result,result);assert.equal(UI.cacheStats().analysisRuns,runs);assert.equal(moved.support.sample_index,90);assert.equal(moved.support.scale_index,13);
});
test('Inactive-panel recipe resolution cannot return a stale signal or prefix',()=>{
  const other=UI.getSelection({...recipe,signal:'constant',endSample:255,sample:180});assert.equal(other.result.signal_id,'constant');assert.equal(other.result.values.length,256);assert.equal(other.support.sample_index,180);
  const back=UI.getSelection(recipe);assert.equal(back.result,result);assert.equal(back.result.values.length,128);assert.equal(back.support.sample_index,64);
  assert.throws(()=>UI.getSelection({...recipe,sample:128}));assert.throws(()=>UI.getSelection({...recipe,landscapeVersion:'unknown'}));
});
test('Saved kernel offset resolves exactly and cannot retain unrelated inspection state',()=>{
  const runs=UI.cacheStats().analysisRuns,a=UI.getSelection({...recipe,kernelOffset:7}),b=UI.getSelection({...recipe,kernelOffset:-3}),restored=UI.getSelection({...recipe,kernelOffset:7});
  assert.equal(a.kernelOffset,7);assert.equal(b.kernelOffset,-3);assert.equal(restored.kernelOffset,7);assert.equal(UI.manifest({...recipe,kernelOffset:7}).kernel.selected_term.offset_samples,7);assert.equal(UI.cacheStats().analysisRuns,runs);
  assert.equal(T.kernelRadius(0),256);assert.equal(T.kernelRadius(47),32);assert.throws(()=>T.kernelRadius(-1));assert.throws(()=>UI.getSelection({...recipe,kernelOffset:T.kernelRadius(recipe.row)+1}));assert.throws(()=>UI.getSelection({...recipe,kernelOffset:.5}));
});
test('Every landscape vertex uses the exact existing coefficient and native axes',()=>{
  geometry=L.makeGeometry(result);assert.equal(geometry.result,result);assert.equal(geometry.points.length,48*128*3);
  for(let j=0;j<48;j++)for(let k=0;k<128;k++){
    const v=geometry.vertex(j,k);assert.equal(v.magnitude,result.magnitude[j][k]);assert.equal(v.time_s,result.times_s[k]);assert.equal(v.frequency_hz,result.frequencies_hz[j]);
    assert.equal(v.z,3.2*result.magnitude[j][k]/result.display.magnitude_max);assert.equal(geometry.colors[j*128+k],L.colorForMagnitude(result.magnitude[j][k],result.display.magnitude_max));
  }
  assert.equal(geometry.vertex(0,0).x,-3.3);assert.equal(geometry.vertex(0,127).x,3.3);assert.equal(geometry.vertex(0,0).y,-2.2);assert.equal(geometry.vertex(47,0).y,2.2);
});
test('Kernel evidence exposes original immutable copies and exact complex sums',()=>{
  const before=hash(result);
  for(const row of[0,24,47])for(const sample of[0,64,127]){
    const a=T.inspectKernel(result,row,sample),b=T.inspectKernel(result,row,sample);
    assert.equal(a.version,'calibration-kernel-inspection/1');assert.notEqual(a.kernel.real,b.kernel.real);assert.deepEqual(a.kernel.real,b.kernel.real);assert.ok(Object.isFrozen(a.kernel.real)&&Object.isFrozen(a.kernel.imag));
    assert.throws(()=>{a.kernel.real[0]=123;});assert.equal(a.reconstructed.real,result.real[row][sample]);assert.equal(a.reconstructed.imag,result.imag[row][sample]);assert.equal(a.reconstructed.exactly_matches_complex_coefficient,true);
    assert.equal(a.terms.length,2*a.kernel.radius_samples+1);
    for(const term of a.terms){assert.equal(term.kernel_real,a.kernel.real[term.kernel_index]);assert.equal(term.kernel_imag,a.kernel.imag[term.kernel_index]);if(term.status==='permitted_sample'){assert.equal(term.source_value,result.values[term.source_sample_index]);assert.equal(term.source_time_s,result.times_s[term.source_sample_index]);}else{assert.equal(term.source_value,null);assert.equal(term.source_time_s,null);assert.equal(term.padded_value,0);assert.equal(Math.abs(term.contribution_real),0);assert.equal(Math.abs(term.contribution_imag),0);}}
  }
  assert.equal(hash(result),before);
});
test('Prefix inspection cannot borrow future samples and marks padded terms explicitly',()=>{
  const signal=T.makeCalibration('chirp');for(let i=128;i<1024;i++)signal.values[i]=NaN;
  const isolated=T.analyze(signal,{mode:'prefix',asOfIndex:127});assert.deepEqual(isolated,result);
  const x=T.inspectKernel(isolated,0,127);assert.equal(x.support.padding_samples.right,256);assert.ok(x.terms.filter(t=>t.source_sample_index>127).every(t=>t.status==='zero_padding'&&t.source_value===null));
});
test('Strict camera changes alter presentation without touching coefficients',()=>{
  const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)}),canvas={style:{},dataset:{},getContext:()=>ctx,getBoundingClientRect:()=>({width:700,height:390,left:0,top:0}),addEventListener(){},removeEventListener(){}};
  scene=new L.Scene(canvas);const before=hash(result);scene.render({result,row:24,sample:64,camera:L.defaultCamera});scene.setCamera({yaw:0,pitch:Math.PI/2,zoom:.9});
  assert.equal(hash(result),before);assert.equal(scene.config.result,result);assert.throws(()=>scene.setCamera({projection:'perspective'}));assert.throws(()=>scene.setCamera({zoom:0}));assert.throws(()=>scene.setCamera({pitch:NaN}));
  for(const[row,sample]of[[5,20],[24,64],[42,100]]){const p=scene.projected[row*result.times_s.length+sample];assert.deepEqual(scene.pick(p.x,p.y),{row,sample});}
});
test('Rendering record shares bounds and matches the actual Scene record',()=>{
  const actual=scene.manifest(),pure=L.renderingRecord(result,{camera:scene.getCamera(),row:24,sample:64,viewport:actual.viewport});assert.deepEqual(actual,pure);
  assert.deepEqual(actual.color_range,[0,result.display.magnitude_max]);assert.deepEqual(actual.height_range,actual.color_range);assert.equal(actual.vertices,result.magnitude.length*result.times_s.length);assert.equal(actual.analysis_recomputed,false);
  const all=UI.manifest(recipe);assert.deepEqual(all.map.magnitude_range,all.landscape.height_range);assert.deepEqual(all.sections.vertical_bounds,all.map.magnitude_range);
});
console.log(JSON.stringify({version:L.version,passed:checks.length,failed:0,checks,scope:'Numerical, cache, source-binding and renderer API checks only. Canvas stubs do not establish browser usability.'},null,2));
