# Observatory release identity

The observatory is packaged separately from the accepted completion baseline. Extract `observatory-package.zip` into an `observatory` directory and open its root `index.html`. The code, data and waveform required by this viewer are embedded in that HTML. The optional baseline link expects a separately retained sibling `accepted-baseline` directory; its 110 accepted manifest files are not copied into the observatory archive.

The standalone viewer runs without the sibling baseline. Full `verify.py` and release packaging intentionally require `../accepted-baseline/` and `../BASELINE_PROVENANCE.json` to verify the retained completion reference. Without them, full verification stops with an unavailable-file error; it does not count the baseline as verified. Keep the established baseline alongside this extracted directory when running that full check. Individual `node test_*.js` files and `python -B test_package.py` can be invoked separately for their documented local contract scopes; those passes do not certify an absent baseline.

`package_manifest.json` identifies the exact HTML, executable source revision, retained data fingerprints, current browser evidence and every archive file. `package_record.json` records the resulting ZIP hash. The source revision is content-addressed, independent of Git commit creation: canonical UTF-8/LF shell/JavaScript, assembler and generation code, cross-system executable code, and raw `data/**` plus `cross-system/snapshot/**` evidence. The declared `cross-system/frozen-1555697.zip` native-oracle fixture is included and fingerprinted as retained data; unrelated ZIP archives are excluded. Reports, screenshots, generated HTML and package outputs do not recursively change this identity.

## Finalization order

1. Finish source/data changes and build the offline HTML.
2. Exercise that build in the browser. Save fresh captures and any supporting checks/sessions under `browser-evidence/current/`.
3. Write `browser-evidence/release-capture.json` with the contract below. Do not copy prior screenshots into the current release evidence set.
4. Finalize notes, then run `python -B test_package.py` and `python -B verify.py --node node`.
5. Run `python -B package.py`. It rejects stale capture identity, evidence hashes, sources or verification inputs; verifies every ZIP entry; and preserves any previous target ZIP under `previous_release/<content-addressed-name>.zip` before replacement.

Prior screenshots, reports and exported sessions remain on disk. They are omitted from this release unless explicitly listed under the current evidence directory. No old evidence is silently relabeled. The existing accepted baseline remains unchanged and referenced by its established manifest hash.

## Capture receipt contract

The browser operator creates this receipt from the final build and actual captured files. `package.source_identity()` returns `source_version`; `build.embedded_data(...)` returns the base `sources` and new `extensionSources`. The receipt uses `extension_sources` for the latter.

```json
{
  "version": "observatory-release-capture/1",
  "release_id": "observatory-release-name",
  "entrypoint": "index.html",
  "html_sha256": "FINAL_HTML_SHA256",
  "source_version": "sha256:SOURCE_IDENTITY_DIGEST",
  "sources": {},
  "extension_sources": {},
  "captures": [{
    "id": "descriptive-capture-id",
    "path": "browser-evidence/current/example.png",
    "sha256": "SCREENSHOT_SHA256",
    "source_id": "oscillator",
    "source_sha256": "SOURCE_SHA256",
    "html_sha256": "FINAL_HTML_SHA256",
    "captured_utc": "2026-10-03T12:00:00Z",
    "caption": "What was actually observed and captured."
  }],
  "artifacts": [{
    "path": "browser-evidence/current/interaction-checks.json",
    "sha256": "ARTIFACT_SHA256",
    "kind": "browser_checks"
  }]
}
```

The empty maps and uppercase hashes above are placeholders, never a valid release receipt. A capture's `source_id` must exist in either current source map. `browser_checks` JSON must carry matching top-level `html_sha256`, `sources` and `extension_sources`. `saved_session` artifacts may be legacy sessions with `sources`, or `observatory-workspace/2` envelopes with `base.sources` and `extensionSources`. Both forms must match the current relevant source fingerprints. Plain supporting text uses artifact kind `notes`.

Validation establishes consistency between the producer's declared capture, executable, source revision and artifact bytes. It does not independently prove that screenshot pixels establish usability, audible output or every behavior. Browser observations and their limits remain explicit in the accompanying checks and captions.
