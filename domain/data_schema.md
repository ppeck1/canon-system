# Minimal Shift-Level Data Schema

This file defines a minimal schema for retrospective shift-level data collection.

It is not a production data model. It is a practical starting point for future empirical evaluation of CANON against real shift trajectories.

The intent is narrow: establish what would need to be recorded, at what granularity, to test whether CANON's latent-state variables meaningfully predict shift outcomes better than KPIs alone.

---

## Schema

### Identifiers

| Field | Description |
|---|---|
| `shift_id` | Unique identifier for the shift (unit + date + shift type) |
| `unit_id` | Unit identifier (e.g., 4N, MICU, 6W) |
| `shift_start` | Datetime of shift start |
| `shift_end` | Datetime of shift end |

---

### Observed state at shift start

| Field | Description | CANON relevance |
|---|---|---|
| `census` | Patient count at shift start | Numerator for ΩV estimation |
| `staffed_beds` | Beds staffed and operational | Denominator for ΩV estimation |
| `pending_admits` | Admits in queue not yet placed | Reduces effective ΩV |
| `delayed_discharges` | Discharges ordered but not completed | Primary H driver |
| `prior_shift_carryover` | Unresolved items carried from prior shift (placement calls, orders, coordination tasks) | Secondary H driver |
| `float_pool_status` | Float pool availability: `full`, `partial`, `depleted` | Adjusts ΩV ceiling |

---

### Flow and pressure signals

| Field | Description | CANON relevance |
|---|---|---|
| `ed_boarding_hours` | Aggregate or average ED boarding time at shift start | Primary Π input |
| `escalation_count` | Number of charge RN or supervisor escalations during shift | Π signal |
| `rapid_response_count` | Rapid response activations during shift | Π signal (severity-weighted) |
| `transport_delay_count` | Transport or placement delays encountered | Contributes to H and Γ |

---

### Observation quality signals

| Field | Description | CANON relevance |
|---|---|---|
| `handoff_type` | Structured, verbal, or hybrid | Primary L_P input |
| `dashboard_lag_minutes` | Estimated or known ADT/EMR update lag | L_P input |
| `adt_grouping` | Whether ADT events are batched or real-time | L_P input |

---

### Outcome

| Field | Description |
|---|---|
| `outcome_label` | Shift outcome classification: `stable`, `degraded`, `failed` |
| `outcome_notes` | Free-text notes on what occurred (optional) |
| `kpi_signal_at_event` | Whether KPIs reflected degradation before or only after the event |

---

## Mapping to CANON variables

These fields support the illustrative mappings defined in `domain/input_mapping.md`:

**ΩV**
```
ΩV ≈ (staffed_beds − census − pending_admits) / staffed_beds
     adjusted for float_pool_status
```

**Π**
```
Π ∝ ed_boarding_hours + (escalation_count × weight)
    normalized to unit baseline
```

**H**
```
H ∝ delayed_discharges + prior_shift_carryover + transport_delay_count
    normalized to unit baseline
```

**L_P**
```
L_P ∝ dashboard_lag_minutes + handoff_compression_score(handoff_type) + adt_grouping_penalty
      normalized to 0–1
```

These are not calibrated formulas. They define the logical structure of the mapping. Weights and normalization bounds require retrospective fitting against real shift outcomes.

---

## Collection notes

A minimal retrospective dataset could be assembled from:

- ADT logs (census, pending admits, discharge timestamps)
- Staffing records (staffed beds, float pool utilization)
- ED boarding reports
- Incident or escalation logs
- Shift handoff records or charge RN notes

No new instrumentation is strictly required for a first pass. Most of these fields can be reconstructed retrospectively from existing clinical systems, though data quality and lag will vary by institution.

---

## Evaluation approach

A first empirical evaluation would:

1. Collect 30–60 shifts per unit, retrospectively labeled by outcome
2. Apply the mapping formulas to estimate ΩV, Π, H, L_P per shift
3. Compute Δc* using the toy scoring model (or a fitted variant)
4. Compare Δc* signal timing against KPI signal timing relative to outcome
5. Report detection lead time: how many hours earlier does Δc* < 0 appear vs first KPI alert

This is a feasibility study design, not a validation study. The goal is to determine whether the latent-state variables carry information beyond KPIs, not to establish clinical performance thresholds.

---

## Cross-reference

- `domain/input_mapping.md` — conceptual mapping framework
- `examples/shift_failure_case.md` — scenario using these variables
- `examples/toy_delta_c_comparison.md` — numeric illustration of divergence
- `spec/CANON_SYSTEM_v3.9.53.json` — canonical variable definitions
