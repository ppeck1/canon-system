# SPEC_README

## Purpose

This folder contains the machine-readable canonical specification of the system.

Primary file:
- CANON_SYSTEM_v3.9.53.json

---

## What the spec defines

- canonical variables
- governing equation
- operator semantics
- execution order
- projection semantics
- runtime modes
- validation rules
- initial condition schema
- scenario schema
- trace output schema

---

## Key principle

Latent state evolution is primary.

Observation (projection, traces, dashboards) is derived.

---

## Interpreter implication

To run this system, the following must be bound:

- F_latent
- Pi_K
- P_K
- Psi (history update)
- Xi (cadence update)
- f, f_star (collapse margin estimators)
- q_obs, r_diag, b_scope (observation quality functions)

---

## Important constraint

The spec intentionally avoids domain-specific calibration.

All real-world use requires:
- proxy mapping
- constraint definition
- estimator implementation