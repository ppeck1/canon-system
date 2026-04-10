# los_constraints

## Constraint set K

Defines feasible hospital state space.

---

## Core constraints

### Capacity
- staffed beds ≤ total staffed capacity

### Staffing
- nurse-to-patient ratios must be valid

### Bed compatibility
- ICU beds cannot be used for med-surg patients
- isolation requirements must be met

### Flow dependencies
- discharge requires:
  - orders complete
  - transport available
  - room ready

### Operational constraints
- transport throughput limited
- EVS turnaround time bounded
- admission batching effects

---

## Interpretation

K defines what transitions are allowed.

Pi_K enforces:
- clipping
- delay
- rejection
- collapse

Without K, the system is undefined.