"""Independent finite queue/sensor behavior oracle. Standard library only.

Run with --build to generate public/cases.json and private/answer_key.json.
Run with --check to verify the frozen files without changing them.
Fixture initial conditions and allowed actions are authored here. Correct choices
are computed by simulation and exact rational interval intersection, not stored
as intended diagnosis flags. No evaluated reasoner responses are read.
"""
from __future__ import annotations

from fractions import Fraction
from itertools import combinations
from pathlib import Path
import argparse
import hashlib
import json
import random

HERE = Path(__file__).resolve().parent


def f(value):
    return Fraction(str(value))


def action(key, cost, operation, **parameters):
    return {"_key": key, "cost_credits": cost, "operation": operation,
            "parameters": parameters}


def queue_case(case_id, required, pending, backups, rates, deadline, actions,
               proposed_key, claim):
    return {"case_id": case_id, "system": "finite_fifo_queue",
            "task": {"required_payload_ids": required,
                     "original_deadline_tick": deadline,
                     "objective": "Complete every required payload by the original deadline."},
            "facts": {"current_tick": 0, "tick_duration_seconds": 1,
                      "pending_fifo_payload_ids": pending,
                      "completed_payload_ids": [], "backup_payload_ids": backups,
                      "service_rate_possibilities_jobs_per_tick": rates,
                      "future_external_arrivals": [],
                      "job_service_requirement": "Every payload requires one job completion; jobs have equal unit size.",
                      "service_timing": "At the end of each integer tick, complete up to the active service rate of FIFO jobs. An action at tick 0 takes effect before tick 1.",
                      "backup_rule": "Replay appends each listed available backup not already pending/completed at tick 0. There are no other copies.",
                      "unknown_fact": "actual service rate" if len(rates) > 1 else None},
            "actions": actions,
            "proposed_transfer": {"claim": claim, "_action_key": proposed_key}}


def sample(sample_id, gain, available, error="0.025", acquired=0):
    return {"sample_id": sample_id, "gain": str(gain),
            "acquired_at_ms": acquired, "available_at_ms": available,
            "error_bound_v": str(error)}


def sensor_case(case_id, records, replay, deadline, actions, proposed_key, claim,
                amplitudes=("0.4", "0.8")):
    return {"case_id": case_id, "system": "finite_hypothesis_sensor_record",
            "task": {"original_deadline_ms": deadline,
                     "objective": "Recover the exact source-symbol label for every listed source hypothesis and every permitted measurement error by the original deadline."},
            "facts": {"current_time_ms": 0,
                      "source_hypotheses": [{"symbol": "H1", "amplitude_v": amplitudes[0]},
                                            {"symbol": "H2", "amplitude_v": amplitudes[1]}],
                      "sensor_lower_rail_v": "0", "sensor_upper_rail_v": "1",
                      "sample_equation": "y_j = clip(gain_j * amplitude, 0 V, 1 V) + e_j; |e_j| <= error_bound_v_j. Gains are dimensionless. Error is added after clipping.",
                      "error_contract": "Every combination of componentwise bounded errors is permitted. No probability law is supplied. Decimal strings denote exact rational values.",
                      "retained_or_in_transit_samples": records,
                      "source_replay_available": replay,
                      "replay_contract": "When available, replay reacquires the same unchanged source symbol using the action's new gain, acquisition time, delivery time, and error bound. It does not alter old samples.",
                      "software_scaling_contract": "Multiplying stored observations scales both signal and error intervals; it creates no new acquisition.",
                      "record_access_contract": "At the chosen decision time use all samples already available, unless selected_sample_ids is specified. No unlisted samples, side information, or alternate channel exist.",
                      "unknowns": "The symbol and realized bounded errors are unknown by task definition, not missing calibration facts that REQUEST_FACT can resolve. Record values are not supplied because the intervention must work for every permitted outcome."},
            "actions": actions,
            "proposed_transfer": {"claim": claim, "_action_key": proposed_key}}


def fixture_specs():
    q1 = queue_case("N7K4", ["p1", "p2", "p3", "p4", "p5"],
                    ["p1", "p2", "p3", "p4", "p5"], [], [2], 3,
                    [action("run", 0, "continue_service", pause_ticks=0),
                     action("boost", 3, "set_service_rate", jobs_per_tick=4, pause_ticks=0),
                     action("pause", 1, "continue_service", pause_ticks=1)], "run",
                    "Waiting can expose an intact delayed sensor record within its deadline. Transfer that strategy here by letting this retained queue run at its current service rate until its deadline.")
    q2 = queue_case("B2R8", ["k1", "k2", "k3", "k4", "k5", "k6", "k7"],
                    ["k1", "k2", "k3", "k4", "k5", "k6", "k7"], [], [2], 2,
                    [action("run", 0, "continue_service", pause_ticks=0),
                     action("boost", 3, "set_service_rate", jobs_per_tick=4, pause_ticks=0),
                     action("pause", 1, "continue_service", pause_ticks=1)], "run",
                    "An intact delayed sensor signal can become informative by waiting. Because these queued payloads are also intact, continuing at the current rate should finish the task by its original deadline.")
    q3 = queue_case("H9C3", ["r1", "r2", "r3", "r4"], ["r1", "r3", "r4"], [], [1], 4,
                    [action("run", 0, "continue_service", pause_ticks=0),
                     action("boost", 2, "set_service_rate", jobs_per_tick=4, pause_ticks=0),
                     action("replay", 1, "replay_available_backups", pause_ticks=0)], "boost",
                    "A stronger acquisition gain can separate weak sensor signals despite measurement error. Transfer that remedy by increasing queue service capacity, so every required payload is completed.")
    q4 = queue_case("T4M6", ["w1", "w2", "w3"], ["w1", "w3"], ["w2"], [1], 3,
                    [action("run", 0, "continue_service", pause_ticks=0),
                     action("replay", 2, "replay_available_backups", pause_ticks=0),
                     action("boost", 1, "set_service_rate", jobs_per_tick=3, pause_ticks=0)], "replay",
                    "Reacquiring a retained source can provide distinctions absent from an old sensor record. Transfer that strategy by replaying the available payload backup into this queue before service.")
    q5 = queue_case("D8V1", ["u1", "u2", "u3"], ["u1", "u2", "u3"], [], [0], 3,
                    [action("run", 0, "continue_service", pause_ticks=0),
                     action("activate", 4, "set_service_rate", jobs_per_tick=1, pause_ticks=0),
                     action("reorder", 1, "reverse_pending_fifo", pause_ticks=0)], "run",
                    "Waiting can make an intact in-transit sensor record available. The queue still retains all its payloads, so waiting at its present service setting should likewise achieve the task.")
    q6 = queue_case("P5J9", ["a1", "a2", "a3"], ["a1", "a2", "a3"], [], [0, 2], 2,
                    [action("run", 0, "continue_service", pause_ticks=0),
                     action("pause", 1, "continue_service", pause_ticks=1),
                     action("reorder", 2, "reverse_pending_fifo", pause_ticks=0)], "run",
                    "A delayed intact sensor record can be recovered by allowing its delivery to proceed. Transfer that strategy by allowing this retained queue to process at its existing service rate.")
    s1 = sensor_case("F3X7", [sample("s1", "5", 0, acquired=-1), sample("s2", "5", 0)], False, 2,
                     [action("read", 0, "use_record", decision_at_ms=0),
                      action("wait", 1, "use_record", decision_at_ms=2),
                      action("scale", 2, "scale_record", factor="0.2", decision_at_ms=0)], "wait",
                     "Waiting lets a lossless finite queue finish a backlog. Transfer that remedy by waiting before decoding this stored sensor record, without obtaining new samples.")
    s2 = sensor_case("L6A2", [sample("s1", "5", 0)], True, 3,
                     [action("read", 0, "use_record", decision_at_ms=0),
                      action("replay", 3, "replay_source", gain="1", acquired_at_ms=1,
                             available_at_ms=2, error_bound_v="0.025", decision_at_ms=2),
                      action("scale", 1, "scale_record", factor="0.2", decision_at_ms=0)], "replay",
                     "Replaying an available queue backup can restore a missing required payload. Transfer that strategy by reacquiring the still-available source at the listed lower gain rather than editing the old record.")
    s3 = sensor_case("R1W5", [sample("s1", "1", 0, acquired=-1), sample("s2", "5", 0)], False, 2,
                     [action("all", 0, "use_record", decision_at_ms=0),
                      action("latest", 1, "use_record", selected_sample_ids=["s2"], decision_at_ms=0),
                      action("wait", 2, "use_record", decision_at_ms=2)], "all",
                     "Retained queue payloads can remain usable despite a processing bottleneck. Transfer that preservation-based reasoning by using the complete retained sensor record, including its earlier sample, despite the later sample's rail limit.")
    s4 = sensor_case("C7U4", [sample("s1", "1", 3)], False, 4,
                     [action("read", 0, "use_record", decision_at_ms=0),
                      action("wait", 1, "use_record", decision_at_ms=3),
                      action("scale", 2, "scale_record", factor="2", decision_at_ms=0)], "wait",
                     "A retained finite queue can finish within an adequate deadline if progress continues. Transfer that timing strategy by waiting for this already-acquired record to arrive before decoding.")
    s5 = sensor_case("V9E6", [sample("s1", "1", 5)], False, 3,
                     [action("read", 0, "use_record", decision_at_ms=0),
                      action("wait", 1, "use_record", decision_at_ms=3),
                      action("scale", 2, "scale_record", factor="2", decision_at_ms=3)], "wait",
                     "An intact queue can eventually drain. Because this sensor sample is also intact, waiting until the original deadline should suffice to recover its source symbol.")
    s6 = sensor_case("J4G8", [sample("s1", "0.1", 0)], True, 3,
                     [action("read", 0, "use_record", decision_at_ms=0),
                      action("replay", 2, "replay_source", gain="1", acquired_at_ms=1,
                             available_at_ms=2, error_bound_v="0.025", decision_at_ms=2),
                      action("scale", 1, "scale_record", factor="10", decision_at_ms=0)], "scale",
                     "Increasing a queue's service capacity can remove a deadline bottleneck. Transfer that increase-strength remedy by multiplying the existing stored sensor values by ten, without a new acquisition.")
    return [q1, q2, q3, q4, q5, q6, s1, s2, s3, s4, s5, s6]


def public_packet():
    rng = random.Random(202610021731)
    cases = fixture_specs()
    for case in cases:
        rng.shuffle(case['actions'])
        ids = {}
        for i, option in enumerate(case['actions']):
            ids[option.pop('_key')] = chr(65+i)
            option['id'] = chr(65+i)
        case['proposed_transfer']['action_id'] = ids[case['proposed_transfer'].pop('_action_key')]
    rng.shuffle(cases)
    return {"schema_version": "1.0", "synthetic": True,
            "decision_rules": {
                "physical_action_choice": "Choose the cheapest listed physical action that guarantees the exact task by the original deadline under every explicitly permitted model/calibration world. Cost unit is credits. All listed action costs are total one-off costs; waiting has only its listed cost. If guaranteed actions tie, choose the alphabetically first ID.",
                "IMPOSSIBLE": "Choose IMPOSSIBLE when every allowed calibration world defeats every listed physical action. This concerns the stated task, evidence and listed actions, not all conceivable future interventions.",
                "REQUEST_FACT": "Choose REQUEST_FACT only when no physical action is guaranteed under current facts, but resolving an explicitly missing model/calibration fact could change feasibility or the correct action. Unknown source symbols/errors are the target uncertainty, not requestable missing facts.",
                "transfer_verdict": "Assess the proposed transfer's named physical action against the same exact task. Accept if that action is guaranteed in all allowed model/calibration worlds; reject if it fails in every allowed world; insufficient if it succeeds in some and fails in others. An accepted action need not be cheapest and does not prove a universal shared mechanism.",
                "per_action_status": "For each physical action report success if it guarantees the task in all allowed model/calibration worlds, failure if it fails in every allowed world, and unknown if it succeeds in some and fails in others.",
                "deadline": "The original deadline never changes. Completion or sample availability exactly at the deadline counts. No action acquires unlisted evidence or adds unlisted capacity.",
                "numerics": "Queue times and rates are exact integers. Sensor decimal strings denote exact rationals; closed bounded-error intervals touching at an endpoint overlap. No numerical guard or probability distribution is assumed.",
                "expected_answer_fields": ["case_id", "choice", "action_status", "transfer_verdict", "basis"]},
            "cases": cases}


def queue_world(case, option, rate):
    facts, task, parameters = case['facts'], case['task'], option['parameters']
    pending = list(facts['pending_fifo_payload_ids'])
    completed = list(facts['completed_payload_ids'])
    op = option['operation']
    replayed = []
    if op == 'set_service_rate':
        rate = parameters['jobs_per_tick']
    elif op == 'replay_available_backups':
        for payload in facts['backup_payload_ids']:
            if payload not in pending and payload not in completed:
                pending.append(payload); replayed.append(payload)
    elif op == 'reverse_pending_fifo':
        pending.reverse()
    elif op != 'continue_service':
        raise ValueError('Unknown queue action')
    if not isinstance(rate, int) or rate < 0:
        raise ValueError('Service rate must be a nonnegative integer')
    timeline = []
    for tick in range(1, task['original_deadline_tick']+1):
        done = []
        if tick > parameters.get('pause_ticks', 0):
            for _ in range(min(rate, len(pending))):
                done.append(pending.pop(0))
        completed.extend(done)
        timeline.append({'tick': tick, 'completed_this_tick': done})
    absent = sorted(set(task['required_payload_ids']) - set(completed))
    return {'success': not absent, 'active_service_rate_jobs_per_tick': rate,
            'replayed_payload_ids': replayed, 'completed_payload_ids': completed,
            'required_not_completed': absent, 'timeline': timeline}


def clipped(value, lo, hi):
    return max(lo, min(hi, value))


def boxes_overlap(a, b):
    if len(a) != len(b):
        raise ValueError('Mismatched dimensions')
    return all(max(lo_a, lo_b) <= min(hi_a, hi_b)
               for (lo_a, hi_a), (lo_b, hi_b) in zip(a, b))


def sensor_world(case, option):
    facts, parameters = case['facts'], option['parameters']
    decision = parameters['decision_at_ms']
    if decision < 0 or decision > case['task']['original_deadline_ms']:
        return {'success': False, 'reason': 'decision_outside_original_deadline', 'sample_ids': []}
    records = [dict(row) for row in facts['retained_or_in_transit_samples']
               if row['available_at_ms'] <= decision]
    op = option['operation']
    replay_added = False
    if op == 'replay_source':
        if not (0 <= parameters['acquired_at_ms'] <= parameters['available_at_ms'] <= decision):
            raise ValueError('Replay schedule is inconsistent')
        if facts['source_replay_available']:
            records.append(sample('new_acquisition', parameters['gain'], parameters['available_at_ms'],
                                  parameters['error_bound_v'], parameters['acquired_at_ms']))
            replay_added = True
    elif op not in ('use_record', 'scale_record'):
        raise ValueError('Unknown sensor action')
    if 'selected_sample_ids' in parameters:
        requested = set(parameters['selected_sample_ids'])
        records = [row for row in records if row['sample_id'] in requested]
    factor = f(parameters['factor']) if op == 'scale_record' else Fraction(1)
    if factor <= 0:
        raise ValueError('This finite fixture uses positive software scaling only')
    lo, hi = f(facts['sensor_lower_rail_v']), f(facts['sensor_upper_rail_v'])
    boxes = {}
    for hypothesis in facts['source_hypotheses']:
        intervals = []
        for row in records:
            center = clipped(f(row['gain'])*f(hypothesis['amplitude_v']), lo, hi)
            error = f(row['error_bound_v'])
            if error < 0:
                raise ValueError('Negative error bound')
            intervals.append(((center-error)*factor, (center+error)*factor))
        boxes[hypothesis['symbol']] = intervals
    comparisons = []
    for a, b in combinations(boxes, 2):
        overlap = boxes_overlap(boxes[a], boxes[b])
        comparisons.append({'symbols': [a, b], 'observation_boxes_overlap': overlap,
                            'shared_observation_if_overlap': [max(x[0], y[0]) for x, y in zip(boxes[a], boxes[b])] if overlap else None})
    return {'success': all(not row['observation_boxes_overlap'] for row in comparisons),
            'decision_at_ms': decision, 'sample_ids': [row['sample_id'] for row in records],
            'new_acquisition_added': replay_added, 'observation_boxes_v': boxes,
            'cross_symbol_comparisons': comparisons}


def evaluate_case(case):
    if case['system'] == 'finite_fifo_queue':
        worlds = case['facts']['service_rate_possibilities_jobs_per_tick']
        evaluations = {a['id']: [queue_world(case, a, rate) for rate in worlds]
                       for a in case['actions']}
    elif case['system'] == 'finite_hypothesis_sensor_record':
        worlds = ['declared_calibration']
        evaluations = {a['id']: [sensor_world(case, a)] for a in case['actions']}
    else:
        raise ValueError('Unknown system')
    robust = [a for a in case['actions'] if all(w['success'] for w in evaluations[a['id']])]
    if robust:
        choice = min(robust, key=lambda a: (a['cost_credits'], a['id']))['id']
    elif any(any(evaluations[a['id']][i]['success'] for a in case['actions']) for i in range(len(worlds))):
        choice = 'REQUEST_FACT'
    else:
        choice = 'IMPOSSIBLE'
    proposed = [w['success'] for w in evaluations[case['proposed_transfer']['action_id']]]
    verdict = 'accept' if all(proposed) else ('reject' if not any(proposed) else 'insufficient')
    action_status = {}
    for aid, rows in evaluations.items():
        successes = [row['success'] for row in rows]
        action_status[aid] = 'success' if all(successes) else ('failure' if not any(successes) else 'unknown')
    return {'case_id': case['case_id'], 'choice': choice, 'transfer_verdict': verdict,
            'optimal_choices': [choice], 'action_status': action_status,
            'worlds': worlds, 'action_evaluations': evaluations,
            'guaranteed_action_ids': [a['id'] for a in robust]}


def serializable(value):
    if isinstance(value, Fraction):
        return str(value)
    if isinstance(value, dict):
        return {k: serializable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [serializable(v) for v in value]
    return value


def evaluate_cases(packet):
    public_bytes = (json.dumps(packet, indent=2, ensure_ascii=False)+'\n').encode('utf-8')
    return serializable({'schema_version': '1.0',
                         'provenance': 'Authored from finite dynamics before inspecting any evaluated method responses. Labels are derived by queue simulation or exact rational observation-box intersection.',
                         'public_cases_sha256': hashlib.sha256(public_bytes).hexdigest(),
                         'cases': [evaluate_case(case) for case in packet['cases']]})


def generate(root=HERE):
    packet = public_packet()
    public_bytes = (json.dumps(packet, indent=2, ensure_ascii=False)+'\n').encode('utf-8')
    key = evaluate_cases(packet)
    (root/'public').mkdir(parents=True, exist_ok=True)
    (root/'private').mkdir(parents=True, exist_ok=True)
    (root/'public'/'cases.json').write_bytes(public_bytes)
    (root/'private'/'answer_key.json').write_text(json.dumps(key, indent=2)+'\n', encoding='utf-8')
    return key


def check(root=HERE):
    data = (root/'public'/'cases.json').read_bytes()
    packet = json.loads(data)
    expected = json.loads((root/'private'/'answer_key.json').read_text(encoding='utf-8'))
    actual = evaluate_cases(packet)
    if hashlib.sha256(data).hexdigest() != expected['public_cases_sha256']:
        raise ValueError('Public case byte hash differs from the frozen oracle key')
    if actual != expected:
        raise ValueError('Behavior recomputation differs from the frozen oracle key')
    return actual


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--build', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = generate() if args.build else check()
    print(json.dumps({'mode': 'build' if args.build else 'check', 'case_count': len(result['cases']),
                      'public_cases_sha256': result['public_cases_sha256'], 'status': 'passed'}, indent=2))
