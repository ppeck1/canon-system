# CANON: linked instruments, structure and timescale inspection



## Current contained completion pass

The accepted visualization extension remains intact. Open `index.html` offline or the running preview at http://127.0.0.1:8769/index.html. `integration-candidate.zip` contains the current matching HTML, source modules, checks, documentation and manifest. The accepted extension archive remains under `releases/multiview-extension-20261002/`.

- **Body receipt:** restore recomputes the full semantic `rendering_record`, including field formula, mesh settings, coordinate units and ordered history timestamps. `rendering_capture` separately retains past viewport, clipping bounds and fit diagnostics labeled `unvalidated_historical_capture`; these observations are not trusted as recipe inputs. Existing combined saved receipts still restore after the same semantic validation and capture separation.
- **Deterministic HTML:** code/template line endings become LF explicitly, and HTML is emitted as UTF-8 bytes without BOM. Assembly checks exercise LF, CRLF and CR source copies. Raw evidence bytes and their hashes are not normalized, and original JSON string values are retained.
- **Responsive numeric inspection:** Over time, X–Y Relationship and rate lanes use CSS-pixel geometry with readable labels. More panel height increases plotting space. Timescale maps, sections, raw signal and kernel inspection respond to their container dimensions using the same cached coefficients and calibration. Very small panels can scroll to preserve minimum usable drawing space; resizing never reinterprets native values.

Use the existing layout controls or panel resize corners, then Export / Restore view to save the layout with the analytical recipe. `extension_checks.json` records the current contract, independent numerical, preservation and assembly checks; the completion section in `BROWSER_EVIDENCE.md` records actual browser verification separately.

Current checks: all 13 Node suites and three Python verification commands pass. All 152 protected originals and six evidence copies remain unchanged. Browser resizing, linked selections, rate-lane visibility, receipt rejection and restoration are recorded in `browser_completion_checks.json`. The body-linked history and transverse plots also retain 12-pixel labels and use additional height when their existing lower panels are resized.

Spectrum/spectrogram and synchronized-signal phase remain outstanding. The next expansion must first establish a bounded local sampled-signal input path retaining source data, timestamps, units and provenance, with explicit sampling and missingness validation. No arbitrary data intake or new analyses are introduced here. See `VISUALIZATION_INVENTORY.md`.

## Accepted visualization extension

Open **index.html** directly for the offline viewer, or use the running preview at http://127.0.0.1:8769/index.html. **integration-candidate.zip** is the current portable release; its manifest verifies every included file and exact HTML assembly. The prior multiview build was frozen before feature changes under `releases/baseline-multiview-20261002/`. Release archives are excluded from the current ZIP.

The first instrument group remains: State body, Over time, X–Y Relationship, independent comparison, event/history/transverse inspection, and complete source drill-down. The extension adds:

- **Timescale · 2D / 3D**: the existing transform result supplies both views. Height and color share its magnitude bound. A single coefficient cursor links the map, landscape, raw permitted support, time/scale sections and analyzing kernel. Camera movement changes presentation only. The mesh joins existing coefficients for rendering; it creates no analytical samples.
- **System map**: required identities, ready FIFO rank, listed backup membership and completion at the exact selected queue event. Clicking an identity opens the matching native record and source pointers. Declared constraints, derived set relations and unverified source claims have separate types; no new hypotheses are inferred.
- **Lineage / transforms**: inspectable source revision, frozen producer, selected record, native channel derivation, frame and visual encoding/rendering. Native counts and required-work Gaussian weights have separate branches. A separate calibration branch traces the selected coefficient and its permitted support.
- **Actual kernel inspection**: original conjugated complex kernel weights from the existing analyzer, permitted raw sample values, explicit zero padding, complex products and their coefficient sum. The rendering Gaussian and the analyzing wavelet are different, named operations.
- **Linked workspace**: choose a primary view and numeric/System/Lineage companion, stack or place them side by side, set panel heights and width share, or resize panel corners vertically. Layout is saved with the recipe. Below 900 CSS pixels panels stack; native values and analytical settings remain fixed.

For a queue inspection, use the default backup case, open System map and click **w2**. Before replay it is backup-only; after advancing one event at the same native time, it is at the tail of the ready queue and its backup copy remains listed. Source inspection highlights the same selected identity. Alternatives retain separate records and worlds.

For a coefficient inspection, open Timescale, select a sample/frequency in either map or landscape, and inspect the shared readout and sections. Raw support and the actual complex kernel use only permitted samples. A prefix endpoint truncates the input before recomputation; zero padding is labeled separately from observed zero values. Queue events are never fed to this transform.

Export includes the effective recipe, both cameras, panel layout, selected identity/channel/coefficient and a reproducible rendering record. Restore validates source and implementation versions and recomputes the configuration. Existing saved views are validated before the UI supplies defaults for newly available presentation controls. No source data, numerical core, benchmark result, accepted standalone example or core `L_P` work is changed.

The completed check run is recorded in `extension_checks.json`: 10 Node suites, independent NumPy reference, protected-source verification and exact offline assembly (13 commands, all passed). Browser interactions are recorded separately in `browser_extension_checks.json`. All 152 protected originals and six copied evidence files remain unchanged.

To rebuild/check: `python build.py`, then `python run_checks.py`. Node.js is required for the contract suites; Python with NumPy is required for the independent numerical reference. The offline HTML itself needs only a browser. To create another immutable package use `python package_candidate.py --release-label YOUR-NEW-LABEL`; existing release labels are never overwritten.

Saved examples for this pass: `example-timescale-landscape.json`, `example-system-workspace.json`, and `example-kernel-inspection.json`. The latter saves the exact kernel offset as well as the coefficient.

See **VISUALIZATION_INVENTORY.md** for the executable inventory and unsupported prerequisites, **BROWSER_EVIDENCE.md** for interaction evidence, and the check reports for their distinct numerical, preservation, contract and browser scopes. Historical sections below describe the retained earlier passes.

## Retained first multiview pass

The existing integration now has **State body**, **Over time**, **Relationship (X–Y)**, and a separate **Timescale map** calibration. Launch `index.html` offline or open the local preview at http://127.0.0.1:8769/index.html. The source bundle and frozen benchmark artifacts are unchanged.

Case selectors show verified descriptions of their initial conditions. Actions and possible initial-rate alternatives use ordinary language. Stable case/action IDs, label versions, and exact source pointers remain under Technical details. Initial titles never report a future result.

To inspect the backup example, keep the default case and action, choose Relationship, and move **Ordered now A** to event 4. The retained replay path is (2,3) before action, (3,3) after action at the same zero timestamp, then (2,2), (1,1), (0,0). Add a comparison to see the default Continue processing action end at (0,1). Choose Over time as the linked companion. Clicking an event selects the same exact record in both views, the body, and evidence inspection. Selecting an earlier event deliberately limits the visible prefix; use the ordered slider or Next event to advance again.

Numeric views read identity counts and configured rate from retained event records through `channels.js`; they never sample the Gaussian mesh. Automatic axes share the maxima of the selected A/B prefixes and remain stable during pan. Manual vertical bounds are explicit, including a clipping notice. Counts use jobs; configured rate and actual completions use a separate jobs/tick lane. Actual completions are service-event dots, unavailable at action records; they do not imply dwell in Relationship. Other queue states are held between stipulated events. Carry-in is prior evidence at a window boundary, not a fabricated event. Native/aligned clocks, original deadline, pause duration and per-side windows remain explicit. Camera and surface softness affect only the body.

**Timescale map** analyzes its own labeled synthetic sampled signal: a known chirp, 12 Hz sinusoid, or constant. It does not derive frequencies from queue records, category positions or Gaussian geometry. The raw permitted signal remains beside the map. Retrospective mode uses the full signal; prefix mode recomputes with only samples through the inclusive endpoint. Inspect a coefficient with the sample/frequency controls or by clicking the map to see its observed support and zero padding. The pale edge overlay is a declared convention, not a significance test. Magnitude loses phase and covers only the declared 4–32 Hz scales. See `TIMESCALE_CONTRACT.md` for equation, normalization, sample spacing, source revision, limitations and independent-reference results.

Export/Restore records primary/companion views, channels, range, pan, exact ordered cursor, frames, camera, label/transform versions and calibration cursor. All five earlier `/2` saves remain supported. Unknown versions and inconsistent recipes are rejected explicitly. Restoring an older save opens the modern instrument shell with defaults; its original effective configuration is validated before that presentation upgrade.

Run the preceding checks plus:

```text
node test_channels.js
node test_instruments.js
node test_multiview_session.js
node test_timescale.js
python -B reference_timescale.py
```

The new grouped checks pass: 13 channels/naming, 17 direct-view, 15 session and 9 transform controls. Independent NumPy checks cover 172,080 coefficients with maximum normalized error 1.40e-15 against 1e-10 tolerance. This is a bounded calibration implementation check, not a CANON superiority benchmark. Browser observations are recorded in the appended section of `BROWSER_EVIDENCE.md`. `example-multiview.json` and `example-timescale-prefix.json` were exported through the browser and can be restored.

## Previous architecture pass

Open **index.html** in a desktop browser. It is self-contained and works offline. The running local preview is `http://127.0.0.1:8769/index.html`. The previous candidate remains intact in `../state_body_visual_2026_10_02` (its preview uses port 8768).

The body remains the first view. Drag to orbit; Shift/right-drag pans; the wheel zooms. **Fit both bodies** changes one shared camera and reports clipping. It does not normalize counts, change the kernel, or change either source selection. **Solo A**, **Solo B**, and side-by-side use equal filled materials; overlay uses teal surface and amber wireframe.

**Same evidence · two clocks** loads B2R8/A and B2R8/C at native 2 seconds, with a one-second trailing history. Change **Time coordinates** from native to event-aligned. A's first completion is at 2 seconds, B's at 1 second. The same retained events and counts occupy display windows `[-1,0]` and `[0,1]`; the source delay remains inspectable. This is the small alternate-frame exercise, not a new model or effectiveness test.

**Visual examples → V02** retains the absent-versus-backup comparison. **Inspect Backup only identities** resolves B's `w2` to the original `/cases/6/facts/backup_payload_ids`. **All source fields** includes all 670 ledger nodes, unused fields and the six unaligned sensor cases.

Export is a meaningful manual checkpoint. The visible JSON can be copied and pasted into **Restore view**. It records source revisions by reference, a single effective configuration, precise selected records, frame windows, transformations, calibration, camera and actual rendering bounds. Unknown source/kernel/renderer/frame/etc. versions and inconsistent recomputations are rejected. The old `view/1` format is not silently migrated; use the unchanged prior viewer for those saves. Source-byte recovery, derived-value replay and pixel identity are separate claims.

`CHANGE_MAP.md` is the concise code-to-responsibility map. The three supplied handoff files are unchanged under `context/`; `context_manifest.json` pins their hashes. The borrowed principles are architectural context, not installed platforms or validation of CANON. `rendering_contract.json` retains the existing named Gaussian preset's mathematical/display definition; versioned executable boundaries and actual settings are in the modules and exported checkpoints. The architecture pass left the numerical core, `L_P`, acquisition, lifecycle discovery and comparative-effectiveness work unchanged. The later user-facing pass adds a separately sourced calibration transform, described below.

## Run the checks

```text
python -B build.py
node test_mapping.js
node test_boundaries.js
node test_integration_review.js
python -B verify_preservation.py
```

The architecture-pass results were **16 existing mapping checks + 6 boundary checks + 12 independent integration checks**. The renderer tests use a canvas stub and do not establish perceptual usability. `BROWSER_EVIDENCE.md` records actual browser interaction and screenshots. `preservation_checks.json` verifies **152 protected originals**, including all 32 files of the prior spatial candidate, and **six byte-identical evidence copies**. The source data producer was not rerun.

Actual browser-exported examples: `example-native.json`, `example-aligned.json`, `example-unequal-windows.json`, `example-fit.json`, `example-comparison.json`. Load them through Restore view. The ZIP includes the referenced source bundle for portability; saved JSON itself does not duplicate the full input artifacts. Python and Node are needed only to rebuild or check, not to open the HTML.
