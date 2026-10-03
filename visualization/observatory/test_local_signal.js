'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,data=JSON.parse(fs.readFileSync(path.join(root,'data/local_signal.json'),'utf8'));
const checks=[];function test(name,fn){fn();checks.push({name,passed:true});}
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('Full workbook and pull manifest retain the inspected immutable bytes',()=>{
  assert.equal(data.version,'local-annual-signal/1');assert.equal(data.source.sha256,'ecc5916ca12789b983fc4be437f8a354bbf4291323605324ac3e0aea4c57cbb6');
  for(const file of data.preservation.retainedFiles){assert.ok(file.path.startsWith('data/local-signal/'));const bytes=fs.readFileSync(path.join(root,file.path));assert.equal(bytes.length,file.bytes);assert.equal(digest(bytes),file.sha256);}
  assert.equal(data.source.manifestSha256,'a9be4d88cb4fff60dea6885f341295636db325cf0ab77253bd65be65e9b27467');assert.equal(data.source.retrievalEvent.meta.file_id,421302);
});
test('Two distinct identities retain exact annual keys, all values and native units',()=>{
  assert.deepEqual(data.countries.map(c=>c.code),['CAN','USA']);assert.deepEqual(data.countries.map(c=>c.name),['Canada','United States']);
  assert.equal(data.units.gdppc,'Real GDP per capita in 2011$');assert.equal(data.units.pop,'Population, mid-year (thousands)');
  const ids=new Set();for(const c of data.countries){assert.equal(c.records.length,21);assert.equal(c.region,'Western Offshoots');
    c.records.forEach((r,i)=>{assert.equal(r.year,1950+i);assert.equal(r.id,'mpd2023:'+c.code+':'+r.year);assert.ok(!ids.has(r.id));ids.add(r.id);
      assert.deepEqual(Object.keys(r.values),['gdppc','pop']);for(const key of ['gdppc','pop']){assert.ok(Number.isFinite(r.values[key]));assert.equal(r.missingness[key],false);assert.equal(r.sourceTypes[key],'n');}
      const column=c.code==='CAN'?'Y':'FF',row=708+i;assert.equal(r.sourceCells.year,'GDPpc!A'+row);assert.equal(r.sourceCells.populationYear,'Population!A'+row);assert.equal(r.sourceCells.gdppc,'GDPpc!'+column+row);assert.equal(r.sourceCells.pop,'Population!'+column+row);
    });
  }
  assert.equal(ids.size,42);
});
test('Independent inspected endpoint and middle cells bind values to the correct country',()=>{
  const [can,usa]=data.countries;
  assert.deepEqual(can.records[0].values,{gdppc:11622,pop:14011.422});assert.deepEqual(usa.records[0].values,{gdppc:15240,pop:152271});
  assert.deepEqual(can.records[10].values,{gdppc:13952,pop:18266.765});assert.deepEqual(usa.records[10].values,{gdppc:18057,pop:180671});
  assert.deepEqual(can.records[20].values,{gdppc:19207,pop:21749.986});assert.deepEqual(usa.records[20].values,{gdppc:23958,pop:205052});
  assert.notDeepEqual(can.records.map(r=>r.values),usa.records.map(r=>r.values));
});
test('Sampling validation matches the records without inventing seconds, missingness or waveforms',()=>{
  for(const c of data.countries){const s=c.sampling;assert.equal(s.recordCount,c.records.length);assert.equal(s.strictlyIncreasing,true);assert.deepEqual(s.observedYearSteps,[1]);assert.deepEqual(s.duplicateYears,[]);assert.deepEqual(s.missingExpectedYears,[]);assert.deepEqual(s.missingValuesByChannel,{gdppc:[],pop:[]});assert.equal(s.interpolatedValues,0);assert.equal(s.synthesizedDates,0);assert.equal(s.frequencyHz,null);assert.equal(s.completeDeclaredYearGrid,true);}
  assert.equal(data.samplingValidation.frequencyAnalysisSupported,false);assert.equal(data.samplingValidation.interpolationPermitted,false);assert.equal(data.samplingValidation.missingSelectedValues,0);assert.deepEqual(data.samplingValidation.pairedYears,Array.from({length:21},(_,i)=>1950+i));
});
test('Unused classification, source definitions and partial provenance remain inspectable',()=>{
  assert.match(data.preservation.fieldCoverage.region,/not used/);assert.match(data.preservation.unusedOutsideScope,/byte-identical full workbook/);
  assert.equal(Object.keys(data.preservation.fieldCoverage).length,6);assert.ok(data.source.notes.some(r=>r.cells.some(c=>c.cell==='B16'&&c.value===data.units.gdppc)));
  assert.ok(data.source.countrySourceNotes.some(r=>r.sheet==='Maddison original sources'&&r.row===32));assert.match(data.source.provenanceLimit,/partially/);assert.match(data.comparison.independence,/same compilation/);
});
console.log(JSON.stringify({passed:checks.length,failed:0,checks,scope:'Retained byte revisions, record identities, native units, source-cell coordinates, sampling and inspected values. prepare_local_signal.py --check independently re-extracts every selected source cell.'},null,2));
