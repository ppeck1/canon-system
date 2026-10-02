/* Source-backed queue structure and transformation lineage; no new inference/model. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./domain.js'):root.QueueDomain,node?require('./channels.js'):root.SourceChannels,()=>node?require('./timescale.js'):root.CanonTimescale,()=>node?require('./timescale-landscape.js'):root.TimescaleLandscape);if(node)module.exports=api;if(root)root.SystemStructure=api;})(typeof globalThis!=='undefined'?globalThis:this,(D,C,getTimescale,getLandscape)=>{
'use strict';
const version='system-lineage/1';
const copy=x=>JSON.parse(JSON.stringify(x));
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
const invariant=(ok,message)=>{if(!ok)throw Error(message);};
function context(selection,store,side='A'){
 invariant(selection?.s&&selection?.w&&selection?.r,'Selected scenario/world/record required.');
 invariant(store?.resolveSource&&store?.resolvePointer,'Evidence resolver required.');
 const {s,w}=selection,prefix=D.prefix(w,selection.r.event_index),r=prefix.at(-1);
 invariant(r.id===selection.r.id,'Selection is outside its own ordered prefix.');
 const resolved=store.resolveSource(s.source_sha256);
 invariant(resolved.status==='resolved','Source revision is unavailable; no substitute graph.');
 const packet=resolved.value.packet,caseIndex=packet.cases.findIndex(item=>item.case_id===s.case_id);
 invariant(caseIndex>=0,'Case has no retained source locator.');
 const sourceCase=packet.cases[caseIndex],base='/cases/'+caseIndex;
 invariant(sourceCase.system==='finite_fifo_queue','This structural adapter supports the stated finite FIFO queue only.');
 const actionIndex=sourceCase.actions.findIndex(item=>item.id===s.action_id);
 invariant(actionIndex>=0,'Selected action has no retained source locator.');
 return {s,w,r,prefix,sourceCase,base,actionIndex,store,side:side.toUpperCase(),source_revision:s.source_sha256,
  selection:{side:side.toUpperCase(),case_id:s.case_id,scenario_id:s.id,world_id:w.id,record_id:r.id,event_index:r.event_index,native_time_s:r.time_s,source_revision:s.source_sha256}};
}
function sourceRef(z,pointer){return {source_revision:z.source_revision,pointer};}
function recordRef(z,path){return {source_revision:z.source_revision,scenario_id:z.s.id,world_id:z.w.id,record_id:z.r.id,path};}
function graph(selection,{store,side='A'}={}){
 const z=context(selection,store,side),r=z.r,partition=D.partition(r),prefixId=z.s.case_id+'::';
 const ids=[...new Set([...r.identities.required,...r.identities.pending,...r.identities.backups,...r.identities.completed])];
 invariant(ids.length<=16,'Structural view supports at most 16 identities; it never silently crops a larger graph.');
 const nodes=[],edges=[],constraints=[];
 const sourceRefs=r.source_refs.map(pointer=>sourceRef(z,pointer));
 const common={selection:z.selection,source_revision:z.source_revision};
 const addNode=node=>{const result={...common,...node};nodes.push(result);return result;};
 const hubs=[['task','Required task','declared_task',[z.base+'/task']],['queue','Active FIFO queue','recorded_simulated_container',[]],['backup','Listed backup copies','recorded_simulated_container',[]],['completed','Completed ledger','recorded_simulated_container',[]],['unlisted','No listed copy','derived_record_condition',[]]];
 for(const[id,label,status,pointers]of hubs)addNode({id:prefixId+id,kind:'container',role:id,label,status,source_refs:pointers.map(p=>sourceRef(z,p)),record_refs:id==='task'?[]:id==='unlisted'?['required','pending','backups','completed'].map(key=>recordRef(z,'/identities/'+key)):[recordRef(z,'/identities/'+({queue:'pending',backup:'backups',completed:'completed'}[id]))]});
 const membership=(type,label,identity,target,status,path,extra={})=>edges.push({...common,id:z.r.id+'::'+type+'::'+identity,kind:type,label,from:prefixId+'identity:'+identity,to:prefixId+target,status,record_refs:path?[recordRef(z,path)]:[],source_refs:type==='required'?[sourceRef(z,z.base+'/task/required_payload_ids')]:sourceRefs,source_reference_role:type==='required'?'assertion_locator':'upstream_simulation_inputs',...extra});
 for(const identity of ids){
  const indexes=Object.fromEntries(['required','pending','backups','completed'].map(key=>[key,r.identities[key].indexOf(identity)]));
  const disposition=Object.keys(partition.identities).find(key=>partition.identities[key].includes(identity))||'not_required';
  const detail={identity,case_id:z.s.case_id,identity_scope:'case',required:indexes.required>=0,ready:indexes.pending>=0,pending_fifo_rank:indexes.pending>=0?indexes.pending+1:null,backup_copy:indexes.backups>=0,completed:indexes.completed>=0,absent_from_all_listed_copies:indexes.pending<0&&indexes.backups<0&&indexes.completed<0,required_disposition:disposition};
  addNode({id:prefixId+'identity:'+identity,kind:'identity',label:identity,status:'recorded_simulated_identity',identity,case_id:z.s.case_id,identity_scope:'case',detail,
   source_refs:sourceRefs,source_reference_role:'upstream_simulation_inputs',record_refs:Object.entries(indexes).filter(([,i])=>i>=0).map(([key,i])=>recordRef(z,'/identities/'+key+'/'+i))});
  if(indexes.required>=0)membership('required','required by task',identity,'task','declared_task_requirement','/identities/required/'+indexes.required);
  if(indexes.pending>=0)membership('ready_fifo','FIFO rank '+(indexes.pending+1),identity,'queue','recorded_simulated_relation','/identities/pending/'+indexes.pending,{fifo_rank:indexes.pending+1});
  if(indexes.backups>=0)membership('backup_copy','listed backup copy',identity,'backup','recorded_simulated_relation','/identities/backups/'+indexes.backups);
  if(indexes.completed>=0)membership('completed','completed',identity,'completed','recorded_simulated_relation','/identities/completed/'+indexes.completed);
  if(detail.required&&detail.absent_from_all_listed_copies)membership('no_listed_copy','no listed copy',identity,'unlisted','derived_record_relation',null,{derivation:'required identity absent from retained pending, backups and completed arrays; not a claim about unlisted real-world copies',record_refs:['required','pending','backups','completed'].map(key=>recordRef(z,'/identities/'+key))});
 }
 function rule(key,label,pointer,target,status='declared_model_rule'){
  const resolved=store.resolvePointer(pointer,z.source_revision);
  if(resolved.status!=='resolved')return;
  const node=addNode({id:prefixId+'rule:'+key,kind:'rule',rule_id:key,label,status,value:copy(resolved.value),source_refs:[sourceRef(z,pointer)],record_refs:[],applicability:'Declared fixture/task/action context; no rule is newly inferred.'});
  constraints.push(node);
  edges.push({...common,id:z.r.id+'::rule:'+key,kind:'constrains',label:'declared rule',from:node.id,to:prefixId+target,status,source_refs:node.source_refs,record_refs:[]});
 }
 rule('deadline','Original deadline',z.base+'/task/original_deadline_tick','task','declared_task_constraint');
 rule('service_timing','Service timing',z.base+'/facts/service_timing','queue');
 rule('unit_work','Work per payload',z.base+'/facts/job_service_requirement','queue');
 rule('backup_rule','Backup replay rule',z.base+'/facts/backup_rule','backup');
 rule('arrivals','Later external arrivals',z.base+'/facts/future_external_arrivals','queue');
 rule('selected_action','Selected action',z.base+'/actions/'+z.actionIndex,'queue',r.event_kind==='pre_action'?'declared_action_not_yet_applied':'declared_selected_action');
 const suppliedClaims=[];
 if(z.sourceCase.proposed_transfer?.claim!==undefined)suppliedClaims.push({id:prefixId+'supplied-transfer',label:'Source-supplied transfer claim',status:'supplied_unverified_claim',value:z.sourceCase.proposed_transfer.claim,source_refs:[sourceRef(z,z.base+'/proposed_transfer/claim')],used_for_graph_state:false});
 return {version,kind:'queue_system_structure',status:'available',selection:z.selection,nodes,edges,constraints,supplied_claims:suppliedClaims,
  source_refs:sourceRefs,record_refs:[recordRef(z,'')],required_partition:partition,
  native_values:{configured_rate:r.values.rate,rate_unit:'jobs/tick',service_offered:r.values.service_offered,original_deadline_s:z.s.deadline_s,event_kind:r.event_kind},
  inference:{new_hypotheses:0,status:'none_inferred',supplied_claims_are_not_findings:true},
  identity_policy:'Identity key is case_id plus native payload ID. The same identity may be inspected in different explicit worlds; no states or histories are merged.',
  omissions:['All nonselected source fields remain in the unchanged evidence resolver.','Graph layout distances are presentation only.','No future outcomes or records determine this selected graph.'],
  semantics:{recorded_simulated_relation:'Membership/rank recorded at the chosen simulated event.',declared_model_rule:'Text or parameters asserted by the retained fixture; not discovered laws.',derived_record_relation:'Explicit set relation calculated from the selected record, not an inferred hypothesis.',supplied_unverified_claim:'Retained source assertion, not endorsed by this graph.'}};
}
function lineage(selection,{store,effective=null,side='A',channelKey='ready',coefficient=null}={}){
 if(coefficient)return calibrationLineage(coefficient);
 const z=context(selection,store,side),r=z.r,frame=effective?.observation?.[z.side]||null;
 invariant(C&&C.specs?.[channelKey],'Unsupported native channel for lineage: '+channelKey);
 const channel=C.record(r,{scenario:z.s,world:z.w}).channels[channelKey],metadata=D.describe(selection,store.bundle),nodes=[],edges=[];
 const add=(id,label,kind,detail,source_refs=[],record_refs=[])=>{nodes.push({id,label,kind,detail,source_refs,record_refs,selection:z.selection});return id;};
 const edge=(from,to,label,status='declared_derivation')=>edges.push({id:from+'→'+to,from,to,label,status});
 const source=add('source','Retained source revision','source',{sha256:z.source_revision,custody:'Assertions retained from authored synthetic fixtures, not empirical truth.'},[sourceRef(z,z.base)]);
 const producer=add('producer','Frozen queue simulator','producer',metadata.origin.producer,[sourceRef(z,z.base+'/facts'),sourceRef(z,z.base+'/actions/'+z.actionIndex)]);
 const record=add('record','Selected simulated event','record',{record_id:r.id,event_index:r.event_index,native_time_s:r.time_s,known_at_s:r.known_at_s,world_id:z.w.id,origin:r.source_kind},[],[recordRef(z,'')]);
 const native=add('channel','Native channel: '+channel.label,'derivation',{implementation_version:C.version,...copy(channel)},channel.source_refs.map(pointer=>sourceRef(z,pointer)),channel.input_refs.map(ref=>recordRef(z,ref.path)));
 const framedIds=frame?.eventRows?.map(row=>row.recordId)||[];
 const carryIds=frame?.carryIn?[frame.carryIn.recordId]:[];
 const inclusion=!frame?'frame_not_supplied':frame.status!=='available'?'frame_unavailable':framedIds.includes(r.id)?'selected_event_in_window':carryIds.includes(r.id)?'selected_record_is_carry_in':'selected_event_outside_window';
 const frameNode=add('frame','Observation frame','frame',{status:frame?.status||'not_supplied',selected_record_status:frame?inclusion:'frame_not_supplied',transform:frame?.transform||null,windows:frame?{native:frame.nativeWindow,display:frame.displayWindow}:null});
 const direct=add('direct','Direct native instrument','rendering',{method:'DirectInstruments',version:'direct-instruments/1',parameters:effective?.instrument||null,semantics:'Count/rate channels directly from retained records, not Gaussian heights.',selected_record_status:inclusion,omissions:['All source fields outside chosen channels','Times outside the selected per-side window']});
 const partition=D.partition(r),part=add('partition','Required-work disposition','derivation',{implementation_version:D.version,mapping_version:D.mappingVersion,weights:partition.weights,identities:partition.identities,transform:metadata.transform},partition.source_refs.map(pointer=>sourceRef(z,pointer)),[recordRef(z,'/identities')]);
 const encoding=add('encoding','Named Gaussian encoding','encoding',{...copy(effective?.encoding||{}),transform:effective?.transforms?.spatial||null,semantics:'Spatial kernel over exact required-work weights; no probability model.',omissions:['Identity strings and FIFO order in surface geometry','Magnitude of rate and deadline, which stay separate native values']});
 const rendering=add('render','Body / history renderer','rendering',{version:effective?.versions?.renderer||'not_supplied',camera:effective?.presentation?.camera||null,calibration:effective?.rendering?.calibration||null,perspective:effective?.rendering?.perspective||null,semantics:'Camera/material projection only; no new data states.'});
 edge(source,producer,'source assertions');edge(producer,record,'retained simulation output');edge(record,native,'native channel formula');edge(native,frameNode,'selected native view',inclusion==='selected_event_outside_window'?'selected_record_excluded':'declared_derivation');edge(frameNode,direct,'per-side framed records');
 edge(record,part,'required-identity partition');edge(part,encoding,'exact category weights');edge(encoding,rendering,'spatial field');edge(frameNode,rendering,'time registration / history window');
 return {version,kind:'queue_lineage',status:'available',selection:z.selection,channel_key:channelKey,nodes,edges,source_revision:z.source_revision,
  distinction:'Native ready counts all pending identities; the body ready contribution counts required, uncompleted pending identities. These are separate derivations, even when their counts coincide.',
  inference:{new_hypotheses:0,status:'none_inferred'},composition:'Resolve source → named simulation producer → retained event; branch into native channel/frame and required-work spatial encoding.',
  omitted_information_remains_source_resolvable:true};
}
function calibrationLineage(coefficient){
 const {result:r,support:s,kernelInspection:k=null,recipe=null,rendering=null}=coefficient;
 invariant(r&&s,'Calibration lineage requires the existing selected result and coefficient support.');
 invariant(s.source_revision===r.source.revision&&s.source_id===r.source.id,'Calibration support must match its result source.');
 const T=getTimescale();invariant(T?.coefficientSupport,'Supported coefficient inspector is unavailable.');
 const expected=T.coefficientSupport(r,s.scale_index,s.sample_index);
 invariant(stable(s)===stable(expected),'Calibration support differs from the selected result, observation interval or coefficient.');
 if(recipe){
  invariant(recipe.signal===r.source.id&&recipe.mode===r.mode,'Calibration recipe differs from the selected source/mode.');
  if(r.mode==='prefix')invariant(recipe.endSample===r.as_of_index,'Calibration recipe endpoint differs from the permitted result prefix.');
  if(recipe.row!==undefined)invariant(recipe.row===s.scale_index,'Calibration recipe row differs from the selected coefficient.');
  if(recipe.sample!==undefined)invariant(recipe.sample===s.sample_index,'Calibration recipe sample differs from the selected coefficient.');
 }
 if(k){invariant(T.inspectKernel,'Supported kernel inspector is unavailable.');invariant(stable(k)===stable(T.inspectKernel(r,s.scale_index,s.sample_index)),'Kernel inspection differs from the selected result/support.');}
 let renderingDetail={status:'unavailable',reason:'No rendering record was supplied; camera or mesh projection is not inferred.'};
 if(rendering){
  const L=getLandscape();invariant(L?.renderingRecord,'Supported landscape rendering-record producer is unavailable.');
  if(recipe?.landscapeVersion!==undefined)invariant(recipe.landscapeVersion===L.version,'Calibration recipe has an unsupported landscape version.');
  const camera=recipe?(recipe.landscapeCamera||L.defaultCamera):rendering.camera;
  const viewport=rendering.viewport??null;
  if(viewport!==null)invariant(['width','height','pixel_ratio'].every(key=>Number.isFinite(viewport[key])&&viewport[key]>0),'Rendering viewport is invalid.');
  const expectedRendering=L.renderingRecord(r,{camera,row:s.scale_index,sample:s.sample_index,viewport});
  invariant(stable(rendering)===stable(expectedRendering),'Rendering record differs from the selected result, coefficient or camera recipe.');
  renderingDetail={status:'available',record:copy(rendering),validation:'Pure renderingRecord(result, selected coefficient, recipe camera, supplied viewport); the transform is not rerun.'};
 }
 const nodes=[
  {id:'cal-source',label:'Synthetic sampled source',kind:'source',detail:copy({source:r.source,sampling:r.sampling,interval:r.interval,recipe})},
  {id:'cal-support',label:'Actual coefficient support',kind:'selection',detail:copy({observed_sample_range:s.observed_sample_range,observed_time_range_s:s.observed_time_range_s,observed_sample_count:s.observed_sample_count,padding_samples:s.padding_samples,requested_sample_range:s.requested_sample_range,mode:s.mode,as_of_index:s.as_of_index})},
  {id:'cal-kernel',label:'Conjugated wavelet kernel',kind:'transform',detail:copy({implementation:r.implementation_version,contract:r.contract_version,wavelet:r.wavelet,normalization:r.normalization,scale:s.scale,frequency_hz:s.frequency_hz,inspected_kernel:k,limitations:r.limitations})},
  {id:'cal-coefficient',label:'Selected complex coefficient',kind:'derivation',detail:copy(s)},
  {id:'cal-view',label:'Magnitude map / landscape',kind:'encoding',detail:copy({display:r.display,units:r.units,loss:'Magnitude omits complex phase; displayed scales omit other frequencies. Display geometry does not change the coefficient.',edge_policy:r.support_policy})},
  {id:'cal-render',label:'Camera / mesh projection',kind:'rendering',detail:renderingDetail}
 ];
 const edges=nodes.slice(1).map((node,i)=>({id:nodes[i].id+'→'+node.id,from:nodes[i].id,to:node.id,label:['permitted sampled input','source-supported weighted support','existing transform coefficient','magnitude / display mapping','camera / mesh projection'][i],status:node.id==='cal-render'?(rendering?'declared_presentation':'rendering_unavailable'):'declared_derivation'}));
 return {version,kind:'calibration_lineage',status:'available',nodes,edges,selection:{source_revision:s.source_revision,source_id:s.source_id,sample_index:s.sample_index,scale_index:s.scale_index},
  separation:'Separate synthetic calibration branch; no queue events, queue worlds or Gaussian state-body geometry are inputs.',inference:{new_hypotheses:0,status:'none_inferred'}};
}
return Object.freeze({version,graph,lineage,calibrationLineage});
});
