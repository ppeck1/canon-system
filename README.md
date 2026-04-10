# CANON — Constraint-First Modeling for Hospital Flow

**CANON (Constrained Autonomous Node-state Operational Network)**  
A constrained state-evolution framework for modeling hospital operations as a dynamic system under load.

This repository applies CANON to hospital length of stay (LOS) and bed management dynamics.

---

## Start here

The clearest entry point is the example set:

- [examples/shift_failure_case.md](examples/shift_failure_case.md) — a shift that collapses despite stable KPIs
- [examples/shift_contrast_case.md](examples/shift_contrast_case.md) — the same visible setup, different outcome
- [examples/toy_delta_c_comparison.md](examples/toy_delta_c_comparison.md) — numeric comparison of how latent state diverges

For how observable inputs map to CANON variables:

- [domain/input_mapping.md](domain/input_mapping.md)

For the formal system:

- [theory/CANON_MATH_v1.md](theory/CANON_MATH_v1.md)
- [spec/CANON_SYSTEM_v3.9.53.json](spec/CANON_SYSTEM_v3.9.53.json)

---

## Why this exists

In hospital operations, units can appear stable:

- census unchanged  
- staffing ratios unchanged  
- KPIs within expected range  

And still fail.

This shows up as:

- sudden overload  
- delayed discharges  
- coordination breakdown  
- “bad shifts” with no clear cause  

Traditional systems do not explain this.

---

## The problem

Most hospital dashboards compress system state into metrics:

- occupancy  
- LOS  
- throughput  

These are **projections**, not full system representations.

They do not preserve:

- accumulated load from prior states  
- mismatch between demand and configuration  
- loss of information across handoffs and summaries  

As a result:

> Two shifts with identical visible metrics can produce different outcomes.

---

## Core idea

System behavior is not defined only by current values.

It depends on:

- **H** — accumulated load (path dependence)  
- **L_P** — projection loss (information degradation)  
- **ΩV** — remaining viable capacity  
- **Π** — pressure required to maintain operation  

Failure occurs when:

> the system can no longer maintain a viable state under its constraints

—not when a metric crosses a threshold.

---

## Governing principle

All system evolution reduces to:

x_{t+1} = Π_K(F(x_t))

Where:

- **F(x_t)** → latent system evolution  
- **Π_K** → constraint projection (what is allowed)  

Observed metrics are downstream of this process.

---

## What CANON models

CANON represents the system as a constrained state evolving over time.

Key components:

- **State variables**  
  (capacity, flow, mismatch, pressure, accumulated load)

- **Operators**  
  (Enable, Express, Regulate, Constrain)

- **Constraint surface**  
  (feasible vs infeasible system states)

- **Projection layer**  
  (difference between true state and observed dashboard)

---

## What this explains

### Patterns not captured by KPIs

- Identical census, different outcomes  
  → due to accumulated load (H)

- Stable dashboard, failing system  
  → due to projection loss (L_P)

- Sudden collapse after stable period  
  → due to constraint exhaustion

- Degradation without individual failure  
  → due to coordination load, not error

---

## Comparative behavior vs traditional KPIs

Across multiple simulated hospital scenarios:

- CANON detects instability before changes in LOS, occupancy, or throughput  
- CANON identifies degradation driven by state fragmentation and coordination load  
- KPI-based systems can show false stability under high projection loss  

Example pattern:

Same census, same staffing → different outcomes

- KPI interpretation: equivalent system state  
- CANON interpretation: divergence due to H and L_P  

CANON does not replace KPIs.

It differentiates between system states that KPIs treat as equivalent.

---

## Example: Hidden Instability Under Stable KPIs

See:

/examples/shift_failure_case.md

This example shows a realistic hospital shift where:

- metrics appear stable  
- discharge friction persists  
- prior load is unresolved  

Result:

- system collapse emerges after apparent stability  
- failure appears sudden but is structurally latent  

CANON explains this through:

- accumulated load (H)  
- projection loss (L_P)  
- reduced viable capacity (ΩV)

---

## Numeric Illustration: Matched Cases, Divergent Viability

A compact numeric comparison is included in:

`/examples/toy_delta_c_comparison.md`

This file uses a simple illustrative Δc* scoring model to show that two shifts with identical visible KPIs can still diverge in latent viability due to differences in:

- accumulated load (H)
- projection loss (L_P)
- remaining viable capacity (ΩV)

The scoring model is demonstrative, not calibrated, but it makes the latent-state distinction explicit and legible.  

---

## Repository structure

/theory
  CANON_MATH_v1.md
  CANON_OPERATORS.md
  CANON_OBSERVABILITY.md
  CANON_GOVERNING_LAYER.md

/spec
  CANON_SYSTEM_v3.9.53.json
  SPEC_README.md
  INITIAL_CONDITION_SCHEMA.json
  SCENARIO_SCHEMA.json
  TRACE_OUTPUT_SCHEMA.json

/domain
  input_mapping.md
  data_schema.md
  los_mapping.json
  los_execution.md
  los_constraints.md

/examples
  shift_failure_case.md
  shift_contrast_case.md
  toy_delta_c_comparison.md
  walkthrough.md
  sample_shift.json

/atlas
  canon_los_atlas.html

/implementation
  interpreter.py
  interpreter_contract.md

---

## Reading order

**If you are new:**
1. examples/shift_failure_case.md
2. examples/shift_contrast_case.md
3. examples/toy_delta_c_comparison.md
4. domain/input_mapping.md

**If you want the formal system:**
5. theory/CANON_MATH_v1.md
6. theory/CANON_OPERATORS.md
7. spec/SPEC_README.md
8. domain/los_execution.md
9. atlas/canon_los_atlas.html

**Reference only:**
- examples/walkthrough.md — simplified scenario, no numeric layer

---

## Scope

This repository is:

- a formal system model  
- a domain mapping to hospital operations  
- an implementation-ready specification  

This repository is not:

- a production hospital system  
- a validated predictive tool  
- an EHR-integrated solution  

---

## Claim

Hospital systems fail structurally before they fail visibly.

This framework models that structure.

---

## Limitations

Current state:

- structurally coherent  
- evidence-informed  
- scenario-tested  

Not yet:

- empirically validated against real datasets  
- statistically benchmarked  
- calibrated to specific institutions  

Future work requires:

- shift-level or event-level data  
- comparison against KPI baselines  
- measurement of detection lead time  

CANON can be evaluated using simple shift-level data. See `domain/input_mapping.md` and `domain/data_schema.md`.

---

## Positioning

CANON is not:

- a dashboard  
- a forecasting model  
- a simple optimization tool  

It is:

> a state-coherence framework for understanding system behavior under constraint

---

## Summary

Traditional systems ask:

> “What are the numbers?”

CANON asks:

> “Is the system still viable?”

---

## References (contextual)

- JAMA Network Open (2024) — U.S. Hospital Occupancy Trends  
- MedPAC (2024) — Acute Care Discharge Planner Interviews  
- CMS — ADT Notification Conditions of Participation  
- The Joint Commission — Patient Flow / ED Boarding Guidance
