"""
CANON v3.9.53 Reference Interpreter
====================================
deterministic_reference runtime mode
Numeric families: affine_bounded (Psi), affine_margin (f),
                  separable_penalty_margin (f_star), ellipsoidal_local (A_s),
                  weighted_geometric_mean (g)

Governing equation:  x_{t+1} = Pi_K(F(x_t))
Operator chain:      Enable -> Express -> Regulate -> Constrain (latent)
                     P -> Probe -> Filter -> Render -> Calibrate (observation)

Run with:
    python interpreter.py                     # built-in demo scenario
    python interpreter.py scenario.json       # load external scenario
    python interpreter.py --trace full        # full trace output
"""

import json
import math
import sys
import uuid
from copy import deepcopy
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional

# ─────────────────────────────────────────────────────────────────────────────
# VERSION
# ─────────────────────────────────────────────────────────────────────────────
CANON_VERSION = "v3.9.53_reference_numeric_layer"
INTERPRETER_VERSION = "v1.0.0"

# ─────────────────────────────────────────────────────────────────────────────
# NUMERIC FAMILY REGISTRY
# ─────────────────────────────────────────────────────────────────────────────
NUMERIC_FAMILIES = {
    "Psi_family":   "affine_bounded",
    "Xi_family":    "cadence_relaxation",
    "g_family":     "weighted_geometric_mean",
    "f_family":     "affine_margin",
    "f_star_family":"separable_penalty_margin",
    "A_s_family":   "ellipsoidal_local",
}

SIGMA_K_PENALTY = {
    "interior":    0.00,
    "grazing":     0.25,
    "sliding":     0.50,
    "saturating":  0.70,
    "crossing":    0.90,
    "terminal":    1.00,
}

# ─────────────────────────────────────────────────────────────────────────────
# STATE DATACLASS
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class CanonState:
    # Canonical state (X_c)
    Omega_V: float = 1.0   # Viability margin / capacity
    Pi:      float = 0.2   # Repair / regulation pressure
    T:       float = 0.4   # Transfer / throughput
    Gamma:   float = 0.3   # Mismatch gradient

    # Adjunct state
    H:     float = 0.0     # History / hysteresis residue
    theta: float = 0.0     # Phase state
    omega: float = 0.0     # Rhythmic cadence

    # Derived latent
    Phi:         float = 0.0   # T * Gamma
    C_x:         float = 1.0   # Cross-plane coherence [0,1]
    A_s:         float = 1.0   # Accessible state-space volume proxy
    L_P:         float = 0.0   # Projection loss
    Delta_c:     float = 0.0   # Legacy collapse margin
    Delta_c_star:float = 0.0   # Extended collapse margin

    # Stability
    J_F_spectral_radius: float = 0.0   # max|real(eig(J_F))| proxy
    Sigma_K:             str   = "interior"
    collapse:            bool  = False

    # Observation
    O_q:    float = 1.0
    Tau_obs:float = 0.0
    A_obs:  float = 0.0
    N:      float = 0.0

    def snapshot(self) -> dict:
        return asdict(self)


# ─────────────────────────────────────────────────────────────────────────────
# FEASIBILITY REGION  K
# ─────────────────────────────────────────────────────────────────────────────
class FeasibilityRegion:
    """
    Admissibility constraints.
    K is defined by simple box bounds on canonical variables plus
    a terminal collapse condition.
    """
    def __init__(self, params: dict):
        self.Omega_V_min = params.get("Omega_V_min", 0.0)
        self.Omega_V_max = params.get("Omega_V_max", 2.0)
        self.Pi_max      = params.get("Pi_max",      2.0)
        self.T_max       = params.get("T_max",       2.0)
        self.Gamma_max   = params.get("Gamma_max",   2.0)
        self.H_max       = params.get("H_max",       5.0)
        self.omega_max   = params.get("omega_max",   4.0)

    def clip(self, s: CanonState) -> CanonState:
        """Project proposed state into K."""
        s.Omega_V = float(max(self.Omega_V_min, min(self.Omega_V_max, s.Omega_V)))
        s.Pi      = float(max(0.0,              min(self.Pi_max,      s.Pi)))
        s.T       = float(max(0.0,              min(self.T_max,       s.T)))
        s.Gamma   = float(max(0.0,              min(self.Gamma_max,   s.Gamma)))
        s.H       = float(max(-self.H_max,      min(self.H_max,       s.H)))
        s.omega   = float(max(0.0,              min(self.omega_max,   s.omega)))
        s.theta   = float(s.theta % (2 * math.pi))
        return s

    def sigma_K(self, s_pre: CanonState, s_post: CanonState) -> str:
        """Classify boundary regime."""
        if s_post.Delta_c_star <= 0:
            return "terminal"
        # Check if projection changed anything significantly
        pre_vec  = [s_pre.Omega_V, s_pre.Pi, s_pre.T, s_pre.Gamma]
        post_vec = [s_post.Omega_V, s_post.Pi, s_post.T, s_post.Gamma]
        delta    = sum(abs(a - b) for a, b in zip(pre_vec, post_vec))
        if delta < 1e-9:
            return "interior"
        elif delta < 0.05:
            return "grazing"
        elif s_post.Omega_V <= self.Omega_V_min + 1e-6:
            return "saturating"
        elif delta < 0.2:
            return "sliding"
        else:
            return "crossing"


# ─────────────────────────────────────────────────────────────────────────────
# NUMERIC FAMILIES — all declared, deterministic
# ─────────────────────────────────────────────────────────────────────────────

def Psi_affine_bounded(X_c: dict, u: dict, params: dict) -> float:
    """
    affine_bounded: Psi(X_c, u) = clip(W_x · X_c + W_u · u + b, psi_min, psi_max)
    Encodes how new load drives history accumulation.
    """
    W_Gamma = params.get("W_Gamma", 0.4)
    W_T     = params.get("W_T",     0.1)
    W_u     = params.get("W_u",     0.2)
    b       = params.get("b",       0.0)
    psi_min = params.get("psi_min", -1.0)
    psi_max = params.get("psi_max",  1.0)
    raw = W_Gamma * X_c["Gamma"] + W_T * X_c["T"] + W_u * u.get("load", 0.0) + b
    return float(max(psi_min, min(psi_max, raw)))


def Xi_cadence_relaxation(X_c: dict, H: float, u: dict, omega: float, params: dict) -> float:
    """
    cadence_relaxation: omega_next = clip(omega + alpha*signal - beta*omega, 0, omega_max)
    """
    alpha     = params.get("alpha_omega", 0.1)
    beta      = params.get("beta_omega",  0.05)
    omega_max = params.get("omega_max",   4.0)
    signal    = X_c["Gamma"] + abs(H) * 0.1
    return float(max(0.0, min(omega_max, omega + alpha * signal - beta * omega)))


def g_weighted_geometric_mean(C_phase: float, C_sign: float,
                               C_load: float,  C_topo: float,
                               params: dict) -> float:
    """
    C_x = prod_i max(eps, C_i)^(w_i),  sum w_i = 1
    """
    eps = params.get("eps", 1e-6)
    w   = params.get("weights", [0.25, 0.25, 0.25, 0.25])
    components = [C_phase, C_sign, C_load, C_topo]
    result = 1.0
    for c, wi in zip(components, w):
        result *= max(eps, min(1.0, c)) ** wi
    return float(max(0.0, min(1.0, result)))


def f_affine_margin(Omega_V: float, Pi: float, Phi: float, params: dict) -> float:
    """
    Delta_c = a_Omega*Omega_V + a_Pi*Pi - a_Phi*Phi + b
    a_Omega > 0,  a_Pi >= 0,  a_Phi > 0
    """
    a_Omega = params.get("a_Omega", 0.5)
    a_Pi    = params.get("a_Pi",    0.2)
    a_Phi   = params.get("a_Phi",   0.4)
    b       = params.get("b",      -0.1)
    return float(a_Omega * Omega_V + a_Pi * Pi - a_Phi * Phi + b)


def f_star_separable_penalty(Omega_V: float, Pi: float, Phi: float,
                              C_x: float,    H: float,   A_s: float,
                              L_P: float,    lambda_growth: float,
                              sigma_penalty: float,       params: dict) -> float:
    """
    Delta_c_star = w0 + w1*Omega_V + w2*Pi + w3*C_x + w4*A_s
                     - w5*Phi - w6*L_P - w7*h_norm(H) - w8*lambda_growth - w9*sigma_penalty
    All w_i >= 0;  monotonicity constraints enforced by sign.
    """
    w = params.get("weights", {})
    w0 = w.get("w0",  0.0)
    w1 = w.get("w1",  0.4)
    w2 = w.get("w2",  0.15)
    w3 = w.get("w3",  0.2)
    w4 = w.get("w4",  0.15)
    w5 = w.get("w5",  0.35)
    w6 = w.get("w6",  0.1)
    w7 = w.get("w7",  0.1)
    w8 = w.get("w8",  0.05)
    w9 = w.get("w9",  0.05)
    h_norm = min(1.0, abs(H))
    return float(w0
                 + w1 * Omega_V
                 + w2 * Pi
                 + w3 * C_x
                 + w4 * A_s
                 - w5 * Phi
                 - w6 * L_P
                 - w7 * h_norm
                 - w8 * lambda_growth
                 - w9 * sigma_penalty)


def A_s_ellipsoidal_local(Omega_V: float, Delta_c_star_prev: float,
                           C_x: float,    H: float,
                           J_F_spectral: float, params: dict) -> float:
    """
    Approximate reachable viable volume as ellipsoidal local proxy.
    A_s proportional to det(Q)^0.5 after clipping to K.
    Simplified: product of margin-scaled axis lengths.
    Normalized to [0,1].
    """
    eps = params.get("eps", 1e-4)
    # Axis lengths shrink with degraded margin, coherence, and spectral growth
    ax_viability  = max(eps, Omega_V)
    ax_margin     = max(eps, max(0.0, Delta_c_star_prev) + eps)
    ax_coherence  = max(eps, C_x)
    ax_pathlock   = max(eps, 1.0 - min(1.0, abs(H) * 0.5))
    ax_stability  = max(eps, 1.0 - min(0.99, J_F_spectral * 0.3))

    raw = (ax_viability * ax_margin * ax_coherence
           * ax_pathlock * ax_stability) ** (1.0 / 5.0)
    # Normalize against a reference (fully open system at Omega_V=2, Delta_c_star=1, etc.)
    ref = (2.0 * 1.0 * 1.0 * 1.0 * 1.0) ** 0.2
    return float(min(1.0, max(0.0, raw / ref)))


def J_F_finite_diff_spectral(s: CanonState, dt: float = 1.0) -> float:
    """
    Estimate max|real(eig(J_F))| via a scalar linearization proxy.
    Full matrix Jacobian deferred to domain-specific implementation.
    Proxy: sensitivity of Delta_c to perturbation in Gamma (dominant instability driver).
    Uses finite difference on the Phi = T*Gamma channel.
    """
    eps = 1e-4
    # dPhi/dGamma at current state
    dPhi_dGamma = s.T
    # d(Delta_c)/d(Phi) = -a_Phi (from affine_margin, a_Phi = 0.4)
    # d(Omega_V)/dt ~ -k * Phi (load depletes capacity, k ~ 0.15)
    # Combined growth rate proxy: if Phi is rising, margin is shrinking
    k_depletion = 0.15
    growth_proxy = k_depletion * dPhi_dGamma * s.Gamma
    return float(max(0.0, growth_proxy))


# ─────────────────────────────────────────────────────────────────────────────
# LATENT OPERATORS  (Enable → Express → Regulate → Constrain)
# ─────────────────────────────────────────────────────────────────────────────

def Enable(s: CanonState, u: dict, params: dict) -> CanonState:
    """
    Expand viable state space, reduce dissipation baseline, soften path-lock.
    Reads: Omega_V, Phi, H
    Writes: Omega_V, Phi, H
    Must NOT write: Y, Z, M_view
    """
    recovery = params.get("recovery_rate", 0.05)
    h_soften = params.get("h_softening",  0.08)
    # Capacity recovery (environment/staffing slack)
    s.Omega_V = s.Omega_V + recovery * (1.0 - s.Omega_V)
    # Dissipation reduction from enablement actions
    s.Phi    = max(0.0, s.Phi - params.get("phi_reduction", 0.02))
    # Soften path-lock
    s.H      = s.H * (1.0 - h_soften)
    return s


def Express(s: CanonState, u: dict, params: dict) -> CanonState:
    """
    Activate flow and resolve gradients into observable rhythmic dynamics.
    Reads: T, Gamma, theta, omega
    Writes: T, Gamma, Phi, theta, omega
    """
    load_in  = u.get("admits",   0.0)
    load_out = u.get("discharges", 0.0)
    transport_delay = u.get("transport_delay", 0.0)

    gamma_drive = params.get("gamma_drive", 0.12)
    t_drive     = params.get("t_drive",     0.10)
    dt          = params.get("dt",           1.0)

    # Throughput: admits add T, discharges reduce, transport delay stalls
    s.T = max(0.0, s.T + t_drive * load_in - 0.08 * load_out)
    # Mismatch: admits and delays accumulate gradient, discharges resolve
    s.Gamma = max(0.0, s.Gamma
                  + gamma_drive * load_in
                  + 0.05 * transport_delay
                  - 0.10 * load_out)
    # Dissipation = T * Gamma (updated after T and Gamma are set)
    s.Phi = s.T * s.Gamma
    # Phase advance
    s.theta = (s.theta + s.omega * dt) % (2 * math.pi)
    return s


def Regulate(s: CanonState, u: dict, params: dict) -> CanonState:
    """
    Apply corrective pressure to maintain stability.
    Reads: Pi, Gamma, C_x, Delta_c_star
    Writes: Pi, Gamma, Delta_c_star, C_x
    """
    pi_gain  = params.get("pi_gain",  0.10)
    g_damp   = params.get("g_damp",   0.08)
    cx_decay = params.get("cx_decay", 0.02)

    # Regulation pressure increases when Gamma is elevated
    s.Pi = min(2.0, s.Pi + pi_gain * s.Gamma)
    # Regulation damps gradient
    s.Gamma = max(0.0, s.Gamma - g_damp * s.Pi)
    # Cross-plane coherence degrades under sustained load (mild)
    load_pressure = s.Phi + 0.1 * abs(s.H)
    s.C_x = max(0.0, min(1.0, s.C_x - cx_decay * load_pressure))
    return s


def Constrain(s_proposed: CanonState, K: FeasibilityRegion) -> CanonState:
    """
    Realize Pi_K: project proposed latent state into feasible set K.
    May saturate, clip, slide, or mark terminal collapse.
    """
    return K.clip(s_proposed)


# ─────────────────────────────────────────────────────────────────────────────
# DERIVED LATENT QUANTITIES
# ─────────────────────────────────────────────────────────────────────────────

def compute_derived_latent(s: CanonState, s_prev: CanonState,
                            K: FeasibilityRegion, params: dict) -> CanonState:
    """
    Compute: Phi, H_next, omega_next, C_x, A_s, L_P, Delta_c, Delta_c_star,
             J_F spectral proxy, Sigma_K, collapse flag.
    """
    X_c = {"Omega_V": s.Omega_V, "Pi": s.Pi, "T": s.T, "Gamma": s.Gamma}
    u   = params.get("u", {})

    # Phi (may have been set in Express; recompute for consistency)
    s.Phi = s.T * s.Gamma

    # History update  H_next = lambda_H * H + Psi(X_c, u)
    lambda_H = params.get("lambda_H", 0.85)
    psi_val  = Psi_affine_bounded(X_c, u, params.get("Psi_params", {}))
    s.H      = lambda_H * s.H + psi_val

    # Omega update  (capacity depletes under load)
    depletion = params.get("k_depletion", 0.15)
    s.Omega_V = max(0.0, s.Omega_V - depletion * s.Phi)

    # Cadence update
    s.omega = Xi_cadence_relaxation(X_c, s.H, u, s.omega, params.get("Xi_params", {}))

    # Cross-plane coherence components (simplified from domain)
    C_phase = max(0.0, 1.0 - abs(s.theta / math.pi - 1.0) * 0.3)
    C_sign  = max(0.0, 1.0 - 0.5 * s.Gamma)
    C_load  = max(0.0, min(1.0, s.Omega_V))
    C_topo  = max(0.0, 1.0 - 0.2 * abs(s.H))
    s.C_x   = g_weighted_geometric_mean(C_phase, C_sign, C_load, C_topo,
                                         params.get("g_params", {}))

    # J_F spectral proxy
    s.J_F_spectral_radius = J_F_finite_diff_spectral(s)

    # Sigma_K
    sigma = K.sigma_K(s_prev, s)
    s.Sigma_K = sigma
    sigma_penalty = SIGMA_K_PENALTY[sigma]

    # Delta_c (legacy)
    s.Delta_c = f_affine_margin(s.Omega_V, s.Pi, s.Phi,
                                 params.get("f_params", {}))

    # A_s (using previous Delta_c_star as context)
    prev_dc_star = s_prev.Delta_c_star
    s.A_s = A_s_ellipsoidal_local(s.Omega_V, prev_dc_star, s.C_x, s.H,
                                   s.J_F_spectral_radius,
                                   params.get("A_s_params", {}))

    # L_P (projection loss grows with mismatch and load)
    s.L_P = min(1.0, max(0.0, 0.15 * s.Phi + 0.05 * (1.0 - s.C_x)))

    # Delta_c_star (extended margin)
    s.Delta_c_star = f_star_separable_penalty(
        s.Omega_V, s.Pi, s.Phi, s.C_x, s.H, s.A_s, s.L_P,
        s.J_F_spectral_radius, sigma_penalty,
        params.get("f_star_params", {}))

    # Collapse
    s.collapse = (s.Delta_c_star <= 0.0)

    return s


# ─────────────────────────────────────────────────────────────────────────────
# OBSERVATION STACK  (P → Probe → Filter → Render → Calibrate)
# ─────────────────────────────────────────────────────────────────────────────

def P_observation_projection(s: CanonState) -> dict:
    """Derive reduced observed state Y from admissible latent state."""
    return {
        "Omega_V":      s.Omega_V,
        "Delta_c_star": s.Delta_c_star,
        "Phi":          s.Phi,
        "C_x":          s.C_x,
        "A_s":          s.A_s,
        "Sigma_K":      s.Sigma_K,
        "collapse":     s.collapse,
    }


def Probe_trace(Y: dict, s: CanonState, step: int, params: dict) -> dict:
    """Generate trace bundle Z from observation projection."""
    channels = params.get("channels", list(Y.keys()))
    return {
        "step":    step,
        "Tau_obs": s.Tau_obs,
        "A_obs":   s.A_obs,
        "O_q":     s.O_q,
        "channels": {k: Y[k] for k in channels if k in Y},
    }


def Filter_trace(Z: dict, s: CanonState) -> dict:
    """Suppress noise; in reference mode noise=0 so this is identity."""
    if s.N == 0.0:
        return Z
    # Simple Gaussian contamination removal (no-op when N=0)
    return Z


def Render_views(Z_filtered: dict) -> dict:
    """Produce diagnostic views from filtered trace."""
    ch = Z_filtered.get("channels", {})
    return {
        "stability_summary": {
            "Delta_c_star": ch.get("Delta_c_star"),
            "A_s":          ch.get("A_s"),
            "Sigma_K":      ch.get("Sigma_K"),
            "collapse":     ch.get("collapse"),
        },
        "capacity_view": {
            "Omega_V": ch.get("Omega_V"),
            "Phi":     ch.get("Phi"),
        },
        "coherence_view": {
            "C_x": ch.get("C_x"),
        },
    }


def Calibrate_observation(s: CanonState, Z: dict, params: dict) -> CanonState:
    """Tune observation stack for next step."""
    # O_q degrades with high aliasing or projection loss
    s.O_q    = max(0.0, min(1.0, 1.0 - 0.5 * s.A_obs - 0.3 * s.L_P))
    s.A_obs  = max(0.0, s.A_obs * 0.9)   # aliasing decays when probe is stable
    return s


# ─────────────────────────────────────────────────────────────────────────────
# VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

def validate_preflight(scenario: dict) -> list[dict]:
    """Check scenario before run. Returns list of validation messages."""
    msgs = []

    def emit(level, code, msg):
        msgs.append({"level": level, "code": code, "message": msg})

    if scenario.get("runtime_mode") not in [
        "latent_only", "instrumented", "ideal_instrument",
        "legacy_approximation", "diagnostic", "strict_projection",
        "observer_only", "deterministic_reference", "stochastic_reference"
    ]:
        emit("error", "INVALID_RUNTIME_MODE", f"Unknown mode: {scenario.get('runtime_mode')}")

    ic = scenario.get("initial_conditions", {}).get("state", {})
    for key in ["Omega_V", "Pi", "T", "Gamma"]:
        if key not in ic:
            emit("fatal", "MISSING_CANONICAL_STATE", f"Required state key missing: {key}")

    nd = scenario.get("numeric_declarations", {})
    for req in ["Psi_family", "f_family", "f_star_family"]:
        if req not in nd:
            emit("warning", "MISSING_NUMERIC_DECLARATION",
                 f"Reference mode should declare {req}")

    steps = scenario.get("steps", 0)
    if not isinstance(steps, int) or steps < 1:
        emit("error", "INVALID_STEP_COUNT", "steps must be positive integer")

    return msgs


def validate_state(s: CanonState, step: int) -> list[dict]:
    """Per-step state validation."""
    msgs = []
    def emit(level, code, msg):
        msgs.append({"level": level, "code": code, "step": step, "message": msg})

    if math.isnan(s.Omega_V) or math.isinf(s.Omega_V):
        emit("error", "INVALID_STATE", "Omega_V is NaN or inf")
    if not (0.0 <= s.C_x <= 1.0):
        emit("warning", "RANGE_VIOLATION", f"C_x={s.C_x:.4f} outside [0,1]")
    if not (0.0 <= s.O_q <= 1.0):
        emit("warning", "RANGE_VIOLATION", f"O_q={s.O_q:.4f} outside [0,1]")
    if s.A_s < 0.0:
        emit("error", "RANGE_VIOLATION", f"A_s={s.A_s:.4f} < 0")
    if s.L_P < 0.0:
        emit("error", "RANGE_VIOLATION", f"L_P={s.L_P:.4f} < 0")
    if s.Delta_c_star <= 0.0 and not s.collapse:
        emit("error", "COLLAPSE_FLAG_MISSING",
             "Delta_c_star <= 0 but collapse not flagged")
    if s.Sigma_K not in SIGMA_K_PENALTY:
        emit("error", "INVALID_SIGMA_K", f"Unknown Sigma_K: {s.Sigma_K}")

    return msgs


# ─────────────────────────────────────────────────────────────────────────────
# STEP FUNCTION  (single canonical step)
# ─────────────────────────────────────────────────────────────────────────────

def step(s: CanonState, u: dict, K: FeasibilityRegion,
         params: dict, step_idx: int,
         runtime_mode: str, trace_level: str) -> dict:
    """
    Execute one canonical step.
    Returns a per_step_record conforming to trace_output_schema.
    """
    state_pre = deepcopy(s)

    # ── LATENT EVOLUTION ──────────────────────────────────────────────────
    s = Enable(s, u, params.get("Enable_params", {}))
    s = Express(s, u, params.get("Express_params", {}))
    s = Regulate(s, u, params.get("Regulate_params", {}))
    s_proposed = deepcopy(s)
    s = Constrain(s, K)   # Pi_K
    s = compute_derived_latent(s, state_pre, K, params)

    # ── OBSERVATION STACK ─────────────────────────────────────────────────
    if runtime_mode not in ["latent_only", "legacy_approximation"]:
        Y         = P_observation_projection(s)
        Z_raw     = Probe_trace(Y, s, step_idx, params.get("Probe_params", {}))
        Z_filt    = Filter_trace(Z_raw, s)
        M_view    = Render_views(Z_filt)
        s         = Calibrate_observation(s, Z_filt, params)
    else:
        Y, Z_filt, M_view = {}, {}, {}

    # ── VALIDATION ────────────────────────────────────────────────────────
    val_msgs = validate_state(s, step_idx)

    # ── STABILITY FLAGS ───────────────────────────────────────────────────
    stability_flags = {
        "stable_local":    (s.J_F_spectral_radius < 0.01 and s.Delta_c_star > 0),
        "marginal_local":  (0.01 <= s.J_F_spectral_radius <= 0.05 and s.Delta_c_star > 0),
        "unstable_growth": (s.J_F_spectral_radius > 0.05),
        "boundary_risk":   (s.Sigma_K in {"grazing", "sliding", "saturating", "crossing"}),
        "collapsed":       s.collapse,
    }

    # ── RECORD ────────────────────────────────────────────────────────────
    record: dict = {
        "step":       step_idx,
        "state_pre":  state_pre.snapshot() if trace_level in ("standard", "full") else None,
        "state_post": s.snapshot(),
        "derived": {
            "Phi":         s.Phi,
            "Delta_c":     s.Delta_c,
            "Delta_c_star":s.Delta_c_star,
            "C_x":         s.C_x,
            "A_s":         s.A_s,
            "L_P":         s.L_P,
        },
        "projection": {
            "Y":        Y,
            "Sigma_K":  s.Sigma_K,
            "collapse": s.collapse,
        },
        "diagnostics": {
            "stability_flags":   stability_flags,
            "validation_messages": val_msgs,
            "runtime_mode":      runtime_mode,
        },
        "numeric_provenance": {
            **NUMERIC_FAMILIES,
            "lambda_H": params.get("lambda_H", 0.85),
        },
    }

    if trace_level == "full":
        record["trace"]     = Z_filt
        record["view"]      = M_view
        record["J_F_proxy"] = s.J_F_spectral_radius
        record["inputs"]    = u

    return record, s


# ─────────────────────────────────────────────────────────────────────────────
# INTERPRETER  (full run)
# ─────────────────────────────────────────────────────────────────────────────

def run(scenario: dict, params: dict = None,
        trace_level: str = "standard") -> dict:
    """
    Execute a full CANON run from a scenario definition.
    Returns a complete trace conforming to trace_output_schema.
    """
    params = params or {}

    # ── PREFLIGHT ─────────────────────────────────────────────────────────
    preflight_msgs = validate_preflight(scenario)
    fatal = [m for m in preflight_msgs if m["level"] == "fatal"]
    if fatal:
        return {"error": "preflight_failure", "messages": preflight_msgs}

    # ── INIT ──────────────────────────────────────────────────────────────
    run_id    = str(uuid.uuid4())[:8]
    scenario_id = scenario.get("scenario_id", "unnamed")
    runtime_mode = scenario.get("runtime_mode", "deterministic_reference")
    n_steps   = scenario["steps"]
    ic        = scenario["initial_conditions"]

    s = CanonState(
        Omega_V = ic["state"]["Omega_V"],
        Pi      = ic["state"]["Pi"],
        T       = ic["state"]["T"],
        Gamma   = ic["state"]["Gamma"],
        H       = ic.get("H", 0.0),
        theta   = ic.get("theta", 0.0),
        omega   = ic.get("omega", 0.0),
    )
    # Seed derived quantities
    s.Phi         = s.T * s.Gamma
    s.C_x         = ic.get("derived_seed", {}).get("C_x", 1.0)
    s.A_s         = ic.get("derived_seed", {}).get("A_s", 1.0)
    s.Delta_c_star = 0.5  # will be computed on step 1

    K_params = scenario.get("K_params", {})
    K = FeasibilityRegion(K_params)

    input_schedule = {e["step"]: e for e in scenario.get("input_schedule", [])}

    # ── RUN HEADER ────────────────────────────────────────────────────────
    header = {
        "run_id":            run_id,
        "scenario_id":       scenario_id,
        "version":           CANON_VERSION,
        "interpreter_version": INTERPRETER_VERSION,
        "runtime_mode":      runtime_mode,
        "started_at":        datetime.now(timezone.utc).isoformat(),
        "step_count_planned": n_steps,
        "numeric_family_summary": NUMERIC_FAMILIES,
        "determinism_status": "deterministic",
        "preflight_messages": preflight_msgs,
    }

    # ── STEP LOOP ─────────────────────────────────────────────────────────
    records     = []
    completed   = 0
    collapsed   = False
    termination = "step_limit"

    for i in range(1, n_steps + 1):
        sched = input_schedule.get(i, {})
        u = {
            "admits":           sched.get("events", []).count("2_admits") * 2
                              + sched.get("events", []).count("3_admits") * 3,
            "discharges":       sched.get("events", []).count("1_discharge"),
            "transport_delay":  int("transport_delay" in sched.get("events", [])),
            "load":             float(sched.get("load", 0.0)),
        }

        record, s = step(s, u, K, params, i, runtime_mode, trace_level)
        records.append(record)
        completed += 1

        if s.collapse:
            collapsed   = True
            termination = "collapse"
            break

    # ── RUN FOOTER ────────────────────────────────────────────────────────
    footer = {
        "completed_steps":         completed,
        "termination_reason":      termination,
        "collapsed":               collapsed,
        "final_state":             s.snapshot(),
        "numeric_family_summary":  NUMERIC_FAMILIES,
        "determinism_status":      "deterministic",
        "replay_sufficient_metadata": {
            "scenario_id": scenario_id,
            "version":     CANON_VERSION,
            "lambda_H":    params.get("lambda_H", 0.85),
            "families":    NUMERIC_FAMILIES,
        },
    }

    return {
        "run_header": header,
        "steps":      records,
        "run_footer": footer,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DISPLAY HELPERS
# ─────────────────────────────────────────────────────────────────────────────

STABILITY_ICONS = {
    True:  "▼ COLLAPSED",
    False: "",
}

def render_terminal_summary(result: dict) -> None:
    """Human-readable run summary to stdout."""
    hdr = result["run_header"]
    ftr = result["run_footer"]
    steps = result["steps"]

    print(f"\n{'═'*70}")
    print(f" CANON {hdr['version']}  ·  Interpreter {hdr['interpreter_version']}")
    print(f" Scenario: {hdr['scenario_id']}  ·  Mode: {hdr['runtime_mode']}")
    print(f" Run ID:   {hdr['run_id']}  ·  {hdr['started_at'][:19]}Z")
    print(f"{'═'*70}")
    print(f"\n{'Step':>4} {'Ω_V':>7} {'Γ':>7} {'Φ':>7} "
          f"{'H':>7} {'C_x':>6} {'A_s':>6} {'Δc*':>8} {'Σ_K':<12} {'flags'}")
    print(f"{'─'*70}")

    for rec in steps:
        sp  = rec["state_post"]
        dv  = rec["derived"]
        pr  = rec["projection"]
        sf  = rec["diagnostics"]["stability_flags"]

        flags = []
        if sf.get("unstable_growth"):  flags.append("⚠ grow")
        if sf.get("boundary_risk"):    flags.append("◈ bndry")
        if sf.get("collapsed"):        flags.append("✕ COLLAPSE")
        elif sf.get("stable_local"):   flags.append("✓ stable")
        elif sf.get("marginal_local"): flags.append("~ marginal")

        print(f"{rec['step']:>4}  "
              f"{sp['Omega_V']:>6.3f}  "
              f"{sp['Gamma']:>6.3f}  "
              f"{dv['Phi']:>6.3f}  "
              f"{sp['H']:>6.3f}  "
              f"{dv['C_x']:>5.3f}  "
              f"{dv['A_s']:>5.3f}  "
              f"{dv['Delta_c_star']:>7.4f}  "
              f"{pr['Sigma_K']:<12} "
              f"{' '.join(flags)}")

    print(f"{'─'*70}")
    print(f"\n Termination: {ftr['termination_reason'].upper()}"
          f"  ·  Steps: {ftr['completed_steps']}"
          f"  ·  Collapsed: {ftr['collapsed']}")
    print(f"\n Numeric families:")
    for k, v in ftr["numeric_family_summary"].items():
        print(f"   {k:<20} {v}")
    print(f"{'═'*70}\n")


# ─────────────────────────────────────────────────────────────────────────────
# BUILT-IN DEMO SCENARIO  (med-surg shift under load)
# ─────────────────────────────────────────────────────────────────────────────

DEMO_SCENARIO = {
    "scenario_id":   "med_surg_shift_v3953",
    "runtime_mode":  "deterministic_reference",
    "steps":         10,
    "initial_conditions": {
        "state": {"Omega_V": 0.9, "Pi": 0.2, "T": 0.4, "Gamma": 0.3},
        "H": 0.0, "theta": 0.0, "omega": 0.3,
    },
    "numeric_declarations": {
        "Psi_family":   "affine_bounded",
        "Xi_family":    "cadence_relaxation",
        "g_family":     "weighted_geometric_mean",
        "f_family":     "affine_margin",
        "f_star_family":"separable_penalty_margin",
        "A_s_family":   "ellipsoidal_local",
    },
    "input_schedule": [
        {"step": 2, "events": ["2_admits"]},
        {"step": 3, "events": ["3_admits"]},
        {"step": 4, "events": ["transport_delay"]},
        {"step": 5, "events": ["3_admits"]},
        {"step": 7, "events": ["1_discharge"]},
    ],
}

DEMO_PARAMS = {
    "lambda_H":    0.85,
    "k_depletion": 0.12,
    "Enable_params":  {"recovery_rate": 0.04, "h_softening": 0.06, "phi_reduction": 0.01},
    "Express_params": {"gamma_drive": 0.15, "t_drive": 0.10, "dt": 1.0},
    "Regulate_params":{"pi_gain": 0.10, "g_damp": 0.08, "cx_decay": 0.015},
    "Psi_params":     {"W_Gamma": 0.4, "W_T": 0.1, "W_u": 0.2, "b": 0.0,
                       "psi_min": -1.0, "psi_max": 1.0},
    "Xi_params":      {"alpha_omega": 0.08, "beta_omega": 0.04, "omega_max": 4.0},
    "g_params":       {"eps": 1e-6, "weights": [0.25, 0.25, 0.25, 0.25]},
    "f_params":       {"a_Omega": 0.5, "a_Pi": 0.2, "a_Phi": 0.4, "b": -0.05},
    "f_star_params":  {"weights": {"w0": 0.0, "w1": 0.4, "w2": 0.15, "w3": 0.2,
                                   "w4": 0.15, "w5": 0.35, "w6": 0.1, "w7": 0.1,
                                   "w8": 0.05, "w9": 0.05}},
    "A_s_params":     {"eps": 1e-4},
    "Probe_params":   {"channels": ["Omega_V", "Delta_c_star", "Phi", "C_x", "A_s",
                                    "Sigma_K", "collapse"]},
}


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="CANON v3.9.53 Reference Interpreter")
    parser.add_argument("scenario", nargs="?", help="Path to scenario JSON (optional)")
    parser.add_argument("--trace",  default="standard",
                        choices=["minimal", "standard", "full"],
                        help="Trace verbosity level")
    parser.add_argument("--json",   action="store_true",
                        help="Emit raw JSON trace to stdout")
    args = parser.parse_args()

    if args.scenario:
        with open(args.scenario) as f:
            scenario = json.load(f)
        params = {}
    else:
        scenario = DEMO_SCENARIO
        params   = DEMO_PARAMS

    result = run(scenario, params=params, trace_level=args.trace)

    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        render_terminal_summary(result)
        if args.trace == "full":
            print("── Full JSON trace ──")
            print(json.dumps(result, indent=2, default=str))
