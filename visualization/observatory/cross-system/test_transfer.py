"""Contracts for the actual selectors and recorded independent executable runs."""
from copy import deepcopy
from pathlib import Path
from zipfile import ZipFile
import json
import unittest

import mechanism
import native

ROOT = Path(__file__).resolve().parent


class TransferContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = json.loads((ROOT.parent/'data'/'transfer.json').read_bytes())

    def test_queue_identity_capacity_boundary(self):
        rows = [self.result['source']['selected'], *self.result['source']['boundary_cases']]
        for row in rows:
            expected = {key: value['success'] for key, value in row['nativeOutcomes'].items()}
            for actual in (mechanism.select(mechanism.queue_graph(row['facts'])), native.queue(row['facts'])):
                self.assertEqual({item['id']: item['feasible'] for item in actual['actions']}, expected)
        by_case = {row['case_id']: row for row in rows}
        self.assertEqual(by_case['T4M6']['decisions']['role']['choice'], 'A')
        self.assertIsNone(by_case['H9C3']['decisions']['role']['choice'])
        self.assertEqual(by_case['B2R8']['decisions']['role']['choice'], 'C')

    def test_actual_target_oracle_agreement(self):
        for case in self.result['cases']:
            facts = case['facts']
            for actual in (mechanism.select(mechanism.release_graph(facts)), native.release(facts)):
                self.assertEqual(actual['choice'], case['oracle_choice'])
                predictions = {item['id']: item['feasible'] for item in actual['actions']}
                for action in case['actions']:
                    self.assertEqual(predictions[action['id']], action['run']['success'])
                    if action['run']['success']:
                        self.assertTrue(action['run']['archive']['valid'])
                        self.assertEqual(action['run']['commands'][-1]['exit_code'], 0)

    def test_paused_replay_and_beyond_deadline_against_frozen_queue_oracle(self):
        import importlib.util
        path = ROOT/'oracle'/'queue'/'behavior.py'
        spec = importlib.util.spec_from_file_location('frozen_paused_queue', path)
        oracle = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(oracle)
        for pause in (0, 1, 3, 4):
            case = deepcopy(self.result['source']['selected']['facts'])
            for action in case['actions']:
                action['parameters']['pause_ticks'] = pause
            expected = {action['id']: oracle.queue_world(case, action, 1)['success'] for action in case['actions']}
            for result in (mechanism.select(mechanism.queue_graph(case)), native.queue(case)):
                self.assertEqual({row['id']: row['feasible'] for row in result['actions']}, expected)

    def test_labels_and_action_order_are_not_diagnoses(self):
        for case in self.result['cases']:
            facts = deepcopy(case['facts'])
            aliases = {action['id']: 'opaque-'+str(i) for i, action in enumerate(facts['actions'])}
            for action in facts['actions']:
                action['id'] = aliases[action['id']]
                action['label'] = 'unhelpful surface resemblance'
            facts['actions'].reverse()
            expected = aliases.get(case['oracle_choice'])
            self.assertEqual(mechanism.select(mechanism.release_graph(facts))['choice'], expected)
            self.assertEqual(native.release(facts)['choice'], expected)

    def test_stale_receipt_is_rejected_without_supplied_rejection_flag(self):
        case = next(row for row in self.result['cases'] if row['id'] == 'P7Q2')
        facts = deepcopy(case['facts'])
        name = next(iter(facts['retained_receipt']['content']['input_fingerprints']))
        facts['retained_receipt']['content']['input_fingerprints'][name]['sha256'] = '0'*64
        restoration = next(row['id'] for row in facts['actions'] if row['operation'] == 'restore_retained_receipt')
        for result in (mechanism.select(mechanism.release_graph(facts)), native.release(facts)):
            self.assertFalse(next(row['feasible'] for row in result['actions'] if row['id'] == restoration))

    def test_failed_and_absent_retained_receipts_are_not_compatible(self):
        original = next(row for row in self.result['cases'] if row['id'] == 'P7Q2')['facts']
        for variant in ('failed', 'absent', 'invalid-json'):
            facts = deepcopy(original)
            if variant == 'failed':
                facts['retained_receipt']['content']['passed'] = False
            elif variant == 'absent':
                facts['retained_receipt']['exists'] = False
            else:
                facts['retained_receipt']['parse_error'] = 'invalid JSON'
            restoration = next(row['id'] for row in facts['actions'] if row['operation'] == 'restore_retained_receipt')
            for result in (mechanism.select(mechanism.release_graph(facts)), native.release(facts)):
                self.assertFalse(next(row['feasible'] for row in result['actions'] if row['id'] == restoration))

    def test_independent_constraint_is_not_erased_by_compatible_receipt(self):
        facts = deepcopy(next(row for row in self.result['cases'] if row['id'] == 'P7Q2')['facts'])
        facts['package_constraints'][0]['observed']['sha256'] = 'f'*64
        # This is a model falsification probe, not a fabricated oracle receipt run.
        for result in (mechanism.select(mechanism.release_graph(facts)), native.release(facts)):
            self.assertIsNone(result['choice'])
            self.assertTrue(all(not row['feasible'] for row in result['actions']))

    def test_method_inputs_contain_no_outcome_flags(self):
        forbidden = {'success', 'feasible', 'oracle_choice', 'intended_diagnosis', 'transfer_verdict', 'rejection_flag'}
        def visit(value):
            if isinstance(value, dict):
                self.assertFalse(set(value) & forbidden)
                for key, item in value.items():
                    # The genuine prior report includes prior test results, not
                    # target action labels. Retain that evidence verbatim.
                    if key != 'content':
                        visit(item)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
        for case in self.result['cases']:
            visit(case['facts'])

    def test_frozen_code_and_preservation(self):
        from hashlib import sha256
        manifest = self.result['target']['bundle']
        raw = (ROOT/'frozen-1555697.zip').read_bytes()
        self.assertEqual(sha256(raw).hexdigest(), manifest['bundle']['sha256'])
        with ZipFile(ROOT/'frozen-1555697.zip') as archive:
            for name, fingerprint in manifest['oracle_files'].items():
                actual = archive.read(name)
                self.assertEqual(sha256(actual).hexdigest(), fingerprint['sha256'])
                self.assertEqual(len(actual), fingerprint['bytes'])
                directory = 'queue' if '/data/sources/' in name else 'release'
                self.assertEqual((ROOT/'oracle'/directory/Path(name).name).read_bytes(), actual)
        self.assertTrue(all(self.result['preservation'].values()))

    def test_recorded_predictions_are_tied_to_current_methods_and_protocol(self):
        from hashlib import sha256
        commit = self.result['decision_commit']
        self.assertEqual(json.loads((ROOT/'prediction_digest.json').read_bytes()), commit)
        predictions = [{key: case[key] for key in ('id', 'facts', 'roleGraph', 'decisions', 'timing_ms')}
                       for case in self.result['cases']]
        raw = json.dumps(predictions, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        self.assertEqual(sha256(raw).hexdigest(), commit['sha256'])
        for name, fingerprint in commit['method_source_hashes'].items():
            self.assertEqual(sha256((ROOT/name).read_bytes()).hexdigest(), fingerprint['sha256'])
        self.assertEqual(sha256((ROOT/'protocol.json').read_bytes()).hexdigest(), commit['case_protocol_sha256'])
        for record in self.result['effort']['implementation']:
            self.assertEqual(sha256((ROOT/record['path']).read_bytes()).hexdigest(), record['sha256'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
