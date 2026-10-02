# Timescale map: calibration transform contract

Contract: `calibration-cwt/1`  
Status: bounded transform implemented after the direct views were built; JavaScript, independent NumPy, and analytic controls passed. Browser integration remains a separate check.  
Scope: a separate, explicitly synthetic calibration signal. The retained queue cases, Gaussian body, case identifiers, and concatenated alternative worlds are not transform inputs.

## Purpose and eligibility

The first map shows how a declared, sufficiently sampled numeric signal appears at different analysis scales. It is not evidence of periodic behavior in the queue fixtures or an effectiveness claim for CANON. The raw calibration trace remains visible next to the map.

For a selected queue case, show: “This view needs a sampled numeric signal with supported scales. This case contains a short event history. Use Over time / Relationship, or open the labeled calibration signal.” The limitation is the evidence and analysis question; wavelets can also describe transients.

Version 1 accepts only its own named calibration sources. A future external numeric adapter requires a separate source and sampling contract. This bounded implementation does not resample events, infer intermediate measurements, detrend, smooth, normalize each frame, or fill missing samples.

## Source and sampling

All three fixtures use sample rate `fs = 128 Hz`, spacing `dt = 1/128 s`, and `N = 1024`. Sample `n` occurs at `t[n] = n/128`, for `n = 0..1023`. The acquisition interval is `[0, 8)` seconds; the last observed sample is at `7.9921875 s`. Values are dimensionless calibration amplitudes. No randomness is used, so a seed is not applicable.

| Fixture ID | Plain-language title | Generating equation | Known structure |
|---|---|---|---|
| `chirp` | Synthetic rising-frequency signal | `x(t) = sin(2*pi*(6*t + 1.25*t*t))` | Phase derivative gives instantaneous frequency `6 + 2.5*t Hz`, from 6 Hz toward 26 Hz. |
| `sinusoid` | Synthetic 12 Hz sine wave | `x(t) = sin(2*pi*12*t)` | One constant-frequency, unit-amplitude component. |
| `constant` | Synthetic constant signal | `x(t) = 1` | No changing component; finite-record edges and the chosen wavelet's tiny nonzero mean must remain distinguishable. |

Each source retains `id`, `source_kind: synthetic_calibration`, `source_revision: calibration-signals/1`, `channel_id`, `units`, `equation`, `sample_rate_hz`, `sample_spacing_s`, full sample timestamps/values, `missingness: none`, and `random_seed: not_applicable`. The version is a generating-contract revision, not a claim of a cryptographic digest. Any equation or sampling change requires a source revision change. A future saved arbitrary source must have independently resolvable source custody rather than rely on these fixture IDs.

Reject nonfinite values, absent values, mismatched lengths, duplicate timestamps, nonincreasing timestamps, and spacing departures exceeding `max(1e-12 s, dt*1e-9)`. Missing records are never zeros. Require at least 64 selected samples and return a readable eligibility reason otherwise. The anti-aliasing policy is “none applied; native analytic fixture sampled at the declared rate.” The analysis passband ends below Nyquist and does not certify arbitrary future signals as alias-free.

## Transform definition

The browser implementation is `cmor-sampled-convolution/1`: direct discrete convolution against a complex Morlet kernel in Float64 arithmetic, with no external browser dependency. Browser rendering is downstream from these numeric results.

Fixed wavelet: complex Morlet `cmor1.5-1.0`, with bandwidth `B = 1.5` and center parameter `C = 1.0`:

```text
psi(u) = exp(-u*u/B) * exp(i*2*pi*C*u) / sqrt(pi*B)

W[a,b] = (1/sqrt(a)) * sum_n x[n] * conjugate(psi((n-b)/a))
```

Scale `a` and translation `b` are expressed in samples. This is a sample-normalized convention; no `dt` factor enters the coefficients. Retain both real and imaginary components. The map displays `abs(W)`, not `abs(W)^2`, amplitude spectral density, probability, or significance. Label its color scale “CWT coefficient magnitude (sample-normalized calibration units)”. A physical-time-normalized transform would multiply by `sqrt(dt)` and would require a distinct declared output convention. Version 1 offers no logarithmic strength control, avoiding an undefined dB reference.

Use 48 logarithmically spaced center-frequency labels from 4 through 32 Hz, inclusive. For row `j = 0..47`, `f[j] = 4 * 8^(j/47)` and `a[j] = C/(f[j]*dt)`. The resulting scales run from 32 to 4 samples. The map can draw higher frequencies at the top without changing this stored row order. Metadata contains the actual scale and frequency arrays, not just their endpoints.

Frequency labels are the selected wavelet's center-frequency-to-scale mapping, not exact recovered local oscillation frequencies. In particular, raw scale-normalized coefficient magnitude can bias a ridge slightly relative to the generating frequency. No exact per-sample ridge claim is permitted. A longer kernel improves frequency selectivity while spreading temporal support; parameter changes, if introduced later, are analysis changes with a new saved configuration.

The kernel is truncated to `abs((n-b)/a) <= 8`; integer offsets are therefore `-floor(8*a)..floor(8*a)`. Outside the selected record, use zero extension. Record `kernel_support_normalized: [-8,8]`, `padding: zero`, `preprocessing: none`, and `detrending: none`. Version 1 never silently subtracts the record mean. The selected complex Morlet has a very small nonzero mean; the constant control is expected to have tiny interior residuals and visible boundary responses, not mathematical zero everywhere.

## Boundary and support accounting

Every coefficient exposes its actual input sample range, corresponding time range, requested kernel range, and whether zero extension contributed. Supporting samples have unequal kernel weights; the support interval is not a claim that each sample contributes equally.

Provide a separate edge-risk mask using the declared convention:

```text
edge_radius_samples(a) = sqrt(B) * a
edge_affected(a,b) = min(b, selected_count - 1 - b) < edge_radius_samples(a)
```

This is the time radius where the Morlet amplitude envelope falls to `1/e` (its power envelope to `exp(-2)`). It is a chosen cone-of-influence convention, not a universal confidence or significance threshold. The actual finite computational support, `8*a` samples on either side, is wider. Distinguish “inside the displayed edge-risk region” from “kernel touches zero padding”; do not label the unshaded area unconditionally reliable. Keep edge-affected coefficients visible under a distinct overlay rather than convert them to zeros.

Coefficient selection reports fixture/revision, center sample/time, frequency/scale, real/imaginary/magnitude values, the observed supporting interval, padding status, and edge-risk status. It must not claim that a coefficient comes from only its center timestamp. A pulse or step's broad frequency response is not proof of a repeating cycle.

## Retrospective and as-of modes

`retrospective` analyzes all 1024 source samples and visibly states that coefficients may depend on later samples. A cursor or display crop does not change that fact.

`prefix` accepts an inclusive, zero-based `asOfIndex` in `63..1023`; saved-view `instrument.calibration.endSample` has the same meaning. For example, `512` means the first 513 samples. Slice timestamps and values **before** convolution, then recompute all coefficients, support intervals, and edge masks against that prefix. Samples beyond the endpoint must not influence preprocessing, coefficients, automatic color bounds, or coefficient details. There is no full-data-compute-and-crop shortcut.

Prefix mode is still a centered transform of the retained prefix. A coefficient earlier in that prefix may use samples after its center but no later than the selected as-of endpoint. It is not a streaming causal filter. The known generating equation/frequency overlay is calibration metadata, not an extra source of measured future samples.

Display window and coordinate alignment remain separate from the transform input interval. Panning or cropping the map changes presentation only and retains the transform interval in details. Changing the analysis interval or as-of endpoint must recompute and update provenance.

## Module API

Export one UMD-style `CanonTimescale` object for browser and Node use:

```javascript
makeCalibration(kind) // chirp | sinusoid | constant -> declared sampled source
analyze(signal, { mode: 'retrospective' | 'prefix', asOfIndex, contractVersion })
coefficientSupport(result, scaleIndex, sampleIndex)
eligibility(source) // {available, reason}; explicit queue-fixture limitation
```

`analyze` returns contract/implementation versions, source/channel/revision, selected source indices and times, sampling and missingness metadata, input interval, mode/as-of endpoint, wavelet and normalization, scales/frequencies, complex coefficients and magnitudes in `[scale][sample]` order, edge-risk flags, support/padding policy, and display-limit guidance. Results retain the raw selected trace. `contractVersion` is optional; an explicitly unsupported version is rejected. Unknown options and invalid configurations fail explicitly rather than fall back silently. The exposed coefficient arrays are `real`, `imag`, and `magnitude`; associated fields are `times_s`, `values`, `frequencies_hz`, `scales`, and `edge_affected`. Support indices are inclusive.

State-body camera and Gaussian softness are not arguments and cannot affect coefficients. The calibration signal is its own source context; queue scenario/world IDs must never be attached as if it were derived from a queue. Changing calibration kind does not mutate a queue selection or its retained evidence. Like-for-like comparisons require a shared color scale; do not normalize each panel independently. A single-panel automatically chosen maximum is allowed only when exposed and computed from its permitted transform result, with the same reference used for comparison.

## Bounded implementation checks

These checks validate the transform implementation, not a new CANON benchmark or audit program:

1. Check fixture equations, timestamps, source versions, scale conversion, dimensions, numeric finiteness, and invalid/missing input rejection.
2. Compare browser coefficients against an independently written NumPy vectorized evaluation of the declared discrete sum. Target normalized maximum absolute complex error `<= 1e-10` for these small fixtures. The reference must not import or call the JavaScript implementation.
3. Check the 12 Hz sinusoid against its analytic complex-Morlet response away from edges; use a stated bound for finite kernel tails. Check the constant interior against the declared tiny nonzero wavelet mean rather than require exact zero. These controls reduce the chance of both implementations sharing a sign, scaling, or frequency error.
4. Optionally use PyWavelets as an additional library cross-check. Its CWT uses an integrated-wavelet discretization, so direct sampled convolution is not promised bit-identical. Record actual version, discretization difference, observed tolerance, and whether the check was available; never relabel NumPy as a PyWavelets comparison. The bundled Python has NumPy 2.3.5 and does not have PyWavelets. No dependency was installed and no PyWavelets comparison is claimed.
5. Confirm that modifying every future sample after `asOfIndex` leaves prefix coefficients, edge masks, support, and display limits unchanged. Confirm prefix-boundary coefficients differ from a cropped retrospective result when later data would contribute.
6. Visually verify the raw signal, units, 4–32 Hz axis, visible edge overlay, coefficient support, and mode label in the browser. Compare the known chirp frequency with the map over the useful interior using a declared coarse tolerance; do not demand exact ridge recovery everywhere.

Magnitude omits phase; finite scales omit other frequencies; zero extension is an assumption; truncation and sampling approximate a continuous integral. The display has no generic inverse-CWT or lossless-recovery promise. No spectrum panel, coherence, automated cycle discovery, queue-frequency inference, or 3D coefficient surface is required for this bounded map.

### Recorded numeric results

`test_timescale.js` passes nine grouped controls, including missingness rejection, scale conversion, support accounting, no future-data influence in prefix mode, and disagreement between prefix recomputation and retrospective cropping. `reference_timescale.py` separately generates all input equations and uses NumPy complex convolution; it does not call the JavaScript algorithm to calculate reference values. `timescale_reference_results.json` records all four comparisons (three full signals and the 513-sample chirp prefix), covering 172,080 complex coefficients.

- Maximum normalized absolute complex difference from the independent NumPy reference: `1.40e-15`, against `1e-10` tolerance.
- Maximum unpadded sinusoid absolute complex difference from the analytic response: `9.34e-14`, against `1e-10` tolerance.
- Maximum constant interior difference from the analytic nonzero wavelet mean: `3.66e-16`, against `1e-10` tolerance. Its largest unpadded magnitude is about `2.11e-6`; boundary responses remain visible.
- For the chirp's 2–6 second interior, raw-magnitude ridge relative error has median `1.50%` and 95th percentile `3.51%`, within the declared coarse `6%`/`10%` checks. This is a calibration-specific check, not an exact-frequency or real-world accuracy claim.

These are transform implementation results only. They do not establish the browser labels, saved selection, or rendering until the separate browser checks are completed.

## Primary references inspected 2026-10-02

- [PyWavelets CWT documentation](https://pywavelets.readthedocs.io/en/latest/ref/cwt.html): complex Morlet definition, sample normalization, scale/frequency conversion, finite support, and low-scale aliasing. Its library implementation is a possible reference, not the proposed browser runtime.
- [MathWorks: Boundary Effects and the Cone of Influence](https://www.mathworks.com/help/wavelet/ug/boundary-effects-and-the-cone-of-influence.html): boundary effects and the dependence of COI interpretation on the declared convention.
- [MathWorks: Time-Frequency Analysis and Continuous Wavelet Transform](https://www.mathworks.com/help/wavelet/ug/time-frequency-analysis-and-continuous-wavelet-transform.html): time/frequency localization and coefficient-magnitude maps. These sources support analysis concepts, not CANON efficacy.

## Subsequent multiview rendering and kernel inspection

The next authorized visual pass adds `timescale-landscape/1` and `timescale-multiview/1`. The numerical contract remains `calibration-cwt/1`; `analyze` remains `cmor-sampled-convolution/1`, with unchanged coefficients, support rules and source fixtures. The earlier bounded-map scope above describes its original milestone, not a prohibition on this subsequent rendering extension.

`TimescaleLandscape` consumes the same `result.magnitude[frequencyRow][sampleIndex]` object used by the 2D map. Every coefficient is a mesh vertex: no row or sample decimation, new transform, fitted surface or reconstructed signal is introduced. Adjacent native coefficient samples form projected quadrilateral faces. This spatial interpolation is a drawing choice; intermediate points are not new analytical coefficients. Each face uses the color of its lower-index existing coefficient. The 2D midpoint cells and 3D faces use one color function and one bound, `result.display.magnitude_max`, computed from the permitted transform result. Height is linear in that same magnitude bound. A changed result can have a changed bound, so independently ranged signals are not directly comparable by color strength.

The displayed coordinates are native permitted time, logarithmic scale-center frequency, and magnitude in sample-normalized calibration units. For the declared square scene, x spans −3.3 to 3.3 over the first and last native sample times, y spans −2.2 to 2.2 over the log-frequency bounds, and z is `3.2 * magnitude / maximum` (zero when the maximum is zero). The renderer adds no analytical kernel. It uses orthographic camera projection; yaw/pitch are radians, pan is CSS pixels and zoom is a dimensionless display factor. Canvas bounds clip projected geometry. There is no hidden peak fitting, coefficient culling or temporal interpolation. The existing edge flags receive the same white alpha-0.25 presentation overlay in both views; this is not significance or uncertainty calibration.

The single selected row/sample drives both views, the exact coefficient readout, the native raw-support highlight, and two sections. The time section is the selected matrix row; the frequency section is the selected matrix column. Both sections retain the shared magnitude bounds and join existing values only for display. A landscape face pick selects its nearest original projected vertex; keyboard arrow controls and the native sample/row controls remain available. The original state-body camera and this landscape camera are separate saved settings.

`TimescaleLandscape.renderingRecord(result, {camera, row, sample, viewport})` is the pure record constructor also used by `Scene.manifest()`. It records exact data axes, bounds, matrix dimensions, projection, style and selection. The optional viewport records an actual scene's pixel dimensions; it is not an analysis input. `TimescaleUI.getSelection(recipe)` resolves that recipe through the same transform cache whether or not its panel is active. Camera, row/sample selection, layout and kernel-term inspection are excluded from the analysis cache key. Camera gestures change the recipe through event handlers, not through render-time clamping or source mutation.

The additive `CanonTimescale.inspectKernel(result, row, sample)` API has inspection version `calibration-kernel-inspection/1`. It returns copied, frozen arrays from the actual private `kernels[row].re/im` used by `analyze`; it does not independently redraw a formula to stand in for those weights. `kernelRadius(row)` reads the corresponding original stored radius. The imaginary array is already conjugated, as used in the original discrete sum. Every finite-support offset exposes the exact stored real/imaginary weight, its native source index/time/value when permitted, or explicit zero padding when outside the selected interval. A padded term has no source observation (`source_value` and `source_time_s` are null); its requested mathematical time and zero contribution remain explicit.

The inspector also exposes each real/imaginary product and re-sums permitted terms in the analyzer's original order. The recorded sums match the existing complex coefficient exactly in the checked edge and interior cases. Kernel-term inspection links a selected offset to the corresponding raw source sample and a full numeric JSON record. Human-readable values use nine significant digits without altering exponents; the JSON retains the original JavaScript numeric values. Downloadable kernel evidence contains all copied weights and terms, not just the currently highlighted contribution.

The selected `recipe.kernelOffset` is saved and validated against the stored radius; missing legacy offsets mean zero. Restoring a recipe selects that offset rather than retaining another inspection's transient state. An explicit row-changing UI action resets an out-of-support offset to zero before requesting a new render. Rendering itself never silently clamps an imported offset.

`node test_timescale_landscape.js` runs nine grouped checks covering shared cache/result identity, inactive-panel recipe resolution, every coefficient vertex, original-kernel copies and bit-exact sums, prefix isolation, strict camera behavior, actual-row/sample picks, common bounds, saved term selection and scientific-number formatting. The nine original `test_timescale.js` controls still pass. These numerical/API checks use a canvas stub and do not establish visual usability; browser captures and interaction checks are reported separately by the integration task.
