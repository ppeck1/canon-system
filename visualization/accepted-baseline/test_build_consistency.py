"""Verify current offline HTML against the real assembler, without writing HTML."""
from pathlib import Path
from hashlib import sha256
from unittest.mock import patch
from contextlib import redirect_stdout
import importlib.util
import io
import json
import tempfile

ROOT = Path(__file__).resolve().parent


def check_newline_policy(module):
    """Exercise real assembly and output using LF, CRLF, and CR code copies."""
    expected = module.assemble_bytes(ROOT)
    assert b'\r' not in expected, 'Offline HTML must contain only LF line endings'
    assert not expected.startswith(b'\xef\xbb\xbf'), 'Offline HTML must not have a UTF-8 BOM'
    original_bundle = (ROOT / 'data/bundle.json').read_bytes()
    original_revision = sha256(original_bundle).hexdigest().encode('ascii')
    assert original_revision in expected, 'Expected raw evidence revision is missing'
    source_bytes = {name: (ROOT / name).read_bytes() for name in module.TEXT_INPUTS}
    verified = []
    with tempfile.TemporaryDirectory(prefix='canon-assembly-newlines-') as temporary:
        root = Path(temporary)
        (root / 'data').mkdir()
        (root / 'data/bundle.json').write_bytes(original_bundle)
        for name, ending in [('LF', '\n'), ('CRLF', '\r\n'), ('CR', '\r')]:
            for filename, raw in source_bytes.items():
                normalized = raw.decode('utf-8').replace('\r\n', '\n').replace('\r', '\n')
                (root / filename).write_bytes(normalized.replace('\n', ending).encode('utf-8'))
            inputs = {p: p.read_bytes() for p in root.rglob('*') if p.is_file() and p.name != 'index.html'}
            # A binary-only write path is independent of every OS's text-mode
            # newline translation. Fail if main() returns to write_text().
            with patch.object(module, 'ROOT', root), patch.object(Path, 'write_text', side_effect=AssertionError('Assembler must emit binary UTF-8 bytes')), redirect_stdout(io.StringIO()):
                module.main()
            assert (root / 'index.html').read_bytes() == expected, name+' source line endings changed HTML bytes'
            assert all(p.read_bytes() == raw for p, raw in inputs.items()), 'Assembler modified its inputs'
            verified.append(name)
        # Evidence has its own raw-byte revision: do not normalize it to hide
        # source changes. JSON values (including escaped native CR/LF) survive.
        evidence = {'native_value': 'first\r\nsecond\rthird\nfourth', 'unit': 'jobs', 'missing': None}
        for ending in ('\n', '\r\n'):
            raw = (json.dumps(evidence, indent=2)+'\n').replace('\n', ending).encode('utf-8')
            (root / 'data/bundle.json').write_bytes(raw)
            assembled = module.assemble_bytes(root)
            assert sha256(raw).hexdigest().encode('ascii') in assembled, 'Raw evidence revision was normalized'
            escaped = json.dumps(evidence, ensure_ascii=True, separators=(',', ':')).encode('utf-8')
            assert escaped in assembled, 'Native JSON field values changed during assembly'
            assert (root / 'data/bundle.json').read_bytes() == raw, 'Evidence bytes were changed'
    assert (ROOT / 'data/bundle.json').read_bytes() == original_bundle
    return {'passed': True, 'code_input_line_endings': verified,
            'identical_html_bytes_and_sha256': True, 'output': 'binary UTF-8, LF only, no BOM',
            'evidence_raw_bytes_and_revision_preserved': True, 'native_JSON_CR_LF_values_preserved': True}


def check_build():
    spec = importlib.util.spec_from_file_location('_candidate_assembler_check', ROOT / 'build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    output = ROOT / 'index.html'
    original_read_bytes = Path.read_bytes
    inputs, planned = {}, []
    def remember(path):
        path = Path(path).resolve()
        if path != output.resolve():
            inputs[path] = original_read_bytes(path)
    def read_bytes(path):
        remember(path)
        return original_read_bytes(path)
    def capture_write(path, content):
        if Path(path).resolve() != output.resolve():
            raise AssertionError('Unexpected assembler output: '+str(path))
        assert isinstance(content, bytes), 'Assembler must emit bytes'
        planned.append(content)
        return len(content)
    before = output.read_bytes()
    with patch.object(Path, 'read_bytes', read_bytes), patch.object(Path, 'write_bytes', capture_write), patch.object(Path, 'write_text', side_effect=AssertionError('Assembler must emit binary UTF-8 bytes')), redirect_stdout(io.StringIO()):
        module.main()
    assert len(planned) == 1, 'Expected one offline HTML output'
    assert planned[0] == before, 'index.html differs from current assembler/source modules; rebuild before packaging'
    assert output.read_bytes() == before, 'Consistency check changed executable bytes'
    for path, data in inputs.items():
        assert path.read_bytes() == data, 'Assembly input changed during verification: '+str(path)
    return {'passed': True, 'scope': 'Exact bytes from the actual assembler, with output writes intercepted; source and HTML unchanged.',
            'entrypoint': 'index.html', 'html_bytes': len(before), 'html_sha256': sha256(before).hexdigest(),
            'newline_policy': module.NEWLINE_POLICY, 'newline_checks': check_newline_policy(module),
            'assembler_sha256': sha256((ROOT / 'build.py').read_bytes()).hexdigest(),
            'assembly_inputs': [{'path': p.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': sha256(data).hexdigest()} for p, data in inputs.items()]}


if __name__ == '__main__':
    result = check_build()
    (ROOT / 'build_consistency_checks.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
