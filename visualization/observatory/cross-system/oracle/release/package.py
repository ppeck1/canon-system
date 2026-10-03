"""Package the complete visualization tree with deterministic entry metadata.

Run verify.py after final source changes, then this script after browser evidence
and documentation are ready. Never writes inside accepted-baseline.
"""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import io
import json
import os
import verify

ROOT = Path(__file__).resolve().parent
VISUALIZATION = ROOT.parent
EXCLUDE_FILES = {'package_manifest.json', 'package_record.json'}
EXCLUDE_DIRS = {'__pycache__', '.git', 'node_modules'}


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False)+'\n').encode('utf-8')


def main():
    report = json.loads((ROOT/'verification_checks.json').read_bytes())
    if not report.get('passed') or report['input_fingerprints'] != verify.input_snapshot():
        raise ValueError('Verification report does not match current inputs; run verify.py before packaging')
    assembly, baseline = verify.assembly_check(), verify.baseline_check()
    contents = {}
    for directory, dirs, files in os.walk(VISUALIZATION):
        dirs[:] = sorted(name for name in dirs if name not in EXCLUDE_DIRS)
        for filename in sorted(files):
            path = Path(directory)/filename
            if filename in EXCLUDE_FILES or path.suffix.lower() in ('.zip', '.log', '.tmp', '.pyc'):
                continue
            if path.is_symlink():
                raise ValueError('Package inputs must not be symbolic links: '+str(path))
            contents[path.relative_to(VISUALIZATION).as_posix()] = path.read_bytes()
    manifest = {'version': 'observatory-portable-package/1', 'entrypoint': 'observatory/index.html',
                'accepted_entrypoint': 'accepted-baseline/index.html', 'offline': True,
                'scope': 'Current standalone observatory plus byte-preserved accepted instruments, source copies, tests, documentation and browser evidence.',
                'assembly': assembly, 'accepted_baseline': baseline,
                'excluded': ['ZIP archives', '__pycache__, .git, node_modules', '*.log, *.tmp, *.pyc', 'previous package manifest and package record'],
                'files': [{'path': name, 'bytes': len(raw), 'sha256': sha256(raw).hexdigest()} for name, raw in sorted(contents.items())]}
    manifest_raw = json_bytes(manifest)
    buffer = io.BytesIO()
    with ZipFile(buffer, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name, raw in sorted({**contents, 'package_manifest.json': manifest_raw}.items()):
            info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, raw, compress_type=ZIP_DEFLATED, compresslevel=9)
    zipped = buffer.getvalue()
    with ZipFile(io.BytesIO(zipped)) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(contents) | {'package_manifest.json'}
        for name, raw in contents.items():
            assert archive.read(name) == raw
        assert archive.read('package_manifest.json') == manifest_raw
    for name, raw in contents.items():
        if (VISUALIZATION/name).read_bytes() != raw:
            raise ValueError('Package input changed: '+name)
    target = ROOT/'observatory-package.zip'
    target.write_bytes(zipped)
    (ROOT/'package_manifest.json').write_bytes(manifest_raw)
    record = {'zip': str(target), 'bytes': len(zipped), 'sha256': sha256(zipped).hexdigest(),
              'manifest_sha256': sha256(manifest_raw).hexdigest(), 'verified_files': len(contents),
              'html_sha256': assembly['sha256'], 'accepted_baseline_files_unchanged': baseline['verified_files']}
    (ROOT/'package_record.json').write_bytes(json_bytes(record))
    print(json.dumps(record, indent=2))


if __name__ == '__main__':
    main()
