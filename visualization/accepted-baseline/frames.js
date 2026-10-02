/* Observation selection/registration, independent of rendering and evidence custody. */
(function(root,factory){const domain=typeof module==='object'&&module.exports?require('./domain.js'):root.QueueDomain;const api=factory(domain);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ObservationFrames=api;})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';
  if(!D)throw new Error('ObservationFrames requires QueueDomain');
  const version='observation-frames/1';
  function invariant(ok,message){if(!ok)throw new Error(message);}
  function side(selection,{clock='native',span=4,timeOffset=0}={}) {
    invariant(selection&&selection.s&&selection.w&&selection.r,'Frame requires a scenario, world and selected record');
    invariant(clock==='native'||clock==='aligned','Unsupported clock: '+clock);
    invariant(span==='all'||(Number.isFinite(span)&&span>0),'Frame span must be positive native seconds or all');
    invariant(Number.isFinite(timeOffset)&&timeOffset<=0,'Frame timeOffset must be finite and nonpositive');
    const {s,w}=selection,selected=D.prefix(w,selection.r.event_index),r=selected.at(-1);
    invariant(r&&r.id===selection.r.id,'Selected record is not the current event in its declared world');
    const requestedAnchor=selection.anchor&&selection.anchor.name||'native';
    const anchor=clock==='native'?D.anchorFor(s,w,r.event_index,'native'):D.anchorFor(s,w,r.event_index,requestedAnchor);
    const nativeEnd=r.time_s+timeOffset;
    const nativeStart=span==='all'?Math.min(selected[0].time_s,nativeEnd):nativeEnd-span;
    const nativeWindow=[nativeStart,nativeEnd];
    const sourceRevision=s.source_sha256||null;
    const baseRef={source_revision:sourceRevision,scenario_id:s.id,world_id:w.id,record_id:r.id,event_index:r.event_index};
    const frameId=version+':'+r.id+':'+clock+':'+requestedAnchor+':'+span+(timeOffset!==0?':pan='+timeOffset:'');
    const outputRef={kind:'observation_frame',id:frameId,...baseRef};
    const transform={id:clock==='native'?'native-trailing-events/1':'event-relative-trailing-events/1',implementation_version:version,
      input_refs:[{kind:'simulated_record_prefix',...baseRef}],output_ref:outputRef,
      parameters:{clock,trailing_span_s:span,selected_event_index:r.event_index,selected_native_time_s:r.time_s,known_at_cutoff_s:r.time_s,anchor,...(timeOffset!==0?{pan_s:timeOffset}:{})},
      composition:['selected ordered event / as-of prefix','per-side native trailing interval','separate in-window events and last prior carry-in','native or event-anchor translation','common domain union only after both sides are cut'],
      preconditions:['ordered discrete records with native seconds and knowledge times','selected record known at selected native time','source-supported anchor known in selected prefix for aligned frame'],
      missing_value_behavior:'missing records reject; unavailable anchor returns unavailable frame without native substitution; missing history is not zero',
      output_units:{native_time_s:'seconds',aligned_time_s:'seconds',display_time_s:'seconds',weights:'required payload identities'},
      uncertainty_effect:'none; no world aggregation and no probability inference',
      reversibility:{time_translation:'exact inverse native_s = aligned_s + anchor_s',selection:'lossy view selection, excluded source records remain retained and resolvable',carry_in:'display clipping is not a timestamp rewrite'},
      known_limitations:['As-of policy is an analytical view, not a security boundary when future records are bundled','Queue model stipulates held state between events; no continuous measurement is fabricated','No lifecycle or frequency inference']};
    if(!anchor.available) return {status:'unavailable',reason:anchor.reason,clock,rows:[],eventRows:[],carryIn:null,nativeWindow,displayWindow:null,now:null,nativeNow:r.time_s,anchor,transform,ref:outputRef};
    const shift=clock==='aligned'?anchor.anchor_s:0,displayWindow=[nativeStart-shift,nativeEnd-shift];
    function row(record,kind) {
      const p=D.partition(record),isCarry=kind==='carry_in';
      return {time_s:record.time_s,native_time_s:record.time_s,aligned_time_s:record.time_s-shift,
        display_time_s:isCarry?displayWindow[0]:record.time_s-shift,event_index:record.event_index,event_kind:record.event_kind,
        known_at_s:record.known_at_s,recordId:record.id,record_id:record.id,weights:p.weights,identities:p.identities,
        row_kind:kind,isObservedEvent:!isCarry,carry_in:isCarry,
        source_kind:record.source_kind,source_refs:(record.source_refs||[]).slice(),
        ref:{kind:'simulated_record',id:record.id,source_revision:sourceRevision,scenario_id:s.id,world_id:w.id},
        output_ref:{kind:isCarry?'held_state_boundary':'framed_event',id:frameId+'#'+kind+'/'+record.id},
        boundary_meaning:isCarry?'State held from this prior event at the window boundary; this is not an in-window event or new observation.':'Retained simulated event at its original native time.',
        disposition_ref:{kind:'derived_partition',id:record.id+'#'+D.mappingVersion},
        carry_source_time_s:isCarry?record.time_s:null};
    }
    const eventRows=selected.filter(record=>record.time_s>=nativeStart&&record.time_s<=nativeEnd).map(record=>row(record,'event'));
    const prior=selected.filter(record=>record.time_s<nativeStart).at(-1);
    // A boundary event supplies state itself; carry-in is needed only before the first in-window event.
    const carryIn=prior&&(!eventRows.length||eventRows[0].time_s>nativeStart)?row(prior,'carry_in'):null;
    const rows=carryIn?[carryIn,...eventRows]:eventRows;
    transform.output_refs=rows.map(x=>x.output_ref);
    transform.effective_windows={native:nativeWindow,display:displayWindow};
    transform.carried_record_ref=carryIn?carryIn.ref:null;
    return {status:'available',clock,rows,eventRows,carryIn,nativeWindow,displayWindow,native_window:nativeWindow,display_window:displayWindow,
      now:r.time_s-shift,nativeNow:r.time_s,anchor,shift_s:shift,ref:outputRef,transform,
      coverage:{eligible_prefix_record_ids:selected.map(x=>x.id),in_window_event_ids:eventRows.map(x=>x.recordId),carry_in_record_id:carryIn?carryIn.recordId:null,
        first_prefix_native_time_s:selected[0].time_s,earlier_history_available:!!prior,pre_source_window_region:nativeStart<selected[0].time_s?[nativeStart,selected[0].time_s]:null},
      origin:{record_origin:r.source_kind,source_revision:sourceRevision},world:{scenario_id:s.id,world_id:w.id},
      alignment:{status:clock==='native'?'native':'aligned',anchor},claim:{conditional_on_stipulated_model:true,uncertainty:w.uncertainty||null}};
  }
  function combine(aFrame,bFrame=null) {
    invariant(aFrame,'A frame required');
    const frames={a:aFrame,b:bFrame},all=[aFrame,...(bFrame?[bFrame]:[])];
    const unavailable=all.find(x=>x.status!=='available');
    if(unavailable)return {status:'unavailable',reason:unavailable.reason||'Frame unavailable',a:[],b:[],span:null,windows:{a:aFrame.nativeWindow,b:bFrame&&bFrame.nativeWindow},frames,nowA:null,nowB:null,axis:aFrame.clock};
    invariant(all.every(x=>x.clock===aFrame.clock),'Comparison frame clocks are incompatible');
    const windows={a:{native:aFrame.nativeWindow.slice(),display:aFrame.displayWindow.slice()},b:bFrame?{native:bFrame.nativeWindow.slice(),display:bFrame.displayWindow.slice()}:null};
    const union=[Math.min(...all.map(x=>x.displayWindow[0])),Math.max(...all.map(x=>x.displayWindow[1]))];
    return {status:'available',a:aFrame.rows,b:bFrame?bFrame.rows:[],span:union,windows,frames,nowA:aFrame.now,nowB:bFrame?bFrame.now:aFrame.now,axis:aFrame.clock,
      transform:{id:'per-side-window-union/1',implementation_version:version,input_refs:all.map(x=>x.ref),output_ref:{kind:'common_display_domain',id:all.map(x=>x.ref.id).join('|')},
        composition:['cut each native trailing window independently','translate each selected clock independently','union resulting display extents without widening either side'],
        parameters:{windows,common_display_domain:union},output_units:{time:'seconds'},preconditions:['available per-side frames with compatible clocks'],missing_value_behavior:'unavailable side blocks comparison',
        uncertainty_effect:'none',reversibility:{status:'source_preserving_noninvertible_domain_union',reason:'Union alone does not identify individual windows; both windows remain in this output'},known_limitations:['Common extent does not authorize filling either side outside its own selected window']}};
  }
  return Object.freeze({version,side,combine});
});
