"""Bounded release-gate tests using synthetic files, never browser evidence."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile
import base64
import copy
import io
import json
import tempfile
import unittest
import package

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=')


class PackageContract(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='observatory-package-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)/'observatory'
        self.root.mkdir()
        for name, raw in {'shell.html': b'<html>template</html>\n', 'build.py': b'pass\n',
                          'model.js': b'const x = 1;\n', 'extension.js': b'const y = 2;\n',
                          'index.html': b'<html>unit test only</html>\n', 'data/source.json': b'{"native":"a"}\r\n',
                          'cross-system/run.py': b'x = 1\n', 'cross-system/snapshot/facts.json': b'{"id":1}\n',
                          'cross-system/frozen-1555697.zip': b'native oracle archive unit fixture',
                          'browser-evidence/current/test.png': PNG, 'browser-evidence/old.png': PNG+b'old',
                          'previous_release/old.txt': b'old release', 'server.log': b'transient'}.items():
            self.write(name, raw)
        self.sources = {'oscillator': {'sha256': 'a'*64}}
        self.extensions = {'local_signal': {'sha256': 'b'*64}, 'transfer': {'sha256': 'c'*64}}
        self.html_hash = sha256((self.root/'index.html').read_bytes()).hexdigest()
        self.receipt = {'version': 'observatory-release-capture/1', 'release_id': 'unit-fixture-only',
                        'entrypoint': 'index.html', 'html_sha256': self.html_hash,
                        'source_version': package.source_identity(self.root)['source_version'],
                        'sources': self.sources, 'extension_sources': self.extensions,
                        'captures': [{'id': 'test', 'path': 'browser-evidence/current/test.png',
                                      'sha256': sha256(PNG).hexdigest(), 'source_id': 'local_signal',
                                      'source_sha256': 'b'*64, 'html_sha256': self.html_hash,
                                      'captured_utc': '2026-10-03T12:00:00Z',
                                      'caption': 'Synthetic unit-test fixture; not actual browser evidence.'}], 'artifacts': []}
        self.save_receipt()

    def write(self, relative, raw):
        path = self.root/relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)

    def save_receipt(self):
        self.write(package.CAPTURE_PATH, package.json_bytes(self.receipt))

    def validate(self):
        return package.validate_capture(self.root, self.html_hash, self.sources, extension_sources=self.extensions)

    def test_matching_current_receipt_accepts_dynamic_extension_source(self):
        value, files = self.validate()
        self.assertEqual(value['source_version'], package.source_identity(self.root)['source_version'])
        self.assertEqual(set(files), {package.CAPTURE_PATH, 'browser-evidence/current/test.png'})

    def test_stale_html_source_revision_and_fingerprint_rejected(self):
        original = copy.deepcopy(self.receipt)
        for field, value in [('html_sha256', '0'*64), ('source_version', 'sha256:'+'0'*64),
                             ('sources', {'oscillator': {'sha256': '0'*64}}), ('extension_sources', {})]:
            self.receipt = copy.deepcopy(original)
            self.receipt[field] = value
            self.save_receipt()
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.validate()

    def test_wrong_screenshot_content_source_and_unqualified_time_rejected(self):
        original = copy.deepcopy(self.receipt)
        for field, value in [('sha256', '0'*64), ('source_id', 'invented'), ('source_sha256', '0'*64),
                             ('captured_utc', '2026-10-03T12:00:00'), ('html_sha256', '0'*64)]:
            self.receipt = copy.deepcopy(original)
            self.receipt['captures'][0][field] = value
            self.save_receipt()
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.validate()

    def test_legacy_evidence_and_path_escape_are_not_packaged_as_current(self):
        for path in ('browser-evidence/old.png', 'browser-evidence/current/../old.png', '/outside.png'):
            self.receipt['captures'][0]['path'] = path
            self.save_receipt()
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.validate()

    def test_saved_workspace_and_checks_have_matching_base_and_extension_sources(self):
        fixtures = [('session.json', 'saved_session', {'schema': 'observatory-workspace/2', 'base': {'sources': self.sources}, 'extensionSources': self.extensions}),
                    ('checks.json', 'browser_checks', {'html_sha256': self.html_hash, 'sources': self.sources, 'extension_sources': self.extensions})]
        for name, kind, value in fixtures:
            relative = 'browser-evidence/current/'+name
            raw = package.json_bytes(value)
            self.write(relative, raw)
            self.receipt['artifacts'] = [{'path': relative, 'sha256': sha256(raw).hexdigest(), 'kind': kind}]
            self.save_receipt()
            self.validate()
            value['extensionSources' if kind == 'saved_session' else 'extension_sources'] = {}
            raw = package.json_bytes(value)
            self.write(relative, raw)
            self.receipt['artifacts'][0]['sha256'] = sha256(raw).hexdigest()
            self.save_receipt()
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                self.validate()

    def test_source_identity_canonicalizes_code_but_preserves_raw_data_revisions(self):
        original = package.source_identity(self.root)
        for filename in ('model.js', 'cross-system/run.py'):
            path = self.root/filename
            path.write_bytes(path.read_bytes().replace(b'\n', b'\r\n'))
        self.assertEqual(original, package.source_identity(self.root))
        for filename in ('index.html', 'verification_checks.json', 'test_extra.js', 'cross-system/test_case.py', 'README.md', 'browser-evidence/new.png'):
            self.write(filename, b'ignored for source identity')
        self.assertEqual(original, package.source_identity(self.root))
        path = self.root/'cross-system/run.py'
        old = path.read_bytes()
        path.write_bytes(old+b'x += 1\n')
        self.assertNotEqual(original, package.source_identity(self.root))
        path.write_bytes(old)
        raw = self.root/'data/source.json'
        raw.write_bytes(raw.read_bytes().replace(b'\r\n', b'\n'))
        self.assertNotEqual(original, package.source_identity(self.root))

    def test_observatory_archive_excludes_baseline_and_previous_evidence_without_deleting(self):
        sibling = self.root.parent/'accepted-baseline/index.html'
        sibling.parent.mkdir()
        sibling.write_bytes(b'accepted untouched')
        receipt, evidence = self.validate()
        contents = package.collect_contents(self.root, evidence)
        self.assertIn('index.html', contents)
        self.assertIn('cross-system/snapshot/facts.json', contents)
        self.assertIn('cross-system/frozen-1555697.zip', contents)
        self.assertTrue(any(item['path']=='cross-system/frozen-1555697.zip' and item['fingerprint_policy']==package.RAW_POLICY
                            for item in package.source_identity(self.root)['inputs']))
        self.assertNotIn('browser-evidence/old.png', contents)
        self.assertNotIn('previous_release/old.txt', contents)
        self.assertNotIn('server.log', contents)
        self.assertFalse(any(name.startswith('accepted-baseline/') for name in contents))
        manifest = {'version': 'unit-test', 'entrypoint': 'index.html', 'release_id': receipt['release_id']}
        a, _ = package.archive_bytes(contents, manifest)
        b, _ = package.archive_bytes(contents, manifest)
        self.assertEqual(a, b)
        with ZipFile(io.BytesIO(a)) as archive:
            self.assertIn('index.html', archive.namelist())
            self.assertTrue(all(info.date_time == (1980, 1, 1, 0, 0, 0) for info in archive.infolist()))
        self.assertEqual(sibling.read_bytes(), b'accepted untouched')
        self.assertTrue((self.root/'browser-evidence/old.png').exists())

    def test_previous_target_zip_is_preserved_byte_for_byte(self):
        target = self.root/'observatory-package.zip'
        raw = b'previous release archive fixture'
        target.write_bytes(raw)
        previous = package.preserve_previous(self.root, target)
        self.assertEqual((self.root/previous).read_bytes(), raw)
        self.assertEqual(package.preserve_previous(self.root, target), previous)
        self.assertEqual(target.read_bytes(), raw)


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(PackageContract)
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    print(json.dumps({'passed': result.wasSuccessful(), 'checks': result.testsRun,
                      'scope': 'Release gate and archive contracts against synthetic temporary fixtures, not application/browser behavior.'}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
