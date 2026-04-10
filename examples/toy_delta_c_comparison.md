# Toy Δc* Comparison — Matched Cases, Divergent Outcomes

## Purpose

This file provides a compact numeric comparison between two matched scenarios:

1. `shift_failure_case.md`
2. `shift_contrast_case.md`

The visible setup is intentionally the same in both:

- census
- staffing
- ratio
- broad KPI appearance

The latent state differs.

This allows CANON to demonstrate a core claim:

> identical observed conditions do not imply identical system viability

---

## Toy Scoring Model

For illustration only:

**Δc* = 1.0·ΩV − 0.8·Π − 1.1·H − 0.9·L_P**

Where:

- **ΩV** = viability margin
- **Π** = regulatory / stabilizing pressure
- **H** = accumulated load
- **L_P** = projection loss

Important:
- this is not a calibrated production equation
- weights are illustrative
- values are normalized to make divergence legible

---

## How values were assigned (illustrative)

Values are normalized (0–1) and assigned based on:

- **ΩV**: estimated remaining bed maneuverability — how much slack exists before the unit cannot accept or absorb additional demand
- **Π**: observed escalation and coordination effort — how hard the system is working to stay operational
- **H**: carried-over unresolved workload — discharge delays, float pool exhaustion, backlog from prior shift
- **L_P**: degree of information compression — quality of handoffs, dashboard lag, ADT grouping, summarization loss

These are not measured inputs yet.

They are structured approximations to demonstrate how latent differences map into Δc*.

The failure case starts at ΩV=0.42 (not 0.52) because prior discharge delays have already consumed available maneuverability. The contrast case starts at ΩV=0.52 because that slack was recovered overnight. That difference — invisible to the dashboard — is what the model is built to represent.

---

## Δc* interpretation

```
Δc* > 0 → system within viable region
Δc* ≈ 0 → boundary condition — marginal viability, elevated collapse risk
Δc* < 0 → latent instability / collapse condition
```

The failure case enters negative territory at t0 and deepens from there.
The contrast case stays positive and improves.
Both look equivalent at the dashboard level.

---

## Failure Case

| Time | ΩV | Π | H | L_P | Δc* |
|---|---:|---:|---:|---:|---:|
| t0 | 0.42 | 0.35 | 0.45 | 0.35 | -0.11 |
| t1 | 0.36 | 0.40 | 0.52 | 0.42 | -0.54 |
| t2 | 0.30 | 0.48 | 0.58 | 0.47 | -0.95 |

### Read

The system begins fragile and then degrades further as:

- ΩV falls
- Π rises
- H remains active
- L_P stays high

Visible KPIs do not fully reflect this early enough.

---

## Contrast Case

| Time | ΩV | Π | H | L_P | Δc* |
|---|---:|---:|---:|---:|---:|
| t0 | 0.52 | 0.30 | 0.12 | 0.10 | 0.06 |
| t1 | 0.55 | 0.28 | 0.10 | 0.10 | 0.12 |
| t2 | 0.58 | 0.26 | 0.08 | 0.09 | 0.18 |

### Read

The system starts viable and becomes more stable as:

- ΩV rises
- Π stays controlled
- H remains low
- L_P remains low

Visible KPIs appear similar to the failure case at the start, but outcome differs.

---

## Direct Comparison

### Same visible setup
- census = same
- staffing = same
- ratio = same
- broad dashboard signal = similar

### Different latent state
- failure case carries unresolved load
- failure case is more poorly observed
- failure case has less remaining maneuverability

### Result
- failure case Δc* trends negative
- contrast case Δc* trends positive

---

## Interpretation

This toy comparison does not prove predictive superiority.

It does show, however, that CANON can numerically represent a distinction that KPI-based systems collapse:

> same setup, different viability

That is the threshold between a purely verbal model and a state-based explanatory framework.

---

## Recommended use

This file is best referenced from:

- `README.md`
- `shift_failure_case.md`
- `shift_contrast_case.md`

Suggested README language:

“See `examples/toy_delta_c_comparison.md` for a compact numeric illustration of how matched scenarios with identical visible KPIs can diverge in latent viability.”

---
