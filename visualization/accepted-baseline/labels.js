/* Display aliases describe initial source facts only; native identities remain authoritative. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DisplayLabels=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const version='display-labels/1';
  const definitions=Object.freeze({
    T4M6:{label:'One required job is stored only in backup',expected:[3,2,0,1,0,[1],3]},
    D8V1:{label:'Three jobs queued; service stopped',expected:[3,3,0,0,0,[0],3]},
    B2R8:{label:'Seven jobs; a two-second deadline',expected:[7,7,0,0,0,[2],2],seconds:true},
    P5J9:{label:'Service rate not yet established',expected:[3,3,0,0,0,[0,2],2],unknownRate:true},
    H9C3:{label:'One required job has no listed copy',expected:[4,3,0,0,1,[1],4]},
    N7K4:{label:'Five jobs queued; a three-second deadline',expected:[5,5,0,0,0,[2],3],seconds:true},
  });
  function result(label,details){return {label,label_version:version,...details};}
  function identityArray(value){return Array.isArray(value)&&value.every(x=>typeof x==='string')&&new Set(value).size===value.length?value:null;}
  function caseLabel(bundle,caseId){
    const cases=bundle&&Array.isArray(bundle.cases)?bundle.cases:[];
    const index=cases.findIndex(item=>item.case_id===caseId),item=cases[index],definition=definitions[caseId];
    const base={case_id:caseId,scope:'initial_source_configuration',source_refs:[],source_revision:bundle&&bundle.source&&bundle.source.sha256||null};
    const unknown=reason=>result(typeof caseId==='string'?caseId:'Unknown case',{...base,status:'unknown',reason});
    if(!item||item.system!=='finite_fifo_queue'||!definition)return unknown('No verified display alias for this source case.');
    const f=item.facts||{},required=identityArray(item.task&&item.task.required_payload_ids),pending=identityArray(f.pending_fifo_payload_ids),completed=identityArray(f.completed_payload_ids),backups=identityArray(f.backup_payload_ids);
    if(!required||!pending||!completed||!backups)return unknown('Initial source identity lists are unavailable or invalid.');
    const backupOnly=required.filter(id=>backups.includes(id)&&!pending.includes(id)&&!completed.includes(id));
    const absent=required.filter(id=>!backups.includes(id)&&!pending.includes(id)&&!completed.includes(id));
    const facts=[required.length,pending.length,completed.length,backupOnly.length,absent.length,f.service_rate_possibilities_jobs_per_tick,item.task.original_deadline_tick];
    if(JSON.stringify(facts)!==JSON.stringify(definition.expected))return unknown('Source facts differ from the versioned alias; use the native case ID.');
    if(definition.seconds&&(f.tick_duration_seconds!==1||f.current_tick!==0))return unknown('Source clock differs from the versioned deadline alias; use the native case ID.');
    if(definition.unknownRate&&f.unknown_fact!=='actual service rate')return unknown('Source uncertainty differs from the versioned alias; use the native case ID.');
    return result(definition.label,{...base,status:'verified',source_refs:[
      '/cases/'+index+'/case_id','/cases/'+index+'/task/required_payload_ids','/cases/'+index+'/task/original_deadline_tick',
      ...['pending_fifo_payload_ids','completed_payload_ids','backup_payload_ids','service_rate_possibilities_jobs_per_tick'].map(key=>'/cases/'+index+'/facts/'+key),
      ...(definition.seconds?['/cases/'+index+'/facts/tick_duration_seconds','/cases/'+index+'/facts/current_tick']:[]),
      ...(definition.unknownRate?['/cases/'+index+'/facts/unknown_fact']:[]),
    ],initial_counts:{required:required.length,ready:pending.length,completed:completed.length,backup:backupOnly.length,absent:absent.length},
    meaning:'Alias for the declared initial configuration, before any selected action. It does not assert an outcome or diagnosis.'});
  }
  function actionLabel(scenario){
    const action=scenario&&scenario.action||{},p=action.parameters||{},id=scenario&&scenario.action_id||action.id||null;
    let label=null;
    if(action.operation==='continue_service')label='Continue processing';
    if(action.operation==='reverse_pending_fifo')label='Reverse the waiting order';
    if(action.operation==='replay_available_backups')label='Add available backup jobs to the queue';
    if(action.operation==='set_service_rate'&&Number.isInteger(p.jobs_per_tick)&&p.jobs_per_tick>=0)label='Set processing rate to '+p.jobs_per_tick+' jobs/tick';
    if(label&&Number.isInteger(p.pause_ticks)&&p.pause_ticks>0)label='Pause '+p.pause_ticks+' tick'+(p.pause_ticks===1?'':'s')+', then '+label[0].toLowerCase()+label.slice(1);
    return result(label||('Action '+(id||'unknown')),{status:label?'verified':'unknown',action_id:id,operation:action.operation||null,
      scope:'declared_action',source_refs:(scenario&&scenario.source_refs||[]).filter(ref=>/\/actions\//.test(ref)),
      source_revision:scenario&&scenario.source_sha256||null,cost_credits:Number.isFinite(action.cost_credits)?action.cost_credits:null,
      ...(label?{}:{reason:'No ordinary label is registered for this declared operation.'})});
  }
  function worldLabel(world){
    const rate=world&&world.rate,uncertainty=world&&world.uncertainty||{},known=Number.isInteger(rate)&&rate>=0;
    const possible=uncertainty.actual_rate_unknown===true;
    return result(known?(possible?'Possible initial rate: ':'Initial rate: ')+rate+' job'+(rate===1?'':'s')+'/tick':(world&&world.id||'Unknown world'),
      {status:known?'verified':'unknown',world_id:world&&world.id||null,scope:'declared_initial_world_rate',rate:known?rate:null,
        source_refs:Array.isArray(uncertainty.source_refs)?uncertainty.source_refs.slice():[],
        meaning:'Initial model rate; the selected action can change the configured rate. Alternative worlds are not probabilities.',
        ...(known?{}:{reason:'Declared initial world rate is unavailable.'})});
  }
  function eventLabel(record){
    const kind=typeof record==='string'?record:record&&record.event_kind;
    const labels={pre_action:'Before action',post_action:'After action',service_end:'End of service tick'};
    return result(labels[kind]||kind||'Unknown event',{status:labels[kind]?'verified':'unknown',event_kind:kind||null,
      scope:'retained_event_kind',source_refs:record&&Array.isArray(record.source_refs)?record.source_refs.slice():[],
      ...(labels[kind]?{}:{reason:'No ordinary label is registered for this event kind.'})});
  }
  return Object.freeze({version,caseIds:Object.freeze(Object.keys(definitions)),caseLabel,actionLabel,worldLabel,eventLabel});
});
