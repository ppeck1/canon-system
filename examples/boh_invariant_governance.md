# BOH Invariant Governance Example

## System Goal

Preserve coherent, usable knowledge.

---

## Why BOH Is the First Testbed

BOH has a smaller stakeholder set, a tractable goal, and concrete failure modes.

It is the right place to test Invariant Governance before applying the method to healthcare, AI governance, or larger organizational systems.

BOH is also close to the core failure mode:

- knowledge can be stored but not retrievable
- provenance can become decoration
- governance can add entropy
- review rituals can persist after their purpose is lost

That makes BOH a contained operational test case.

---

## Candidate Invariants

1. Knowledge must remain retrievable and usable, not merely stored.
2. Provenance must serve retrieval, not replace it.
3. Governance must reduce entropy, not create it.
4. A piece of knowledge is alive if it still informs decisions or builds on prior understanding.
5. A preserved artifact that no longer affects understanding, decisions, or construction has become archival rather than operational.

---

## Constraint Accountability Tests

For each BOH governance mechanism, ask:

- Which invariant does this preserve?
- Is the invariant still active, contested, retired, or failed?
- Does the mechanism reduce entropy or add procedural load?
- Does provenance improve retrieval and use, or merely decorate storage?
- Can a user still recover the knowledge at the moment of need?

---

## Drift Signals

- Workers/users cannot explain how a requirement serves the goal.
- Provenance becomes more visible than usability.
- Stored knowledge cannot be retrieved when needed.
- Review rituals continue after their original purpose is lost.
- Governance creates ambiguity instead of reducing it.

---

## Renewal Triggers

- Scheduled invariant review.
- Detected drift signal.
- Major change in BOH architecture.
- Repeated retrieval failure.
- New knowledge type that does not fit existing invariant set.

---

## Example Invariant Record

```json
{
  "invariant_id": "BOH-INV-001",
  "status": "candidate",
  "statement": "Knowledge must remain retrievable and usable, not merely stored.",
  "goal_relation": "This invariant preserves BOH's goal of coherent, usable knowledge by requiring that preserved material remain recoverable at the moment of need.",
  "evidence_basis": [
    "Observed retrieval events where stored knowledge changes a decision, build, repair, or explanation.",
    "Failed retrieval events where stored knowledge exists but cannot be found or used in time.",
    "User reports distinguishing operational knowledge from archival material."
  ],
  "stakeholder_claimants": [
    "BOH operator",
    "knowledge worker",
    "future user of the corpus"
  ],
  "contestation_tests": [
    "Can the knowledge be recovered without already knowing its exact source path?",
    "Does provenance improve use, or does it become a substitute for use?",
    "Does the governance mechanism make retrieval clearer under pressure?"
  ],
  "falsification_conditions": [
    "Stored knowledge repeatedly cannot be found at the moment of need.",
    "Users preserve artifacts for compliance with process while decisions no longer draw on them.",
    "The corpus can prove custody but cannot support reconstruction of understanding."
  ],
  "constraints_accountable_to_this": [
    "intake_metadata_required",
    "canonical_promotion_requires_human_review",
    "retrieval_index_refresh_required",
    "archive_status_requires_operationality_check"
  ],
  "drift_signals": [
    "Users can cite storage location but not operational meaning.",
    "Search returns artifacts without helping recover the relevant understanding.",
    "Review queues grow while usable knowledge does not improve."
  ],
  "review_triggers": [
    "scheduled",
    "drift_detected",
    "system_transformation",
    "stakeholder_contestation"
  ],
  "last_reviewed": null,
  "revision_history": []
}
```

---

## Status

Contained worked example.

Not healthcare governance.

Not a claim that Invariant Governance is fully operationalized.
