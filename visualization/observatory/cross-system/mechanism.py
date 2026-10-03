"""Small typed-role experiment; no case labels, diagnoses or oracle outcomes.

This is an explicit provisional mapping, not a change to CANON's numerical core.
The same selector handles identity-preserving recovery in a queue and a release
handoff. Domain adapters must retain exact identities, units and constraints.
"""
from copy import deepcopy


def equalities_hold(constraints):
    return all(item['observed'] == item['required'] for item in constraints)


def compatible(token, requirement):
    return token['kind'] == requirement['kind'] and all(
        token['attributes'].get(key) == value
        for key, value in requirement['attributes'].items())


def select(graph):
    """Propagate declared action effects, then check typed coverage and gates."""
    predictions = []
    for action in graph['actions']:
        tokens = deepcopy(graph['tokens'])
        limit = graph.get('active_limit')
        trace = []
        for effect in action['effects']:
            if effect['type'] == 'promote':
                for token in list(tokens):
                    if token['location'] != effect['from']:
                        continue
                    if any(item['location'] in ('active', 'complete') and compatible(item, token)
                           for item in tokens):
                        continue
                    added = deepcopy(token)
                    added['location'] = effect['to']
                    if effect.get('replace_kind'):
                        tokens = [item for item in tokens if not (
                            item['location'] == effect['to'] and item['kind'] == added['kind'])]
                    tokens.append(added)
                    trace.append({'operation': 'promote', 'token': added['id']})
            elif effect['type'] == 'produce':
                if equalities_hold(effect['guards']):
                    for token in effect['tokens']:
                        tokens = [item for item in tokens if not (
                            item['location'] == token['location'] and item['kind'] == token['kind'])]
                        tokens.append(deepcopy(token))
                    trace.append({'operation': 'produce', 'guards': 'satisfied'})
                else:
                    trace.append({'operation': 'produce', 'guards': 'unsatisfied'})
            elif effect['type'] == 'set_limit':
                limit = effect['value']
            elif effect['type'] != 'unchanged':
                raise ValueError('Unsupported role effect: '+effect['type'])
        active = [token for token in tokens if token['location'] == 'active']
        permitted = [token for token in tokens if token['location'] == 'complete']
        permitted += active if limit is None else active[:limit]
        missing = [requirement['id'] for requirement in graph['requirements']
                   if not any(compatible(token, requirement) for token in permitted)]
        blocked = [gate['id'] for gate in graph['gates'] if gate['observed'] != gate['required']]
        predictions.append({'id': action['id'], 'feasible': not missing and not blocked,
                            'missing_requirements': missing, 'unsatisfied_gates': blocked,
                            'steps': trace, 'cost': action['cost']})
    feasible = [item for item in predictions if item['feasible']]
    chosen = min(feasible, key=lambda item: (item['cost'], item['id']))['id'] if feasible else None
    return {'choice': chosen, 'actions': predictions, 'method': 'typed-role propagation',
            'claim': 'Only the supplied finite action effects and constraints are evaluated.'}


def queue_graph(case):
    facts, task = case['facts'], case['task']
    rates = facts['service_rate_possibilities_jobs_per_tick']
    if len(rates) != 1 or facts['future_external_arrivals']:
        raise ValueError('Pilot adapter requires one exact service rate and no arrivals')
    deadline = task['original_deadline_tick']
    tokens = []
    for location, key in [('active', 'pending_fifo_payload_ids'),
                          ('complete', 'completed_payload_ids'), ('backup', 'backup_payload_ids')]:
        tokens += [{'id': identity, 'kind': 'required-job', 'attributes': {'identity': identity},
                    'location': location} for identity in facts[key]]
    actions = []
    for action in case['actions']:
        operation, parameters = action['operation'], action['parameters']
        pause = parameters.get('pause_ticks', 0)
        if not isinstance(pause, int) or pause < 0:
            raise ValueError('Pilot pause must be a nonnegative integer')
        available_ticks = max(0, deadline-pause)
        if operation == 'replay_available_backups':
            effects = [{'type': 'promote', 'from': 'backup', 'to': 'active'},
                       {'type': 'set_limit', 'value': rates[0]*available_ticks}]
        elif operation == 'set_service_rate':
            effects = [{'type': 'set_limit', 'value': parameters['jobs_per_tick']*available_ticks}]
        elif operation == 'continue_service':
            effects = [{'type': 'set_limit', 'value': rates[0]*available_ticks}]
        else:
            raise ValueError('Unsupported queue action')
        actions.append({'id': action['id'], 'cost': action['cost_credits'], 'effects': effects})
    return {'requirements': [{'id': identity, 'kind': 'required-job',
                              'attributes': {'identity': identity}}
                             for identity in task['required_payload_ids']],
            'tokens': tokens, 'gates': [], 'active_limit': rates[0]*deadline, 'actions': actions,
            'native_units': {'rate': 'jobs/tick', 'deadline': 'tick',
                             'tick_duration_seconds': facts['tick_duration_seconds']},
            'scope': 'Equal unit jobs; FIFO order retained in active-token order; no invented arrivals.'}


def release_graph(facts):
    """Translate exact native receipt attributes; mismatches remain visible."""
    desired = {'passed': True, 'input_fingerprints': facts['current_input_fingerprints']}
    tokens = []
    for key, location in [('active_receipt', 'active'), ('retained_receipt', 'backup')]:
        record = facts[key]
        if record['exists'] and record['parse_error'] is None:
            tokens.append({'id': key, 'kind': 'verification-receipt', 'location': location,
                           'attributes': {'passed': record['content'].get('passed'),
                                          'input_fingerprints': record['content'].get('input_fingerprints')}})
    gates = facts['package_constraints']
    actions = []
    for action in facts['actions']:
        if action['operation'] == 'restore_retained_receipt':
            effects = [{'type': 'promote', 'from': 'backup', 'to': 'active', 'replace_kind': True}]
        elif action['operation'] == 'verify_current_then_package':
            effects = [{'type': 'produce', 'guards': facts['verification_constraints'],
                        'tokens': [{'id': 'new-current-receipt', 'kind': 'verification-receipt',
                                    'location': 'active', 'attributes': desired}]}]
        elif action['operation'] == 'repeat_package_attempts':
            effects = [{'type': 'unchanged'}]
        else:
            raise ValueError('Unsupported release action')
        actions.append({'id': action['id'], 'cost': action['cost'], 'effects': effects})
    return {'requirements': [{'id': 'current-verification', 'kind': 'verification-receipt',
                              'attributes': desired}], 'tokens': tokens, 'gates': gates,
            'actions': actions, 'native_units': {'fingerprints': 'SHA-256 + byte count'},
            'scope': 'No queue-time or service-rate value is mapped onto package execution.'}
