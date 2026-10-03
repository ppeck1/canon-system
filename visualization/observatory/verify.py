"""Verify current observatory sources and offline HTML without rebuilding them."""
from pathlib import Path
from hashlib import sha256
from contextlib import redirect_stdout
from html.parser import HTMLParser
from unittest.mock import patch
import argparse
import array
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave
import build

ROOT = Path(__file__).resolve().parent
VISUALIZATION = ROOT.parent


def file_digest(path):
    raw = path.read_bytes()
    return {'bytes': len(raw), 'sha256': sha256(raw).hexdigest()}


def baseline_check():
    directory = VISUALIZATION / 'accepted-baseline'
    manifest_path = directory / 'manifest.json'
    manifest = json.loads(manifest_path.read_bytes())
    provenance = json.loads((VISUALIZATION / 'BASELINE_PROVENANCE.json').read_bytes())
    assert file_digest(manifest_path)['sha256'] == provenance['manifest_sha256'], 'Accepted manifest changed'
    assert len(manifest['files']) == provenance['files_verified_and_copied'] == 110
    for item in manifest['files']:
        path = (directory / item['path']).resolve()
        assert path.is_relative_to(directory.resolve()), 'Accepted manifest path escaped its directory'
        assert file_digest(path) == {key: item[key] for key in ('bytes', 'sha256')}, 'Accepted file changed: '+item['path']
    assert file_digest(directory / 'index.html')['sha256'] == provenance['html_sha256']
    return {'passed': True, 'verified_files': len(manifest['files']), 'manifest_sha256': provenance['manifest_sha256'],
            'html_sha256': provenance['html_sha256'], 'scope': 'Read-only comparison to the retained accepted release manifest and custody record.'}


def music_check():
    meta = json.loads((ROOT/'data/music.json').read_bytes())
    wav = (ROOT/'data/music.wav').read_bytes()
    assert sha256(wav).hexdigest() == meta['wav_sha256'], 'Music waveform fingerprint differs from supplied annotations'
    assert file_digest(ROOT/'prepare_music.py')['sha256'] == meta['generator_sha256'], 'Music generator revision differs from supplied provenance'
    with wave.open(io.BytesIO(wav), 'rb') as source:
        assert source.getcomptype() == 'NONE'
        channels, width, rate, count = source.getnchannels(), source.getsampwidth(), source.getframerate(), source.getnframes()
        pcm = source.readframes(count)
    assert (channels, width, rate, count) == (2, 2, 22050, 352800)
    assert channels == len(meta['channels']) and rate == meta['sample_rate_hz'] and count == meta['sample_count_per_channel']
    assert count/rate == meta['duration_s'] == 16
    assert len(pcm) == count*channels*width
    values = array.array('h', pcm)
    if sys.byteorder != 'little':
        values.byteswap()
    assert max(map(abs, values)) < 32767, 'Unexpected clipped PCM'
    assert any(values[2*i] != values[2*i+1] for i in range(count)), 'Stereo channels unexpectedly identical'
    assert meta['structure_status'] == 'supplied composition annotations; not inferred'
    assert len(meta['beats']) == 32 and len(meta['bars']) == 8 and len(meta['phrases']) == len(meta['form']) == 2
    assert [beat['time_s'] for beat in meta['beats']] == [i*.5 for i in range(32)]
    for name in ('bars', 'phrases', 'form'):
        segments = meta[name]
        assert segments[0]['start_s'] == 0 and segments[-1]['end_s'] == count/rate
        for i, item in enumerate(segments):
            assert 0 <= item['start_s'] < item['end_s'] <= count/rate
            if i:
                assert segments[i-1]['end_s'] == item['start_s'], 'Unexpected annotation gap/overlap in '+name
    assert len({note['id'] for note in meta['notes']}) == len(meta['notes'])
    for note in meta['notes']:
        assert all(math.isfinite(note[key]) for key in ('start_s', 'duration_s', 'pan', 'amplitude', 'midi'))
        assert 0 <= note['start_s'] < note['start_s']+note['duration_s'] <= count/rate
        assert -1 <= note['pan'] <= 1 and note['amplitude'] >= 0
    return {'passed': True, 'kind': meta['kind'], 'sha256': meta['wav_sha256'], 'channels': channels,
            'sample_rate_hz': rate, 'samples_per_channel': count, 'duration_s': count/rate,
            'pcm_peak_absolute': max(map(abs, values)), 'annotations': {name: len(meta[name]) for name in ('notes', 'beats', 'bars', 'phrases', 'form')},
            'scope': 'Retained PCM header/data/hash and supplied annotation bounds, order, coverage and generator fingerprint. Audibility and browser transport are separate.'}


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.external_assets = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'img', 'audio', 'video', 'source', 'iframe') and attrs.get('src'):
            if not attrs['src'].startswith(('data:', 'blob:')):
                self.external_assets.append((tag, attrs['src']))
        if tag == 'link' and attrs.get('rel') == 'stylesheet' and attrs.get('href'):
            self.external_assets.append((tag, attrs['href']))


def assembly_check():
    actual = (ROOT/'index.html').read_bytes()
    expected = build.assemble_bytes(ROOT)
    assert actual == expected, 'index.html differs from current modules/data; run build.py before verification'
    assert b'\r' not in actual and not actual.startswith(b'\xef\xbb\xbf')
    parser = AssetParser()
    parser.feed(actual.decode('utf-8'))
    assert not parser.external_assets, 'Executable requires external assets: '+str(parser.external_assets)
    source_code = '\n'.join(build.canonical_text(ROOT/name) for name in ('app.js', 'model.js', 'form.js'))
    assert not re.search(r'\b(fetch|XMLHttpRequest|importScripts)\s*\(', source_code), 'Unexpected remote/runtime asset acquisition in source'
    probe_results = []
    with tempfile.TemporaryDirectory(prefix='canon-observatory-build-') as temporary:
        root = Path(temporary)
        (root/'data').mkdir()
        for name in ('lakes.json', 'music.json', 'music.wav'):
            (root/'data'/name).write_bytes((ROOT/'data'/name).read_bytes())
        original_sources = build.embedded_data(ROOT)['sources']
        for label, ending in [('LF', '\n'), ('CRLF', '\r\n'), ('CR', '\r')]:
            for name in build.TEXT_INPUTS:
                raw = build.canonical_text(ROOT/name).replace('\n', ending).encode('utf-8')
                (root/name).write_bytes(raw)
            with patch.object(build, 'ROOT', root), patch.object(Path, 'write_text', side_effect=AssertionError('HTML output must be binary')), redirect_stdout(io.StringIO()):
                build.main()
            assert (root/'index.html').read_bytes() == actual, 'OS-style template/code newlines changed HTML bytes'
            assert build.embedded_data(root)['sources'] == original_sources, 'Line-ending normalization changed source fingerprints'
            probe_results.append(label)
        # Change actual JavaScript tokens, not just a source file's line endings.
        # The additional valid expression must change the source fingerprint.
        changed_model = (build.canonical_text(root/'model.js')+'\n;void 0;\n').encode('utf-8')
        (root/'model.js').write_bytes(changed_model)
        changed_sources = build.embedded_data(root)['sources']
        assert changed_sources['oscillator']['sha256'] == sha256(changed_model).hexdigest()
        assert changed_sources['oscillator']['sha256'] != original_sources['oscillator']['sha256']
        assert changed_sources['oscillator']['fingerprint_policy'] == build.MODEL_FINGERPRINT_POLICY
        assert changed_sources['music'] == original_sources['music'] and changed_sources['lake'] == original_sources['lake']
        assert build.assemble_bytes(root) != actual, 'An actual source-model token change was hidden'
    return {'passed': True, 'bytes': len(actual), 'sha256': sha256(actual).hexdigest(), 'newline_policy': build.NEWLINE_POLICY,
            'all_code_input_newline_variants_verified': probe_results, 'model_source_token_change_detected': True,
            'model_fingerprint_policy': build.MODEL_FINGERPRINT_POLICY, 'raw_data_fingerprints_unchanged': True,
            'runtime_asset_dependencies': [], 'scope': 'Exact executable bytes and binary output; all code/data/audio embedded. Accepted-baseline and evidence hyperlinks open separately on user action.'}


def input_snapshot():
    ignored = {'verification_checks.json', 'package_manifest.json', 'package_record.json'}
    files = [p for p in ROOT.rglob('*') if p.is_file() and p.name not in ignored and '__pycache__' not in p.parts and p.suffix not in ('.zip', '.log', '.pyc')]
    return {p.relative_to(ROOT).as_posix(): file_digest(p) for p in sorted(files)}


def run_checks(node=None):
    before = input_snapshot()
    executable = node or os.environ.get('CANON_NODE') or shutil.which('node')
    if not executable:
        raise RuntimeError('Node unavailable: provide --node or CANON_NODE')
    tests = []
    for file in sorted(ROOT.glob('test_*.js')):
        completed = subprocess.run([executable, str(file)], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=180)
        try:
            result = json.loads(completed.stdout.lstrip('\ufeff'))
        except ValueError:
            result = {'stdout': completed.stdout}
        passed = completed.returncode == 0 and result.get('passed') is not False
        tests.append({'file': file.name, 'passed': passed, 'exit_code': completed.returncode, 'result': result, 'stderr': completed.stderr})
    assert tests and all(test['passed'] for test in tests), 'A Node contract suite failed: '+json.dumps(tests)
    assembly = assembly_check()
    music = music_check()
    baseline = baseline_check()
    after = input_snapshot()
    assert before == after, 'Verification changed observatory inputs'
    return {'passed': True, 'node_suites': tests, 'node_suite_count': len(tests), 'assembly': assembly, 'music': music,
            'accepted_baseline': baseline, 'inputs_unchanged': True, 'input_fingerprints': after,
            'scope': 'Observatory contracts, exact offline assembly, supplied stereo music and immutable accepted baseline. Browser interaction/audio and visual usability are separately evidenced.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node')
    args = parser.parse_args()
    result = run_checks(args.node)
    (ROOT/'verification_checks.json').write_bytes((json.dumps(result, indent=2)+'\n').encode('utf-8'))
    print(json.dumps({'passed': True, 'node_suites': result['node_suite_count'], 'baseline_files': result['accepted_baseline']['verified_files'],
                      'html_sha256': result['assembly']['sha256'], 'report': str(ROOT/'verification_checks.json')}, indent=2))


if __name__ == '__main__':
    main()
