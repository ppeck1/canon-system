# CANON — integrate architectural boundaries now; keep the visual candidate running

Status: Proposed next-work instruction for the user to review and send to Codex.
Date: 2026-10-02.
This document does not itself authorize repository changes, data acquisition, publication, or a release. No implementation changes were performed to produce it.

## Decision

Use `canon_borrowed_principles_handoff(1).json` as architectural context now. Do not treat its ten borrowed principles as ten platforms to install or ten subsystems to implement immediately.

Make a bounded integration pass on the current spatial prototype. Preserve its existing source/evidence layer, data semantics, accepted examples, and comparative results. End the pass with a running visual candidate, not only an architecture document. Keep the core numerical CANON specification, collapse calculations, and unresolved L_P reconciliation out of this pass.

## Coherent goal

Preserve the source evidence and expose a dynamic problem through multiple explicit, source-linked observation frames. Let the user inspect a spatial body, its history, and one independently selected comparison under shared calibration. Changing a view must not silently change evidence or assert equivalence between systems. The current required-work-disposition body is a named preset, not the canonical representation of every system.

The input handoff is a proposal and its integrated architecture is a synthesis. Its references support individual borrowed ideas; they do not establish the effectiveness of CANON as a whole.

## Clarifications to carry into the design

1. **Preservation versus transform loss.** Preserve the bytes and represented content of every successfully ingested source revision. An explicit coverage gap records an acquisition or parsing limitation; it does not count as successful lossless ingestion. A transform may reduce what a view expresses, but may not delete the richer evidence. Recording that deletion happened is not permission to delete accepted sources. Reversibility of a transform and recoverability of source bytes are separate properties.
2. **Evidence custody versus factual authority.** A source record is authoritative about what was ingested from that source revision, not automatically about what happened in the world. Conflicting claims, parsing failures, and uncertain estimates remain distinguishable. Lineage is not causal proof or factual verification.
3. **Independent metadata dimensions.** Do not implement `observed`, `simulated`, `derived`, `aligned`, and `hypothetical` as a single mutually exclusive enum. A simulated record can subsequently be derived, aligned, and rendered. Preserve origin and claim status, transformation lineage, scenario/world identity, and alignment status independently.
4. **Logical boundaries, not mandatory platforms.** The evidence, structural-model, observation-frame, visual-laboratory, and comparison responsibilities can be modules in one local application. They need not be microservices, a graph database, a generic plug-in engine, or a mandatory SysML representation. Not every input must become an event stream, numerical state vector, process trace, or Gaussian body.

## What to borrow in this pass

- BP-01/BP-02: reuse the existing source-preservation envelope and ledger; give derived artifacts stable source-revision links, explicit producers, and versioned lineage. Use provenance concepts without requiring an RDF service or full event-sourcing migration.
- BP-03/BP-04: make the saved observation recipe and presentation state explicit. Separate analytical time/selection/alignment from camera animation. Save meaningful checkpoints, not every pointer movement.
- BP-05/BP-08: retain heterogeneous records and permit segments to reference multiple objects and overlap. Preserve unused and unaligned evidence. Do not infer or require a universal lifecycle.
- BP-06: reserve an explicit frame/transform applicability and scale contract. Do not implement wavelet or frequency analysis for the current short queue examples.
- BP-07: keep the spatial interface central and include perceptual/browser inspection, not only numeric/schema tests.
- BP-09: borrow precise relation and verification links where currently needed. Defer SysML import/export or runtime adoption.
- BP-10: keep modeled alternatives and observed/source history separate. Defer live digital-twin integration.

No new external framework dependency is required by this brief. Propose one only for a concrete current requirement, with its costs and a smaller alternative identified.

## First action: a narrow change map, not another broad audit

Map the current candidate's functions and saved fields to the responsibilities below. Mark each as existing, missing, ambiguous, or mixed. Inspect code before claiming a dependency problem. Refactor only boundaries needed by the current working viewer. Do not replace already demonstrated preservation mechanisms merely to give them standard-inspired names.

## Minimum boundaries

### Evidence and domain adapters

The evidence layer owns immutable/versioned source revisions and exact source locators. Domain adapters interpret identities, records, units, events, relationships, constraints and uncertainties without altering the retained evidence. The queue simulator remains a named, versioned producer of simulated records; its outputs do not become measured observations.

### Frame and transform execution

A frame selects records and defines native/relative time, anchors, channels, units, normalizations, scope and as-of policy. Each transform identifies its input/output artifact references, implementation version, parameters, preconditions, missing-value behavior, output units, uncertainty effects, reversibility and known limitations. Composition order must be explicit because changing order can change a result.

Reject or mark unsupported transforms whose prerequisites are not met. Do not make a transform available solely because it produces attractive geometry. Nonperiodic records do not acquire frequency semantics by passing through a smooth renderer.

### Visual encoding and rendering

The required-work-disposition adapter supplies its four counts, category identities and provenance. A named encoding maps those contributions into spatial geometry; the Gaussian kernel is one encoding choice. The renderer handles the supplied geometry, camera, material, contours and inspection. It must not acquire hidden authority to redefine source semantics or simulate new states.

Camera changes and a shared camera-fit operation must not change counts, units, analytical coordinates, outcomes or observation eligibility. Render softness may change geometry, but not the underlying exact category weights.

### Comparison

A comparison record owns the two selected sources/scenarios/worlds/events, pairing rationale, compatibility status, per-side time windows, shared calibration and any intentionally unaligned dimensions. Same shape is not whole-state identity. When meanings or calibrations are incompatible, expose that status rather than silently forcing an overlay to imply comparability.

### Saved session and analytic lineage

Keep a single effective configuration from which both the renderer and the export are derived. Record source revisions, adapter/frame/encoding/kernel/renderer versions, selected records, native clocks, time mappings, per-side windows, common scales, camera and viewport rules. Validate supported combinations on restore. Unknown or incompatible versions must be rejected with a useful explanation or explicitly migrated; no silent substitution.

Use source hashes/IDs by reference in saved views, with a source resolver and an explicit missing-source state. Do not require each future view file to duplicate every source artifact; an optional portable bundle can contain referenced sources. Derived caches are replaceable and must be keyed by relevant source revisions, method versions, parameters and observation cutoffs. Do not implement distributed cache infrastructure for this pass.

## Carry forward the previously identified visual issues

These are findings of the prior review, not newly rerun in this architectural addendum:

- Apply trailing windows per A/B selection before constructing a common display domain; unequal now-times must not silently widen each side's requested history.
- Validate kernel and relevant rendering compatibility during restore, not only the source hash and mapping version.
- Add an out-of-frame notice and an explicit shared `Fit both bodies` camera operation that preserves common data calibration.
- Keep equal-style solo inspection or A/B style swapping available to judge shape without one material treatment dominating.

## Bounded demonstration of replaceability

Keep the current four-category body working. Exercise the frame boundary with the smallest genuinely supported alternate perspective, selected from already reviewed data. Native/event-relative frames already provide a low-risk test; a service-budget perspective is optional only when its domain preconditions and formula are made explicit. Do not acquire another dataset or build a universal mapping catalogue for this purpose.

The acceptance question is whether changing the supported view uses the same retained evidence and declared interfaces, rather than rewriting the source schema or embedding another set of domain rules throughout the renderer. A thin test adapter/encoding can also demonstrate that the renderer is not structurally tied to exactly four category names.

## Acceptance evidence

- Original-source bytes and identities remain unchanged; every scoped source element remains accounted for, and missing/unsupported items are distinguishable from zero or absence.
- All accepted mapping/count outcomes remain unchanged except for explicitly documented display corrections.
- Each visible contribution can resolve its source and derivation; aggregate geometry need not carry an enormous record list at every mesh vertex if the selection resolver can recover the contributors precisely.
- Camera changes leave analytical outputs and their provenance unchanged.
- Changes to frame/anchor/window or spatial encoding are recorded in the correct part of the effective configuration.
- Future-only record edits do not alter an earlier as-of view; display policy is not represented as a security barrier when future data is bundled locally.
- Alternative worlds stay distinct. Do not invent a probability distribution or average worlds into an unprovided trajectory.
- A/B windows and actual shared bounds match the exported recipe.
- Exact source replay, exact derived-value replay, and pixel-identical rendering are separate claims. Any approximate inverse has a declared domain and tolerance; arbitrary browser pixel identity is not assumed.
- Restore checks source and implementation compatibility; source access failure or unsupported versions remain visible.
- Replacing or varying one supported frame does not mutate the evidence layer or require a new universal CANON state vector.
- Browser inspection demonstrates the working body, comparison, history, fit behavior, drilldown and state restoration through an allowed route. Report unverified browser paths explicitly.

## Stop boundary

Stop when the existing visual candidate runs through these boundaries, the contained display corrections are made, a small alternate-frame/encoding exercise succeeds, and the supporting tests and browser evidence are recorded. Do not continue into a universal ontology, automatic lifecycle discovery, wavelet analysis, SysML integration, live twins, another effectiveness benchmark, or a redesign of the mathematical core.

Return a concise change map, the runnable viewer, saved-session/transform contract examples, tests and browser evidence. The user should still be able to inspect the body immediately; provenance depth belongs in progressive disclosure, not a permanently dominant report panel.

## Reference basis

Primary requested source: `canon_borrowed_principles_handoff(1).json`, artifact version 1.0.0. See `/coherent_goal`, `/core_invariants`, `/borrowed_principles`, `/suggested_architecture`, `/transform_contract`, `/anti_goals`, and `/source_use_policy`. The refinements and sequencing in this brief are recommendations, not quotations or claims that the source already implements them.

Independently consulted primary documentation supports only the borrowed engineering concepts:
- W3C PROV Model Primer: entities, activities, agents, generation and derivation.
- ParaView filtering documentation: explicit source/filter/view pipelines with typed input requirements.
- ParaView animation documentation: separation of data time, scene time and camera animation.
- Microsoft Event Sourcing pattern: immutable event history/materialized views and substantial adoption trade-offs.
- Process Mining event-data reference: event/object perspectives; not proof of a universal lifecycle.

These references do not validate CANON's comparative usefulness, its numerical core, or the selected Gaussian representation.
