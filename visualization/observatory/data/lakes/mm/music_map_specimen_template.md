# MUSIC MAP SPECIMEN TEMPLATE

**Schema Version:** music_map_v0.1\
**Generated:** 2026-03-02T14:48:20.178458Z

------------------------------------------------------------------------

# OVERVIEW

This document defines the minimal, extensible structure required to map
a musical work and performance using a structured, instrument-level,
multi-plane system model.

The architecture separates:

1.  **Raw Assets** (audio, stems, score, metadata)\
2.  **Derived Features** (extracted signals, alignment, events)\
3.  **Map Layer (Canonical Model)**
    -   State vectors x(t)\
    -   Coupling graph C(t)\
    -   Alignment manifold D(t)\
    -   Feasible set K(t)\
    -   Observables Ω

Raw data is retained. Derived layers reference raw. Maps reference
derived.

This preserves completeness while enabling scalable visualization and
analysis.

------------------------------------------------------------------------

# TOP-LEVEL SPECIMEN BUNDLE

``` json
{
  "schema_version": "music_map_v0.1",
  "bundle_id": "uuid",
  "created_utc": "UTC timestamp",

  "work": { },
  "performance": { },

  "entities": [ ],
  "players": [ ],

  "raw_assets": [ ],
  "derived_assets": [ ],
  "maps": [ ],

  "provenance": { },
  "notes": []
}
```

------------------------------------------------------------------------

# WORK (THE COMPOSITION)

Defines score-level information independent of performance.

``` json
{
  "work_id": "uuid",
  "title": "Song Title",
  "composer": "Composer Name",
  "year_composed": null,

  "structure": {
    "form_labels": [],
    "meter_map": [],
    "tempo_map": [],
    "key_map": []
  },

  "instrumentation": {
    "parts": [
      {
        "part_id": "part_violin1",
        "name": "Violin I",
        "role_default": "melody/support"
      }
    ]
  },

  "score_refs": []
}
```

------------------------------------------------------------------------

# PERFORMANCE (ONE SPECIFIC INSTANCE)

``` json
{
  "performance_id": "uuid",
  "work_id": "uuid",
  "date_local": "YYYY-MM-DD",
  "venue": null,

  "timebase": {
    "t0_utc": "timestamp",
    "duration_s": 0.0,
    "frame_rate_hz": 100.0
  },

  "raw_audio_refs": []
}
```

------------------------------------------------------------------------

# ENTITIES (INSTRUMENT-LEVEL NODES)

Each physical instrument is a first-class node.

``` json
{
  "entity_id": "ent_violin1_desk3_playerA",
  "entity_type": "instrument",
  "part_id": "part_violin1",

  "labels": {
    "display": "Violin I – Desk 3 (A)",
    "section": "strings"
  },

  "binding": {
    "player_id": "player_A",
    "instrument_model": "violin"
  }
}
```

Sections are computed as sets over entities.

------------------------------------------------------------------------

# PLAYERS (SPORTS-STYLE PROFILES)

## Player Profile

``` json
{
  "player_id": "player_A",
  "name": "Player A",
  "baseline_stats": {
    "timing_jitter_ms_p50": null,
    "intonation_cents_rmse": null,
    "correction_latency_ms": null,
    "dynamic_resolution_db": null
  }
}
```

## Player Session State (Per Performance)

``` json
{
  "player_session_id": "sess_playerA_perf1",
  "performance_id": "uuid",
  "state": {
    "fatigue_0_1": null,
    "stress_0_1": null,
    "confidence_0_1": null
  }
}
```

------------------------------------------------------------------------

# RAW ASSETS

Never collapse raw data into the map. Store and reference.

``` json
{
  "asset_id": "raw_stereo_mix",
  "kind": "audio",
  "format": "wav",
  "uri": "file://path/to/mix.wav"
}
```

------------------------------------------------------------------------

# DERIVED FEATURES

Extracted from raw assets. Must include provenance.

``` json
{
  "asset_id": "derived_features_ent_violin1",
  "kind": "feature_stream",
  "fields": [
    "pitch_hz",
    "pitch_cents_offset",
    "loudness_db",
    "spectral_centroid_hz",
    "presence_0_1",
    "active_0_1"
  ]
}
```

------------------------------------------------------------------------

# MAP LAYER (CANON STRUCTURE)

## Planes

``` json
[
  { "plane_id": "P", "name": "Pitch" },
  { "plane_id": "R", "name": "Rhythm" },
  { "plane_id": "D", "name": "Dynamics" },
  { "plane_id": "T", "name": "Timbre" }
]
```

------------------------------------------------------------------------

## State Map x_i(t)

Sparse updates recommended.

``` json
{
  "entity_id": "ent_violin1_desk3_playerA",
  "t_s": 0.00,
  "x": {
    "P": null,
    "R": null,
    "D": null,
    "T": null,
    "presence_0_1": null,
    "active_0_1": null
  }
}
```

------------------------------------------------------------------------

## Coupling Graph C(t)

``` json
{
  "src": "ent_conductor",
  "dst": "ent_violin1_desk3_playerA",
  "type": "tempo_authority",
  "weight": 0.8
}
```

------------------------------------------------------------------------

## Alignment Manifold D(t)

Tempo curve, tuning reference, etc.

------------------------------------------------------------------------

## Feasible Set K(t)

``` json
{
  "P_cents_abs_max": 35.0,
  "R_ms_abs_max": 40.0,
  "D_db_min": -60.0,
  "D_db_max": 0.0
}
```

------------------------------------------------------------------------

## Observables Ω

Examples:

-   Timing dispersion\
-   Presence-weighted sameness\
-   Presence concentration\
-   Repair magnitude

------------------------------------------------------------------------

# DESIGN INVARIANTS

1.  Entities remain instrument-level.\
2.  Sections are computed, not primary.\
3.  Presence is explicit.\
4.  Raw data is retained.\
5.  Derived layers are reproducible.\
6.  Maps are regenerable.

------------------------------------------------------------------------

# NEXT STEP

Implement minimal test case:

-   2 instruments\
-   1 conductor\
-   1 short audio segment\
-   Extract pitch, timing, dynamics\
-   Generate x(t), simple C(t), and dispersion observable

Do not overbuild. Start with a specimen.
