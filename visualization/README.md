# Visualization workspace

Open `observatory/index.html` for the current comparison instrument. It is a standalone offline HTML with an orbitable form, fixed-reference oscillator comparison, separate Align and Tune controls, synchronized music and bounded lake source entry. See `observatory/README.md`, `INVENTORY.md` and `browser-evidence/` for use, boundaries and exercised interactions.

`accepted-baseline/index.html` is the preserved offline viewer, copied byte-for-byte from the accepted completion release. `BASELINE_PROVENANCE.json` records custody; the baseline manifest pins its 110 files. The current instrument links to its existing queue evidence, maps and instruments.

Reproduce the observatory: from `observatory`, run `python -B build.py`, `python -B verify.py --node node`, then `python -B package.py`. Python and Node are needed for checks; neither is needed to open the offline HTML. The portable package contains this entire visualization directory and a per-file manifest.

Reproduce the accepted baseline: from `accepted-baseline`, run `python -B build.py`, then `python -B run_checks.py` (Node and NumPy required). Protected originals remain external and are reported explicitly if unavailable.

For a local HTTP viewer, run `python -m http.server 8770 --bind 127.0.0.1` from this directory and open `http://127.0.0.1:8770/observatory/index.html`.

Core implementation, theory, accepted examples, original evidence and L_P reconciliation remain separate and unchanged.
