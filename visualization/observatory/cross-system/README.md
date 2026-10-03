# One prerequisite-recovery transfer

Restoring an exact current verification receipt allows the existing release packager to finish. Replaying a receipt for an older input revision fails. Re-running verification repairs that stale-receipt case, but fails when the assembled HTML itself is stale. These results come from actual execution of pre-existing release code, frozen at `1555697c4c07dd390406bb7d01a8aa2be4eb984f`.

The source is the retained finite FIFO queue fixture `T4M6`: required identity `w2` is absent from the ready queue but available in backup. Replaying the backup completes all three identities by tick 3. Raising service rate to three jobs/tick cannot supply `w2`. The native `behavior.py` computes these outcomes; proposed-transfer prose and its verdict are excluded from both methods' input.

| Functional role | Queue evidence | Release-workflow evidence | Boundary |
|---|---|---|---|
| Required prerequisite | Exact identities `w1`, `w2`, `w3` | Receipt with `passed=true` and the complete current input-fingerprint map | A file name or generic “work completed” count is insufficient. |
| Retained but not active | `w2` is in backup, absent from ready/completed | A genuine prior receipt exists outside the required active path | The target backup condition is constructed for this experiment; it is not a native backup feature of the packager. |
| Recovery operation | Append the missing backup before service | Copy the retained receipt into the required path, byte-for-byte | No receipt fields are edited. |
| Remaining constraints | FIFO order, equal unit jobs, rate and deadline | Exact HTML assembly, accepted-baseline checks and current input revision | Restoring one prerequisite does not waive other constraints. |
| Processing without recovery | More jobs/tick cannot create an absent identity | Three concurrent packaging attempts still encounter the missing receipt | Calls are not jobs/tick; no quantitative throughput law is transferred. |

Direct source links: [queue case records](oracle/queue/cases.json) (`T4M6`, lines 435–494), [queue dynamics](oracle/queue/behavior.py) (`queue_world`, lines 169–198), [release gate](oracle/release/package.py) (lines 24–28), [verification](oracle/release/verify.py) (lines 99–177), and the [existing workflow instructions](oracle/release/README.md) (lines 34–44). These readable copies are exact blobs from the bundled frozen revision. The complete frozen visualization tree includes all dependencies and the unchanged accepted baseline.

## Concrete executions

Every target starts with the active receipt absent. Each intervention runs against its own fresh isolated copy. No outcome from one action carries into another.

| Opaque case | Native change in isolated copy | Restore retained receipt | Three concurrent attempts | Verify current inputs, then package | Both methods choose |
|---|---|---|---|---|---|
| P7Q2 | None | Pass | Fail | Pass | Restore |
| M4J8 | README revision only | Fail | Fail | Pass | Verify |
| X9K1 | Assembled HTML differs from modules | Fail | Fail | Fail at verification | None of the listed actions |

Success requires a zero exit from the actual frozen packager and a newly produced archive whose content matches the current isolated input bytes and its internal manifest. Exit codes, stdout, stderr, elapsed times, copied bytes, archive hashes and content validation are retained in [results.json](results.json). These are recorded executions, not browser buttons that execute filesystem changes.

The source boundary fixtures are also evaluated with the existing queue oracle: `H9C3` has no copy of its missing identity, so all listed actions fail; `B2R8` retains every identity and does benefit from more service capacity. Recovery is therefore not substituted for every capacity problem.

## What the two methods do

[mechanism.py](mechanism.py) converts exact native facts into typed required tokens, active/backup locations, action effects and separate equality constraints. One propagation selector is reused across the queue and release workflow. Its trace identifies promoted tokens, unsatisfied requirements and blocked constraints. This is the distinct reasoning work under examination; it is an explicit, provisional role mechanism, not a new CANON numerical quantity.

[native.py](native.py) independently calculates the FIFO completion budget and the release receipt/assembly preconditions directly in their native terms. It receives the same fact packet, actions and declared intervention credits. It imports neither the role selector nor oracle outcomes. Both methods predict all nine target action outcomes and all three choices correctly. Equal success establishes no relative advantage.

The small action credits only rank otherwise feasible choices (`retry=0`, `restore=1`, `verify=2`); they are not measured costs. Results separately report source/function/line counts, role construction and selection timings, shared fact-inspection time, and actual verification/action runtime. The role implementation is larger than the native baseline. Manual authoring time was not independently instrumented, so these data cannot establish lower construction effort. Both implementations required reading the same native contracts; that effort must not be credited exclusively to either method.

No intended diagnoses, proposed-transfer verdicts or current target outcome flags are supplied to either selector. Case IDs are not selector inputs; action IDs identify returned choices and break exact cost ties but are not diagnostic clues. A real prior verification report is retained verbatim as evidence; its prior test results are not current action answers. A [local prediction digest](prediction_digest.json), including method/protocol hashes, is calculated and saved before any target intervention runs. It can be checked against the retained predictions; it is not external preregistration or a trusted timestamp. Case families were inspected during design, so “held out” means execution instances, not unseen mechanisms or a blinded generalization benchmark.

## Reproduce locally

From this directory, with Python 3.10+ and Node available:

```powershell
python -B run_pilot.py --node node
python -B test_transfer.py
```

The runner uses only [frozen-1555697.zip](frozen-1555697.zip), [frozen_manifest.json](frozen_manifest.json), the explicit [protocol.json](protocol.json), and the local pilot scripts. It needs no Git checkout, original data-lake directory, network or new acquisition. It verifies the bundle hash, safely extracts temporary copies, and runs the frozen `verify.py` once to create a genuine current receipt for the exact Git blob bytes. That unedited receipt supplies all experimental backups. This preparation accounts for checkout line-ending differences; it does not alter the frozen code or accepted baseline.

The runner writes `results.json` and `../data/transfer.json`. Temporary copies are cleaned after recording their evidence. The original accepted baseline and frozen bundle are hashed before/after. The readable `oracle/` files are source links; the executable oracle comes from the checksum-pinned ZIP, so later viewer/build changes cannot silently change its behavior.

Ten contract checks cover actual oracle agreement, opaque labels/action ordering, queue identity versus capacity, paused replay including a pause beyond the deadline, stale/failed/absent receipts, independent constraints, absence of supplied verdict flags, frozen-code/preservation hashes, and the method/protocol fingerprints attached to the predictions. No test treats agreement between the two methods alone as evidence of transfer.

## Limits and falsification

The strongest direct falsifier would be failure of restoration despite a byte-identical, current, compatible retained receipt and all other package constraints holding. A mismatch between a committed prediction and actual code would be reported as a failure. Stale receipts and stale assembly instead establish explicit boundaries; they do not test that strongest falsifier.

Descriptive resemblance is merely that processing appears stalled. Shared structure is a missing named prerequisite with a compatible retained source and an admissible recovery operation. Intervention transfer is supported here only where that operation makes the independent native task succeed. The target has no service-rate parameter, so repeated calls cannot establish a numerical queue-throughput analogy.

The packager's gate checks `passed` and exact fingerprints; it does not authenticate who issued a receipt, and it does not rerun every test itself. This pilot uses only genuine receipts but must not reinterpret package acceptance as cryptographic proof. Re-verification feasibility is bounded to the same checked executable/test/data inputs, with the documented README mutation; arbitrary revisions or runtime failures need further facts. The stale-assembly case has no build-repair action, so its rejection concerns the listed actions only.

This is a fixed-rule mechanism pilot using pre-existing software from the same local project. It is neither an open-ended reasoner benchmark nor evidence of general CANON effectiveness. The accepted viewer/evidence, original datasets, numerical core, standalone signaling example, `L_P` work and data acquisition remain separate.
