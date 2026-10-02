'use strict';
const assert=require('node:assert/strict');
const T=require('./timescale.js');
const checks=[];
function check(name,fn){fn();checks.push({name,passed:true});}
const signals=Object.fromEntries(['chirp','sinusoid','constant'].map(kind=>[kind,T.makeCalibration(kind)]));
let chirp,sine,constant,prefix;
check('Fixtures retain their equations, native spacing, identity, revision, and units',()=>{
  for(const [kind,s] of Object.entries(signals)){
    assert.equal(s.id,kind);assert.equal(s.source_revision,'calibration-signals/1');assert.equal(s.source_kind,'synthetic_calibration');assert.equal(s.values.length,1024);assert.equal(s.times_s.length,1024);assert.equal(s.times_s[1023],1023/128);assert.equal(s.sample_rate_hz,128);assert.ok(s.equation);assert.ok(s.units);
    for(let i=0;i<1024;i++)assert.equal(s.times_s[i],i/128);
  }
  assert.equal(signals.constant.values[600],1);assert.equal(signals.sinusoid.values[3],Math.sin(2*Math.PI*12*3/128));
});
check('Unsupported source kinds, versions, configurations, and short prefixes fail explicitly',()=>{
  assert.equal(T.eligibility({source_kind:'simulated_queue'}).available,false);
  assert.throws(()=>T.makeCalibration('queue'));
  assert.throws(()=>T.analyze({source_kind:'simulated_queue'}));
  assert.throws(()=>T.analyze({...signals.chirp,source_revision:'unknown'}));
  assert.throws(()=>T.analyze(signals.chirp,{mode:'unknown'}));
  assert.throws(()=>T.analyze(signals.chirp,{mode:'prefix',asOfIndex:62}));
  assert.throws(()=>T.analyze(signals.chirp,{mode:'prefix',asOfIndex:1024}));
  assert.throws(()=>T.analyze(signals.chirp,{mode:'prefix',asOfIndex:128.1}));
  assert.throws(()=>T.analyze(signals.chirp,{contractVersion:'calibration-cwt/2'}));
  assert.throws(()=>T.analyze(signals.chirp,{softness:1}));
});
check('Missing, nonfinite, unpaired, duplicate, and irregular selected samples are rejected',()=>{
  for(const bad of [null,undefined,NaN,Infinity]){const s=T.makeCalibration('chirp');s.values[100]=bad;assert.throws(()=>T.analyze(s));}
  const short=T.makeCalibration('chirp');short.values.pop();assert.throws(()=>T.analyze(short));
  const duplicate=T.makeCalibration('chirp');duplicate.times_s[100]=duplicate.times_s[99];assert.throws(()=>T.analyze(duplicate));
  const irregular=T.makeCalibration('chirp');irregular.times_s[100]+=0.001;assert.throws(()=>T.analyze(irregular));
  assert.throws(()=>T.analyze({...signals.chirp,sample_rate_hz:64}));
});
check('Numeric transform exposes fixed scale-frequency conversion and complex magnitude',()=>{
  chirp=T.analyze(signals.chirp);sine=T.analyze(signals.sinusoid);constant=T.analyze(signals.constant);
  for(const result of [chirp,sine,constant]){
    assert.equal(result.contract_version,'calibration-cwt/1');assert.equal(result.implementation_version,'cmor-sampled-convolution/1');assert.equal(result.scales.length,48);assert.equal(result.times_s.length,1024);
    assert.equal(result.frequencies_hz[0],4);assert.equal(result.frequencies_hz[47],32);assert.equal(result.scales[0],32);assert.equal(result.scales[47],4);
    let max=0;
    for(let j=0;j<48;j++){
      assert.ok(Math.abs(result.scales[j]*result.frequencies_hz[j]-128)<1e-12);
      assert.equal(result.magnitude[j].length,1024);
      for(let b=0;b<1024;b++){
        assert.ok(Number.isFinite(result.real[j][b])&&Number.isFinite(result.imag[j][b]));
        assert.equal(result.magnitude[j][b],Math.hypot(result.real[j][b],result.imag[j][b]));
        max=Math.max(max,result.magnitude[j][b]);
      }
    }
    assert.equal(result.display.magnitude_max,max);assert.equal(result.display.magnitude_min,0);assert.equal(result.support_policy.detrending,'none');
  }
});
check('Actual finite support, zero extension, and COI are distinct and inspectable',()=>{
  const mid=T.coefficientSupport(chirp,0,512),edge=T.coefficientSupport(chirp,0,0),near=T.coefficientSupport(chirp,0,100);
  assert.deepEqual(mid.observed_sample_range,[256,768]);assert.equal(mid.observed_sample_count,513);assert.equal(mid.zero_padding_contributed,false);assert.equal(mid.edge_affected,false);
  assert.deepEqual(edge.observed_sample_range,[0,256]);assert.deepEqual(edge.padding_samples,{left:256,right:0});assert.equal(edge.edge_affected,true);
  assert.equal(near.zero_padding_contributed,true);assert.equal(near.edge_affected,false);
  assert.equal(mid.source_revision,'calibration-signals/1');assert.equal(mid.frequency_hz,4);assert.equal(mid.center_time_s,4);
  assert.throws(()=>T.coefficientSupport(chirp,-1,0));assert.throws(()=>T.coefficientSupport(chirp,0,1024));
});
check('Prefix slices before convolution and future data cannot affect coefficients or display bounds',()=>{
  prefix=T.analyze(signals.chirp,{mode:'prefix',asOfIndex:512});
  const changed=T.makeCalibration('chirp');
  for(let i=513;i<1024;i++){changed.values[i]=NaN;changed.times_s[i]=NaN;}
  const isolated=T.analyze(changed,{mode:'prefix',asOfIndex:512});
  assert.deepEqual(prefix,isolated);assert.equal(prefix.values.length,513);assert.equal(prefix.interval.last_sample_index,512);
  const s=T.coefficientSupport(prefix,0,512);assert.deepEqual(s.observed_sample_range,[256,512]);assert.equal(s.padding_samples.right,256);assert.equal(s.edge_affected,true);
  let difference=0;for(let j=0;j<48;j++)difference=Math.max(difference,Math.hypot(prefix.real[j][512]-chirp.real[j][512],prefix.imag[j][512]-chirp.imag[j][512]));
  assert.ok(difference>0.01,'A full-data crop must not masquerade as prefix recomputation');
  const all=T.analyze(signals.chirp,{mode:'prefix',asOfIndex:1023});assert.deepEqual(all.real,chirp.real);assert.deepEqual(all.imag,chirp.imag);
  const minimum=T.analyze(signals.chirp,{mode:'prefix',asOfIndex:63});assert.equal(minimum.values.length,64);assert.ok(minimum.edge_affected[0].every(Boolean));
});
let sinusoidAnalyticMaxError=0,constantInteriorMax=0,chirpMedianRelativeError=0,chirpP95RelativeError=0;
check('Known sinusoid matches the analytic response in unpadded interior',()=>{
  for(let j=0;j<48;j++){
    const a=sine.scales[j],r=Math.floor(8*a),positive=Math.exp(-Math.PI*Math.PI*1.5*Math.pow(a*12/128-1,2)),negative=Math.exp(-Math.PI*Math.PI*1.5*Math.pow(a*12/128+1,2));
    for(let b=r;b<1024-r;b+=23){
      const phase=2*Math.PI*12*b/128,re=Math.sqrt(a)/2*(positive+negative)*Math.sin(phase),im=-Math.sqrt(a)/2*(positive-negative)*Math.cos(phase);
      sinusoidAnalyticMaxError=Math.max(sinusoidAnalyticMaxError,Math.hypot(sine.real[j][b]-re,sine.imag[j][b]-im));
    }
  }
  assert.ok(sinusoidAnalyticMaxError<1e-10,'Analytic sinusoid absolute complex error: '+sinusoidAnalyticMaxError);
});
check('Constant has only tiny interior residual while boundary response remains visible',()=>{
  for(let j=0;j<48;j++){
    const r=Math.floor(8*constant.scales[j]);
    for(let b=r;b<1024-r;b++)constantInteriorMax=Math.max(constantInteriorMax,constant.magnitude[j][b]);
  }
  assert.ok(constantInteriorMax<3e-6);assert.ok(constant.display.magnitude_max>0.1);
});
check('Known rising frequency is recognizable in the useful interior without exact ridge claims',()=>{
  const errors=[];
  for(let b=256;b<768;b+=4){
    let best=-1,strength=-1;
    for(let j=0;j<48;j++)if(!chirp.edge_affected[j][b]&&chirp.magnitude[j][b]>strength){strength=chirp.magnitude[j][b];best=j;}
    const expected=6+2.5*chirp.times_s[b];errors.push(Math.abs(chirp.frequencies_hz[best]-expected)/expected);
  }
  errors.sort((a,b)=>a-b);chirpMedianRelativeError=errors[Math.floor(errors.length/2)];chirpP95RelativeError=errors[Math.floor(errors.length*0.95)];
  assert.ok(chirpMedianRelativeError<0.06&&chirpP95RelativeError<0.1);
});
const output={contract_version:T.version,implementation_version:T.implementationVersion,passed:checks.length,failed:0,checks,metrics:{sinusoid_analytic_max_absolute_complex_error:sinusoidAnalyticMaxError,constant_unpadded_interior_max_magnitude:constantInteriorMax,chirp_interior_ridge_median_relative_error:chirpMedianRelativeError,chirp_interior_ridge_p95_relative_error:chirpP95RelativeError},scope:'Implementation controls on synthetic calibration; no CANON efficacy or queue-frequency inference'};
console.log(JSON.stringify(output,null,2));
