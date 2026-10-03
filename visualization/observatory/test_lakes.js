'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,catalog=JSON.parse(fs.readFileSync(path.join(root,'data/lakes.json'),'utf8')),subset=catalog.selectedSubset,checks=[];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const rawById=new Map(),metadataById=new Map(subset.sourceFiles.map(file=>[file.id,file]));
function test(name,fn){try{fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.stack});}}
function read(file){const resolved=path.resolve(root,file.path);assert.ok(resolved.startsWith(root+path.sep),'Bundled file escaped observatory');const bytes=fs.readFileSync(resolved);assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);return bytes;}
function lines(bytes){return bytes.toString('utf8').split(/\r?\n/).filter(line=>line.trim()).map(line=>JSON.parse(line));}

test('Selected source copies and the separate template match their recorded exact-byte hashes',()=>{
 assert.equal(catalog.version,'lake-catalog/1');assert.equal(subset.kind,'entity_metadata');assert.equal(subset.sourceFiles.length,4);
 for(const file of subset.sourceFiles){rawById.set(file.id,read(file));assert.equal(file.preservation,'exact_source_bytes');}
 const mm=catalog.entryPoints.find(x=>x.id==='MM_Lake');read(mm.inspectedFiles[0]);
});
test('Every selected entity and lookup retains every native field, empty value, label and ordering',()=>{
 assert.deepEqual(subset.records,lines(rawById.get('countries')));
 assert.deepEqual(subset.incomeLevels,lines(rawById.get('incomeLevels')));assert.deepEqual(subset.lendingTypes,lines(rawById.get('lendingTypes')));
 assert.equal(subset.records.length,296);assert.equal(new Set(subset.records.map(x=>x.id)).size,296);
 assert.equal(subset.incomeLevels.length,7);assert.equal(subset.lendingTypes.length,4);
 assert.equal(subset.records.find(x=>x.id==='ABW').region.value,'Latin America & Caribbean ');
 assert.equal(subset.records.find(x=>x.id==='AFE').latitude,'');
 assert.deepEqual(Object.keys(subset.fieldDisposition).sort(),Object.keys(subset.records[0]).sort());
 assert.equal(subset.fieldDisposition.latitude,'retained_not_used_in_graph');
});
test('Every relationship and source mapping resolves to its exact retained native record and field',()=>{
 const native=lines(rawById.get('countries'));assert.equal(subset.relationships.length,296*4);assert.equal(subset.sourceMappings.length,296);
 for(const mapping of subset.sourceMappings){assert.equal(mapping.fileId,'countries');assert.equal(native[mapping.recordLine-1].id,mapping.recordId);assert.deepEqual(mapping.nativeFields,Object.keys(native[mapping.recordLine-1]));}
 const keys=new Set();
 for(const relation of subset.relationships){assert.equal(relation.kind,'recorded');assert.ok(!keys.has(relation.id));keys.add(relation.id);
  const record=native[relation.source.recordLine-1];assert.equal(record.id,relation.recordId);assert.equal(relation.source.fileId,'countries');assert.equal(relation.source.fieldPointer,'/'+relation.field);assert.deepEqual(record[relation.field],relation.nativeTarget);assert.equal(relation.targetId,relation.nativeTarget.id||null);
  if(relation.resolution==='lookup_matched'){const table=relation.field==='incomeLevel'?subset.incomeLevels:subset.lendingTypes;assert.ok(table.some(row=>row.id===relation.targetId));}
  if(!relation.nativeTarget.id)assert.equal(relation.resolution,'empty_native_id');
 }
});
test('Coverage distinguishes explicit aggregates, missing metadata and native unclassified labels',()=>{
 const nonaggregate=subset.records.filter(x=>x.region.value!=='Aggregates'),c=subset.coverage;
 assert.equal(c.nonaggregateRecords,217);assert.equal(c.aggregateRecords,79);assert.equal(c.records,296);
 assert.equal(c.nonaggregateEmptyScalarFields.latitude,nonaggregate.filter(x=>x.latitude==='').length);assert.equal(c.nonaggregateEmptyScalarFields.latitude,6);
 assert.equal(c.emptyScalarFields.latitude,85);assert.equal(c.nonaggregateEmptyNestedIds.adminregion,88);
 assert.deepEqual(c.nonaggregateIncomeUnresolved,[]);assert.deepEqual(c.nonaggregateLendingUnresolved,[]);
 const aggregateRelation=subset.relationships.find(x=>x.recordId==='AFE'&&x.field==='incomeLevel');
 assert.equal(aggregateRelation.targetId,'NA');assert.equal(aggregateRelation.resolution,'not_in_retained_lookup');
 assert.equal(subset.records.find(x=>x.id==='USA').lendingType.value,'Not classified');
});
test('Only capture timestamps are exposed; catalogue classifications are never represented as a sampled signal',()=>{
 const manifest=JSON.parse(rawById.get('pullManifest')),time=subset.timeSemantics;
 assert.equal(time.kind,'capture_metadata_only');assert.equal(time.observationTimestamps,null);assert.equal(time.samplingRateHz,null);
 assert.equal(Date.parse(time.captureStartedUtc),Math.floor(manifest.started*1000));assert.equal(Date.parse(time.captureFinishedUtc),Math.floor(manifest.finished*1000));
 assert.equal(subset.license.recorded,null);assert.ok(subset.limitations.some(x=>x.includes('not measured economic outcomes')));
 assert.ok(!Object.hasOwn(subset,'samples'));assert.ok(!Object.hasOwn(subset,'signals'));
});
test('SCM invalid-query and historical-fingerprint issues remain distinct from zero results and measurements',()=>{
 const scm=catalog.entryPoints.find(x=>x.id==='SCM_LAKE'),geo=scm.responses.find(x=>x.file==='esearch_geo_taxid_562.json');
 assert.equal(scm.status,'metadata_only_no_measurements');assert.equal(geo.status,'query_error');assert.equal(geo.countNative,null);assert.equal(geo.error,'Invalid db name specified: geo');
 assert.equal(scm.coverage.searchResponseFiles,8);assert.equal(scm.coverage.queryErrorFiles,1);assert.equal(scm.coverage.retainedIds,3500);assert.equal(scm.coverage.searchResponsesWithHistoricalFingerprintDiscrepancy,8);
 assert.ok(scm.issues.some(x=>x.id==='historical_fingerprint_discrepancies'));assert.ok(scm.inspectedFiles.every(x=>x.bundled===false));
});
test('MM lake remains a template-only entry, without attributing any demonstration music to it',()=>{
 const mm=catalog.entryPoints.find(x=>x.id==='MM_Lake');assert.equal(mm.status,'template_only_no_music_assets');assert.deepEqual(mm.coverage,{filesPresent:1,audioFiles:0,scoreFiles:0,populatedAnnotationFiles:0});assert.equal(mm.inspectedFiles[0].kind,'schema_template');
 assert.ok(mm.limitations.some(x=>x.includes('must not be attributed to MM_Lake')));
});
const originalChecks=[];
for(const file of [...subset.sourceFiles,...catalog.entryPoints.find(x=>x.id==='MM_Lake').inspectedFiles]){
 const exists=fs.existsSync(file.originalPath),matches=exists?sha(fs.readFileSync(file.originalPath))===file.sha256:null;
 originalChecks.push({id:file.id,available:exists,matches});if(exists&&matches!==true)checks.push({name:'Original source unchanged: '+file.id,passed:false});
}
const report={passed:checks.every(x=>x.passed),checks:checks.length,results:checks,originalChecks,scope:'Exact copied bytes, complete native field retention, recorded relationship references, coverage and metadata/measurement boundaries. External originals absent on another machine remain unavailable, not verified.'};
console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
