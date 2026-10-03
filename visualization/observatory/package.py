"""Release the observatory separately, gated by matching browser capture evidence.

Run final browser QA, write browser-evidence/release-capture.json, then run
verify.py and this script. The accepted completion baseline stays separate.
"""
from pathlib import Path, PurePosixPath
from hashlib import sha256
from datetime import datetime
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import io
import json
import os
import re
import build
import verify

ROOT = Path(__file__).resolve().parent
CAPTURE_PATH = 'browser-evidence/release-capture.json'
FROZEN_ORACLE_PATH = 'cross-system/frozen-1555697.zip'
EXCLUDE_FILES = {'package_manifest.json', 'package_record.json'}
EXCLUDE_DIRS = {'__pycache__', '.git', 'node_modules', 'previous_release', 'releases', 'browser-evidence'}
CODE_POLICY = 'UTF-8 decoded; CRLF/CR normalized to LF; UTF-8 encoded; no other rewriting'
RAW_POLICY = 'exact retained bytes'


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False)+'\n').encode('utf-8')


def canonical_json_bytes(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode('utf-8')


def source_identity(root=ROOT):
    """Content identity for executable/generation code and retained data.

    Reports, screenshots, generated HTML, tests and packaging outputs cannot
    recursively affect this identity. Code newline conventions are canonical;
    every data file remains a byte-level source revision.
    """
    root = Path(root)
    source_paths = {root/'shell.html', root/'build.py'}
    source_paths.update(path for path in root.glob('*.js') if not path.name.startswith('test_'))
    source_paths.update(root.glob('prepare_*.py'))
    cross = root/'cross-system'
    source_paths.update(path for path in cross.rglob('*') if path.is_file() and path.suffix in ('.js', '.py')
                        and not path.name.startswith('test_') and '__pycache__' not in path.parts)
    data_paths = {path for path in (root/'data').rglob('*') if path.is_file()}
    if (root/FROZEN_ORACLE_PATH).is_file():
        data_paths.add(root/FROZEN_ORACLE_PATH)
    data_paths.update(path for path in (cross/'snapshot').rglob('*') if path.is_file() and path.suffix not in ('.py', '.js', '.pyc')
                      and '__pycache__' not in path.parts)
    inputs = []
    for path in sorted(source_paths | data_paths, key=lambda p: p.relative_to(root).as_posix()):
        if path.is_symlink():
            raise ValueError('Source inputs must not be symbolic links: '+str(path))
        raw = path.read_bytes()
        is_data = path in data_paths
        content = raw if is_data else raw.decode('utf-8').replace('\r\n', '\n').replace('\r', '\n').encode('utf-8')
        inputs.append({'path': path.relative_to(root).as_posix(), 'bytes': len(content),
                       'sha256': sha256(content).hexdigest(), 'fingerprint_policy': RAW_POLICY if is_data else CODE_POLICY})
    value = {'version': 'observatory-source-identity/1', 'inputs': inputs}
    return {**value, 'source_version': 'sha256:'+sha256(canonical_json_bytes(value)).hexdigest()}


def safe_file(root, relative):
    if not isinstance(relative, str) or '\\' in relative:
        raise ValueError('Release paths must be relative POSIX paths')
    path = PurePosixPath(relative)
    if path.is_absolute() or '..' in path.parts or path.as_posix() != relative or not path.parts:
        raise ValueError('Unsafe release path: '+relative)
    root = Path(root).resolve()
    resolved = (root/relative).resolve()
    if not resolved.is_relative_to(root) or not resolved.is_file():
        raise ValueError('Release artifact is missing or outside observatory: '+relative)
    if any((root/Path(*path.parts[:i])).is_symlink() for i in range(1, len(path.parts)+1)):
        raise ValueError('Release artifact must not use symbolic links: '+relative)
    return resolved


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_artifact(root, item, paths):
    relative = item.get('path')
    require(isinstance(relative, str) and relative.startswith('browser-evidence/current/'),
            'Current evidence must be under browser-evidence/current/')
    require(relative not in paths, 'Duplicate release evidence path: '+relative)
    path = safe_file(root, relative)
    raw = path.read_bytes()
    require(item.get('sha256') == sha256(raw).hexdigest(), 'Evidence fingerprint disagrees: '+relative)
    paths[relative] = raw
    return raw


def validate_capture(root, html_sha256, sources, identity=None, extension_sources=None):
    """Validate declared browser-evidence identity, not perceptual quality."""
    root = Path(root)
    identity = source_identity(root) if identity is None else identity
    extension_sources = {} if extension_sources is None else extension_sources
    require(not sources.keys() & extension_sources.keys(), 'Base and extension source IDs must remain distinct')
    all_sources = {**sources, **extension_sources}
    receipt_raw = safe_file(root, CAPTURE_PATH).read_bytes()
    receipt = json.loads(receipt_raw)
    require(receipt.get('version') == 'observatory-release-capture/1', 'Unsupported browser release receipt')
    require(isinstance(receipt.get('release_id'), str) and re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._-]*', receipt['release_id']), 'Unsafe release_id')
    require(receipt.get('entrypoint') == 'index.html', 'Capture entrypoint must be the standalone observatory index.html')
    require(receipt.get('html_sha256') == html_sha256, 'Browser capture belongs to another HTML build')
    require(receipt.get('source_version') == identity['source_version'], 'Browser capture belongs to another source revision')
    require(receipt.get('sources') == sources, 'Browser capture source fingerprints disagree with current build')
    require(receipt.get('extension_sources', {}) == extension_sources, 'Browser capture extension source fingerprints disagree with current build')
    captures = receipt.get('captures')
    require(isinstance(captures, list) and captures, 'At least one actual browser screenshot is required')
    paths, identifiers = {CAPTURE_PATH: receipt_raw}, set()
    for item in captures:
        require(isinstance(item, dict), 'Each browser capture must be an object')
        identifier = item.get('id')
        require(isinstance(identifier, str) and identifier and identifier not in identifiers, 'Capture IDs must be unique nonempty strings')
        identifiers.add(identifier)
        require(item.get('html_sha256') == html_sha256, 'Screenshot belongs to another HTML build: '+identifier)
        source_id = item.get('source_id')
        require(isinstance(source_id, str) and source_id in all_sources, 'Screenshot source_id is absent from the build: '+str(source_id))
        require(item.get('source_sha256') == all_sources[source_id]['sha256'], 'Screenshot source fingerprint disagrees: '+identifier)
        require(isinstance(item.get('captured_utc'), str), 'Capture needs an ISO timestamp with timezone: '+identifier)
        try:
            captured = datetime.fromisoformat(item.get('captured_utc', '').replace('Z', '+00:00'))
        except (ValueError, TypeError):
            raise ValueError('Capture needs an ISO timestamp with timezone: '+identifier) from None
        require(captured.tzinfo is not None and captured.utcoffset() is not None, 'Capture timestamp needs timezone: '+identifier)
        require(isinstance(item.get('caption'), str) and item['caption'].strip(), 'Capture needs a concise caption: '+identifier)
        raw = check_artifact(root, item, paths)
        suffix = Path(item['path']).suffix.lower()
        image_matches = (suffix == '.png' and raw.startswith(b'\x89PNG\r\n\x1a\n')) or (suffix in ('.jpg', '.jpeg') and raw.startswith(b'\xff\xd8\xff') and raw.endswith(b'\xff\xd9'))
        require(image_matches, 'Capture extension must match PNG or JPEG browser screenshot bytes: '+identifier)
    artifacts = receipt.get('artifacts', [])
    require(isinstance(artifacts, list), 'Evidence artifacts must be a list')
    for item in artifacts:
        require(isinstance(item, dict), 'Evidence artifact must be an object')
        kind = item.get('kind')
        require(kind in ('browser_checks', 'saved_session', 'notes'), 'Unsupported current evidence artifact kind')
        raw = check_artifact(root, item, paths)
        if kind in ('browser_checks', 'saved_session'):
            evidence = json.loads(raw)
            wrapper = kind == 'saved_session' and evidence.get('schema') == 'observatory-workspace/2'
            packet = evidence.get('base', {}) if wrapper else evidence
            require(packet.get('sources') == sources, 'Current evidence contains stale source fingerprints: '+item['path'])
            if wrapper:
                require(evidence.get('extensionSources') == extension_sources, 'Saved workspace contains stale extension source fingerprints')
            if kind == 'browser_checks':
                require(evidence.get('html_sha256') == html_sha256, 'Browser checks belong to another HTML build')
                require(evidence.get('extension_sources', {}) == extension_sources, 'Browser checks contain stale extension source fingerprints')
    return receipt, paths


def collect_contents(root, current_evidence):
    """Select only observatory files and explicitly listed current QA evidence."""
    root = Path(root)
    contents = {}
    for directory, dirs, files in os.walk(root):
        dirs[:] = sorted(name for name in dirs if name not in EXCLUDE_DIRS and not name.startswith(('stage-', 'tmp-')))
        for filename in sorted(files):
            path = Path(directory)/filename
            if filename in EXCLUDE_FILES or (path.suffix.lower() in ('.zip', '.log', '.tmp', '.pyc')
                                            and path.relative_to(root).as_posix() != FROZEN_ORACLE_PATH):
                continue
            if path.is_symlink():
                raise ValueError('Package inputs must not be symbolic links: '+str(path))
            contents[path.relative_to(root).as_posix()] = path.read_bytes()
    contents.update(current_evidence)
    return contents


def archive_bytes(contents, manifest):
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
        require(archive.testzip() is None, 'Archive CRC verification failed')
        require(set(archive.namelist()) == set(contents) | {'package_manifest.json'}, 'Archive entries disagree')
        for name, raw in contents.items():
            require(archive.read(name) == raw, 'Archive entry differs: '+name)
        require(archive.read('package_manifest.json') == manifest_raw, 'Archive manifest differs')
    return zipped, manifest_raw


def preserve_previous(root, target):
    if not target.exists():
        return None
    raw = target.read_bytes()
    previous = root/'previous_release'/('observatory-'+sha256(raw).hexdigest()+'.zip')
    previous.parent.mkdir(parents=True, exist_ok=True)
    if previous.exists():
        require(previous.read_bytes() == raw, 'Previous-release archive fingerprint collision')
    else:
        previous.write_bytes(raw)
    return previous.relative_to(root).as_posix()


def main():
    report = json.loads((ROOT/'verification_checks.json').read_bytes())
    if not report.get('passed') or report['input_fingerprints'] != verify.input_snapshot():
        raise ValueError('Verification report does not match current inputs; run verify.py after final browser evidence and documentation')
    assembly, baseline = verify.assembly_check(), verify.baseline_check()
    identity = source_identity(ROOT)
    embedded = build.embedded_data(ROOT)
    sources, extension_sources = embedded['sources'], embedded.get('extensionSources', {})
    capture, evidence = validate_capture(ROOT, assembly['sha256'], sources, identity, extension_sources)
    contents = collect_contents(ROOT, evidence)
    manifest = {'version': 'observatory-portable-package/2', 'release_id': capture['release_id'],
                'entrypoint': 'index.html', 'offline': True,
                'scope': 'Observatory only: current executable, source modules, retained data, tests, documentation and explicitly bound current browser evidence.',
                'source_identity': identity, 'sources': sources, 'extension_sources': extension_sources, 'assembly': assembly,
                'browser_capture': {'path': CAPTURE_PATH, 'sha256': sha256(evidence[CAPTURE_PATH]).hexdigest(),
                                    'screenshots': len(capture['captures']), 'html_sha256': capture['html_sha256'],
                                    'source_version': capture['source_version'],
                                    'validation_scope': 'Hashes and declared HTML/source association are verified. This is not independent proof of screenshot usability, audible output, or every application behavior.'},
                'accepted_completion_reference': {**baseline, 'bundled': False,
                                                  'expected_sibling_entrypoint': '../accepted-baseline/index.html',
                                                  'status': 'Separate accepted completion baseline; unchanged and not relabeled as this observatory release.'},
                'excluded': ['Accepted baseline and other visualization directories', 'Prior/unlisted browser evidence (retained on disk)',
                             'previous_release and releases directories', 'ZIP archives except declared cross-system/frozen-1555697.zip native oracle', '__pycache__, .git, node_modules',
                             '*.log, *.tmp, *.pyc and stage-/tmp- directories', 'previous package manifest and package record'],
                'files': [{'path': name, 'bytes': len(raw), 'sha256': sha256(raw).hexdigest()} for name, raw in sorted(contents.items())]}
    zipped, manifest_raw = archive_bytes(contents, manifest)
    for name, raw in contents.items():
        if safe_file(ROOT, name).read_bytes() != raw:
            raise ValueError('Package input changed: '+name)
    require(source_identity(ROOT) == identity, 'Source revision changed during packaging')
    target = ROOT/'observatory-package.zip'
    previous = preserve_previous(ROOT, target)
    target.write_bytes(zipped)
    (ROOT/'package_manifest.json').write_bytes(manifest_raw)
    record = {'zip': str(target), 'release_id': capture['release_id'], 'entrypoint': 'index.html',
              'bytes': len(zipped), 'sha256': sha256(zipped).hexdigest(),
              'manifest_sha256': sha256(manifest_raw).hexdigest(), 'verified_files': len(contents),
              'html_sha256': assembly['sha256'], 'source_version': identity['source_version'],
              'browser_capture_sha256': sha256(evidence[CAPTURE_PATH]).hexdigest(),
              'accepted_baseline_bundled': False, 'accepted_baseline_files_unchanged': baseline['verified_files'],
              'previous_package_preserved': previous}
    (ROOT/'package_record.json').write_bytes(json_bytes(record))
    print(json.dumps(record, indent=2))


if __name__ == '__main__':
    main()
