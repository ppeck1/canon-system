"""Read-only hash verification; writes reports only in this visual candidate."""
from pathlib import Path
import argparse
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parent
PRIOR = ROOT.parent / "trace_instrument_conformance_2026_10_02"


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def fingerprint(path):
    raw = path.read_bytes()
    return {"path": str(path.resolve()), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def initialize():
    output = ROOT / "protected_inputs.json"
    if output.exists():
        raise RuntimeError("Protection baseline already exists; it will not be overwritten.")
    previous = load(PRIOR / "protected_inputs.json")
    entries = {entry["path"]: dict(entry, baseline_origin="inherited_previous_accepted_protection") for entry in previous["files"]}
    # Verify inherited expected hashes before adding any current snapshot.
    for entry in entries.values():
        actual = fingerprint(Path(entry["path"]))
        if (actual["sha256"], actual["bytes"]) != (entry["sha256"], entry["bytes"]):
            raise RuntimeError("Previously protected original no longer matches: " + entry["path"])
    added = 0
    for path in sorted(PRIOR.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts:
            entry = fingerprint(path)
            entry["baseline_origin"] = "accepted_trace_prototype_read_only_snapshot"
            if entry["path"] not in entries:
                entries[entry["path"]] = entry
                added += 1
    result = {
        "created_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "purpose": "Protect accepted source-preserving trace prototype and all inherited original evidence. No core/model/data/benchmark recomputation.",
        "prior_snapshot": str(PRIOR / "protected_inputs.json"),
        "inherited_file_count": len(previous["files"]),
        "accepted_trace_files_added": added,
        "exclusions": ["__pycache__ directories only"],
        "files": list(entries.values()),
    }
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def verify():
    baseline = load(ROOT / "protected_inputs.json")
    failures = []
    verified = 0
    for expected in baseline["files"]:
        path = Path(expected["path"])
        if not path.is_file():
            failures.append({"path": str(path), "reason": "missing_for_verification"})
            continue
        actual = fingerprint(path)
        if (actual["sha256"], actual["bytes"]) != (expected["sha256"], expected["bytes"]):
            failures.append({"path": str(path), "reason": "integrity_mismatch", "expected_sha256": expected["sha256"], "actual_sha256": actual["sha256"]})
        else:
            verified += 1
    copy_verified = 0
    for entry in load(ROOT / "copied_source_manifest.json")["files"]:
        path = ROOT / entry["copied_path"]
        if not path.is_file():
            failures.append({"path": str(path), "reason": "missing_copy"})
            continue
        actual = fingerprint(path)
        if actual["sha256"] != entry["sha256"] or actual["bytes"] != entry["byte_length"]:
            failures.append({"path": str(path), "reason": "copied_source_changed"})
        else:
            copy_verified += 1
    result = {"passed": not failures, "checked_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "protected_original_files_verified": verified, "source_copies_verified": copy_verified,
              "inherited_original_count": baseline["inherited_file_count"],
              "accepted_trace_files_count": baseline["accepted_trace_files_added"],
              "failures": failures,
              "scope": "Hashing only. Accepted prior files and copied byte envelopes; no simulations, predictions or associations rerun."}
    (ROOT / "preservation_checks.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--initialize", action="store_true", help="Create a new baseline once; refuses overwrite")
    args = parser.parse_args()
    if args.initialize:
        initialize()
    result = verify()
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["passed"] else 1)
