"""Run the current local suites and record their scopes without rebuilding HTML.

Usage: python -B run_checks.py [--node PATH]
Node resolution: explicit argument, CANON_NODE, NODE_BINARY, PATH, then the
optional Codex bundled runtime under the current user's home. NumPy is required
by reference_timescale.py. Missing protected originals are reported by the
existing preservation verifier; they are never silently treated as verified.
"""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def digest(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': sha256(data).hexdigest()}


def snapshot():
    code = sorted(p for p in ROOT.iterdir() if p.is_file() and p.suffix in {'.js', '.py', '.html'})
    evidence = sorted(p for directory in ('data', 'context') for p in (ROOT / directory).rglob('*') if p.is_file())
    return {p.relative_to(ROOT).as_posix(): digest(p) for p in code + evidence}


def node_path(explicit):
    selected = explicit or os.environ.get('CANON_NODE') or os.environ.get('NODE_BINARY')
    if selected:
        resolved = shutil.which(selected) or (str(Path(selected).resolve()) if Path(selected).is_file() else None)
        return resolved, None if resolved else 'Explicit Node executable is unavailable: '+selected
    resolved = shutil.which('node')
    if resolved:
        return resolved, None
    bundled = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    if bundled.is_file():
        return str(bundled), None
    return None, 'Node is unavailable. Put node on PATH or set CANON_NODE, NODE_BINARY, or --node.'


def run_one(name, command, unavailable=None):
    if unavailable:
        return {'check': name, 'command': command, 'status': 'unavailable', 'passed': False,
                'exit_code': None, 'reason': unavailable}
    try:
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                                   encoding='utf-8', errors='replace', timeout=180)
        stdout = completed.stdout.lstrip('\ufeff')
        try:
            result = json.loads(stdout)
        except ValueError:
            result = {'stdout': stdout}
        declared_failure = isinstance(result, dict) and (result.get('passed') is False or result.get('status') == 'failed')
        passed = completed.returncode == 0 and not declared_failure
        return {'check': name, 'command': command, 'status': 'passed' if passed else 'failed',
                'passed': passed, 'exit_code': completed.returncode, 'result': result, 'stderr': completed.stderr}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {'check': name, 'command': command, 'status': 'error', 'passed': False,
                'exit_code': None, 'reason': str(error)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', help='Node executable; otherwise environment, PATH, or optional bundled runtime')
    parser.add_argument('--list', action='store_true', help='List commands without running any checks or writing a report')
    args = parser.parse_args()
    node, unavailable = node_path(args.node)
    node_tests = sorted(ROOT.glob('test_*.js'), key=lambda p: p.name)
    commands = [(p.name, [node or 'node', str(p)], unavailable) for p in node_tests]
    commands += [('reference_timescale.py', [sys.executable, '-B', str(ROOT / 'reference_timescale.py'), '--node', node or 'node'], unavailable),
                 ('verify_preservation.py', [sys.executable, '-B', str(ROOT / 'verify_preservation.py')], None),
                 ('test_build_consistency.py', [sys.executable, '-B', str(ROOT / 'test_build_consistency.py')], None)]
    if args.list:
        print(json.dumps({'node': node, 'node_resolution_error': unavailable,
                          'checks': [{'name': name, 'command': command} for name, command, _ in commands]}, indent=2))
        return 0
    before = snapshot()
    results = []
    for name, command, reason in commands:
        result = run_one(name, command, reason)
        results.append(result)
        print(name+': '+result['status'], flush=True)
    after = snapshot()
    changed = sorted(name for name in before.keys() | after.keys() if before.get(name) != after.get(name))
    preserved = not changed
    version_pattern = re.compile(r'\b(version|VERSION|mappingVersion|kernelVersion|encodingVersion)\s*=\s*([\'\"])([^\'\"]+)\2')
    declarations = {p.name: {m[0]: m[2] for m in version_pattern.findall(p.read_text(encoding='utf-8'))}
                    for p in sorted(ROOT.glob('*.js')) if not p.name.startswith('test_')}
    baseline_manifest = ROOT / 'releases/baseline-multiview-20261002/manifest.json'
    baseline = {'available': baseline_manifest.is_file()}
    if baseline_manifest.is_file():
        manifest = json.loads(baseline_manifest.read_text(encoding='utf-8'))
        baseline.update(release_label=manifest['release_label'], manifest_sha256=digest(baseline_manifest)['sha256'],
                        html_sha256=manifest['assembly']['html_sha256'])
    report = {'passed': all(r['passed'] for r in results) and preserved,
              'checked_utc': datetime.now(timezone.utc).isoformat(),
              'scope': 'All current top-level Node suites, independent NumPy calibration reference, protected-original/copied-source verification, and exact offline assembly. Browser behavior and visual acceptance are separate.',
              'node_test_files': [p.name for p in node_tests], 'checks_run': len(results), 'checks': results,
              'runtimes': {'python': sys.executable, 'node': node},
              'code_and_evidence_unchanged_during_checks': preserved, 'changed_inputs': changed,
              'input_hashes_before': before, 'input_hashes_after': after,
              'source_version_declarations': declarations, 'baseline_release': baseline,
              'browser_evidence': {'run_by_this_script': False, 'reference': 'BROWSER_EVIDENCE.md'},
              'portability': 'Runnable with Python, NumPy and Node. External protected originals unavailable on another machine remain explicitly unverifiable; local evidence copies still have their own hashes.'}
    target = ROOT / 'extension_checks.json'
    target.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'passed': report['passed'], 'checks_run': len(results), 'node_suites': len(node_tests),
                      'inputs_unchanged': preserved, 'report': str(target)}, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
