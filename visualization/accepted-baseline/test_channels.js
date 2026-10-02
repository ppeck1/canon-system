'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('./channels.js'),L=require('./labels.js'),F=require('./frames.js');
const bundle=freeze(JSON.parse(fs.readFileSync(path.join(__dirname,'data/bundle.json'),'utf8')));
const source=freeze(JSON.parse(fs.readFileSync(path.join(__dirname,'data/sources/cases.json'),'utf8')));
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function selection(scenarioId,eventIndex,worldIndex=0){const s=bundle.scenarios.find(item=>item.id===scenarioId);assert.ok(s);const w=s.worlds[worldIndex];return {s,w,r:eventIndex===undefined?w.records.at(-1):w.records.find(item=>item.event_index===eventIndex)};}
function pairs(view){return view.rows.map(row=>[row.values.ready,row.values.unfinished]);}
function resolve(pointer){return pointer.split('/').slice(1).reduce((value,key)=>value&&value[key.replace(/~1/g,'/').replace(/~0/g,'~')],source);}

test('T4M6 replay is action A and preserves the exact pre/post jump and completion sequence',()=>{
  const s=selection('T4M6/A'),view=C.prefix(s);
  assert.equal(s.s.action.operation,'replay_available_backups');
  assert.deepEqual(pairs(view),[[2,3],[3,3],[2,2],[1,1],[0,0]]);
  assert.deepEqual(view.rows.map(row=>row.native_time_s),[0,0,1,2,3]);
  assert.deepEqual(view.rows.map(row=>row.event_index),[0,1,2,3,4]);
  assert.deepEqual(view.rows.map(row=>row.values.backup),[1,0,0,0,0]);
  assert.deepEqual(view.rows.map(row=>row.values.completed),[0,0,1,2,3]);
  assert.equal(view.rows[0].channels.ready.formula,'count(identities.pending)');
  assert.ok(view.rows.every(row=>row.source_refs.length>0));
});

test('T4M6 no replay is action B and ends with zero ready but one unfinished required identity',()=>{
  const s=selection('T4M6/B'),view=C.prefix(s);
  assert.equal(s.s.action.operation,'continue_service');
  assert.deepEqual(pairs(view),[[2,3],[2,3],[1,2],[0,1],[0,1]]);
  assert.deepEqual(view.rows.at(-1).channels.unfinished.identities,['w2']);
  assert.equal(view.rows.at(-1).values.backup,1);
  assert.equal(view.rows.at(-1).values.absent,0);
});

test('ordered prefix does not include the same-time post-action record before it is selected',()=>{
  assert.deepEqual(pairs(C.prefix(selection('T4M6/A',0))),[[2,3]]);
  assert.deepEqual(pairs(C.prefix(selection('T4M6/A',1))),[[2,3],[3,3]]);
  const altered=structuredClone(selection('T4M6/A',1));
  altered.w.records.at(-1).identities.pending=['future-only'];
  altered.w.records.at(-1).values.rate=999;
  assert.deepEqual(C.prefix(altered).rows,C.prefix(selection('T4M6/A',1)).rows);
});

test('configured rate stays positive during a pause while actual completions are zero',()=>{
  const rows=C.prefix(selection('B2R8/A')).rows;
  assert.equal(rows[0].values.delivered,null);
  assert.equal(rows[0].channels.delivered.status,'not_applicable');
  const paused=rows.find(row=>row.event_index===2),processing=rows.find(row=>row.event_index===3);
  assert.equal(paused.values.rate,2);
  assert.equal(paused.values.delivered,0);
  assert.equal(paused.values.ready,7);
  assert.equal(processing.values.rate,2);
  assert.equal(processing.values.delivered,2);
  const changedRate=C.prefix(selection('H9C3/B')).rows;
  assert.equal(changedRate[0].values.rate,1);
  assert.equal(changedRate[1].values.rate,4);
});

test('ready and completed count all identities while unfinished, backup and absent use the required set',()=>{
  const r={id:'test/record',event_index:0,event_kind:'service_end',time_s:0,known_at_s:0,source_refs:['/cases/6/task'],
    identities:{required:['a','b','c','d'],pending:['a','non_required'],completed:['b','completed_extra'],backups:['a','c','completed_extra'],completed_this_tick:['b']},
    values:{pending:999,completed:999,outstanding:999,backups:999,absent:999,rate:3}};
  assert.deepEqual(C.record(r).values,{ready:2,unfinished:3,completed:2,backup:1,absent:1,rate:3,delivered:1});
  assert.deepEqual(C.record(r).channels.backup.identities,['c']);
  assert.deepEqual(C.record(r).channels.absent.identities,['d']);
});

test('missing or invalid data is explicit and never replaced with numeric zero or world rate',()=>{
  const r=structuredClone(selection('T4M6/A',2).r);
  delete r.identities.pending;
  delete r.values.rate;
  delete r.source_refs;
  const row=C.record(r,{world:{rate:8}});
  assert.equal(row.values.ready,null);
  assert.equal(row.values.backup,null);
  assert.equal(row.values.absent,null);
  assert.equal(row.values.rate,null);
  assert.equal(row.values.completed,1);
  assert.equal(row.values.unfinished,2);
  assert.equal(row.channels.ready.status,'unavailable');
  assert.equal(row.source_refs_status,'missing');
  assert.ok(row.missing.some(item=>item.field==='source_refs'));
  const duplicate=structuredClone(selection('T4M6/A',0).r);
  duplicate.identities.pending.push(duplicate.identities.pending[0]);
  assert.equal(C.record(duplicate).values.ready,null);
  delete duplicate.time_s;
  assert.equal(C.record(duplicate).native_time_s,null);
  assert.equal(C.record(duplicate).display_time_s,null);
});

test('alignment changes display time only and an unavailable anchor does not become native time',()=>{
  const s=selection('T4M6/A'),native=C.prefix(s),aligned=C.prefix(s,{clock:'aligned',anchorName:'first_completed_payload'});
  assert.deepEqual(aligned.rows.map(row=>row.native_time_s),native.rows.map(row=>row.native_time_s));
  assert.deepEqual(aligned.rows.map(row=>row.display_time_s),[-1,-1,0,1,2]);
  assert.deepEqual(aligned.rows.map(row=>row.values),native.rows.map(row=>row.values));
  const unavailable=C.prefix(selection('T4M6/A',0),{clock:'aligned',anchorName:'first_completed_payload'});
  assert.equal(unavailable.status,'unavailable');
  assert.deepEqual(unavailable.rows,[]);
  assert.match(unavailable.reason,/No completed-payload/);
});

test('framed channels preserve carry source time and read source identities instead of rendered weights',()=>{
  const s=selection('T4M6/A'),frame=F.side(s,{clock:'native',span:1.5});
  for(const row of frame.rows)row.weights={ready:12345,backup_only:12345,absent:12345,completed:12345};
  const result=C.fromFrame(s,frame);
  assert.equal(result.carryIn.native_time_s,1);
  assert.equal(result.carryIn.display_time_s,1.5);
  assert.equal(result.carryIn.carry_in,true);
  assert.equal(result.carryIn.isObservedEvent,false);
  assert.deepEqual(pairs(result),[[2,2],[1,1],[0,0]]);
  const invalidFrame=structuredClone(frame);
  invalidFrame.rows[0].record_id='future/not-in-prefix';
  assert.throws(()=>C.fromFrame(s,invalidFrame),/outside the selected source prefix/);
});

test('all queue cases have source-backed initial-only aliases with stable native IDs',()=>{
  const queueCases=bundle.cases.filter(item=>item.system==='finite_fifo_queue');
  assert.deepEqual(L.caseIds.slice().sort(),queueCases.map(item=>item.case_id).sort());
  for(const item of queueCases){
    const label=L.caseLabel(bundle,item.case_id);
    assert.equal(label.status,'verified');
    assert.equal(label.case_id,item.case_id);
    assert.equal(label.scope,'initial_source_configuration');
    assert.equal(label.label_version,L.version);
    assert.ok(label.source_refs.every(ref=>resolve(ref)!==undefined));
    assert.ok(label.source_refs.every(ref=>!ref.includes('/actions/')&&!ref.includes('outcome')));
  }
  assert.equal(L.caseLabel(bundle,'T4M6').label,'One required job is stored only in backup');
  assert.equal(L.caseLabel(bundle,'H9C3').label,'One required job has no listed copy');
  assert.equal(L.caseLabel(bundle,'D8V1').label,'Three jobs queued; service stopped');
  assert.equal(L.caseLabel(bundle,'B2R8').label,'Seven jobs; a two-second deadline');
  assert.equal(L.caseLabel(bundle,'P5J9').label,'Service rate not yet established');
  assert.equal(L.caseLabel(bundle,'N7K4').label,'Five jobs queued; a three-second deadline');
  assert.equal(L.caseLabel(bundle,'T4M6').initial_counts.absent,0);
  assert.equal(L.caseLabel(bundle,'H9C3').initial_counts.backup,0);
});

test('aliases do not use future outcome and unknown or changed sources fall back without fabricated diagnoses',()=>{
  const changed=structuredClone(bundle),before=L.caseLabel(bundle,'T4M6');
  for(const s of changed.scenarios.filter(item=>item.case_id==='T4M6'))for(const w of s.worlds){w.outcome.success=false;w.records=[];}
  assert.deepEqual(L.caseLabel(changed,'T4M6'),before);
  const unknown=L.caseLabel(bundle,'CASE_NOT_SUPPLIED');
  assert.equal(unknown.label,'CASE_NOT_SUPPLIED');
  assert.equal(unknown.status,'unknown');
  assert.deepEqual(unknown.source_refs,[]);
  assert.equal(L.caseLabel(bundle,'V9E6').status,'unknown');
  changed.cases.find(item=>item.case_id==='D8V1').facts.service_rate_possibilities_jobs_per_tick=[9];
  assert.equal(L.caseLabel(changed,'D8V1').status,'unknown');
  assert.equal(L.caseLabel(changed,'D8V1').label,'D8V1');
  changed.cases.find(item=>item.case_id==='B2R8').facts.tick_duration_seconds=2;
  assert.equal(L.caseLabel(changed,'B2R8').status,'unknown');
  changed.cases.find(item=>item.case_id==='N7K4').facts.current_tick=1;
  assert.equal(L.caseLabel(changed,'N7K4').status,'unknown');
  changed.cases.find(item=>item.case_id==='P5J9').facts.unknown_fact=null;
  assert.equal(L.caseLabel(changed,'P5J9').status,'unknown');
});

test('ordinary action, world and event labels retain source naming truth',()=>{
  const replay=selection('T4M6/A'),noReplay=selection('T4M6/B');
  assert.equal(L.actionLabel(replay.s).label,'Add available backup jobs to the queue');
  assert.equal(L.actionLabel(replay.s).action_id,'A');
  assert.equal(L.actionLabel(noReplay.s).label,'Continue processing');
  assert.equal(L.actionLabel(noReplay.s).action_id,'B');
  assert.ok(L.actionLabel(replay.s).source_refs.every(ref=>resolve(ref)!==undefined));
  assert.match(L.actionLabel(selection('B2R8/A').s).label,/Pause 1 tick/);
  const possibilities=bundle.scenarios.find(item=>item.id==='P5J9/C').worlds.map(world=>L.worldLabel(world));
  assert.deepEqual(possibilities.map(item=>item.rate),[0,2]);
  assert.ok(possibilities.every(item=>item.label.startsWith('Possible initial rate:')));
  assert.equal(L.eventLabel('pre_action').label,'Before action');
  assert.equal(L.eventLabel('post_action').label,'After action');
  assert.equal(L.eventLabel('service_end').label,'End of service tick');
  assert.equal(L.actionLabel({action_id:'Z',action:{operation:'not_supported'}}).status,'unknown');
  assert.equal(L.worldLabel({id:'world_unknown'}).status,'unknown');
  assert.equal(L.eventLabel('unregistered_event').status,'unknown');
});

test('every retained world is a separate exact prefix and frozen originals are unchanged',()=>{
  const before=JSON.stringify(bundle);
  for(const s of bundle.scenarios)for(const w of s.worlds){
    const result=C.prefix({s,w,r:w.records.at(-1)});
    assert.equal(result.world_id,w.id);
    assert.deepEqual(result.rows.map(row=>row.record_id),w.records.map(row=>row.id));
    for(let i=0;i<result.rows.length;i++){
      assert.equal(result.rows[i].values.ready,w.records[i].identities.pending.length);
      assert.equal(result.rows[i].values.rate,w.records[i].values.rate);
    }
  }
  assert.equal(JSON.stringify(bundle),before);
});

test('browser globals expose the same source channel and display label interfaces',()=>{
  const context={};
  for(const name of ['domain.js','labels.js','channels.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,name),'utf8'),context);
  assert.equal(context.SourceChannels.version,C.version);
  assert.equal(context.DisplayLabels.version,L.version);
  assert.equal(typeof context.SourceChannels.prefix,'function');
  assert.equal(typeof context.DisplayLabels.eventLabel,'function');
});
