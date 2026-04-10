# Input Mapping — Observable Signals to CANON Variables

## Purpose

This file defines how observable hospital inputs map to CANON state variables.

It is the translation layer between what a unit can measure and what the model represents.

All mappings are illustrative. None are empirically calibrated yet. They are structurally grounded — meaning the logic of the mapping is defensible, not arbitrary — but the weights and thresholds require validation against real shift-level data.

---

## ΩV — Viability Margin

**Concept:** How much operational slack remains before the unit cannot absorb additional demand.

**Observable inputs:**
- staffed beds vs current census
- open beds vs pending admits in queue
- available float or flex capacity

**Illustrative mapping:**

```
ΩV ≈ (staffed beds − current census) / staffed beds
```

Adjusted downward if:
- pending admits exceed open beds
- float pool is depleted
- prior discharges are blocked

**Range:** 0 = no slack, 1 = fully available

**Why not just use occupancy:** Standard occupancy compresses the numerator (beds in use) without capturing the denominator dynamics — blocked discharges, pending placements, and flex capacity all affect true maneuverability, not just the census count.

### Dependency risk

ΩV is highly dependent on accurate staffed bed information.

If staffed bed data is:
- missing
- static
- or inconsistently recorded

then ΩV becomes a weaker proxy for true system slack.

In such cases:
- census-based approximations may still be used
- but the distinction between theoretical capacity and functional capacity is reduced

This should be treated as a dependency risk for implementation, not just a measurement limitation.

---

## Π — Regulatory Pressure

**Concept:** How much active effort the system is expending to remain operational. Elevated Π means the system is working harder to stay feasible, not that it is failing — but sustained high Π depletes adaptive capacity.

**Observable inputs:**
- ED boarding time
- escalation frequency (charge RN calls, supervisor involvement)
- coordination overhead (cross-unit placement calls, transport delays)
- rapid response activations

**Illustrative mapping:**

```
Π ∝ (ED boarding hours) + (escalation count × weight)
     normalized to a 0–1 scale relative to shift baseline
```

**Range:** 0 = no active regulation needed, 1 = continuous high-effort stabilization

**Why not just use escalations:** Isolated escalations are noise. Π captures whether the system is spending sustained effort just to maintain its current state — the difference between an isolated event and a system in continuous corrective mode.

---

## H — Accumulated Load

**Concept:** Carried-over burden from prior states. H is path-dependent — it does not reset when visible metrics stabilize. A shift that begins with unresolved load from the prior shift starts in a different structural position than one that does not, even with identical census and staffing.

**Observable inputs:**
- delayed or pending discharges at shift start
- prior-shift backlog (placement calls unresolved, orders pending)
- float pool utilization over prior 24–48 hours
- unresolved case management items

**Illustrative mapping:**

```
H ∝ (pending discharges × delay weight)
   + (prior shift carryover count)
   + (float pool depletion fraction)
   normalized to 0–1
```

**Range:** 0 = clean slate, 1 = maximum accumulated unresolved load

**Why not just track pending discharges:** Pending discharge count is a point-in-time metric. H tracks whether load is accumulating or resolving across time — a unit with 3 pending discharges that have been pending for 6 hours is in a different state than one with 3 that arrived 20 minutes ago.

---

## L_P — Projection Loss

**Concept:** The degree to which the current observation arrangement fails to represent the true system state. High L_P means decisions are being made from a compressed or lagged picture of reality — not because the data is wrong, but because the aggregation, delay, or summarization structure hides relevant state.

**Observable inputs:**
- handoff quality (structured vs compressed vs verbal-only)
- dashboard lag (time between event and ADT/EMR update)
- ADT grouping or batching delays
- degree of summarization in shift report (event-level vs aggregate)

**Illustrative mapping:**

```
L_P ∝ (time lag between event and dashboard update)
     + (handoff compression score: 0=structured, 1=verbal-only)
     + (ADT grouping delay)
     normalized to 0–1
```

**Range:** 0 = full real-time structured observation, 1 = maximal compression and lag

**Why this matters:** A system can be in a degrading state while dashboards show stability — not because the system is hiding anything, but because the observation structure was not designed to preserve state-relevant signals across handoffs, summaries, and reporting aggregations.

---

## Notes on operationalization

These mappings describe the logic of translation, not a validated instrument.

To move from illustrative to operational, the next step is:

1. Define a minimal data collection schema (shift-level or event-level)
2. Retrospectively apply mappings to shifts with known outcomes
3. Calibrate weights against observed divergence between KPI signal and actual shift trajectory
4. Establish normalization bounds from institutional baseline

Until that work is done, this file defines the structural argument — what would need to be measured, and why, to make CANON's latent-state distinctions empirically grounded.

---

## Cross-reference

- `examples/toy_delta_c_comparison.md` — shows how these values produce divergent Δc* across matched scenarios
- `examples/shift_failure_case.md` — applies these mappings to a failure trajectory
- `examples/shift_contrast_case.md` — applies these mappings to a stable trajectory
- `spec/CANON_SYSTEM_v3.9.53.json` — canonical definitions of all variables
