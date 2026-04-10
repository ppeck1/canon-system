# Shift Failure Case — Hidden Instability Under Stable KPIs

## Purpose

This example demonstrates how a hospital shift can appear operationally stable while already progressing toward failure in latent state.

It is grounded in publicly documented hospital capacity constraints, discharge delays, and observation limitations, and is intended as an **evidence-anchored illustrative scenario**, not a validated predictive model.

---

## Scenario Context

Hospital type:
- Urban academic / tertiary care center

Initial observed state (07:00):

- Census: 28 patients
- Staffing: 5 RNs
- Ratio: 1:5.6
- ED inflow: moderate
- Discharges: delayed

Dashboard KPIs:
- Occupancy: within normal range
- LOS: unchanged
- Throughput: within expected variation

System appears stable.

---

## External Constraints (Evidence)

This scenario reflects known system pressures:

- U.S. hospital occupancy increased from ~63.9% pre-pandemic to ~75.3% post-PHE, with ~85% considered a critical operational threshold  
  (JAMA Network Open, 2024)

- Discharge delays due to prior authorization and placement commonly extend multiple days  
  (MedPAC, 2024 discharge planner interviews)

- ADT notifications may be grouped or delayed depending on delivery preferences, introducing observation lag  
  (CMS ADT CoP guidance)

- ED boarding beyond ~4 hours represents constrained throughput and degraded flow  
  (The Joint Commission patient flow guidance)

---

## Latent State (CANON Variables)

At shift start:

- ΩV (viability margin): low positive  
- Π (pressure): rising  
- T (throughput): constrained but active  
- Γ (mismatch): moderate  
- H (accumulated load): high  
  - prior discharge delays
  - float pool utilization
  - unresolved coordination burden
- L_P (projection loss): high  
  - lagged dashboards
  - compressed handoffs
  - grouped event notifications

---

## Timeline

### t0 (07:00–09:00)

- ED inflow steady
- Expected discharge delayed

KPI view:
- No change
- System appears stable

CANON:
- Δc* slightly positive but fragile
- System viable only due to residual capacity

### t1 (09:00–12:00)

- Discharge still blocked
- New admits continue
- Placement friction persists

KPI view:
- LOS unchanged
- Occupancy acceptable
- No early warning

CANON:
- ΩV decreases
- Π increases
- H remains elevated
- Δc* approaches zero

### t2 (12:00–15:00)

- Bed remains unavailable
- Interruptions increase
- Coordination burden rises
- ED boarding extends

KPI view:
- Degradation begins to appear

CANON:
- Δc* becomes negative
- Collapse condition reached

---

## Illustrative Toy Δc* Scoring

To make the divergence visible numerically, this example uses a simple illustrative scoring model:

**Δc* = 1.0·ΩV − 0.8·Π − 1.1·H − 0.9·L_P**

Important:
- this is a **toy scoring model**
- weights are **illustrative only**
- values are normalized to a 0–1 range for demonstration
- this is not a calibrated predictive equation

### Failure case values

| Time | ΩV | Π | H | L_P | Δc* |
|---|---:|---:|---:|---:|---:|
| t0 | 0.42 | 0.35 | 0.45 | 0.35 | -0.11 |
| t1 | 0.36 | 0.40 | 0.52 | 0.42 | -0.54 |
| t2 | 0.30 | 0.48 | 0.58 | 0.47 | -0.95 |

### Interpretation

Even though the dashboard still appears acceptable early in the shift, the latent state is already degrading:

- ΩV falls as available maneuverability shrinks
- Π rises as the system expends more effort to stay feasible
- H remains high because prior unresolved load is still active
- L_P stays elevated because observation remains compressed and lagged

The result is a steadily worsening Δc* that crosses deeper into negative territory before the KPI layer fully reflects collapse.

---

## Outcome

- Rapid increase in coordination load
- Discharge stagnation
- RN interruption rate rises
- Shift perceived as “sudden failure”

---

## KPI Interpretation

- No early signal
- Failure appears abrupt
- Attribution unclear

---

## CANON Interpretation

Failure was already in progress due to:

- accumulated unresolved load (H)
- reduced maneuverability (ΩV)
- increasing pressure (Π)
- information loss (L_P)

Collapse was not sudden … it was latent.

---

## Why KPIs Miss This

Standard metrics compress system state into:

- occupancy
- LOS
- throughput

They do not preserve:

- path dependence (H)
- information degradation (L_P)
- constraint exhaustion

Thus:

Identical observable states can produce different outcomes.

---

## Key Insight

Two shifts with identical:

- census
- staffing
- throughput

can diverge due to:

- accumulated load (H)
- projection loss (L_P)
- constrained state evolution

---

## Limitations

This example is:

- evidence-informed
- structurally grounded

But not:

- empirically validated
- statistically benchmarked
- calibrated to real hospital datasets

Further work requires:

- shift-level or event-level data
- retrospective comparison against KPI baselines
- measurement of detection lead time

---

## References

- JAMA Network Open (2024). U.S. Hospital Occupancy Trends  
- MedPAC (2024). Acute Care Discharge Planner Interviews  
- CMS. ADT Notification Conditions of Participation  
- The Joint Commission. Patient Flow / ED Boarding Guidance

---

## Example Input → Variable Mapping (Illustrative)

This section shows how observable signals in this scenario map to the CANON latent variables used above.

These are illustrative approximations, not measured values. The mapping logic is consistent with `domain/input_mapping.md`.

**ΩV (viability margin) → 0.42 at t0**
Census is 28 against a 32-bed unit, with 2 discharges pending and blocked. Available maneuverability is narrow — not because the unit is over census, but because the beds that appear open are not functionally accessible. ΩV reflects that residual slack, not raw occupancy.

**Π (pressure) → 0.35 at t0, rising**
ED boarding at shift start is approximately 3–4 hours. One escalation call to charge RN occurred during night shift handoff. Π is elevated at baseline and rising as coordination overhead accumulates, even before new admits arrive.

**H (accumulated load) → 0.45 at t0**
Two discharges from the prior shift remain unresolved due to placement delays. Float pool was partially utilized overnight. These carry forward as structural load — they do not appear in census counts, but they constrain available regulatory responses.

**L_P (projection loss) → 0.35 at t0**
Shift handoff was compressed (verbal summary, no structured event log). ADT updates are grouped with a 20–30 minute lag. Dashboard reflects occupancy but not pending placement status. The observation structure does not faithfully represent the current state of the unit.

The resulting Δc* of −0.11 at t0 reflects a system that is already outside the viable region in latent state, even though no dashboard metric signals concern.

See `domain/input_mapping.md` for the general mapping framework and `domain/data_schema.md` for the minimal data fields that would support retrospective evaluation of this scenario.
