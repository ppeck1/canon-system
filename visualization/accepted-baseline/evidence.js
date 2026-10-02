/* Versioned evidence custody: exact retained assertions are not world truth. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.EvidenceStore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const version='evidence-store/1';
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
  function copy(value){return JSON.parse(JSON.stringify(value));}
  function create(bundle,options={}) {
    if(!bundle||!bundle.source||!bundle.source.sha256||!bundle.source.packet)throw new Error('A retained source envelope and revision are required');
    const retained=freeze(copy(bundle)),revision=retained.source.sha256;
    const bundleRevision=options.bundleSha256||null;
    const records=new Map(),scenarios=new Map(),worlds=new Map(),ledger=new Map();
    for(const s of retained.scenarios||[]) {scenarios.set(s.id,s);for(const w of s.worlds||[]) {worlds.set(w.id,{s,w});for(const r of w.records||[])records.set(r.id,{s,w,r});}}
    for(const entry of retained.ledger||[])ledger.set(entry.pointer,entry);
    const missingSource=sha=>({status:'missing_source',requested_revision:sha,available_revision:revision,value:null,reason:'Requested source revision is not loaded; no fallback substitution.'});
    function resolveSource(sha=revision){return sha===revision?{status:'resolved',source_revision:revision,value:retained.source,custody:'retained assertions, not factual verification'}:missingSource(sha);}
    function resolvePointer(pointer,sha=revision) {
      if(sha!==revision)return missingSource(sha);
      if(typeof pointer!=='string'||(pointer!==''&&!pointer.startsWith('/')))return {status:'missing_pointer',pointer,value:null,source_revision:revision,reason:'Expected an RFC6901 JSON pointer.'};
      let value=retained.source.packet;
      for(const token of (pointer===''?[]:pointer.slice(1).split('/'))) {
        if(/~(?:[^01]|$)/.test(token))return {status:'missing_pointer',pointer,value:null,source_revision:revision,reason:'Invalid JSON pointer escape.'};
        const key=token.replace(/~1/g,'/').replace(/~0/g,'~');
        if(value===null||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,key))return {status:'missing_pointer',pointer,value:null,source_revision:revision};
        value=value[key];
      }
      return {status:'resolved',pointer,value,source_revision:revision,ledger:ledger.get(pointer)||null,custody:'exact decoded assertion from retained source; numeric lexemes and raw bytes remain in envelope'};
    }
    function recordRef(id){const entry=records.get(id);return entry?{kind:'simulated_record',id,scenario_id:entry.s.id,world_id:entry.w.id,source_revision:revision,bundle_revision:bundleRevision}:null;}
    function resolveRecord(id){const entry=records.get(id);return entry?{status:'resolved',value:entry.r,scenario:entry.s,world:entry.w,ref:recordRef(id)}:{status:'missing_record',id,value:null};}
    function resolveLedger(pointer){return ledger.has(pointer)?{status:'resolved',value:ledger.get(pointer),source_revision:revision}:{status:'missing_pointer',pointer,value:null,source_revision:revision};}
    function resolveScenario(id){return scenarios.has(id)?{status:'resolved',value:scenarios.get(id)}:{status:'missing_scenario',id,value:null};}
    function resolveWorld(id){const entry=worlds.get(id);return entry?{status:'resolved',value:entry.w,scenario:entry.s}:{status:'missing_world',id,value:null};}
    return Object.freeze({version,sourceRevision:revision,bundleRevision,bundle:retained,resolveSource,resolvePointer,resolveRecord,recordRef,resolveLedger,resolveScenario,resolveWorld,
      manifest:freeze({source_revision:revision,bundle_revision:bundleRevision,source_bytes:retained.source.byte_length,ledger_nodes:retained.ledger.length,
        hash_status:'Retained source hash is an ingestion revision identifier. Byte verification is recorded separately by preservation checks.',
        coverage:copy(retained.coverage),custody:'authoritative about what this source revision contains; not automatic factual authority',
        producer:{id:'queue_world',implementation:'sources/behavior.py::queue_world',implementation_sha256:retained.metadata.behavior_copy_sha256,version:'sha256:'+retained.metadata.behavior_copy_sha256}})});
  }
  return Object.freeze({version,create});
});
