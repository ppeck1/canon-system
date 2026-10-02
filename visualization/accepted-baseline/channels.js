/* Exact retained-state channels. No smoothing, prediction, simulation, or world averaging. */
(function(root,factory){const domain=typeof module==='object'&&module.exports?require('./domain.js'):root.QueueDomain;const api=factory(domain);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SourceChannels=api;})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';
  if(!D)throw new Error('SourceChannels requires QueueDomain');
  const version='source-channels/1';
  const specs=Object.freeze({
    ready:Object.freeze({key:'ready',label:'Ready jobs',unit:'payload identities',family:'count',formula:'count(identities.pending)',meaning:'All pending FIFO payload identities, including non-required jobs.'}),
    unfinished:Object.freeze({key:'unfinished',label:'Unfinished required jobs',unit:'required payload identities',family:'count',formula:'count(required minus completed)',meaning:'Required identities not completed; includes ready, backup-only and absent identities.'}),
    completed:Object.freeze({key:'completed',label:'Completed jobs',unit:'payload identities',family:'count',formula:'count(identities.completed)',meaning:'All completed payload identities.'}),
    backup:Object.freeze({key:'backup',label:'Required jobs in backup only',unit:'required payload identities',family:'count',formula:'count(required intersect backups minus pending minus completed)',meaning:'Required identities with a backup and no pending or completed copy.'}),
    absent:Object.freeze({key:'absent',label:'Absent required jobs',unit:'required payload identities',family:'count',formula:'count(required minus pending minus completed minus backups)',meaning:'Required identities with no listed pending, completed or backup copy.'}),
    rate:Object.freeze({key:'rate',label:'Configured processing rate',unit:'jobs/tick',family:'rate',formula:'record.values.rate',meaning:'Configured capacity; a pause or empty queue can result in fewer actual completions.'}),
    delivered:Object.freeze({key:'delivered',label:'Jobs completed this service tick',unit:'jobs/tick',family:'rate',formula:'count(identities.completed_this_tick) at service_end',meaning:'Actual jobs completed at the retained service event; unavailable for pre/post-action records.'}),
  });
  const keys=Object.freeze(Object.keys(specs));
  function invariant(ok,message){if(!ok)throw new Error(message);}
  function array(record,name){const value=record&&record.identities&&record.identities[name];return Array.isArray(value)&&value.every(x=>typeof x==='string')&&new Set(value).size===value.length?value.slice():null;}
  function refs(record){return Array.isArray(record&&record.source_refs)?record.source_refs.filter(x=>typeof x==='string').slice():[];}
  function record(source,options={}){
    invariant(source&&typeof source==='object','Retained record required');
    const inputs=Object.fromEntries(['required','pending','completed','backups','completed_this_tick'].map(key=>[key,array(source,key)]));
    const sourceRefs=refs(source),channels={},values={},missing=[];
    const sourceRevision=options.scenario&&options.scenario.source_sha256||null;
    function channel(key,inputNames,derive){
      const missingInputs=inputNames.filter(name=>inputs[name]===null);
      const ids=missingInputs.length?null:derive(inputs);
      channels[key]={...specs[key],status:ids===null?'unavailable':'available',value:ids===null?null:ids.length,
        identities:ids,source_refs:sourceRefs.slice(),source_refs_status:sourceRefs.length?'available':'missing',
        input_refs:inputNames.map(name=>({record_id:source.id||null,path:'/identities/'+name})),
        ...(missingInputs.length?{reason:'Missing or invalid identity arrays: '+missingInputs.join(', '),missing_inputs:missingInputs}:{}),
      };
    }
    channel('ready',['pending'],x=>x.pending);
    channel('completed',['completed'],x=>x.completed);
    channel('unfinished',['required','completed'],x=>x.required.filter(id=>!x.completed.includes(id)));
    channel('backup',['required','pending','completed','backups'],x=>x.required.filter(id=>x.backups.includes(id)&&!x.pending.includes(id)&&!x.completed.includes(id)));
    channel('absent',['required','pending','completed','backups'],x=>x.required.filter(id=>!x.backups.includes(id)&&!x.pending.includes(id)&&!x.completed.includes(id)));
    const rate=source.values&&source.values.rate,rateValid=Number.isInteger(rate)&&rate>=0;
    channels.rate={...specs.rate,status:rateValid?'available':'unavailable',value:rateValid?rate:null,source_refs:sourceRefs.slice(),source_refs_status:sourceRefs.length?'available':'missing',
      input_refs:[{record_id:source.id||null,path:'/values/rate'}],...(rateValid?{}:{reason:'Configured processing rate is missing or invalid.',missing_inputs:['values.rate']})};
    if(source.event_kind==='service_end')channel('delivered',['completed_this_tick'],x=>x.completed_this_tick);
    else channels.delivered={...specs.delivered,status:'not_applicable',value:null,identities:null,source_refs:sourceRefs.slice(),source_refs_status:sourceRefs.length?'available':'missing',
      input_refs:[{record_id:source.id||null,path:'/event_kind'}],reason:'This is not a service-end event.'};
    for(const key of keys){values[key]=channels[key].value;if(channels[key].status==='unavailable')missing.push({channel:key,reason:channels[key].reason});}
    const native=Number.isFinite(source.time_s)?source.time_s:null;
    const display=Object.prototype.hasOwnProperty.call(options,'display_time_s')?(Number.isFinite(options.display_time_s)?options.display_time_s:null):native;
    if(native===null)missing.push({field:'native_time_s',reason:'Native source time is missing.'});
    if(display===null)missing.push({field:'display_time_s',reason:'Display time is unavailable.'});
    if(!sourceRefs.length)missing.push({field:'source_refs',reason:'Source references are not supplied.'});
    return {record_id:source.id||null,recordId:source.id||null,event_index:source.event_index,event_kind:source.event_kind,
      native_time_s:native,time_s:native,display_time_s:display,known_at_s:Number.isFinite(source.known_at_s)?source.known_at_s:null,
      values,channels,missing,complete:missing.length===0,source_kind:source.source_kind||'unknown',source_refs:sourceRefs,
      source_refs_status:sourceRefs.length?'available':'missing',source_revision:sourceRevision,
      carry_in:options.carry_in===true,row_kind:options.carry_in===true?'carry_in':'event',isObservedEvent:options.carry_in!==true,
      ref:{kind:'simulated_record',id:source.id||null,source_revision:sourceRevision,scenario_id:options.scenario&&options.scenario.id||null,world_id:options.world&&options.world.id||null},
      derivation:{version,kind:'exact_source_state_counts',input_record_id:source.id||null,world_aggregation:'none',smoothing:'none',missing_value_behavior:'null with explicit reason; never substitute zero'},
    };
  }
  function selected(selection){
    invariant(selection&&selection.s&&selection.w&&selection.r,'Scenario, world and selected record required');
    const records=D.prefix(selection.w,selection.r.event_index);
    invariant(records.at(-1)&&records.at(-1).id===selection.r.id,'Selected record does not match the ordered source prefix');
    return records;
  }
  function output(selection,rows,clock,anchor,extra={}){
    return {status:'available',version,rows,channels:keys.map(key=>specs[key]),keys:keys.slice(),clock,anchor,
      selected_record_id:selection.r.id,selected_event_index:selection.r.event_index,nativeNow:selection.r.time_s,
      now:rows.length?rows.at(-1).display_time_s:null,source_refs:[...new Set(rows.flatMap(row=>row.source_refs))],
      source_revision:selection.s.source_sha256||null,world_id:selection.w.id,scenario_id:selection.s.id,
      complete:rows.every(row=>row.complete),missing:rows.flatMap(row=>row.missing.map(item=>({record_id:row.record_id,...item}))),
      value_semantics:'Exact retained source-state counts and declared configured rate; no Gaussian rendering values.',...extra};
  }
  function prefix(selection,options={}){
    const records=selected(selection),clock=options.clock||'native';
    invariant(clock==='native'||clock==='aligned','Unsupported channel clock');
    const anchorName=clock==='native'?'native':options.anchorName||(selection.anchor&&selection.anchor.name)||'native';
    const anchor=D.anchorFor(selection.s,selection.w,selection.r.event_index,anchorName);
    if(!anchor.available)return {status:'unavailable',version,rows:[],channels:keys.map(key=>specs[key]),keys:keys.slice(),clock,anchor,reason:anchor.reason,source_refs:[]};
    const shift=clock==='aligned'?anchor.anchor_s:0;
    return output(selection,records.map(item=>record(item,{scenario:selection.s,world:selection.w,display_time_s:item.time_s-shift})),clock,anchor,{shift_s:shift});
  }
  function fromFrame(selection,frame){
    invariant(frame&&Array.isArray(frame.rows),'Observation frame required');
    const records=selected(selection),byId=new Map(records.map(item=>[item.id,item]));
    if(frame.status!=='available')return {status:'unavailable',version,rows:[],channels:keys.map(key=>specs[key]),keys:keys.slice(),clock:frame.clock,anchor:frame.anchor,reason:frame.reason||'Observation frame unavailable.',source_refs:[]};
    const rows=frame.rows.map(row=>{
      const source=byId.get(row.record_id||row.recordId);
      invariant(source&&source.event_index===row.event_index&&source.time_s===row.native_time_s,'Frame row is outside the selected source prefix or changes native identity/time');
      const result=record(source,{scenario:selection.s,world:selection.w,display_time_s:row.display_time_s,carry_in:row.carry_in});
      return {...result,boundary_meaning:row.boundary_meaning||null,carry_source_time_s:row.carry_in?source.time_s:null};
    });
    return output(selection,rows,frame.clock,frame.anchor,{nativeWindow:frame.nativeWindow&&frame.nativeWindow.slice(),displayWindow:frame.displayWindow&&frame.displayWindow.slice(),
      eventRows:rows.filter(row=>!row.carry_in),carryIn:rows.find(row=>row.carry_in)||null,frame_ref:frame.ref||null});
  }
  return Object.freeze({version,keys,specs,record,prefix,fromFrame});
});
