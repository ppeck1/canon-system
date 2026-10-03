'use strict';
const assert=require('node:assert/strict'),F=require('./form.js');
const calibration=[{key:'position',label:'Position',unit:'m',scale:2},{key:'velocity',label:'Velocity',unit:'m/s',scale:3}];
const checks=[];function test(name,fn){fn();checks.push({name,passed:true});}
const radius=p=>Math.hypot(p[0],p[1],p[2]-2.2);
let baseline,envelope;
test('Zero contributions give one closed baseline shell above the reference plane',()=>{
  baseline=F.makeGeometry({channels:{position:0,velocity:0},calibration});assert.equal(baseline.points.length,762);assert.equal(baseline.faces.length,1520);
  for(const point of baseline.points){assert.ok(Math.abs(radius(point)-1.2)<1e-12);assert.ok(point[2]>0);}
  const edges=new Map();for(const face of baseline.faces){assert.ok(face.normal.every(Number.isFinite));for(let i=0;i<3;i++){const key=[face.ids[i],face.ids[(i+1)%3]].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)||0)+1);}}
  assert.ok([...edges.values()].every(n=>n===2));assert.equal(baseline.points.length-edges.size+baseline.faces.length,2);
});
test('Native values retain sign, units and identity; display compression is explicit and bounded',()=>{
  const channels={position:-5,velocity:9,unused:'retained outside selected view'},before=JSON.stringify(channels);envelope=F.makeGeometry({channels,calibration});
  assert.equal(JSON.stringify(channels),before);assert.equal(envelope.contributions[0].value,-5);assert.equal(envelope.contributions[0].unit,'m');assert.equal(envelope.contributions[0].displayContribution,Math.tanh(-5/2));
  for(const p of envelope.points){assert.ok(p.every(Number.isFinite));assert.ok(radius(p)>=.432-1e-12&&radius(p)<=1.968+1e-12);assert.ok(p[2]>0);}
  const neg=F.makeGeometry({channels:{position:-4,velocity:0},calibration}),pos=F.makeGeometry({channels:{position:4,velocity:0},calibration});
  assert.ok(radius(neg.markers[0].position)<1.2);assert.ok(radius(pos.markers[0].position)>1.2);assert.equal(neg.markers[0].key,'position');
});
test('Both encodings use the same two signed contributions under shared calibration',()=>{
  const native={position:-5,velocity:9},gaussian=F.makeGeometry({channels:native,calibration,encoding:'gaussian'});
  assert.deepEqual(gaussian.contributions,envelope.contributions);assert.equal(gaussian.markers[0].displayDecomposition,'negative lobe');assert.equal(gaussian.markers[1].displayDecomposition,'positive lobe');
  assert.equal(gaussian.points.length,29*29);assert.equal(gaussian.faces.length,28*28*2);assert.ok(gaussian.points.every(p=>p.every(Number.isFinite)&&p[2]>=.04));
  assert.equal(gaussian.contract.geometry.sign,'Positive and negative lobes are a display decomposition of the same two signed contributions, not additional measurements.');
});
test('Missing channels, invalid scales and unsupported cameras are rejected',()=>{
  assert.throws(()=>F.makeGeometry({channels:{position:1},calibration}));assert.throws(()=>F.makeGeometry({channels:{position:NaN,velocity:1},calibration}));
  assert.throws(()=>F.validateCalibration([{...calibration[0],scale:0},calibration[1]]));assert.throws(()=>F.validateCalibration([calibration[0],calibration[0]]));
  assert.throws(()=>F.describe({encoding:'probability',calibration}));assert.throws(()=>F.validateCamera({...F.defaultCamera,zoom:0}));assert.throws(()=>F.validateCamera({...F.defaultCamera,projection:'perspective'}));
});
test('Camera, viewport and labels affect presentation only; picks bind exact native values',()=>{
  let width=900,height=640,picked=null;const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
  const canvas={style:{},dataset:{},getContext:()=>ctx,getBoundingClientRect:()=>({width,height,left:0,top:0}),addEventListener(){},removeEventListener(){},setAttribute(){}};
  const scene=new F.Scene(canvas,{onPick:p=>{picked=p;}}),nativeA={position:-.5,velocity:1.3},nativeB={position:2.5,velocity:-1.7},config={a:{channels:nativeA,label:'Reference'},b:{channels:nativeB,label:'Candidate'},calibration,encoding:'envelope'};
  scene.render(config);const a=scene.geometries.a,b=scene.geometries.b,snapshot=JSON.stringify(scene.geometries);scene.setCamera({yaw:.8,zoom:1.4});width=1100;height=850;scene.draw();
  assert.equal(scene.geometries.a,a);assert.equal(scene.geometries.b,b);assert.equal(JSON.stringify(scene.geometries),snapshot);assert.deepEqual(scene.manifest().calibration,calibration);
  const target=scene.hitTargets.find(t=>t.side==='B'&&t.key==='velocity'),hit=scene.pick(target.screen.x,target.screen.y);assert.equal(hit.side,'B');assert.equal(hit.key,'velocity');assert.equal(hit.value,nativeB.velocity);assert.equal(hit.unit,'m/s');
  for(const target of scene.hitTargets){const picked=scene.pick(target.screen.x,target.screen.y);assert.equal(picked.markerLabel,target.markerLabel);assert.equal(picked.side,target.side);assert.equal(picked.key,target.key);}
  scene.render({...config,a:{...config.a,label:'Same native reference'}});assert.equal(scene.geometries.a,a);assert.equal(scene.getCamera().yaw,.8);scene.home();assert.deepEqual(scene.getCamera(),F.defaultCamera);
  width=1250;height=380;scene.render({...config,a:{channels:{position:0,velocity:0}},b:null});const projected=scene.geometries.a.points.map(scene.projector()),ys=projected.map(p=>p.y);assert.ok(Math.max(...ys)-Math.min(...ys)>230,'Default form uses the available short canvas height');assert.ok(Math.min(...ys)>=0&&Math.max(...ys)<height);
  scene.destroy();assert.equal(scene.destroyed,true);assert.equal(picked,null);
});
console.log(JSON.stringify({version:F.version,passed:checks.length,failed:0,checks,scope:'Closed-mesh topology, finite display geometry, source-value binding, shared calibration and camera invariance. Browser inspection is separately required.'},null,2));
