# CANON observatory prototype

Open `index.html` directly in a modern browser. The generated HTML embeds its code, source catalogue, music annotations and stereo PCM; it requires no runtime downloads. Keep the full `visualization` directory together to use the link to `../accepted-baseline/index.html` and inspect retained raw files.

The observatory is a bounded interaction prototype. It provides a generated oscillator comparison, an original annotated music specimen, and a static lake catalogue. It does not establish CANON superiority, a universal lifecycle, physical geometry, or whole-state equivalence. Numerical core and `L_P` work remain separate.

## Use the instrument

- **Choose** selects the oscillator, music, or lake catalogue. Reference A stays fixed; candidate B is independently adjustable where supported.
- **Compare / Align** changes B's observation coordinates: time shift, gain and offset. Native source data and oscillator parameters remain intact. Candidate native time is display time minus shift. For the oscillator, offset changes position but not velocity; gain affects both. For music, the transform applies to both PCM channels, using the nearest retained sample for a shifted time. Unsupported times remain missing in inspection and comparison coverage. Time stretching is not implemented.
- **Tune model** changes the generated oscillator's frequency, amplitude, phase or damping. This produces a different model trajectory. It is unavailable for retained audio and lake metadata. **Keep candidate** saves up to twelve named oscillator parameter recipes. Phase adjustment and time shifting remain separate recorded operations even when particular settings yield similar traces.
- **Play**, **Step**, the shared time slider, speed, time span and loop controls link the form, signal view and inspection. Click the signal to scrub; Shift-drag it to adjust B's time alignment. Supplied music bars provide direct navigation.
- Drag the form to orbit, Shift-drag to pan, and use the wheel to zoom. Camera movement changes presentation only. Resize the signal panel from its lower corner; its numerical drawing uses the available dimensions.
- **Inspect** exposes native values, source metadata, selected form contributions, transformations, comparison measures, lake coverage and limitations.

## Native evidence and display geometry

The oscillator is a declared analytic equation, with position and its analytic velocity derivative on native support 0–16 seconds. Its units are synthetic `u` and `u/s`; display sampling does not turn it into measured data.

Both 3D encodings use the same ordered pair of channels and fixed A/B calibration. Signed contributions use `tanh(native value / shared scale)`. The **cohesive envelope** maps them to bulges or indentations along fixed directions. The **Gaussian surface** maps positive and negative contributions to declared display lobes. These are alternative renderings; neither is a probability model, physical surface, additional observation, or inferred lifecycle. Exact native values remain inspectable, and the rendering receipt records formulas, scales, camera, mesh and omissions.

Music uses the retained original composition **Eight bars / two phrases**: 16 seconds, 120 BPM, 4/4, stereo PCM16 at 22,050 Hz. Its notes, beats, bars, phrases and A/A′ form are supplied composition annotations, not detected structure. The waveform displays native sample extrema per pixel when necessary. The form uses channel RMS over the trailing permitted 50 ms; inspection distinguishes this derived frame from instantaneous PCM. A composed return is not evidence of feedback regulation.

The selected SOT subset retains all 296 World Bank entity records, seven income classes, four lending classes and its pull manifest. Classification relationships are recorded metadata. The 79 aggregate entries remain distinct from the 217 nonaggregate entries; aggregate membership is not invented. Blank strings, missing coordinates, unused fields and source hashes remain available. Capture-run timestamps are not observation times. Source license and version were not stated in the inspected local files.

SCM's entry describes actual taxonomy and search inventories, including the invalid `geo` query and historical fingerprint discrepancies as separate unresolved issues. Those source files are external references. MM_Lake contains only a retained schema template; this prototype's music is separately generated and is not attributed to that lake. No local lake acquisition or repair occurs here.

## Listening and saved state

**Listen** uses the shared transport. Music plays retained stereo PCM with the declared B alignment. The oscillator uses an explicit sonification: position controls a 40–880 Hz clamped pitch around 220 Hz; this audible pitch is not its native 0.5 Hz frequency. A/B can be heard separately or averaged. Playback applies a 20 Hz high-pass filter and 0.35 master gain; out-of-support audio is silent, and playback-only clipping does not alter retained samples or analysis. Playback speed changes audible speed and pitch. Browser output permissions and the local audio device still govern whether sound is heard.

**Save** includes the selected source, full source fingerprint manifest, time bounds/cursor/speed/loop, Align, Tune, retained candidates, camera, encoding, listening state, panel size, selected lake identity, picked contribution, open inspection panels, transformation receipt and rendering record. **Restore** validates the recipe and sources and recomputes both receipts before accepting the state. An explicit browser Restore action may resume a saved playing/listening state. Historical viewport pixels are not claimed as validated captures. Accepted-viewer session formats remain available in their preserved viewer; this observatory has its own versioned session contract.

## Rebuild, check and package

From this directory, with Python and Node available:

```powershell
python -B build.py
python -B verify.py --node node
python -B package.py
```

`build.py` emits canonical UTF-8/LF bytes. Raw evidence retains byte-level fingerprints; generated oscillator code is fingerprinted after explicitly declared UTF-8/LF normalization, so platform line endings do not change the executable. `verify.py` runs every local `test_*.js`, checks exact HTML assembly, PCM and supplied annotation contracts, and verifies all 110 accepted-baseline files against their retained manifest. It writes `verification_checks.json`. The package step requires that report to match current files and produces `observatory-package.zip`, containing the entire visualization tree with per-file hashes and deterministic archive metadata. Run verification again after final documentation or browser-evidence changes. Tests are separate from browser usability and listening evidence.

`prepare_lakes.py` recreates the bounded metadata export from the explicitly named local roots without changing them. `prepare_music.py` regenerates the original supplied composition and its provenance. Neither is required to open the delivered HTML.

The accepted baseline retains its body rendering-record validation, separate unvalidated capture metadata, canonical LF assembly and responsive numeric instruments byte-for-byte. This prototype adds its own strict session receipts and responsive signal drawing while keeping that implementation separate.

## Explorer reference and remaining scope

`B:\Canon\canon-explorer-reference` at revision `77d467f` was inspected for interaction concepts in `src/ui/application.py`, `time_dial.py`, `multi_viewport.py` and `docking_system.py`: shared time control, linked viewpoints and a flexible inspection workspace. No code was copied from that reference.

Spectrum/spectrogram and synchronized-signal phase remain outstanding analyses. A bounded local sampled-signal input path must retain source bytes, timestamps and units, validate sampling and channel synchronization, and represent gaps explicitly before those analyses are extended. Lake categories must not be converted into a fabricated waveform. This build has no general sampled-signal importer or music-structure inference.
