/* Pairing and comparability are view claims, never source facts or transfer proofs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ViewComparison=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const version='bounded-view-comparison/1';
const unaligned=Object.freeze(['payload identity names across cases','FIFO order','action semantics and cost','deadline and service rate','backup relationships beyond current disposition','uncertainty across alternative worlds','six sensor cases']);
function make(a,b,history,calibration){
  const selected=z=>({scenario_id:z.s.id,world_id:z.w.id,record_id:z.r.id,event_index:z.r.event_index,native_time_s:z.r.time_s,source_revision:z.s.source_sha256});
  const samePreset=a.s.source_kind===b?.s.source_kind;
  const compatible=!b||samePreset;
  return {version,enabled:!!b,sides:{A:selected(a),B:b?selected(b):null},pairing_rationale:b?'User-selected records inspected under the same required-work disposition definitions; no mechanism or intervention equivalence is asserted.':'One selected record; no pair yet.',
    compatibility:{status:!compatible?'incompatible':history.status==='available'?'supported_selected_dimensions':'time_alignment_unavailable',dimensions:['required-identity disposition meaning','native count unit','shared categorical layout and spatial calibration'],reason:!compatible?'Origin contracts differ.':history.status!=='available'?'One selected event-relative anchor is unavailable in its prefix.':'Only the stated disposition and clock dimensions are comparable.'},
    per_side_windows:history.windows,shared_display_bounds:history.span,shared_calibration:{...calibration},intentionally_unaligned:[...unaligned],identity_equivalence:'None across different cases; equal weights are not whole-state identity.',world_policy:'Separate selected alternatives; no averaging, probabilities or merged trajectory.'};
}
return Object.freeze({version,make,unaligned});
});
