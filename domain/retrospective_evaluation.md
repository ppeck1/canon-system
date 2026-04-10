# Retrospective Evaluation — Feasibility Using Existing Hospital Data

## Purpose

This document defines how CANON can be evaluated using data that hospitals already generate.

The goal is not to build a predictive model, but to test a structural hypothesis:

> latent system state degrades before KPI-visible failure

---

## Core hypothesis

Operational failure (e.g., ED boarding spikes, discharge delays, throughput collapse) is preceded by measurable changes in:

- accumulated load (H)
- regulatory pressure (Π)
- viability margin (ΩV)
- projection loss (L_P)

These signals can be reconstructed retrospectively from existing data.

---

## Data sources (existing systems)

CANON variables can be approximated using standard hospital data:

### ADT events
- admit, transfer, discharge timestamps
- unit/location changes
- census reconstruction

### ED throughput signals
- arrival → departure
- decision-to-admit → ED departure (boarding time)

### Orders and task execution
- order time → action time
- medication administration
- lab and imaging turnaround

### Documentation
- note create vs sign time
- flowsheet/event time vs filed time

### Staffing and capacity (where available)
- staffed beds
- worked hours per role
- patient-to-staff assignment (if available)

---

## Variable reconstruction (summary)

### H — Accumulated Load
Proxies:
- ED boarding backlog
- discharge delays
- unresolved orders
- patient movement churn

Represents carried-forward system burden.

---

### Π — Regulatory Pressure
Proxies:
- occupancy relative to capacity
- ED crowding
- escalation frequency

Represents effort required to maintain feasibility.

---

### ΩV — Viability Margin
Proxies:
- staffed beds − census
- staffing intensity vs target
- discharge pipeline balance

Represents remaining maneuverability.

---

### L_P — Projection Loss (proxy)
Proxies:
- documentation lag
- ADT lag / corrections
- order-to-action latency
- fragmentation / rework

Represents degradation in how accurately the system perceives itself.

Important:
- L_P is a proxy, not a direct measurement
- lag may increase with workload, but may also precede visible failure

### Interpretation note

Projection loss (L_P) is not independent of workload.

Increased workload can produce:
- longer documentation lag
- greater compression in handoffs
- more fragmented observation

However, the hypothesis is not that L_P replaces workload.

The hypothesis is:

> degradation in observation quality may diverge before KPI-visible failure

This distinction is empirical:

- if L_P only rises after KPI failure → it is reactive
- if L_P rises before KPI failure → it is a leading signal

The retrospective is designed to test this timing relationship, not to assume independence.

---

## From Proxies to Δc* (Illustrative Transformation)

The retrospective analysis operates in three layers:

1. Observable signals (EHR / ADT / operational data)
2. Proxy metrics (e.g., boarding backlog, documentation lag)
3. Normalized CANON variables (ΩV, Π, H, L_P)

These normalized variables are then used to compute Δc*.

### Transformation structure

```
observable inputs → proxy metrics → normalized variables → Δc*
```

### Example (illustrative)

- ED boarding time → contributes to Π proxy
- discharge delay backlog → contributes to H proxy
- staffed beds vs census → contributes to ΩV
- documentation lag → contributes to L_P

Each proxy is:

- aggregated at shift or hour level
- normalized to a bounded scale (e.g., 0–1)
- optionally weighted

The normalized variables are then used in the illustrative scoring model:

```
Δc* = w1·ΩV − w2·Π − w3·H − w4·L_P
```

Important:
- normalization and weights are not yet calibrated
- this step exists to make latent-state differences computable
- calibration is part of future empirical work

This layer connects real data to the CANON state representation.

---

## Minimal dataset schema

See: `domain/data_schema.md`

This schema defines the minimum fields required to reconstruct CANON variables at shift or hour resolution.

---

## Study design (initial pass)

A minimal retrospective study can be performed with:

- 6–12 months of data
- unit-hour or shift-level aggregation
- adult ED and general inpatient units

### Cohorts
- ED admissions (for boarding-based failure)
- inpatient units (for discharge/LOS failure)

---

## Failure definitions

Examples:

- ED boarding time above threshold
- discharge delay spike
- sustained LOS deviation
- loss of bed slack (ΩV collapse)

Multiple definitions should be used to avoid single-metric bias.

---

## Analysis approach

### 1. Time-series reconstruction
Build unit-level state over time:
- X = latent proxies (H, Π, ΩV, L_P)
- Y = observed failure signals

---

### 2. Lead-time testing
Evaluate whether:

> changes in X precede changes in Y

Methods:
- distributed lag models
- cross-correlation
- change-point detection
- survival analysis (time-to-failure)

---

### 3. Baseline comparison
Compare against:
- census-only models
- occupancy-only models
- ED throughput-only models

---

## Interpretation

This approach can establish:

- temporal ordering (latent → visible)
- predictive lead relationships

It does not establish causality without additional study designs.

---

## Feasibility

This analysis is achievable using:

- ADT + ED timestamps
- order/action timestamps
- documentation timestamps

No new instrumentation is required.

Limitations:

- staffing data may be incomplete
- L_P remains a proxy
- timestamp accuracy depends on workflow

---

## Role in CANON

This document defines how CANON moves from:

- conceptual system  
→  
- testable framework  

It provides a path to empirical evaluation without altering the underlying model.