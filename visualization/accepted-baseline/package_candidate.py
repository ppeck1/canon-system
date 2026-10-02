"""Deterministic portable releases; preserve old ZIPs and exclude work archives."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import argparse
import io
import json
import os
import re
from test_build_consistency import check_build

ROOT = Path(__file__).resolve().parent
EXCLUDED_FILES = {'manifest.json', 'integration-candidate.zip', 'setup_integration.py', 'wire_interface.py'}
EXCLUDED_DIRECTORIES = {'releases', '__pycache__', '.git', 'node_modules'}

def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False)+'\n').encode('utf-8')

def package_paths():
    paths = []
    for directory, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRECTORIES and not d.startswith(('before_multiview_', '.')))
        for name in sorted(files):
            path = Path(directory) / name
            if name in EXCLUDED_FILES or path.suffix.lower() in {'.zip', '.pyc', '.tmp', '.log'}:
                continue
            if name.startswith(('setup_', 'wire_')) and path.suffix == '.py':
                continue
            if path.is_symlink():
                raise ValueError('Release inputs must not be symbolic links: '+str(path))
            paths.append(path)
    return sorted(paths, key=lambda p: p.relative_to(ROOT).as_posix())

def write_once(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError('Immutable release differs; choose a new --release-label: '+str(path))
    else:
        path.write_bytes(data)

def preserve_previous():
    previous = ROOT / 'integration-candidate.zip'
    if not previous.exists():
        return None
    data = previous.read_bytes()
    directory = ROOT / 'releases' / ('previous-candidate-'+sha256(data).hexdigest()[:12])
    write_once(directory / previous.name, data)
    manifest = ROOT / 'manifest.json'
    if manifest.exists():
        write_once(directory / manifest.name, manifest.read_bytes())
    return directory.relative_to(ROOT).as_posix()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--release-label', default='baseline-multiview-20261002')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._-]*', args.release_label):
        raise ValueError('Release label must be one safe directory name')
    assembly = check_build()
    contents = {p.relative_to(ROOT).as_posix(): p.read_bytes() for p in package_paths()}
    source_bundle = json.loads(contents['data/bundle.json'])
    pattern = re.compile(r'\b(version|VERSION|mappingVersion|kernelVersion|encodingVersion)\s*=\s*([\'\"])([^\'\"]+)\2')
    versions = {name: {m[0]: m[2] for m in pattern.findall(data.decode('utf-8'))}
                for name, data in contents.items() if '/' not in name and name.endswith('.js') and not name.startswith('test_')}
    manifest = {'artifact': 'bounded-linked-instruments-release/1', 'release_label': args.release_label,
                'entrypoint': 'index.html', 'offline': True,
                'scope': 'Current linked instruments and separate synthetic timescale calibration; no core/data change.',
                'assembly': assembly, 'source_revisions': {'authored_facts_sha256': source_bundle['source']['sha256'],
                    'retained_bundle_sha256': sha256(contents['data/bundle.json']).hexdigest(),
                    'simulated_record_producer_sha256': source_bundle['metadata']['behavior_copy_sha256']},
                'source_version_declarations': versions,
                'package_exclusions': ['before_multiview_* directories', 'releases directory', 'all ZIP archives', 'transient setup_*/wire_* scripts', '__pycache__, .git, node_modules and dot directories', 'temporary/log/bytecode files'],
                'verification_scope': 'Packaged hashes and exact executable assembly verified. Each test/browser report retains its own documented scope; historical screenshots are not a new browser run.',
                'files': [{'path': name, 'bytes': len(data), 'sha256': sha256(data).hexdigest()} for name, data in contents.items()]}
    manifest_bytes = json_bytes(manifest)
    memory = io.BytesIO()
    with ZipFile(memory, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in list(contents.items())+[('manifest.json', manifest_bytes)]:
            info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data, compress_type=ZIP_DEFLATED, compresslevel=9)
    zipped = memory.getvalue()
    with ZipFile(io.BytesIO(zipped)) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(contents) | {'manifest.json'}
        for name, data in contents.items():
            assert archive.read(name) == data
        assert archive.read('manifest.json') == manifest_bytes
    for name, data in contents.items():
        if (ROOT / name).read_bytes() != data:
            raise ValueError('Release input changed while packaging: '+name)
    release = ROOT / 'releases' / args.release_label
    write_once(release / 'integration-candidate.zip', zipped)
    write_once(release / 'manifest.json', manifest_bytes)
    previous_archive = preserve_previous()
    (ROOT / 'manifest.json').write_bytes(manifest_bytes)
    (ROOT / 'integration-candidate.zip').write_bytes(zipped)
    record = {'release_label': args.release_label, 'zip': str(release / 'integration-candidate.zip'),
              'sha256': sha256(zipped).hexdigest(), 'bytes': len(zipped), 'verified_files': len(contents),
              'manifest_sha256': sha256(manifest_bytes).hexdigest(), 'html_sha256': assembly['html_sha256'],
              'exact_assembly': True, 'previous_package_preserved': previous_archive}
    (release / 'release_record.json').write_bytes(json_bytes(record))
    print(json.dumps(record, indent=2))

if __name__ == '__main__':
    main()
