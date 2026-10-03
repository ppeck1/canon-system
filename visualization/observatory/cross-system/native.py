"""Equally informed engineering baseline, expressed in native system terms.

No import of the role model, case ID branches, or oracle result access.
"""


def choose(predictions):
    feasible = [row for row in predictions if row['feasible']]
    return min(feasible, key=lambda row: (row['cost'], row['id']))['id'] if feasible else None


def queue(case):
    facts, task = case['facts'], case['task']
    rates = facts['service_rate_possibilities_jobs_per_tick']
    if len(rates) != 1 or facts['future_external_arrivals']:
        raise ValueError('Pilot requires one rate and no arrivals')
    rows = []
    for action in case['actions']:
        pending = list(facts['pending_fifo_payload_ids'])
        completed = set(facts['completed_payload_ids'])
        rate = rates[0]
        if action['operation'] == 'replay_available_backups':
            pending += [job for job in facts['backup_payload_ids'] if job not in pending and job not in completed]
        elif action['operation'] == 'set_service_rate':
            rate = action['parameters']['jobs_per_tick']
        elif action['operation'] != 'continue_service':
            raise ValueError('Unsupported queue action')
        pause = action['parameters'].get('pause_ticks', 0)
        if not isinstance(pause, int) or pause < 0:
            raise ValueError('Pilot pause must be a nonnegative integer')
        budget = rate*max(0, task['original_deadline_tick']-pause)
        completed.update(pending[:budget])
        rows.append({'id': action['id'], 'cost': action['cost_credits'],
                     'feasible': set(task['required_payload_ids']).issubset(completed)})
    return {'choice': choose(rows), 'actions': rows, 'method': 'native FIFO capacity calculation'}


def release(facts):
    """Read the package report contract directly; no generic role representation."""
    def report_matches(record):
        if not record['exists'] or record['parse_error'] is not None:
            return False
        data = record['content']
        return data.get('passed') is True and data.get('input_fingerprints') == facts['current_input_fingerprints']

    package_ready = all(row['observed'] == row['required'] for row in facts['package_constraints'])
    verification_ready = all(row['observed'] == row['required'] for row in facts['verification_constraints'])
    rows = []
    for action in facts['actions']:
        if action['operation'] == 'restore_retained_receipt':
            receipt_ready = report_matches(facts['retained_receipt'])
        elif action['operation'] == 'repeat_package_attempts':
            receipt_ready = report_matches(facts['active_receipt'])
        elif action['operation'] == 'verify_current_then_package':
            receipt_ready = verification_ready
        else:
            raise ValueError('Unsupported release action')
        rows.append({'id': action['id'], 'cost': action['cost'], 'feasible': package_ready and receipt_ready})
    return {'choice': choose(rows), 'actions': rows, 'method': 'native release precondition calculation'}
