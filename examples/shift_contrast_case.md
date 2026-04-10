# Shift Contrast Case — Same Setup, Different Outcome

## Purpose

This example contrasts directly with `shift_failure_case.md`.

Both scenarios begin with **identical observable conditions**:

- same census
- same staffing
- same reported KPIs

But produce **different outcomes**.

This demonstrates:

> observable state ≠ true system state

and shows how CANON explains the divergence.

---

## Scenario Context

Hospital type:
- Urban academic / tertiary care center

Initial observed state (07:00):

- Census: 28 patients
- Staffing: 5 RNs
- Ratio: 1:5.6
- ED inflow: moderate
- Discharges: pending

Dashboard KPIs:
- Occupancy: within normal range
- LOS: unchanged
- Throughput: within expected variation

System appears identical to the failure case.

---

## Critical Difference (Hidden State)

Unlike the failure case:

- prior shift completed 3 discharges successfully
- no significant boarding carried forward
- float pool not exhausted
- case management queue cleared overnight
- handoffs included structured, complete summaries

---

## Latent State (CANON Variables)

At shift start:

- ΩV (viability margin): moderate positive
- Π (pressure): stable
- T (throughput): active and unconstrained
- Γ (mismatch): low
- H (accumulated load): low
- L_P (projection loss): low

---

## Timeline

### t0 (07:00–09:00)

- ED inflow steady
- First discharge completes on time

KPI view:
- unchanged
- system stable

CANON:
- Δc* clearly positive
- system operating within viable region

### t1 (09:00–12:00)

- Additional discharges complete
- New admits placed without delay

KPI view:
- still stable
- minor throughput improvement

CANON:
- ΩV increases
- Π remains stable
- H remains low
- Δc* increases

### t2 (12:00–15:00)

- Flow remains smooth
- Interruptions manageable
- No backlog accumulation

KPI view:
- stable or slightly improved

CANON:
- system remains well within constraint boundary
- no approach toward collapse

---

## Illustrative Toy Δc* Scoring

To preserve direct comparability, this example uses the same toy scoring model as the failure case:

**Δc* = 1.0·ΩV − 0.8·Π − 1.1·H − 0.9·L_P**

Important:
- this is a **toy scoring model**
- weights are **illustrative only**
- values are normalized to a 0–1 range for demonstration
- this is not a calibrated predictive equation

### Contrast case values

| Time | ΩV | Π | H | L_P | Δc* |
|---|---:|---:|---:|---:|---:|
| t0 | 0.52 | 0.30 | 0.12 | 0.10 | 0.06 |
| t1 | 0.55 | 0.28 | 0.10 | 0.10 | 0.12 |
| t2 | 0.58 | 0.26 | 0.08 | 0.09 | 0.18 |

### Interpretation

The visible setup matches the failure case, but the latent state is different:

- ΩV is higher because maneuvering room still exists
- Π is lower because the system is not spending escalating effort to remain feasible
- H is low because prior load was resolved rather than carried forward
- L_P is low because handoff integrity and observation quality are better

The result is a positive and improving Δc* despite near-identical visible KPIs.

---

## Outcome

- Discharges continue
- No boarding escalation
- RN workload remains manageable
- Shift perceived as “smooth” or “uneventful”

---

## KPI Interpretation

Both scenarios appear similar at start:

- same census
- same staffing
- same LOS
- same throughput

KPIs cannot explain why one shift fails and the other succeeds.

---

## CANON Interpretation

The difference is entirely in latent state.

### Failure case
- high H
- high L_P
- lower ΩV

### Contrast case
- low H
- low L_P
- higher ΩV

---

## Key Mechanism

The system is path-dependent.

Even with identical visible state:

- one system is operating near constraint boundary
- the other has available maneuvering capacity

---

## Core Insight

Two identical starting states can diverge because:

- past load persists (H)
- information quality differs (L_P)
- constraint distance differs (ΩV)

This divergence is invisible to KPI-based systems.

---

## What This Demonstrates

This contrast shows:

- CANON distinguishes between superficially identical states
- KPIs treat them as equivalent
- outcome divergence is structural, not random

---

## Limitations

As with the failure case:

- scenario is evidence-informed but not empirically validated
- variables are structurally grounded but not calibrated
- no statistical comparison yet performed

---

## References (contextual)

- JAMA Network Open (2024) — U.S. Hospital Occupancy Trends
- MedPAC (2024) — Discharge delays and authorization burden
- CMS — ADT notification timing and grouping
- The Joint Commission — ED boarding thresholds
