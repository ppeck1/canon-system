/* Queue-specific interpretation. Source custody and display geometry are separate. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.QueueDomain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const version='queue-domain/1',mappingVersion='required-work-disposition/1';
  const categoryKeys=Object.freeze(['ready','backup_only','absent','completed']);
  const categories=categoryKeys.map(key=>({key}));
  function invariant(ok, message) { if (!ok) throw new Error(message); }
  function identityArray(value, name) {
    invariant(Array.isArray(value), 'Missing identity array: '+name);
    invariant(value.every(x=>typeof x==='string'), 'Identity arrays require string IDs: '+name);
    invariant(new Set(value).size===value.length, 'Duplicate identity: '+name);
    return value;
  }
  function partition(record) {
    invariant(record && record.identities, 'Record identities required');
    const source = record.identities;
    const required = identityArray(source.required,'required');
    const pending = new Set(identityArray(source.pending,'pending'));
    const completed = new Set(identityArray(source.completed,'completed'));
    const backups = new Set(identityArray(source.backups,'backups'));
    const identities = {ready:[],backup_only:[],absent:[],completed:[]};
    for (const id of required) {
      const category = completed.has(id) ? 'completed' : pending.has(id) ? 'ready' : backups.has(id) ? 'backup_only' : 'absent';
      identities[category].push(id);
    }
    const weights = Object.fromEntries(categories.map(k=>[k.key,identities[k.key].length]));
    const union = categories.flatMap(k=>identities[k.key]);
    invariant(union.length===required.length && new Set(union).size===required.length && required.every(id=>union.includes(id)), 'Disposition must be a disjoint exhaustive required-identity partition');
    return {weights,identities,total:required.length,record_id:record.id,
      source_refs:Array.isArray(record.source_refs)?record.source_refs.slice():[],
      source_kind:'derived_view',mapping_version:mappingVersion};
  }
  function prefix(world,eventIndex) {
    invariant(world && Array.isArray(world.records), 'World records required');
    invariant(Number.isInteger(eventIndex), 'Integer event index required');
    const now=world.records.find(r=>r.event_index===eventIndex);
    invariant(now, 'Selected event index does not exist in world');
    invariant(Number.isFinite(now.time_s) && Number.isFinite(now.known_at_s), 'Selected event time metadata missing');
    invariant(now.known_at_s<=now.time_s, 'Selected event is not known at its native time');
    return world.records.filter(r=>r.event_index<=eventIndex && r.time_s<=now.time_s && r.known_at_s<=now.time_s)
      .slice().sort((a,b)=>a.event_index-b.event_index);
  }
  function anchorFor(scenario,world,eventIndex,name) {
    const records=prefix(world,eventIndex), now=records.find(r=>r.event_index===eventIndex);
    invariant(now, 'Selected event excluded from its prefix');
    const unavailable=reason=>({name,available:false,anchor_s:null,native_s:null,source_refs:[],basis_record_id:null,reason});
    if (name==='first_completed_payload') {
      const r=records.find(r=>r.event_kind==='service_end' && Array.isArray(r.identities.completed_this_tick) && r.identities.completed_this_tick.length>0);
      return r ? {name,available:true,anchor_s:r.time_s,native_s:r.time_s,known_at_s:r.known_at_s,
        source_refs:r.source_refs.slice(),basis_record_id:r.id,event_index:r.event_index,
        meaning:'First prefix service event with at least one completed payload; not a lifecycle phase.'}
        : unavailable('No completed-payload service event is known in the selected prefix.');
    }
    if (name==='native') return {name,available:true,anchor_s:0,native_s:0,known_at_s:0,
      source_refs:[],basis_record_id:null,meaning:'Unshifted native source seconds.'};
    const lookup = name==='decision' ? 'decision_origin' : name;
    const transform=(scenario.transforms||[]).find(t=>t.id===lookup);
    if (!transform) return unavailable('Requested source-supported transform is not present.');
    if (!Number.isFinite(transform.anchor_s) || !Number.isFinite(transform.known_at_s) || transform.known_at_s>now.time_s) return unavailable('Anchor metadata is not known at selected native time.');
    return {name,available:true,anchor_s:transform.anchor_s,native_s:transform.anchor_s,
      known_at_s:transform.known_at_s,source_refs:(transform.source_refs||[]).slice(),basis_record_id:null,
      meaning:transform.meaning,forward:'aligned_s = native_s - anchor_s',inverse:'native_s = aligned_s + anchor_s'};
  }

  function describe(selection,bundle) {
    const {s,w,r,anchor}=selection;
    invariant(s&&w&&r,'Scenario, world and record required for domain metadata');
    const producerHash=(s.action_state_transform||{}).behavior_sha256 || (bundle&&bundle.metadata&&bundle.metadata.behavior_copy_sha256) || null;
    return {
      origin:{source_assertion_kind:s.source_kind||'unknown',record_origin:r.source_kind||'unknown',empirical_observation:false,
        producer:{id:'queue_world',implementation:(s.action_state_transform||{}).behavior_implementation||'sources/behavior.py::queue_world',version:producerHash?'sha256:'+producerHash:'unknown',implementation_sha256:producerHash},
        source_revision:s.source_sha256||null,scope:'Authored synthetic queue assertions and retained simulated records; no new simulation.'},
      claim:{status:'conditional_on_declared_fixture_and_stipulated_model',world_uncertainty:JSON.parse(JSON.stringify(w.uncertainty||{})),
        empirical_verification:'not_established',source_custody_is_world_truth:false,probabilities:'not_supplied; alternatives remain separate'},
      world:{scenario_id:s.id,case_id:s.case_id,action_id:s.action_id,world_id:w.id,declared_rate:w.rate,record_id:r.id,event_index:r.event_index},
      alignment:anchor?{status:anchor.available?'available':'unavailable',name:anchor.name,anchor_s:anchor.anchor_s,basis_record_id:anchor.basis_record_id||null}:
        {status:'not_requested',name:'native',anchor_s:0,basis_record_id:null},
      lineage:{activity:'required-work identity partition',implementation_version:version,method_version:mappingVersion,
        input_refs:[{kind:'simulated_record',id:r.id,source_revision:s.source_sha256||null}],
        output_ref:{kind:'derived_partition',id:r.id+'#'+mappingVersion},
        source_refs:(r.source_refs||[]).map(pointer=>({source_revision:s.source_sha256||null,pointer})),
        derivation_is_causal_proof:false},
      transform:{version:mappingVersion,composition:['required-set membership','completed precedence','pending precedence','backup-only precedence','remainder absent'],
        preconditions:['explicit required/pending/completed/backups identity arrays','unique string identities within each native array'],
        missing_value_behavior:'reject absent arrays and duplicate native identities; never infer zero',
        units:{weights:'required payload identities',members:'native identity strings'},
        uncertainty_effect:'none; no world averaging',
        reversibility:{status:'not_injective',reason:'Weights and membership do not recover FIFO order, action facts, service rates or all source relations.',source_recoverability:'retained source revision remains separately resolvable'},
        known_limitations:['Required-work disposition only; not a universal state vector','No empirical or CANON superiority claim']}
    };
  }
  return Object.freeze({version,mappingVersion,categoryKeys,partition,prefix,anchorFor,describe});
});
