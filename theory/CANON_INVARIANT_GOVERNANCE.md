# CANON Invariant Governance

## Purpose

Invariant Governance defines how a system identifies, contests, revises, and enforces the invariants its constraints are meant to preserve.

It is a governance layer above CANON.

It defines what the constraint system is accountable to.

---

## Relation to CANON

CANON governs constrained state evolution:

```text
x_{t+1} = Pi_K(F(x_t))
```

Invariant Governance defines what the feasible set K and its constraints are accountable to.

CANON answers:

> Is this state admissible?

Invariant Governance answers:

> Admissible relative to what preserved goal?

Current CANON execution invariants are internal interpreter and specification coherence rules. Invariant Governance introduces goal invariants: the preserved identity of the system under transformation.

This layer does not replace CANON. It supplies the goal-content that CANON's constraint accountability checks require.

---

## Why This Layer Is Needed

CANON is structurally strong:

- latent evolution is primary
- observation is derived
- constraint projection governs admissibility
- dashboards cannot redefine state

But CANON can become content-thin without an explicit process for defining the invariants of the goal.

Without Invariant Governance, constraint accountability can become circular:

- a constraint is treated as valid because it exists
- a procedure is treated as valid because it is followed
- a metric is treated as valid because it is measured
- a mission statement is treated as valid because it is declared

Invariant Governance prevents that collapse.

It requires every maintained constraint to remain traceable to the preserved identity of the system under current operating conditions.

---

## Core Functions

1. Invariant Discovery
2. Invariant Contestation
3. Invariant Revision
4. Invariant Accountability

### 1. Invariant Discovery

Invariant discovery identifies what must remain true for the system to remain itself under transformation.

This cannot come only from:

- mission statements
- operational metrics
- existing procedures
- institutional incentives

Those may be evidence. They are not sufficient.

Discovery should look for places where the goal is still practiced directly, before proxies have replaced it.

### 2. Invariant Contestation

Candidate invariants must be contestable.

A candidate invariant must answer:

- Does this remain true across transformation, or only under local conditions?
- Does this hold across legitimate stakeholders, or only for the stakeholder with the most power?
- What evidence would falsify this as an invariant?
- What would show that the invariant has become a proxy?

Contestation is not a vote for the loudest claimant.

It is a stress test under transformation pressure.

### 3. Invariant Revision

Invariants can fail.

They can become obsolete, overgeneralized, captured, or too proxy-like.

An invariant set that cannot be revised becomes a slower form of Constraint Drift.

Revision is the process of updating, narrowing, retiring, or replacing an invariant when evidence shows it no longer preserves the goal.

### 4. Invariant Accountability

Once invariants are established, constraints must remain accountable to them.

The operating question becomes:

> Which active invariant does this constraint preserve?

If the answer cannot be given, the constraint is suspect.

---

## Constraint Accountability Rule

A constraint is valid only while it remains traceable to at least one active invariant under current operating conditions.

---

## Drift Rule

Constraint Drift is present when a maintained constraint can no longer be explained in terms of the invariant it preserves.

Equivalently:

> Constraint Drift is the loss of traceability between a maintained constraint and the invariant it was created to preserve.

---

## Renewal Rule

Constraint Renewal is triggered by:

- scheduled review
- detected drift
- material system transformation
- contested invariant status

Constraint Renewal is the process of reviewing, revising, retiring, or reaffirming constraints against the active invariant set.

---

## Governance Stack

```text
Preserved Goal
    |
Invariant Set
    |
Constraint Lattice K
    |
CANON State Evolution
    |
Drift Detection / Renewal
```

---

## Relationship to Adjacent Frameworks

### Constraint Drift

Constraint Drift is the loss of traceability between a maintained constraint and the invariant it was created to preserve.

### Constraint Renewal

Constraint Renewal reviews, revises, retires, or reaffirms constraints against the active invariant set.

### Preservation / Identity Framework

The Preservation / Identity Framework defines identity as the invariants of the goal under transformation.

Invariant Governance supplies the process for discovering, contesting, revising, and enforcing those invariants.

### Substrate Theory

Substrate Theory detects when proxies or collapsed planes replace the preserved thing itself.

Invariant Governance defines what must not be replaced.

### DSCS

DSCS formalizes who has authority to resolve unresolved states.

Invariant Governance extends that authority question to the definition and revision of invariants.

### OFT

OFT can later measure where invariant failure is likely under load.

### BOH

BOH is the first contained testbed for applying the invariant lifecycle.

---

## Non-Scope

- This is not a new CANON operator.
- This is not a new state variable.
- This does not replace `x_{t+1} = Pi_K(F(x_t))`.
- This does not alter the current executable spec.
- This does not modify `Pi_K`, `P_K`, `F`, or K.
- This does not rename canonical variables or operators.
- This does not claim invariant selection is politically neutral.
- This does not treat mission statements as sufficient invariant sources.
- This does not treat operational metrics as sufficient invariant sources.
- This is not generic values alignment.

---

## Status

Theory-layer integration.

Not executable-core integration.

This document is intended to support future interpreter, schema, and governance work. It does not change the CANON operator layer, the v3.9.53 system specification, or the prototype interpreter.
