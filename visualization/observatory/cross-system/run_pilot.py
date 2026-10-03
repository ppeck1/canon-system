"""Run a bounded transfer pilot against the bundled, unmodified 1555697 code.

Only temporary extracted copies execute package.py / verify.py. No Git checkout,
network, dataset acquisition or original source directory is needed to reproduce.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile
import argparse
import ast
import importlib.util
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import time

import mechanism
import native

ROOT = Path(__file__).resolve().parent
COMMIT = '1555697c4c07dd390406bb7d01a8aa2be4eb984f'
BUNDLE = ROOT/'frozen-1555697.zip'


def digest(raw):
    return {'bytes': len(raw), 'sha256': sha256(raw).hexdigest()}


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(value, ensure_ascii=False, indent=2)+'\n').encode('utf-8'))


def stamp():
    return datetime.now(timezone.utc).isoformat()


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def extract(destination):
    destination.mkdir(parents=True)
    with ZipFile(BUNDLE) as archive:
        for info in archive.infolist():
            target = (destination/info.filename).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise ValueError('Frozen snapshot path escape')
            if info.file_size > 32_000_000:
                raise ValueError('Unexpected snapshot entry size')
        archive.extractall(destination)
    return destination/'visualization'/'observatory'


def snapshot(obs):
    # Exact input_snapshot() policy of frozen verify.py, retained as native facts.
    ignored = {'verification_checks.json', 'package_manifest.json', 'package_record.json'}
    return {p.relative_to(obs).as_posix(): digest(p.read_bytes()) for p in sorted(obs.rglob('*'))
            if p.is_file() and p.name not in ignored and '__pycache__' not in p.parts
            and p.suffix not in ('.zip', '.log', '.pyc')}


def receipt(path):
    if not path.exists():
        return {'exists': False, 'content': None, 'parse_error': None, 'fingerprint': None}
    raw = path.read_bytes()
    try:
        content, error = json.loads(raw), None
    except ValueError as exception:
        content, error = None, str(exception)
    return {'exists': True, 'content': content, 'parse_error': error, 'fingerprint': digest(raw)}


def command(args, obs, sandbox):
    start = time.perf_counter()
    environment = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
    result = subprocess.run(args, cwd=obs, capture_output=True, text=True,
                            encoding='utf-8', errors='replace', timeout=180, env=environment)
    def portable(text):
        return text.replace(str(sandbox).replace('\\', '\\\\'), '<sandbox>').replace(str(sandbox), '<sandbox>').replace(str(sandbox).replace('\\', '/'), '<sandbox>')
    return {'argv': [Path(args[0]).name, *args[1:]], 'exit_code': result.returncode,
            'stdout': portable(result.stdout), 'stderr': portable(result.stderr),
            'elapsed_seconds': round(time.perf_counter()-start, 6)}


def baseline_digest(directory):
    return {p.relative_to(directory).as_posix(): digest(p.read_bytes())
            for p in sorted(directory.rglob('*')) if p.is_file() and '__pycache__' not in p.parts}


def make_case(seed, destination, spec):
    shutil.copytree(seed, destination)
    obs = destination/'visualization'/'observatory'
    current = obs/'verification_checks.json'
    # The retained receipt comes from a real successful seed verification.
    retained = destination/'retained-verification_checks.json'
    retained.write_bytes(current.read_bytes())
    current.unlink()
    if spec['mutation'] == 'documentation_append':
        path = obs/'README.md'
        path.write_bytes(path.read_bytes()+spec['append'].encode('utf-8'))
    elif spec['mutation'] == 'assembled_html_append':
        path = obs/'index.html'
        path.write_bytes(path.read_bytes()+spec['append'].encode('utf-8'))
    elif spec['mutation'] != 'none':
        raise ValueError('Unknown isolated mutation')
    return obs, retained


def inspect_facts(obs, retained, seed_snapshot, seed_report, actions):
    # assemble_bytes() is a pure computation from frozen code, not a test label.
    build = load_module('frozen_build_for_inspection', obs/'build.py')
    current = snapshot(obs)
    observed_html, expected_html = digest((obs/'index.html').read_bytes()), digest(build.assemble_bytes(obs))
    baseline = obs.parent/'accepted-baseline'
    provenance = json.loads((obs.parent/'BASELINE_PROVENANCE.json').read_bytes())
    manifest = json.loads((baseline/'manifest.json').read_bytes())
    constraints = [{'id': 'assembled-html-byte-identity', 'observed': observed_html, 'required': expected_html,
                    'source': 'visualization/observatory/verify.py:102'},
                   {'id': 'accepted-manifest-hash', 'observed': digest((baseline/'manifest.json').read_bytes())['sha256'],
                    'required': provenance['manifest_sha256'], 'source': 'visualization/observatory/verify.py:35'}]
    constraints += [{'id': 'accepted-file:'+item['path'], 'observed': digest((baseline/item['path']).read_bytes()),
                     'required': {key: item[key] for key in ('bytes', 'sha256')},
                     'source': 'visualization/observatory/verify.py:40'} for item in manifest['files']]
    # Rerun feasibility is bounded by exactly the retained, passing executable,
    # data and contract-test inputs. A README mutation is permitted; changed
    # executable/data inputs cannot inherit the seed checks through this adapter.
    checked = {name: value for name, value in seed_snapshot.items()
               if name != 'README.md' and not name.startswith('browser-evidence/')}
    stable_observed = {name: current.get(name) for name in checked}
    verification = constraints + [
        {'id': 'same-checked-program-data-test-inputs', 'observed': stable_observed, 'required': checked,
         'source': 'visualization/observatory/verify.py:147'},
        {'id': 'seed-verification', 'observed': seed_report.get('passed'), 'required': True,
         'source': 'actual seed verify.py execution'}]
    return {'active_receipt': receipt(obs/'verification_checks.json'), 'retained_receipt': receipt(retained),
            'current_input_fingerprints': current, 'package_constraints': constraints,
            'verification_constraints': verification, 'actions': actions,
            'snapshot_policy': 'Frozen verify.py input_snapshot(): exact file bytes; report/package records, archives, logs and pycache excluded.',
            'operational_facts': {'python_available': True, 'node_available': True,
                                  'same_runtime_as_seed_verification': True, 'network_required': False},
            'omissions': ['No receipt signature or trusted issuer is checked by the frozen package gate.',
                          'No workers/service-rate control exists in this target.',
                          'Runtime failure, concurrent external changes and arbitrary new code/data revisions are outside this bounded selector.']}


def archive_result(obs):
    path = obs/'observatory-package.zip'
    if not path.exists():
        return {'exists': False, 'valid': False}
    with ZipFile(path) as archive:
        manifest = json.loads(archive.read('package_manifest.json'))
        mismatches = []
        for item in manifest['files']:
            raw = archive.read(item['path'])
            if digest(raw) != {key: item[key] for key in ('bytes', 'sha256')}:
                mismatches.append(item['path']+':manifest')
            if raw != (obs.parent/item['path']).read_bytes():
                mismatches.append(item['path']+':current-input')
        return {'exists': True, 'valid': not mismatches and archive.testzip() is None,
                'fingerprint': digest(path.read_bytes()), 'verified_files': len(manifest['files']),
                'mismatches': mismatches, 'html_sha256': digest(archive.read('observatory/index.html'))['sha256']}


def run_action(obs, retained, action, node, sandbox):
    calls, copied = [], []
    before = snapshot(obs)
    if action['operation'] == 'restore_retained_receipt':
        raw = retained.read_bytes()
        (obs/'verification_checks.json').write_bytes(raw)
        copied.append({'from': 'retained-verification_checks.json', 'to': 'observatory/verification_checks.json',
                       'fingerprint': digest(raw), 'transformation': 'identity; exact bytes'})
        calls.append(command([sys.executable, '-B', 'package.py'], obs, sandbox))
    elif action['operation'] == 'repeat_package_attempts':
        with ThreadPoolExecutor(max_workers=3) as pool:
            calls = list(pool.map(lambda _: command([sys.executable, '-B', 'package.py'], obs, sandbox), range(3)))
    elif action['operation'] == 'verify_current_then_package':
        calls.append(command([sys.executable, '-B', 'verify.py', '--node', node], obs, sandbox))
        if calls[-1]['exit_code'] == 0:
            calls.append(command([sys.executable, '-B', 'package.py'], obs, sandbox))
    else:
        raise ValueError('Unknown native intervention')
    archive = archive_result(obs)
    return {'commands': calls, 'copies': copied, 'archive': archive,
            'success': bool(archive['valid'] and calls[-1]['exit_code'] == 0),
            'inputs_unchanged_by_action': snapshot(obs) == before,
            'receipt_after': receipt(obs/'verification_checks.json')['fingerprint']}


def measure(callable_, *args):
    start = time.perf_counter_ns()
    result = callable_(*args)
    return result, (time.perf_counter_ns()-start)/1e6


def source_result(seed):
    directory = seed/'visualization'/'accepted-baseline'/'data'/'sources'
    packet = json.loads((directory/'cases.json').read_bytes())
    behavior = load_module('frozen_queue_oracle', directory/'behavior.py')
    results = []
    for identity in ('T4M6', 'H9C3', 'B2R8'):
        case = next(row for row in packet['cases'] if row['case_id'] == identity)
        facts = {key: value for key, value in case.items() if key != 'proposed_transfer'}
        graph, build_ms = measure(mechanism.queue_graph, facts)
        role, role_ms = measure(mechanism.select, graph)
        baseline, native_ms = measure(native.queue, facts)
        outcomes = {action['id']: behavior.queue_world(case, action, case['facts']['service_rate_possibilities_jobs_per_tick'][0])
                    for action in case['actions']}
        results.append({'case_id': identity, 'facts': facts, 'roleGraph': graph,
                        'decisions': {'role': role, 'native': baseline}, 'nativeOutcomes': outcomes,
                        'timing_ms': {'role_mapping': build_ms, 'role_selection': role_ms, 'native_selection': native_ms}})
    return {'selected': results[0], 'boundary_cases': results[1:],
            'proposed_transfer_removed_from_method_input': True,
            'evidence': [{'path': 'visualization/accepted-baseline/data/sources/cases.json',
                          **digest((directory/'cases.json').read_bytes())},
                         {'path': 'visualization/accepted-baseline/data/sources/behavior.py',
                          **digest((directory/'behavior.py').read_bytes())}]}


def code_effort(path):
    text = path.read_text(encoding='utf-8')
    functions = [{'name': node.name, 'lines': node.end_lineno-node.lineno+1}
                 for node in ast.parse(text).body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))]
    return {'path': path.name, **digest(path.read_bytes()),
            'nonblank_lines': sum(bool(line.strip()) for line in text.splitlines()), 'functions': functions}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default=os.environ.get('CANON_NODE') or shutil.which('node'))
    parser.add_argument('--output', type=Path, default=ROOT.parent/'data'/'transfer.json')
    args = parser.parse_args()
    if not args.node:
        raise SystemExit('Node is required for actual frozen verification; supply --node PATH')
    start = time.perf_counter()
    protocol = json.loads((ROOT/'protocol.json').read_bytes())
    manifest = json.loads((ROOT/'frozen_manifest.json').read_bytes())
    assert digest(BUNDLE.read_bytes()) == manifest['bundle'], 'Frozen oracle bundle changed'
    assert manifest['commit'] == COMMIT
    bundle_before = digest(BUNDLE.read_bytes())
    work_live_baseline = ROOT.parent.parent/'accepted-baseline'
    protected_before = baseline_digest(work_live_baseline) if work_live_baseline.exists() else None
    with tempfile.TemporaryDirectory(prefix='canon-cross-system-') as temporary:
        sandbox = Path(temporary).resolve()
        assert sandbox.parent == Path(tempfile.gettempdir()).resolve()
        seed = sandbox/'seed'
        obs = extract(seed)
        baseline_before = baseline_digest(obs.parent/'accepted-baseline')
        old_receipt = receipt(obs/'verification_checks.json')
        seed_call = command([sys.executable, '-B', 'verify.py', '--node', args.node], obs, sandbox)
        if seed_call['exit_code'] != 0:
            raise RuntimeError('Frozen seed verification failed: '+json.dumps(seed_call))
        seed_report = json.loads((obs/'verification_checks.json').read_bytes())
        assert baseline_digest(obs.parent/'accepted-baseline') == baseline_before
        seed_snapshot = snapshot(obs)
        assert seed_snapshot == seed_report['input_fingerprints']
        source = source_result(seed)
        cases = []
        # Prepare and locally digest ALL predictions before ANY target oracle call.
        for spec in protocol['cases']:
            case_dir = sandbox/('inspect-'+spec['id'])
            case_obs, retained = make_case(seed, case_dir, spec)
            facts, inspection_ms = measure(inspect_facts, case_obs, retained, seed_snapshot, seed_report, spec['actions'])
            graph, mapping_ms = measure(mechanism.release_graph, facts)
            role, role_ms = measure(mechanism.select, graph)
            baseline, native_ms = measure(native.release, facts)
            cases.append({'id': spec['id'], 'facts': facts, 'roleGraph': graph,
                          'decisions': {'role': role, 'native': baseline},
                          'timing_ms': {'shared_inspection': inspection_ms, 'role_mapping': mapping_ms,
                                        'role_selection': role_ms, 'native_selection': native_ms}})
        decision_commit = {'timestamp_utc': stamp(), 'sha256': sha256(canonical(cases)).hexdigest(),
                           'method_source_hashes': {name: digest((ROOT/name).read_bytes()) for name in ('mechanism.py', 'native.py')},
                           'case_protocol_sha256': digest((ROOT/'protocol.json').read_bytes())['sha256'],
                           'scope': 'All three target prediction digests locally persisted before all target interventions; not external preregistration. Boundary families were known during design.'}
        write_json(ROOT/'prediction_digest.json', decision_commit)
        for case, spec in zip(cases, protocol['cases']):
            initial_obs, _ = make_case(seed, sandbox/('initial-'+spec['id']), spec)
            case['initial_package_attempt'] = command([sys.executable, '-B', 'package.py'], initial_obs, sandbox)
            case['actions'] = []
            for action in spec['actions']:
                directory = sandbox/('action-'+spec['id']+'-'+action['id'])
                action_obs, retained = make_case(seed, directory, spec)
                result = run_action(action_obs, retained, action, args.node, sandbox)
                row = {**action, 'run': result, 'success': result['success']}
                row['predictions'] = {method: next(value['feasible'] for value in decision['actions'] if value['id'] == action['id'])
                                      for method, decision in case['decisions'].items()}
                case['actions'].append(row)
            feasible = [action for action in case['actions'] if action['success']]
            case['oracle_choice'] = min(feasible, key=lambda action: (action['cost'], action['id']))['id'] if feasible else None
            case['choice_agreement'] = {method: result['choice'] == case['oracle_choice'] for method, result in case['decisions'].items()}
        methods = {}
        for method in ('role', 'native'):
            methods[method] = {'decisions_correct': sum(case['choice_agreement'][method] for case in cases),
                               'decisions_total': len(cases),
                               'action_predictions_correct': sum(action['predictions'][method] == action['success'] for case in cases for action in case['actions']),
                               'action_predictions_total': sum(len(case['actions']) for case in cases)}
        summary = {'methods': methods, 'target_cases': len(cases),
                   'interventions_executed': sum(len(case['actions']) for case in cases),
                   'actual_subprocesses': sum(len(action['run']['commands']) for case in cases for action in case['actions'])+len(cases)+1,
                   'transfer_supported_case_ids': [case['id'] for case in cases if any(action['success'] and action['operation'] == 'restore_retained_receipt' for action in case['actions'])],
                   'replay_rejected_case_ids': [case['id'] for case in cases if not any(action['success'] and action['operation'] == 'restore_retained_receipt' for action in case['actions'])],
                   'relative_benefit_established': False}
        result = {'version': 'canon-cross-system-transfer/1',
                  'title': 'A retained prerequisite: queue identity to release verification handoff',
                  'question': 'When does restoring a retained prerequisite fix a failed task, and when must that transfer be rejected?',
                  'evidence_status': 'Synthetic queue fixture plus real pre-existing local release code exercised in isolated copies; no production outage is claimed.',
                  'protocol': protocol, 'decision_commit': decision_commit, 'source': source,
                  'target': {'commit': COMMIT, 'bundle': manifest, 'seed_verification': seed_call,
                             'source_files': [{'label': name, 'path': 'cross-system/oracle/release/'+name}
                                              for name in ('package.py', 'verify.py', 'build.py', 'README.md')],
                             'seed_receipt_before': old_receipt['fingerprint'],
                             'seed_receipt_after': digest((obs/'verification_checks.json').read_bytes()),
                             'seed_preparation': 'Run actual frozen verify.py once against exact Git blob bytes. This creates a current receipt; it is copied without editing for all cases.',
                             'goal': 'Frozen package.py exits zero and its newly produced ZIP bytes match the current isolated inputs and manifest.'},
                  'mapping': protocol['mapping'], 'cases': cases, 'summary': summary,
                  'effort': {'implementation': [code_effort(ROOT/name) for name in ('mechanism.py', 'native.py', 'run_pilot.py', 'test_transfer.py')],
                             'target_role_requirements': [len(case['roleGraph']['requirements']) for case in cases],
                             'target_role_tokens': [len(case['roleGraph']['tokens']) for case in cases],
                             'target_gate_counts': [len(case['facts']['package_constraints']) for case in cases],
                             'timing_policy': 'Per-case timings are actual wall times for shared inspection, role construction and both selectors. Native baseline consumes the identical native fact packet. Subprocess logs include actual verification/execution times.',
                             'construction_time': 'Manual authoring time was not independently instrumented. Source/function/line counts expose construction size; no lower-effort claim is made.',
                             'execution_elapsed_seconds': round(time.perf_counter()-start, 6)},
                  'preservation': {'frozen_bundle_unchanged': digest(BUNDLE.read_bytes()) == bundle_before,
                                   'extracted_accepted_baseline_unchanged': baseline_digest(obs.parent/'accepted-baseline') == baseline_before,
                                   'live_accepted_baseline_unchanged': protected_before is None or baseline_digest(work_live_baseline) == protected_before,
                                   'all_action_inputs_unchanged': all(action['run']['inputs_unchanged_by_action'] for case in cases for action in case['actions'])},
                  'environment': {'python': platform.python_version(), 'platform': platform.platform(), 'node_executable': Path(args.node).name},
                  'limitations': protocol['limitations']}
        assert all(result['preservation'].values()), 'Protected data changed'
        write_json(args.output, result)
        write_json(ROOT/'results.json', result)
        print(json.dumps({'output': str(args.output), 'summary': summary, 'preservation': result['preservation'],
                          'elapsed_seconds': result['effort']['execution_elapsed_seconds']}, indent=2))


if __name__ == '__main__':
    main()
