"""Build a bounded local metadata catalogue; never modify the source lakes.

Only four selected SOT files and the unpopulated MM template are copied.
SCM summaries refer to their original files and explicitly remain external.
No acquisition, sampled signal, missing-value imputation, or source repair.
"""
from pathlib import Path
from hashlib import sha256
from collections import Counter, defaultdict
from datetime import datetime, timezone
import argparse
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent


def fingerprint(path):
    raw = path.read_bytes()
    return {'originalPath': str(path), 'bytes': len(raw), 'sha256': sha256(raw).hexdigest()}


def read_jsonl(path):
    return [json.loads(line) for line in path.read_bytes().decode('utf-8').splitlines() if line.strip()]


def utc(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sot', type=Path, default=Path(r'B:\Projects\SOT_LAKE'))
    parser.add_argument('--scm', type=Path, default=Path(r'B:\Projects\SCM_LAKE'))
    parser.add_argument('--music-lake', type=Path, default=Path(r'B:\Projects\MM_Lake'))
    args = parser.parse_args()
    output = ROOT / 'data'
    output.mkdir(parents=True, exist_ok=True)
    original_snapshots = {}

    def retain(path, relative, file_id, kind, **metadata):
        raw = path.read_bytes()
        original_snapshots[path] = raw
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(raw)
        return {'id': file_id, 'path': 'data/'+relative, **fingerprint(path), 'kind': kind,
                'bundled': True, 'preservation': 'exact_source_bytes', **metadata}

    sot_out = args.sot / 'LAKE/out'
    bank = sot_out / 'world_bank_indicators_api'
    specs = [('countries', 'world_bank__countries.jsonl'),
             ('incomeLevels', 'world_bank__income_levels.jsonl'),
             ('lendingTypes', 'world_bank__lending_types.jsonl')]
    values, files = {}, []
    for key, name in specs:
        path = bank / name
        values[key] = read_jsonl(path)
        files.append(retain(path, 'lakes/sot/'+name, key, 'entity_metadata', recordCount=len(values[key])))
    manifest_path = sot_out / 'manifest_pull.json'
    manifest = json.loads(manifest_path.read_bytes())
    files.append(retain(manifest_path, 'lakes/sot/manifest_pull.json', 'pullManifest', 'acquisition_manifest'))
    events = [item for item in manifest['events'] if item.get('source') == 'world_bank_indicators_api']
    for file in files:
        if file['id'] == 'pullManifest':
            continue
        event = next(item for item in events if Path(item['out_path'].replace('\\', '/')).name == Path(file['path']).name)
        file['sourceUrl'] = event['url']
        file['historicalManifestRecordCount'] = event['meta']['records']
        file['historicalFingerprint'] = None

    records = values['countries']
    if len({r['id'] for r in records}) != len(records):
        raise ValueError('Selected entity identifiers are not unique')
    nonaggregate = [r for r in records if r['region']['value'] != 'Aggregates']
    aggregate = [r for r in records if r['region']['value'] == 'Aggregates']
    income_ids = {r['id'] for r in values['incomeLevels']}
    lending_ids = {r['id'] for r in values['lendingTypes']}
    relationships = []
    relation_fields = {'region': 'region_classification', 'adminregion': 'administrative_region_classification',
                       'incomeLevel': 'income_classification', 'lendingType': 'lending_classification'}
    for line, record in enumerate(records, 1):
        for field, target_type in relation_fields.items():
            native = record[field]
            target = native['id']
            lookup = income_ids if field == 'incomeLevel' else lending_ids if field == 'lendingType' else None
            resolution = ('empty_native_id' if not target else 'embedded_only' if lookup is None
                          else 'lookup_matched' if target in lookup else 'not_in_retained_lookup')
            relationships.append({'id': record['id']+'/'+field, 'recordId': record['id'], 'kind': 'recorded',
                                  'field': field, 'targetType': target_type, 'targetId': target or None,
                                  'nativeTarget': native, 'resolution': resolution,
                                  'source': {'fileId': 'countries', 'recordLine': line, 'fieldPointer': '/'+field}})
    scalar_fields = ['id', 'iso2Code', 'name', 'capitalCity', 'longitude', 'latitude']
    missing = lambda data: {field: sum(r[field] in ('', None) for r in data) for field in scalar_fields}
    coverage = {'records': len(records), 'uniqueRecordIds': len({r['id'] for r in records}),
                'nonaggregateRecords': len(nonaggregate), 'aggregateRecords': len(aggregate),
                'incomeLevelRecords': len(income_ids), 'lendingTypeRecords': len(lending_ids),
                'nativeTopLevelFields': list(records[0]), 'nativeScalarLeavesPerEntity': 18,
                'emptyScalarFields': missing(records), 'nonaggregateEmptyScalarFields': missing(nonaggregate),
                'nonaggregateEmptyNestedIds': {field: sum(not r[field]['id'] for r in nonaggregate) for field in relation_fields},
                'relationshipRecords': len(relationships),
                'relationshipResolutionCounts': dict(Counter(r['resolution'] for r in relationships)),
                'nonaggregateIncomeUnresolved': sorted({r['incomeLevel']['id'] for r in nonaggregate}-income_ids),
                'nonaggregateLendingUnresolved': sorted({r['lendingType']['id'] for r in nonaggregate}-lending_ids),
                'regionCountsNonaggregate': dict(Counter(r['region']['value'] for r in nonaggregate)),
                'derivation': 'Counts over every retained row. Aggregate means native region.value exactly equals Aggregates. Empty strings are counted without changing source values.'}
    time = {'kind': 'capture_metadata_only', 'observationTimestamps': None, 'samplingRateHz': None,
            'captureStartedUtc': utc(manifest['started']), 'captureFinishedUtc': utc(manifest['finished']),
            'source': {'fileId': 'pullManifest', 'fields': ['/started', '/finished']},
            'warning': 'Global acquisition-run timestamps are not per-entity observations or classification-effective dates.'}
    subset = {'id': 'sot-world-bank-entity-catalog', 'label': 'World Bank entities and recorded classifications',
              'kind': 'entity_metadata', 'recordIdField': 'id', 'records': records,
              'incomeLevels': values['incomeLevels'], 'lendingTypes': values['lendingTypes'],
              'sourceFiles': files, 'coverage': coverage, 'timeSemantics': time,
              'relationships': relationships,
              'relationshipDefinitions': [{'field': field, 'kind': 'recorded', 'targetType': target,
                                            'meaning': 'Native classification field; not a causal or dynamic coupling.'}
                                           for field, target in relation_fields.items()],
              'fieldDisposition': {field: ('used_for_identity' if field in ('id', 'iso2Code', 'name') else
                                           'used_for_recorded_relationships' if field in relation_fields else
                                           'retained_not_used_in_graph') for field in records[0]},
              'sourceMappings': [{'recordId': record['id'], 'fileId': 'countries', 'recordLine': line,
                                  'nativeFields': list(record)} for line, record in enumerate(records, 1)],
              'license': {'recorded': None, 'status': 'not_stated_in_inspected_local_files'},
              'limitations': ['Static catalogue metadata, not measured economic outcomes or a sampled signal.',
                              'Aggregates remain distinct from nonaggregate entities; no aggregate membership lists were supplied.',
                              'Region and administrative-region labels come from embedded source objects, not an independently retained lookup.',
                              'Classification capture time is known only at the acquisition-run level; no effective-date history is present.',
                              'Coordinate values remain original strings. Their measurement units are not declared in these local records, and coordinates are not used by this graph.',
                              'Empty native strings and unclassified/aggregate labels are retained; no values are imputed.',
                              'A source license and version were not recorded. Current byte hashes identify this local revision.',
                              'The retained broader pull manifest describes other files; only the declared four-file subset is imported here.']}

    # Read the existing SCM files to report actual response content separately
    # from run-status claims. No original response or historical hash is repaired.
    scm_source = args.scm / 'LAKE/sources/ncbi_eutils'
    run_path = next((scm_source / 'runs').glob('*.json'))
    run = json.loads(run_path.read_bytes())
    scm_files, scm_responses = [], []
    for path in sorted((scm_source / 'raw').iterdir()):
        if not path.is_file():
            continue
        historical = next(item for item in run['artifacts'] if Path(item['path'].replace('\\', '/')).name == path.name)
        meta = {'name': path.name, **fingerprint(path), 'bundled': False,
                'historicalBytes': historical['bytes'], 'historicalSha256': historical['sha256']}
        meta['historicalBytesMatch'] = meta['bytes'] == meta['historicalBytes']
        meta['historicalHashMatches'] = meta['sha256'] == meta['historicalSha256']
        if path.suffix == '.json':
            result = json.loads(path.read_bytes())['esearchresult']
            response = {'file': path.name, 'kind': 'search_inventory', 'countNative': result.get('count'),
                        'retmaxNative': result.get('retmax'), 'retstartNative': result.get('retstart'),
                        'retainedIdCount': len(result.get('idlist', [])), 'error': result.get('ERROR'),
                        'queryTranslation': result.get('querytranslation'),
                        'status': 'query_error' if result.get('ERROR') else 'valid_zero_results' if result.get('count') == '0' else 'identifier_inventory'}
            scm_responses.append(response)
        else:
            taxon = ET.fromstring(path.read_bytes()).find('Taxon')
            meta['kind'] = 'taxonomy_metadata'
            meta['inspectedFields'] = {field: taxon.findtext(field) for field in ['TaxId', 'ScientificName', 'ParentTaxId', 'Rank']}
        scm_files.append(meta)
    scm_manifest_files = [{'name': path.name, **fingerprint(path), 'bundled': False, 'kind': 'manifest_or_scan_metadata'}
                          for path in [args.scm/'LAKE/00_MANIFEST/lake_manifest.json', run_path, scm_source/'inventory/scan_counts.json']]
    scm_entry = {'id': 'SCM_LAKE', 'label': 'SCM · E. coli taxonomy and search inventories',
                 'originalRoot': str(args.scm), 'status': 'metadata_only_no_measurements',
                 'inspectedFiles': scm_files+scm_manifest_files, 'responses': scm_responses,
                 'assessment': 'Actual taxonomy metadata and ESearch identifier inventories. No expression matrix, observed temporal series, or single-cell measurement file in the inspected populated source.',
                 'coverage': {'rawFiles': len(scm_files), 'taxonomyFiles': 1, 'searchResponseFiles': len(scm_responses),
                              'queryErrorFiles': sum(r['status']=='query_error' for r in scm_responses),
                              'retainedIds': sum(r['retainedIdCount'] for r in scm_responses),
                              'searchResponsesWithHistoricalFingerprintDiscrepancy': sum(not f['historicalHashMatches'] for f in scm_files if f['name'].endswith('.json'))},
                 'captureRunUtc': run['run_utc'], 'timeSemantics': 'acquisition_metadata_only',
                 'issues': [{'id': 'invalid_geo_query', 'status': 'observed_unrepaired', 'detail': 'Actual geo response contains ERROR: Invalid db name specified: geo. This is not a valid zero-result query.',
                             'file': 'esearch_geo_taxid_562.json', 'sourceField': '/esearchresult/ERROR'},
                            {'id': 'historical_fingerprint_discrepancies', 'status': 'observed_unrepaired',
                             'detail': 'Current raw bytes are fingerprinted independently; historical manifest comparisons remain visible. No claim is made that this establishes content authenticity.'}],
                 'limitations': ['Original SCM artifacts are referenced, not bundled in this selected-subset export.',
                                 'Identifier counts are search coverage, not biological values. IDs from different databases are not joined or treated as the same entity.',
                                 'No new source acquisition or invalid-query/fingerprint repair was performed.']}
    music_template = args.music_lake / 'music_map_specimen_template.md'
    mm_file = retain(music_template, 'lakes/mm/music_map_specimen_template.md', 'musicMapTemplate', 'schema_template')
    mm_entries = sorted(p for p in args.music_lake.rglob('*') if p.is_file())
    mm = {'id': 'MM_Lake', 'label': 'MM · unpopulated music specimen template', 'originalRoot': str(args.music_lake),
          'status': 'template_only_no_music_assets', 'inspectedFiles': [mm_file],
          'coverage': {'filesPresent': len(mm_entries), 'audioFiles': 0, 'scoreFiles': 0, 'populatedAnnotationFiles': 0},
          'assessment': 'The sole file is a schema/template with example UUIDs, empty arrays, nulls and hypothetical feature names. It contains no actual composition, performance, audio, score, or populated music annotations.',
          'limitations': ['Template field names are proposals, not observed variables.',
                          'Waveform, spectrum, synchronized phase and beat/bar/phrase/form inspection are unsupported by this lake entry.',
                          'Any separate observatory demonstration music must declare its own origin and must not be attributed to MM_Lake.']}
    if len(mm_entries) != 1 or mm_entries[0] != music_template:
        raise ValueError('MM_Lake contents changed; inspect newly present files before asserting template-only coverage')
    sot_entry = {'id': 'SOT_LAKE', 'label': 'SOT · selected World Bank catalogue', 'originalRoot': str(args.sot),
                 'status': 'selected_metadata_subset', 'selectedSubsetId': subset['id'], 'inspectedFiles': files,
                 'coverage': coverage, 'assessment': 'Complete selected entity and classification metadata files, verified from their current bytes. Broader lake files and download-status entries are not treated as imported measurements.',
                 'limitations': subset['limitations']}
    catalog = {'version': 'lake-catalog/1', 'selectedSubset': subset, 'entryPoints': [scm_entry, sot_entry, mm],
               'scope': 'Bounded local catalogue entry points and one complete selected metadata subset; no acquisition and no numerical time-series import.',
               'preservation': {'selectedSourceFiles': len(files), 'additionalTemplateFiles': 1,
                                'sourceValues': 'All native fields, nested objects, empty strings, ordering and labels are retained.',
                                'rawFiles': 'Byte-for-byte copies with independent SHA-256 hashes.',
                                'derivedValues': 'Coverage counts, resolution statuses and relationship wrappers are derived and labeled separately.',
                                'externalReferences': 'SCM original paths are explicit external references and are not portable bundled evidence.'}}
    for path, raw in original_snapshots.items():
        if path.read_bytes() != raw:
            raise ValueError('Original changed while preparing export: '+str(path))
    destination = output / 'lakes.json'
    destination.write_bytes((json.dumps(catalog, ensure_ascii=False, indent=2)+'\n').encode('utf-8'))
    print(json.dumps({'path': str(destination), 'version': catalog['version'], 'records': len(records),
                      'rawFilesRetained': len(files)+1, 'bytes': destination.stat().st_size,
                      'sha256': sha256(destination.read_bytes()).hexdigest(), 'originalsUnchanged': True}, indent=2))


if __name__ == '__main__':
    main()
