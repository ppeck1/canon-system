# Visualization inventory

The visualization extension milestone is accepted and retained. The contained completion pass changes receipt validation, newline-stable assembly, and responsive plot geometry only; it adds no signal analysis or data intake.

Scope: the executable multiview build at `http://127.0.0.1:8769/index.html`, inspected before this pass and rechecked at delivery on 2026-10-02. Queue records are stipulated simulations, not measured waveforms. Timescale analysis uses separate, explicitly synthetic sampled calibration signals.

| Capability | Before accepted extension | Current delivery | Evidence and boundary |
|---|---|---|---|
| State body, manipulable camera, now/history, transverse section | Implemented  | Implemented | Named required-work Gaussian preset; exact identities remain outside its lossy geometry. |
| Over time and X–Y Relationship | Implemented  | Implemented | Native event channels, ordered same-time records, rates in a separate lane, linked cursor. |
| Independent A/B selection and shared calibration | Implemented  | Implemented | Alternative worlds remain separate; native and event-relative clocks, bounded history, explicit fit. |
| 2D Timescale map | Implemented  | Implemented | Existing complex-wavelet magnitudes for separate chirp, sinusoid and constant calibrations; permitted-prefix recomputation and support inspection. |
| 3D Timescale landscape and linked time/scale sections | Missing  | Implemented | Uses the exact existing coefficient matrix, linked selection and common magnitude bound; no additional transform. |
| System map | Missing  | Implemented | Typed identity/membership/rank/constraint diagrams now link to exact source and event records. |
| Lineage / transform map | Partial  | Implemented | Interactive feature paths include parameters, source revisions, frames, losses and rendering; calibration remains separate. |
| Actual analyzing kernel over permitted samples | Partial  | Implemented | Original conjugated kernel arrays, permitted samples, explicit zero padding, exact products and sum are inspectable. |
| Small linked workspace with persistent resizing | Partial  | Implemented | Panel heights, width share and arrangement are saved; drag resize and explicit controls were browser-tested. |
| Source drill-down, unused/unaligned evidence, saved recipe restore | Implemented  | Implemented | Revision/pointer resolver, complete retained source ledger, strict saved effective configuration replay. |
| Portable package consistency | Partial  | Implemented | Baseline corrected and frozen first; current offline HTML, modules, tests, documentation and manifest packaged together. |
| Spectrum / spectrogram | Missing for calibration; unsupported for queue categories  | Missing for calibration; unsupported for queue categories | Require a declared sufficiently sampled numeric time signal, units, sampling/missingness policy, window and normalization contracts. No temporal waveform is reconstructed from queue categories. |
| Synchronized-signal phase (including specialized stereo-phase) | Missing; unsupported for selected evidence | Outstanding; unsupported for selected evidence | Requires two synchronized numeric signal channels, known timestamps/units and an explicit phase definition. Queue counts and independent alternatives do not supply these. |
| Bounded local sampled-signal input | Missing | Outstanding; prerequisite for next expansion | Must retain the input source, timestamps, units, channel identities and provenance; validate timestamp order, sample spacing, gaps, missing values, duplicates and synchronization before analysis. Current inputs remain the queue fixtures and generated calibration signals. |
| Universal lifecycle or physical geometry | Unsupported  | Unsupported | No verified universal lifecycle contract or physical coordinates in these fixtures. Provisional events remain available. |

Baseline: `releases/baseline-multiview-20261002/integration-candidate.zip`; its HTML was verified byte-identical to assembly from its source modules. Existing instruments are extended, not rebuilt. See `BROWSER_EVIDENCE.md` for the completed-pass interaction evidence and `README.md` for added capabilities and runnable entry points.

Next expansion order: establish one bounded local sampled-signal intake path with retained source evidence and explicit sampling validation first. Then consider spectrum/spectrogram and synchronized-signal phase under declared window, normalization, missingness and synchronization contracts. Those analyses remain outstanding. Categorical queue layouts are not raw signal input.
