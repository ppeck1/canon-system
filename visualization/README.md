# Visualization workspace

`accepted-baseline/index.html` is the preserved offline viewer, copied byte-for-byte from the accepted completion release. `BASELINE_PROVENANCE.json` records custody; the baseline manifest pins its 110 files.

Reproduce: from `accepted-baseline`, run `python -B build.py`, then `python -B run_checks.py` (Node and NumPy required for checks; not for opening HTML). Protected originals remain external and are reported explicitly if unavailable.

The observatory interaction prototype will live separately in `observatory/`. Core implementation, theory, accepted examples and evidence remain untouched.
