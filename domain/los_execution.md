# los_execution

## Unit of analysis

Hospital unit (e.g., med-surg, ICU)

---

## Time step

Discrete step:
- 15 min to 1 hour typical

---

## Inputs

- admissions
- discharges
- transfers
- staffing changes
- delays (transport, cleaning, orders)

---

## Constraints (K)

- bed capacity
- staffing ratios
- bed-type compatibility
- isolation rules
- service assignment rules

---

## Interpretation

The system evolves as:

- load increases → Gamma increases
- throughput responds → T increases
- regulation increases → Pi increases
- capacity shrinks → Omega_V decreases

Collapse risk emerges when:
- Delta_c_star decreases
- A_s shrinks
- C_x degrades

---

## Key insight

Metrics may appear stable while:
- viable state space collapses
- recovery paths disappear

This is where current dashboards fail.