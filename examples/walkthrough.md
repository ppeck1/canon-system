# Walkthrough — Simplified Scenario

> **Note:** This is an early-stage structural walkthrough. It uses variable names only, no numeric values. For a fully developed scenario with numeric tables, evidence anchoring, and contrast comparison, see `shift_failure_case.md`, `shift_contrast_case.md`, and `toy_delta_c_comparison.md`.

---

## Step 1

System stable:

- Omega_V high (available capacity)
- Gamma low (mismatch minimal)

## Step 2–3

Admissions increase:

- Gamma rises
- T increases
- Pi increases (system begins active regulation)

## Step 4

Transport delay introduced:

- Gamma remains elevated
- throughput stalls
- dissipation increases (Phi = T × Gamma)

## Step 5

Capacity tightens:

- Omega_V drops
- A_s shrinks (fewer viable future states reachable)

## Step 6

System appears stable on dashboard.

But:

- Delta_c_star decreasing
- recovery paths limited
- H elevated from unresolved load

---

## Insight

Failure is already developing before visible collapse.

This is not a throughput failure.

This is a state collapse.

---

## See also

- `shift_failure_case.md` — the same pattern, grounded with evidence and numeric values
- `toy_delta_c_comparison.md` — numeric separation between failure and contrast trajectories
- `domain/input_mapping.md` — how observable inputs map to the variables above
