/* Pure observation, comparison and replay contracts. No canvas, audio or IO. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ObservatoryModel=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const version='observatory-model/1',schema='observatory-session/1',stateSchema='observatory-state/1';
const replayPolicy='State and transformations are checked against this implementation and the complete supplied source fingerprint manifest. Restoring expresses requested playback/audio state; it never starts either.';
const limits=Object.freeze({frequency:[.01,20],amplitude:[0,5],phase:[-4*Math.PI,4*Math.PI],damping:[0,2],shift:[-120,120],gain:[-5,5],offset:[-5,5],time:[0,120],speed:[.1,100],span:[.1,16],step:[.001,1],persistence:[0,120],zoom:[.1,8],pitch:[-Math.PI/2,Math.PI/2],height:[180,1000],maxSamples:2000000,maxAlternatives:12});
for(const value of Object.values(limits))if(Array.isArray(value))Object.freeze(value);
const reference=Object.freeze({frequency:.5,amplitude:1,phase:0,damping:0});
const clone=x=>JSON.parse(JSON.stringify(x));
const fail=(ok,message)=>{if(!ok)throw Error(message);};
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function object(value,keys,name){fail(value&&typeof value==='object'&&!Array.isArray(value),name+' must be an object.');fail(Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),name+' has missing or unsupported fields.');}
function bounded(value,bounds,name){fail(Number.isFinite(value)&&value>=bounds[0]&&value<=bounds[1],name+' must be finite within ['+bounds.join(', ')+'].');}
function enumValue(value,values,name){fail(values.includes(value),'Unsupported '+name+'.');}
function validateTune(tune,name='tune'){object(tune,['frequency','amplitude','phase','damping'],name);for(const key of Object.keys(tune))bounded(tune[key],limits[key],name+'.'+key);return tune;}
function defaultState(){return {schema:stateSchema,source:'oscillator',transport:{time:0,start:0,end:16,speed:1,span:8,step:1/60,loop:true,persistence:2,playing:false},tune:{frequency:.53,amplitude:1,phase:.45,damping:0},align:{shift:0,gain:1,offset:0},encoding:'envelope',camera:{yaw:-.55,pitch:.42,zoom:1,panX:0,panY:0,projection:'orthographic'},task:'compare',audio:{enabled:false,mix:'both'},selectedLakeId:null,panel:{inspect:false,height:240},inspection:{contribution:null,openDetails:['native']},alternatives:[]};}
function validateState(state){
 object(state,['schema','source','transport','tune','align','encoding','camera','task','audio','selectedLakeId','panel','inspection','alternatives'],'state');
 fail(state.schema===stateSchema,'Unsupported observation state schema.');enumValue(state.source,['oscillator','music','lake'],'source');
 const t=state.transport;object(t,['time','start','end','speed','span','step','loop','persistence','playing'],'transport');
 for(const key of ['time','start','end'])bounded(t[key],limits.time,'transport.'+key);
 fail(t.start<t.end&&t.time>=t.start&&t.time<=t.end,'Transport time must lie in the ordered playback bounds.');
 if(state.source==='oscillator')fail(t.end<=16,'Generated oscillator support ends at 16 seconds.');
 for(const key of ['speed','span','step','persistence'])bounded(t[key],limits[key],'transport.'+key);
 for(const key of ['loop','playing'])fail(typeof t[key]==='boolean','transport.'+key+' must be Boolean.');
 validateTune(state.tune);object(state.align,['shift','gain','offset'],'align');for(const key of Object.keys(state.align))bounded(state.align[key],limits[key],'align.'+key);
 enumValue(state.encoding,['envelope','gaussian'],'encoding');enumValue(state.task,['choose','compare','align','tune','inspect'],'task');
 const c=state.camera;object(c,['yaw','pitch','zoom','panX','panY','projection'],'camera');for(const key of ['yaw','panX','panY'])bounded(c[key],[-100000,100000],'camera.'+key);bounded(c.pitch,limits.pitch,'camera.pitch');bounded(c.zoom,limits.zoom,'camera.zoom');enumValue(c.projection,['orthographic'],'camera projection');
 object(state.audio,['enabled','mix'],'audio');fail(typeof state.audio.enabled==='boolean','audio.enabled must be Boolean.');enumValue(state.audio.mix,['both','a','b'],'audio mix');
 fail(state.selectedLakeId===null||(typeof state.selectedLakeId==='string'&&state.selectedLakeId.length>0&&state.selectedLakeId.length<=256),'Invalid selected lake identity.');
 object(state.panel,['inspect','height'],'panel');fail(typeof state.panel.inspect==='boolean','panel.inspect must be Boolean.');bounded(state.panel.height,limits.height,'panel.height');
 object(state.inspection,['contribution','openDetails'],'inspection');
 const selected=state.inspection.contribution;
 if(selected!==null){object(selected,['side','key'],'inspection.contribution');enumValue(selected.side,['A','B'],'contribution side');fail(state.source!=='lake','Lake records do not provide form contributions.');enumValue(selected.key,state.source==='oscillator'?['position','velocity']:['left','right'],'contribution channel for selected source');}
 const details=state.inspection.openDetails;fail(Array.isArray(details)&&details.length<=4,'inspection.openDetails must be a bounded array.');
 for(const detail of details)enumValue(detail,['native','source','receipt','lakes'],'inspection detail');fail(new Set(details).size===details.length,'inspection.openDetails must contain unique entries.');
 fail(Array.isArray(state.alternatives)&&state.alternatives.length<=limits.maxAlternatives,'Too many saved candidate alternatives.');
 for(const [i,a] of state.alternatives.entries()){object(a,['name','tune'],'alternative '+i);fail(typeof a.name==='string'&&a.name.trim().length>0&&a.name.length<=80,'Alternative name must contain 1–80 characters.');validateTune(a.tune,'alternative '+i+' tune');}
 return state;
}
function recipeReceipt(state){
 validateState(state);
 return {version,source:state.source,
  reference:state.source==='oscillator'?{kind:'generated_control',fixed:true,parameters:clone(reference),support_seconds:[0,16]}:state.source==='music'?{kind:'retained_stereo_pcm',fixed:true,channels:['left','right'],sample_selection:'nearest native sample by round(t * sampleRate), limited to the last stored sample while t < duration'}:{kind:'retained_lake_record',fixed:true,identity:state.selectedLakeId,temporal_signal:'unsupported'},
  candidate:state.source==='oscillator'?{kind:'generated_scenario',parameters:clone(state.tune),support_seconds:[0,16]}:state.source==='music'?{kind:'same_retained_stereo_pcm',tune_applied:false}:{kind:'same_retained_lake_record',tune_applied:false},
  equations:state.source==='oscillator'?{position:'amplitude * exp(-damping*t) * sin(2*pi*frequency*t + phase)',velocity:'amplitude * exp(-damping*t) * (2*pi*frequency*cos(2*pi*frequency*t+phase) - damping*sin(2*pi*frequency*t+phase))',units:{position:'declared synthetic position unit',velocity:'declared synthetic position unit / second'}}:state.source==='music'?{channels:'native retained PCM samples; no inferred physical stress or categorical waveform',units:'dimensionless decoded PCM amplitude'}:null,
  alignment:{applied_to:'candidate B only',parameters:clone(state.align),native_time:'displayTime - shift',position_or_pcm:'gain * nativeValue + offset',velocity:'gain * nativeVelocity',time_stretching:false,outside_source_support:'missing; no cyclic source extension or extrapolation'},
  transport:{...clone(state.transport),clock_role:'shared display cursor; loop changes only cursor position, never source support',persistence_role:'rendered trailing history span, not dynamical damping'},
  observation:{encoding:state.encoding,task:state.task,camera:clone(state.camera),panel:clone(state.panel),inspection:clone(state.inspection),selectedLakeId:state.selectedLakeId,analytical_window_span_seconds:state.transport.span},
  alternatives:clone(state.alternatives),audio:{...clone(state.audio),role:'audition request only; this pure module never starts audio or playback'},
  discrepancy:{oscillator_grid_hz:128,music_grid:'native PCM sample rate',window_policy:'caller-specified half-open [start,end), sampled on the display clock grid',missing_policy:'exclude missing pairs from error statistics; include them explicitly in coverage',claim:'Pointwise channel discrepancy on the selected window only; not whole-system equivalence.'}};
}
function musicInfo(data){
 fail(data&&typeof data==='object','Retained PCM data are unavailable.');
 bounded(data.sampleRate,[1,192000],'PCM sample rate');fail(Number.isInteger(data.sampleRate),'PCM sample rate must be an integer.');
 const n=data.left?.length;fail(Number.isInteger(n)&&n>=2&&n<=limits.maxSamples&&data.right?.length===n,'PCM channels must contain equal bounded sample counts.');
 bounded(data.duration,[1/data.sampleRate,120],'PCM duration');
 fail(Math.abs(data.duration-n/data.sampleRate)<=1e-10,'PCM duration must equal stored sample count / sample rate.');
 return {sampleRate:data.sampleRate,count:n,duration:data.duration,revision:data.sha256??data.sourceRevision??null};
}
function oscillator(parameters,t){const w=2*Math.PI*parameters.frequency,a=parameters.amplitude*Math.exp(-parameters.damping*t),angle=w*t+parameters.phase;return {position:a*Math.sin(angle),velocity:a*(w*Math.cos(angle)-parameters.damping*Math.sin(angle))};}
function sampleUnchecked(state,side,time,musicData,info){
 const isB=side==='B',a=isB?state.align:{shift:0,gain:1,offset:0},nativeTime=time-a.shift;
 const base={side,displayTime:time,nativeTime,valid:false,channels:{},units:{},sourceRefs:[],derived:{alignment_applied:isB,shift_seconds:a.shift,gain:a.gain,offset:a.offset,time_stretching:false}};
 if(state.source==='lake')return {...base,reason:'unsupported_temporal_signal',derived:{...base.derived,note:'A retained lake record is not treated as a sampled temporal signal.'}};
 if(state.source==='oscillator'){
  const parameters=isB?state.tune:reference,units={position:'synthetic position unit',velocity:'synthetic position unit / s'};
  const sourceRefs=[{source:'oscillator',kind:'generated_scenario',recipe:isB?'candidate-tune':'fixed-reference/1',nativeTime,parameters:clone(parameters)}];
  if(nativeTime<0||nativeTime>16)return {...base,reason:'outside_source_support',units,channels:{position:null,velocity:null},sourceRefs};
  const native=oscillator(parameters,nativeTime);
  return {...base,valid:true,reason:null,units,channels:{position:a.gain*native.position+a.offset,velocity:a.gain*native.velocity},sourceRefs,derived:{...base.derived,nativeChannels:native,velocity_method:'analytical derivative of the declared position equation'}};
 }
 info=info||musicInfo(musicData);const units={left:'dimensionless PCM amplitude',right:'dimensionless PCM amplitude'};
 if(nativeTime<0||nativeTime>=info.duration)return {...base,reason:'outside_source_support',units,channels:{left:null,right:null}};
 const sampleIndex=Math.min(info.count-1,Math.round(nativeTime*info.sampleRate)),sampleTime=sampleIndex/info.sampleRate,native={left:musicData.left[sampleIndex],right:musicData.right[sampleIndex]};
 const finite=Number.isFinite(native.left)&&Number.isFinite(native.right);
 const sourceRefs=['left','right'].map(channel=>({source:'music',sourceRevision:info.revision,channel,sampleIndex,sampleTime,sampleRate:info.sampleRate,selection:'nearest native sample; no waveform interpolation'}));
 return {...base,valid:finite,reason:finite?null:'nonfinite_native_sample',units,channels:finite?{left:a.gain*native.left+a.offset,right:a.gain*native.right+a.offset}:{left:null,right:null},sourceRefs,derived:{...base.derived,nativeChannels:native,sampleIndex,sampleTime,requestedNativeTime:nativeTime,quantizationErrorSeconds:sampleTime-nativeTime}};
}
function sample(state,side,time,musicData){validateState(state);enumValue(side,['A','B'],'sample side');fail(Number.isFinite(time),'Display sample time must be finite.');return sampleUnchecked(state,side,time,musicData);}
function metrics(state,window,musicData){
 validateState(state);object(window,['start','end'],'comparison window');for(const k of ['start','end'])bounded(window[k],limits.time,'comparison '+k);fail(window.start<window.end,'Comparison window must have positive duration.');
 const claim='Pointwise channel discrepancy on the selected window only; not whole-system equivalence.';
 if(state.source==='lake')return {available:false,reason:'unsupported_temporal_signal',window:clone(window),channels:{},coverage:null,grid:null,claim};
 const info=state.source==='music'?musicInfo(musicData):null,rate=info?.sampleRate||128,first=Math.ceil(window.start*rate),stop=Math.ceil(window.end*rate),count=stop-first;
 fail(count>0&&count<=limits.maxSamples,'Comparison grid is empty or exceeds the bounded sample limit.');
 const keys=state.source==='music'?['left','right']:['position','velocity'],acc=Object.fromEntries(keys.map(k=>[k,{sumSquares:0,maxAbsoluteError:0,pairs:0}]));
 const coverage={requested:count,paired:0,missingReference:0,missingCandidate:0,missingEither:0,fraction:0};
 for(let i=first;i<stop;i++){
  if(info){
   // Same nearest-sample rule as source inspection, without allocating source
   // references for every paired PCM sample in a potentially large window.
   const t=i/rate,bt=t-state.align.shift,ai=Math.min(info.count-1,Math.round(t*rate)),bi=Math.min(info.count-1,Math.round(bt*rate));
   const av=t>=0&&t<info.duration&&Number.isFinite(musicData.left[ai])&&Number.isFinite(musicData.right[ai]);
   const bv=bt>=0&&bt<info.duration&&Number.isFinite(musicData.left[bi])&&Number.isFinite(musicData.right[bi]);
   if(!av)coverage.missingReference++;if(!bv)coverage.missingCandidate++;
   if(!av||!bv){coverage.missingEither++;continue;}
   coverage.paired++;
   for(const key of keys){const delta=state.align.gain*musicData[key][bi]+state.align.offset-musicData[key][ai],x=acc[key];x.sumSquares+=delta*delta;x.maxAbsoluteError=Math.max(x.maxAbsoluteError,Math.abs(delta));x.pairs++;}
   continue;
  }
  const t=i/rate,a=sampleUnchecked(state,'A',t,musicData,info),b=sampleUnchecked(state,'B',t,musicData,info);
  if(!a.valid)coverage.missingReference++;if(!b.valid)coverage.missingCandidate++;
  if(!a.valid||!b.valid){coverage.missingEither++;continue;}
  coverage.paired++;
  for(const key of keys){const delta=b.channels[key]-a.channels[key],x=acc[key];x.sumSquares+=delta*delta;x.maxAbsoluteError=Math.max(x.maxAbsoluteError,Math.abs(delta));x.pairs++;}
 }
 coverage.fraction=coverage.paired/count;
 const channels=Object.fromEntries(keys.map(k=>[k,{rmse:acc[k].pairs?Math.sqrt(acc[k].sumSquares/acc[k].pairs):null,maxAbsoluteError:acc[k].pairs?acc[k].maxAbsoluteError:null,pairs:acc[k].pairs}]));
 return {available:coverage.paired>0,reason:coverage.paired?null:'no_paired_samples',window:clone(window),channels,coverage,grid:{sampleRate:rate,firstIndex:first,lastIndex:stop-1,firstTime:first/rate,lastTime:(stop-1)/rate,start:window.start,end:window.end,endPolicy:'exclusive',sampling:state.source==='music'?'native sample rate; shifted candidate uses nearest retained sample':'128 Hz evaluation of declared continuous synthetic equation'},claim};
}
function jsonSafe(value,name='metadata',depth=0){
 fail(depth<=24,name+' is too deeply nested.');
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='number'){fail(Number.isFinite(value),name+' must contain finite numbers.');return;}
 if(typeof value==='string'){fail(value.length<=100000,name+' string is too long.');return;}
 fail(value&&typeof value==='object',name+' must be JSON data.');
 fail(Object.keys(value).length<=10000,name+' contains too many fields.');
 for(const [key,item] of Object.entries(value))jsonSafe(item,name+'.'+key,depth+1);
}
function validateSources(sources,source){
 fail(sources&&typeof sources==='object'&&!Array.isArray(sources),'Source fingerprints must be a named object.');jsonSafe(sources,'sources');
 const selected=sources[source],hash=typeof selected==='string'?selected:selected?.sha256;
 fail(typeof hash==='string'&&/^[0-9a-f]{64}$/i.test(hash),'Selected source '+source+' requires a SHA-256 fingerprint.');
 return sources;
}
function renderingValue(value,state){const resolved=typeof value==='function'?value(clone(state)):value??null;if(resolved!==null)jsonSafe(resolved,'rendering record');return resolved;}
function save(state,{sources,renderingRecord=null}={}){
 validateState(state);validateSources(sources,state.source);
 return {schema,modelVersion:version,state:clone(state),sources:clone(sources),transformationReceipt:recipeReceipt(state),renderingRecord:clone(renderingValue(renderingRecord,state)),replayPolicy};
}
function restore(packet,{sources,renderingRecord=null}={}){
 object(packet,['schema','modelVersion','state','sources','transformationReceipt','renderingRecord','replayPolicy'],'saved session');
 fail(packet.schema===schema&&packet.modelVersion===version,'Unsupported saved session or model version.');
 fail(packet.replayPolicy===replayPolicy,'Unsupported saved replay policy.');
 validateState(packet.state);validateSources(sources,packet.state.source);validateSources(packet.sources,packet.state.source);
 fail(stable(packet.sources)===stable(sources),'Source fingerprints disagree; no evidence substitution.');
 const receipt=recipeReceipt(packet.state);fail(stable(packet.transformationReceipt)===stable(receipt),'Saved transformation receipt disagrees with the recipe.');
 const expectedRendering=renderingValue(renderingRecord,packet.state);jsonSafe(packet.renderingRecord,'saved rendering record');
 fail(stable(packet.renderingRecord)===stable(expectedRendering),'Saved rendering record disagrees with the current rendering recipe.');
 return {state:clone(packet.state),receipt,renderingRecord:clone(expectedRendering)};
}
return Object.freeze({version,schema,stateSchema,limits,reference,defaultState,validateState,stable,recipeReceipt,sample,metrics,save,restore});
});
