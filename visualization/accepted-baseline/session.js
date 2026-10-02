/* One effective configuration feeds rendering, linked views and saved checkpoints. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./evidence.js'):root.EvidenceStore,node?require('./domain.js'):root.QueueDomain,node?require('./encoding.js'):root.SpatialEncoding,node?require('./frames.js'):root.ObservationFrames,node?require('./comparison.js'):root.ViewComparison,()=>node?require('./labels.js'):root.DisplayLabels);
 if(node)module.exports=api;if(root)root.AnalyticSession=api;
})(typeof globalThis!=='undefined'?globalThis:this,(E,D,V,F,C,getLabels)=>{
'use strict';
const version='analytic-session/2',schema='canon-analytic-checkpoint/2',preset='required-work-disposition-gaussian/1';
const instrumentVersion='instrument-views/1',labelVersion='display-labels/1',transformVersion='calibration-cwt/1';
const channelKeys=['ready','unfinished','completed','backup','absent','rate','delivered'];
const copy=x=>JSON.parse(JSON.stringify(x));
const fail=(ok,message)=>{if(!ok)throw Error(message);};
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function validateInstrumentVersions(i){
 fail(i&&typeof i==='object'&&!Array.isArray(i),'Instrument settings must be an object.');
 fail(i.version===instrumentVersion,'Unsupported instrument version: '+String(i.version)+'; expected '+instrumentVersion+'.');
 fail(i.labelVersion===labelVersion,'Unsupported display-label version: '+String(i.labelVersion)+'; expected '+labelVersion+'.');
 fail(i.transformVersion===transformVersion,'Unsupported calibration transform version: '+String(i.transformVersion)+'; expected '+transformVersion+'.');
}
function validateInstrument(i){
 validateInstrumentVersions(i);
 const fields=['version','active','companion','timeChannels','xChannel','yChannel','yMax','timeOffset','labelVersion','transformVersion','calibration','workspace','structure'];
 fail(Object.keys(i).every(k=>fields.includes(k)),'Unsupported instrument setting; no saved option is silently discarded.');
 fail(['body','time','relationship','timescale','system','lineage'].includes(i.active),'Unsupported primary instrument view.');
 fail(['none','time','relationship','system','lineage'].includes(i.companion),'Unsupported companion instrument view.');
 fail(Array.isArray(i.timeChannels)&&i.timeChannels.length>0&&i.timeChannels.every(k=>channelKeys.includes(k))&&new Set(i.timeChannels).size===i.timeChannels.length,'Time channels must be a nonempty list of distinct supported source channels.');
 fail(channelKeys.includes(i.xChannel)&&channelKeys.includes(i.yChannel),'Unsupported relationship source channel.');
 fail(i.yMax===null||(Number.isFinite(i.yMax)&&i.yMax>0),'Instrument yMax must be null for shared-prefix calibration or a finite positive value.');
 fail(Number.isFinite(i.timeOffset)&&i.timeOffset<=0,'Instrument timeOffset must be finite and nonpositive; future window pan is unsupported.');
 if(Object.hasOwn(i,'calibration')){
  const c=i.calibration;
  fail(c&&typeof c==='object'&&!Array.isArray(c),'Calibration selection must be an object.');
  fail(Object.keys(c).every(k=>['signal','mode','endSample','row','sample','landscapeVersion','landscapeCamera','kernelOffset'].includes(k)),'Unsupported calibration setting; no saved option is silently discarded.');
  fail(['chirp','sinusoid','constant'].includes(c.signal),'Unsupported calibration signal.');
  fail(['retrospective','prefix'].includes(c.mode),'Unsupported calibration observation mode.');
  fail(Number.isInteger(c.endSample)&&c.endSample>=63&&c.endSample<=1023,'Calibration endSample must be an inclusive sample index from 63 to 1023.');
  if(Object.hasOwn(c,'row'))fail(Number.isInteger(c.row)&&c.row>=0&&c.row<=47,'Calibration cursor row must be an integer from 0 to 47.');
  if(Object.hasOwn(c,'sample'))fail(Number.isInteger(c.sample)&&c.sample>=0&&c.sample<=(c.mode==='prefix'?c.endSample:1023),'Calibration cursor sample must be an integer within the permitted input samples.');
  if(Object.hasOwn(c,'kernelOffset')){
   const api=typeof module==='object'&&module.exports?require('./timescale.js'):globalThis.CanonTimescale;
   fail(typeof api?.kernelRadius==='function','Kernel inspection implementation unavailable.');
   fail(Number.isInteger(c.kernelOffset)&&Math.abs(c.kernelOffset)<=api.kernelRadius(c.row??24),'Kernel inspection offset outside the selected analyzing support.');
  }
  if(Object.hasOwn(c,'landscapeVersion')||Object.hasOwn(c,'landscapeCamera')){
   fail(c.landscapeVersion==='timescale-landscape/1','Unsupported landscape version.');
   const cam=c.landscapeCamera;
   fail(cam&&Object.keys(cam).length===6&&Object.keys(cam).every(k=>['yaw','pitch','zoom','panX','panY','projection'].includes(k)),'Unsupported landscape camera setting.');
   for(const k of ['yaw','pitch','zoom','panX','panY'])fail(Number.isFinite(cam[k]),'Invalid landscape camera '+k+'.');
   fail(cam.projection==='orthographic'&&cam.pitch>=.08&&cam.pitch<=Math.PI/2&&cam.zoom>=.25&&cam.zoom<=3,'Landscape camera outside supported limits.');
  }
 }
 if(Object.hasOwn(i,'workspace')){
  const api=typeof module==='object'&&module.exports?require('./workspace.js'):globalThis.LinkedWorkspace;
  fail(api?.version==='linked-workspace/1','Workspace implementation unavailable.');api.validate(i.workspace);
 }
 if(Object.hasOwn(i,'structure')){
  const s=i.structure;
  fail(s&&s.version==='system-lineage/1','Unsupported structure version.');
  fail(Object.keys(s).every(k=>['version','lineageChannel','lineageSource','selectedIdentity'].includes(k)),'Unsupported structure setting.');
  fail(channelKeys.includes(s.lineageChannel)&&['queue','calibration'].includes(s.lineageSource),'Unsupported lineage source or channel.');
  const id=s.selectedIdentity;
  fail(id===null||(id&&Object.keys(id).length===3&&['A','B'].includes(id.side)&&typeof id.caseId==='string'&&typeof id.identity==='string'&&id.identity.length>0),'Invalid selected queue identity.');
 }
 fail(![i.active,i.companion].some(v=>['system','lineage'].includes(v))||Object.hasOwn(i,'structure'),'Structure view requires an explicit structure recipe.');
 fail(i.active!=='timescale'||Object.hasOwn(i,'calibration'),'Timescale view requires an explicit calibration signal and observation selection.');
 return i;
}
function create(bundle,{bundleSha,rendererVersion,cameraLimits={zoom:[.05,2.5],pitch:[.02,Math.PI/2]}}={}){
 fail(typeof bundleSha==='string'&&bundleSha.length===64,'Retained bundle revision hash is required.');
 fail(typeof rendererVersion==='string','Renderer implementation version is required.');
 const store=E.create(bundle,{bundleSha256:bundleSha});
 bundle=store.bundle;
 const scenarios=new Map(bundle.scenarios.map(s=>[s.id,s]));
 const versions={evidence:E.version,adapter:D.version||D.mappingVersion,frame:F.version,encoding:V.version||V.encodingVersion||'required-work-gaussian-encoding/1',mapping:V.mappingVersion||D.mappingVersion,kernel:V.kernelVersion,renderer:rendererVersion,comparison:C.version,session:version};
 const sourceRefs=[{role:'authored_facts',sha256:bundle.source.sha256},{role:'retained_simulated_traces_and_ledger',sha256:bundleSha},{role:'simulated_record_producer',sha256:bundle.metadata.behavior_copy_sha256}];
 const rendererEncoding={id:preset,version:versions.encoding,kernelVersion:V.kernelVersion,categories:V.categories,field:V.field,fieldFormula:'sum(n_k * exp(-((u-u_k)^2+(v-v_k)^2)/(2*h^2)) / (2*pi*h^2))'};
 function validateState(t){
  fail(t&&typeof t==='object','Saved presentation/observation state is missing.');
  fail(t.version==='state-body-view/2','Unsupported state version.');
  fail(t.preset===preset,'Unsupported visual preset. Required-work disposition is a named preset, not a universal schema.');
  fail(typeof t.compare==='boolean','Comparison enabled must be Boolean.');
  fail(['now','history'].includes(t.perspective)&&['overlay','side','soloA','soloB'].includes(t.mode)&&['native','aligned'].includes(t.clock),'Unsupported view/frame mode.');
  for(const k of ['a','b']){
   const s=scenarios.get(t[k]?.scenarioId),w=s?.worlds[t[k]?.worldIndex];
   fail(Number.isInteger(t[k]?.worldIndex)&&w?.records.some(r=>r.event_index===t[k]?.eventIndex),'Unknown selected scenario, alternative world or ordered event: '+k.toUpperCase());
   fail(['decision','first_service_boundary','first_completed_payload'].includes(t[k].anchor),'Unsupported event anchor.');
  }
  for(const[k,min,max]of [['h',.35,1.1],['valueGain',.5,2],['span',1,8]])fail(Number.isFinite(t[k])&&t[k]>=min&&t[k]<=max,'Invalid '+k+' outside implemented scale contract.');
  fail(['u','v'].includes(t.slice?.axis)&&Number.isFinite(t.slice.offset)&&t.slice.offset>=-3&&t.slice.offset<=3,'Invalid transverse slice.');
  for(const k of ['surface','contours','exact'])fail(typeof t.layers?.[k]==='boolean','Invalid layer flag: '+k);
  for(const k of ['yaw','pitch','zoom','panX','panY'])fail(Number.isFinite(t.camera?.[k]),'Invalid camera: '+k);
  fail(['perspective','orthographic'].includes(t.camera.projection),'Unsupported camera projection.');
  for(const k of ['zoom','pitch']){const limit=cameraLimits[k],min=limit.min??limit[0],max=limit.max??limit[1];fail(t.camera[k]>=min&&t.camera[k]<=max,'Camera '+k+' outside supported limits; no silent clamping during restore.');}
  if(Object.hasOwn(t,'instrument'))validateInstrument(t.instrument);
  const identity=t.instrument?.structure?.selectedIdentity;
  if(identity){
   fail(identity.side!=='B'||t.compare,'Selected identity side B is not enabled.');
   const selectedScenario=scenarios.get(t[identity.side.toLowerCase()].scenarioId);
   fail(selectedScenario.case_id===identity.caseId,'Selected identity case does not match its shown side.');
   const c=bundle.cases.find(c=>c.case_id===identity.caseId);
   fail(c&&c.system==='finite_fifo_queue'&&[...c.task.required_payload_ids,...c.facts.pending_fifo_payload_ids,...c.facts.backup_payload_ids].includes(identity.identity),'Selected identity does not resolve in its source case.');
  }
  return t;
 }
 function select(x){
  const s=scenarios.get(x.scenarioId),w=s.worlds[x.worldIndex],r=w.records.find(r=>r.event_index===x.eventIndex);
  return {s,w,r,p:D.partition(r),prefix:D.prefix(w,x.eventIndex),anchor:D.anchorFor(s,w,x.eventIndex,x.anchor)};
 }
 function compile(input,{viewport=null}={}){
  const t=copy(validateState(input)),a=select(t.a),b=t.compare?select(t.b):null;
  const frameOptions={clock:t.clock,span:t.span,timeOffset:t.instrument?.timeOffset||0};
  const fa=F.side(a,frameOptions),fb=b?F.side(b,frameOptions):null;
  const history=F.combine(fa,fb);history.countGain=.42*(t.valueGain/1.35);
  const cal={halfExtent:3.6,h:t.h,valueGain:t.valueGain},comparison=C.make(a,b,history,cal);
  const supported=history.status==='available';
  const labels=Object.hasOwn(t,'instrument')?getLabels():null;
  if(labels)fail(labels.version===labelVersion&&typeof labels.caseLabel==='function'&&typeof labels.eventLabel==='function','Unsupported display-label implementation; expected '+labelVersion+'.');
  if(Object.hasOwn(t,'instrument'))fail(labels,'Display labels are unavailable for this instrument version.');
  const describe=(z,label)=>({label,scenario_id:z.s.id,world_id:z.w.id,record_id:z.r.id,event_index:z.r.event_index,native_time_s:z.r.time_s,known_at_s:z.r.known_at_s,partition:z.p,anchor:z.anchor,original_deadline_s:z.s.deadline_s,metadata:D.describe(z,bundle),crop:V.cropInfo(z.p.weights,t.h)});
  const body=z=>({weights:copy(z.p.weights),label:labels
   ?'Initial case: '+labels.caseLabel(bundle,z.s.case_id).label+' · '+z.r.time_s+' s · '+labels.eventLabel(z.r).label+' · event '+z.r.event_index
   :z.s.id+' · '+z.r.time_s+' s · '+z.r.event_kind,recordId:z.r.id});
  const render={showLegend:false,a:body(a),b:b?body(b):null,mode:t.compare?t.mode:'soloA',camera:copy(t.camera),calibration:cal,layers:t.perspective==='history'?{surface:true,contours:true,exact:true}:copy(t.layers),slice:copy(t.slice),perspective:supported?t.perspective:'now',visible:supported||t.perspective==='now',history:supported?history:null,encoding_ref:{id:preset,version:versions.encoding,kernel_version:versions.kernel}};
  return {schema:'canon-effective-view/2',versions:copy(versions),source_revisions:copy(sourceRefs),requested:t,
   ...(Object.hasOwn(t,'instrument')?{instrument:{...copy(t.instrument),source_revision:bundleSha,
    ...(t.instrument.calibration?{calibration_source:{revision:'calibration-signals/1',implementation:'cmor-sampled-convolution/1',channel:'calibration_amplitude'}}:{}),
    selected_record_refs:{A:a.r.id,B:b?b.r.id:null},prefix_record_refs:{A:a.prefix.map(r=>r.id),B:b?b.prefix.map(r=>r.id):[]}}}:{}),
   observation:{frame_id:t.clock==='native'?'native-seconds/1':'event-relative-seconds/1',as_of_policy:'Each selected ordered event; native time and known-at guards. This display policy is not a security boundary over a locally bundled future.',A:fa,B:fb,shared_display_domain:history.span},
   linked_views:{history:{common_domain:history.span,vertical_max_count:Math.max(a.p.total,b?.p.total||0),value_scale:'selected required-set cardinality maximum shared by both sides; no future states consulted',temporal_encoding:'model-held step between supplied framed records; no smooth interpolation',event_handle_offsets_px:{pre_action:-4,post_action:4},event_ribs:'native/relative times exact; carry-in is not an event handle'},transverse:{...t.slice,curve_samples:141,domain:[-3.6,3.6],vertical_max_density:7/(2*Math.PI*t.h*t.h),scale_basis:'Fixed retained fixture scope maximum required count 7, defined by original task contracts known at decision; shared by A and B.',source_units:'required identities',output_units:'count per artificial display area',formula:rendererEncoding.fieldFormula,spatial_only:true}},
   selected:[describe(a,'A'),...(b?[describe(b,'B')]:[])],comparison,
   encoding:{preset,version:versions.encoding,kernel_version:versions.kernel,categories:copy(V.categories),calibration:cal,units:'required jobs per artificial display area',meaning:'Declared spatial smoothing only; no probability, physical geometry or temporal oscillation.'},
   rendering:render,rendering_status:supported?'visible':'alignment_unavailable_history_withheld',
   presentation:{camera:copy(t.camera),viewport,viewport_rules:'Camera restored in CSS-pixel pan and common zoom. Canvas adapts to available viewport. Shared fit is explicit; pixel-identical replay across viewport/device/font changes is not claimed.'},
   transforms:{composition_order:['source revision resolution','queue-domain record and prefix selection','per-side native trailing-window selection with source-linked carry-in','declared per-side time translation','union of already bounded display windows','required-work identity partition and native counts','named spatial encoding or stepped history encoding','common camera projection'],frames:[fa.transform,...(fb?[fb.transform]:[])],spatial:{producer:versions.encoding,input_refs:[a.r.id,...(b?[b.r.id]:[])],output_artifact:'selected-body-geometry',parameters:cal,preconditions:'Explicit exhaustive nonnegative category cardinalities, supported category layout, positive spatial width.',missing_value_behavior:'Reject; never infer missing category as zero.',source_units:'required identities / native count',output_units:'count per artificial area; display coordinates',uncertainty_effect:'No uncertainty distribution inferred. Model alternatives remain separate.',reversibility:'lossy',known_information_loss:'Geometry omits identity names, FIFO ordering, action details and all unencoded fields. These remain in the source resolver; byte recovery is separate from geometric inversion.'}},
   preservation:{ledger_nodes:bundle.ledger.length,coverage:copy(bundle.coverage),unused_and_unaligned:'Retained unchanged; prior ledger use labels describe the prior trace viewer. Current named preset does not consume six sensor cases.',lifecycle:'Optional and unimplemented; existing provisional segments remain source-linked and may overlap.'}};
 }
 function renderConfig(effective){return {...effective.rendering,encoding:rendererEncoding};}
 const captureValidation='unvalidated_historical_capture';
 function bodyRecordParts(record){
  const recipe=copy(record);
  // These observations depend on a past canvas, fonts and viewport. They are
  // retained as capture metadata, never trusted as replayed analytical facts.
  const capture={validation:captureValidation,replay:'Informational only; not replay-validated or used to restore the recipe.',viewport:recipe.projection?.viewport??null,actual_bounds:recipe.actual_bounds??null,last_shared_fit:recipe.last_shared_fit??null};
  if(recipe.projection)recipe.projection.viewport=null;
  delete recipe.actual_bounds;delete recipe.last_shared_fit;
  return {recipe,capture};
 }
 function validateBodyRecord(record,effective){
  fail(record&&typeof record==='object'&&!Array.isArray(record),'Invalid body rendering record.');
  fail(record.renderer_version===rendererVersion,'Unsupported rendering-record version.');
  const renderer=typeof module==='object'&&module.exports?require('./renderer.js'):globalThis.BodyRenderer;
  fail(renderer?.version===rendererVersion&&typeof renderer.describe==='function','Body renderer implementation unavailable for receipt validation.');
  const parts=bodyRecordParts(record),expected=renderer.describe(renderConfig(effective),effective.presentation.camera,null);
  fail(stable(parts.recipe)===stable(expected),'Saved body rendering record disagrees with the effective recipe or renderer implementation.');
  return parts;
 }
 function save(effective,{checkpointId,parentId=null,renderingRecord=null}={}){
  const body=renderingRecord?validateBodyRecord(renderingRecord,effective):null;
  return {schema,checkpoint:{id:checkpointId||'manual-checkpoint',parent_id:parentId,trigger:'explicit export',history_policy:'Meaningful checkpoints only; pointer motion is not stored as analytic history.'},effective:copy(effective),rendering_record:body?body.recipe:null,...(body?{rendering_capture:body.capture}:{}),replay_claims:{source_bytes:'Retained by referenced local artifacts; save file does not duplicate sources.',derived_values:'Recomputed and checked against saved effective configuration on restore.',body_rendering:'The complete rendering_record is replay-validated. rendering_capture is unvalidated historical capture metadata, separate from the recipe.',pixels:'Not guaranteed across browsers, device pixel ratios, viewport or fonts.'}};
 }
 function restore(saved){
  fail(saved?.schema===schema,'Unsupported session schema; legacy view/1 requires an explicit migration and is not silently reinterpreted.');
  const e=saved.effective;fail(e?.schema==='canon-effective-view/2','Missing effective configuration.');
  if(Object.hasOwn(e,'instrument'))validateInstrumentVersions(e.instrument);
  for(const[k,v]of Object.entries(versions))fail(e.versions?.[k]===v,'Unsupported '+k+' version: '+String(e.versions?.[k])+'; expected '+v+'.');
  fail(stable(e.source_revisions)===stable(sourceRefs),'Missing source revision: this session references evidence or a trace producer unavailable in this viewer. Current view is retained.');
  const resolution=store.resolveSource(bundle.source.sha256);fail(resolution.status==='resolved','Missing source: '+bundle.source.sha256);
  const recomputed=compile(e.requested,{viewport:e.presentation.viewport});
  fail(stable(recomputed)===stable(e),'Saved effective configuration does not match a replay from the referenced evidence, versions and recipe. No silent substitution.');
  const body=saved.rendering_record?validateBodyRecord(saved.rendering_record,recomputed):null;
  if(Object.hasOwn(saved,'rendering_capture'))fail(saved.rendering_capture&&saved.rendering_capture.validation===captureValidation,'Historical rendering capture must be explicitly labeled unvalidated.');
  // Combined legacy receipts remain readable, but receive the same full
  // semantic validation and an explicit split of their historical observations.
  const capture=saved.rendering_capture?copy(saved.rendering_capture):body?.capture;
  return {state:copy(e.requested),effective:recomputed,checkpoint:copy(saved.checkpoint),...(capture?{renderingCapture:capture}: {})};
 }
 return Object.freeze({compile,select,renderConfig,save,restore,validateState,versions,sourceRefs,store,rendererEncoding});
}
return Object.freeze({version,schema,preset,create,stable});
});
