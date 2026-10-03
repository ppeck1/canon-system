# Browser evidence for this observatory release

These are fresh default-viewport Chrome captures of the assembled observatory at `http://127.0.0.1:8770/observatory/index.html`. The release capture receipt binds each image, the exact HTML and both source maps to one content-addressed source revision. They are separate from the accepted completion viewer and all earlier observatory screenshots.

- `polarity-counterexample.jpg`: both 50 ms RMS contributions match at 4.25 s, while the evidence inspector shows opposite signed PCM. The result states its two-channel limit, compression, native/aligned state and 100% paired window coverage.
- `annual-native-comparison.jpg`: distinct Canada/United States observations, year 1952, population in thousands on the shared 0–250000 axis. The resized plot occupies the added panel height; exact values and original cells remain visible below it.
- `transfer-compatible.jpg`: restoring the compatible receipt succeeds for P7Q2 under the frozen native release code.
- `transfer-stale-countercase.jpg`: restoring the stale receipt fails for M4J8 although its other release gates hold.

`interaction-checks.json` records ten observed checks, including legacy session compatibility, native/aligned reset, repeated year selection, layout restoration and the stale-assembly boundary. The three saved workspace files come from the actual Save dialog; `transfer-session.json` restores X9K1/action S with the functional mapping disclosure open. Every saved rendering/evidence receipt is recomputed by Restore. The final console-error query returned no entries.

Two automation limitations were resolved without changing application behavior: a full-page screenshot timed out, so these are ordinary viewport captures; a large session read was truncated by the automation interface, so the complete DOM value was read in bounded chunks before successful restoration. The browser's download-event wait also timed out, so download completion is not claimed. The viewer's Save dialog and full restore were exercised successfully.

These checks establish the stated interactions and readable evidence views. They are not a listening test, general perceptual study, new cross-domain discovery evaluation, or proof of CANON superiority.
