# CANON_OBSERVABILITY

## Purpose

Define how latent state becomes observable.

---

## Layers

Latent state → X_tilde  
Projection → Y = P_K(X_tilde)  
Trace → Z = Probe(Y)  
View → M_view = Render(Filter(Z))

---

## Key variables

- L_P → projection loss
- O_q → observability quality
- R_diag → diagnostic resolution
- B_scope → scope bandwidth

---

## Failure mode

Most real systems fail here:

- projection compresses state
- dashboards operate on Y, not X_tilde
- instability is hidden

---

## Rule

Observation must never:
- govern state
- replace Pi_K
- redefine collapse