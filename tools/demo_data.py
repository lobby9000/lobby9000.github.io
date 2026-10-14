#!/usr/bin/env python3
"""
Build assets/apps/demo-data.js, the data behind the demos in the site's terminal.

Every number a demo prints, or checks itself against, comes from the project
repositories and is computed with their own code:

    btc, macd   macd-toolkit: the recorded example in examples/btc-2026-10-14
    api         macd-signal-api: engine/indicators.py on data/sample_prices.csv
    qa          incentive-comp-qa: app/calc.py of build rc2 and of build rc1 (from git)
    vigia       vigia: scripts/traffic_model.py and analytics-api's anomaly.py
    notes       class-notes-pipeline: extensiones/indice.py on the sample vault
    retail      Retail-Business-Data-Cases: the Wilson test of analisis.ipynb
    inflation   the background equations of the thesis solver, integrated with SciPy

The site does not run this script: its output is committed, and the browser
tests check the demos against the reference values stored in it.

    python3 tools/demo_data.py                  # repositories in ../repos
    python3 tools/demo_data.py --repos ~/code   # or wherever they are checked out

Needs numpy, pandas, scipy and snowballstemmer, and the repositories with their
git history (build rc1 of the QA project is read from it).
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import subprocess
import sys
import tomllib
import types
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "apps" / "demo-data.js"


def load_module(name: str, path: Path) -> types.ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# btc and macd: the recorded bitcoin example of macd-toolkit
# ---------------------------------------------------------------------------

def btc(repos: Path) -> dict:
    repo = repos / "macd-toolkit"
    folder = repo / "examples" / "btc-2026-10-14"
    serie = pd.read_csv(folder / "serie.csv", parse_dates=["fecha"], index_col="fecha")
    if not (serie.index.to_series().diff().dropna() == pd.Timedelta(days=1)).all():
        raise SystemExit("serie.csv must be one candle per day")
    closes = serie["close"].to_numpy()
    if not np.all(closes == np.round(closes)):
        raise SystemExit("the demo stores Bitso's closes as whole pesos")

    estrategias = pd.read_csv(folder / "estrategias.csv")
    cot = pd.read_csv(folder / "cotizaciones.csv")
    plataformas = tomllib.loads((repo / "plataformas.toml").read_text(encoding="utf-8"))

    def book(name: str) -> tuple[float, float]:
        row = cot[cot["plataforma"] == name].iloc[0]
        return float(row["compra"]), float(row["venta"])

    # The analysis re-reads the order books a few seconds after the quotes. Binance's
    # book had not moved; Bitso's had, so its half-spread is recovered from the
    # recorded buy-and-hold result (the book is symmetric: a = b).
    capital = float(estrategias["aportado"].iloc[0])
    hold = estrategias[(estrategias["estrategia"] == "mantener") &
                       (estrategias["plataforma"] == "Bitso, orden de mercado")].iloc[0]
    growth = closes[-1] / closes[0]
    comm = 0.0078
    ratio = hold["valor_final"] / (capital * (1 - comm) ** 2 * growth)   # (1 - b) / (1 + a)
    half_bitso = (1 - ratio) / (1 + ratio)

    ask, bid = book("Binance, orden de mercado")
    mid = (ask + bid) / 2
    spreads = {
        "Binance, orden de mercado": (ask / mid - 1, 1 - bid / mid, "book"),
        "Bitso, orden límite": (0.0, 0.0, "fixed"),
        "Bitso, orden de mercado": (half_bitso, half_bitso, "book"),
        "Mercado Pago": (0.0, 0.0, "unmeasured"),
    }
    english = {
        "Binance, orden de mercado": "Binance, market order",
        "Bitso, orden límite": "Bitso, limit order",
        "Bitso, orden de mercado": "Bitso, market order",
        "Mercado Pago": "Mercado Pago",
        "Sin costos": "No costs",
    }
    costs = []
    for p in plataformas["plataforma"]:
        if p["nombre"] not in spreads:
            continue                       # Binance P2P: left out of the run, spread unmeasured
        a, b, origin = spreads[p["nombre"]]
        costs.append({"key": p["nombre"], "name": english[p["nombre"]],
                      "buy": p["comision_compra"] / 100, "sell": p["comision_venta"] / 100,
                      "a": a, "b": b, "spread": origin})

    first = serie.iloc[0]
    checkpoints = [{"i": int(i), "ppo": float(serie["ppo"].iloc[i]), "ppo_senal": float(serie["ppo_senal"].iloc[i]),
                    "macd": float(serie["macd"].iloc[i]), "signal": float(serie["signal"].iloc[i])}
                   for i in [*range(0, len(serie), 100), len(serie) - 1]]
    expected = [{"strategy": r["estrategia"], "platform": english[r["plataforma"]],
                 "value": r["valor_final"], "costs": r["costos"], "trades": int(r["operaciones"]),
                 "btc": r["btc_final"], "worst": r["peor_momento"], "days_in": r["dias_con_btc"]}
                for _, r in estrategias.iterrows()]
    bitso_ask, bitso_bid = book("Bitso, orden de mercado")
    return {
        "source": "macd-toolkit/examples/btc-2026-10-14 (Bitso daily candles, Mexico City dates)",
        "start": serie.index[0].strftime("%Y-%m-%d"),
        "closes": [int(c) for c in closes],
        "init": {"ma_fast": float(first["ma_fast"]), "ma_slow": float(first["ma_slow"]),
                 "signal": float(first["signal"]), "ppo_senal": float(first["ppo_senal"])},
        "checkpoints": checkpoints,
        "weekly": 500.0, "capital": capital, "delay": 1,
        "quotes_at": "2026-10-14 21:25 UTC",
        "reference_mid": (bitso_ask + bitso_bid) / 2,
        "costs": costs,
        "expected": expected,
        "random_walk_periods": 12,
    }


# ---------------------------------------------------------------------------
# api: the MACD signal API engine
# ---------------------------------------------------------------------------

def api(repos: Path) -> dict:
    repo = repos / "macd-signal-api"
    sys.path.insert(0, str(repo))
    try:
        from engine import indicators as ind
    finally:
        sys.path.remove(str(repo))
    prices = pd.read_csv(repo / "data" / "sample_prices.csv", parse_dates=["date"], index_col="date")["close"]
    x = prices.iloc[-80:]
    df = ind.macd(x, ind.MACDConfig())
    events = ind.crossovers(df)
    last = df.dropna(subset=["hist"]).iloc[-1]

    # BUG-M01, as TC-NUM-010 builds it: down in a straight line, then up
    line = np.r_[np.linspace(100, 80, 60), np.linspace(80, 110, 60)]
    dates = pd.date_range("2026-01-05", periods=len(line), freq="B")
    bug = ind.macd(pd.Series(line, index=dates), ind.MACDConfig())

    def periods(rel_tol: float) -> list[list]:
        ev = ind.crossovers(bug, rel_tol=rel_tol)
        return [[int(dates.get_loc(e["date"])) + 1, e["event"]] for e in ev.to_dict("records")]

    rc1, fixed = periods(0.0), periods(1e-9)
    if [p for p, _ in rc1[:3]] != [45, 50, 55]:
        raise SystemExit(f"BUG-M01 no longer reproduces as reported: {rc1}")
    return {
        "source": "macd-signal-api/data/sample_prices.csv (synthetic random walk), last 80 business days",
        "prices": [[d.strftime("%Y-%m-%d"), float(c)] for d, c in x.items()],
        "expected": {
            "periods": len(df), "first_signal_period": ind.MACDConfig().first_signal,
            "events": [[e["date"].strftime("%Y-%m-%d"), e["event"]] for e in events.to_dict("records")],
            "last": {"date": df.dropna(subset=["hist"]).index[-1].strftime("%Y-%m-%d"),
                     "macd": float(last["macd"]), "signal": float(last["signal"]), "hist": float(last["hist"]),
                     "reading": ind.describe_last(df)},
        },
        "bug": {"rc1": rc1, "fixed": fixed,
                "hist": [None if math.isnan(v) else float(v) for v in bug["hist"].to_numpy()]},
    }


# ---------------------------------------------------------------------------
# qa: the commission calculation of both builds
# ---------------------------------------------------------------------------

QA_CASES = [
    # id, quota, credited, what the case checks, expected value (docs/03-test-cases.csv), title
    ("TC-CAL-001", "100000.00", "49999.99", "gate", "50.00|no|0.00", "Just below the 50% gate"),
    ("TC-CAL-002", "100000.00", "49995.00", "gate", "50.00|no|0.00", "Shows 50.00% but does not qualify"),
    ("TC-CAL-003", "100000.00", "50000.00", "gate", "50.00|yes|500.00", "Exactly 50% qualifies"),
    ("TC-CAL-004", "100000.00", "80000.00", "payout", "800.00", "Exactly 80% (band A to B)"),
    ("TC-CAL-005", "100000.00", "100000.00", "payout", "1300.00", "Exactly 100% (band B to C)"),
    ("TC-CAL-006", "100000.00", "150000.00", "payout", "3300.00", "Exactly 150% (band C to D)"),
    ("TC-CAL-007", "100000.00", "200000.00", "payout", "5800.00", "Exactly 200% (cap limit)"),
    ("TC-CAL-008", "100000.00", "250000.00", "payout", "5800.00", "250% is capped"),
    ("TC-CAL-009", "100000.00", "-1500.00", "gate", "-1.50|no|0.00", "Negative net credit pays 0.00"),
    ("TC-CAL-010", "10000.00", "5000.50", "payout", "50.01", "Half-cent tie rounds up"),
    ("TC-CAL-011", "33333.33", "30000.00", "payout", "350.00", "Band limits between cents"),
    ("TC-CAL-012", "100000.00", "150000.00", "bands", "80000.00/800.00 20000.00/500.00 50000.00/2000.00 0.00/0.00",
     "Band breakdown at 150%"),
    ("TC-CAL-014", "30000.00", "10000.00", "attainment", "33.33", "Attainment display rounds half-up"),
    ("TC-CAL-014", "30000.00", "20000.00", "attainment", "66.67", "Attainment display rounds half-up"),
    ("TC-CAL-014", "100000.00", "12345.00", "attainment", "12.35", "Attainment display rounds half-up"),
    ("TC-CAL-015", "10000.00", "5000.50", "band_a", "50.01", "Band A commission tie rounds half-up"),
]


def qa(repos: Path) -> dict:
    repo = repos / "incentive-comp-qa"
    rc2 = load_module("demo_qa_calc_rc2", repo / "app" / "calc.py")
    # Build rc1 is the commit the rc1 test run used (the tag is v0.1.0-rc1)
    source = None
    for rev in ("v0.1.0-rc1", "0aaaf70"):
        r = subprocess.run(["git", "-C", str(repo), "show", f"{rev}:app/calc.py"], capture_output=True, text=True)
        if r.returncode == 0:
            source = r.stdout
            break
    if source is None:
        raise SystemExit("incentive-comp-qa: could not read rc1's app/calc.py from git")
    rc1 = types.ModuleType("demo_qa_calc_rc1")
    sys.modules[rc1.__name__] = rc1
    exec(compile(source, "rc1/app/calc.py", "exec"), rc1.__dict__)

    def cents(text: str) -> int:
        return int(round(float(text) * 100))

    def statement(calc, quota: str, credited: str, half_up_bands: bool) -> dict:
        res = calc.calculate(cents(credited), cents(quota))
        fmt = rc2.display if half_up_bands else (lambda v: f"{v:.2f}")   # service.py of each build
        return {"attainment": f"{res.attainment_pct:.2f}", "qualified": res.qualified, "payout": f"{res.payout:.2f}",
                "bands": [[b.band, fmt(b.base), fmt(b.commission)] for b in res.bands]}

    def observed(st: dict, check: str) -> str:
        if check == "gate":
            return f"{st['attainment']}|{'yes' if st['qualified'] else 'no'}|{st['payout']}"
        if check == "payout":
            return st["payout"]
        if check == "attainment":
            return st["attainment"]
        if check == "band_a":
            return st["bands"][0][2]
        return " ".join(f"{b}/{c}" for _, b, c in st["bands"])

    cases = []
    for tc, quota, credited, check, expected, title in QA_CASES:
        new, old = statement(rc2, quota, credited, True), statement(rc1, quota, credited, False)
        if observed(new, check) != expected:
            raise SystemExit(f"{tc}: rc2 gives {observed(new, check)}, the catalogue expects {expected}")
        cases.append({"id": tc, "title": title, "quota": quota, "credited": credited, "check": check,
                      "expected": expected, "rc2": new, "rc1": old})
    return {
        "source": "incentive-comp-qa: app/calc.py (rc2) and the same file at v0.1.0-rc1, cases from docs/03-test-cases.csv",
        "cases": cases,
        "bugs": {"TC-CAL-001": "BUG-002", "TC-CAL-002": "BUG-002", "TC-CAL-010": "BUG-003",
                 "TC-CAL-014": "BUG-006", "TC-CAL-015": "BUG-006"},
    }


# ---------------------------------------------------------------------------
# vigia: one day of loyalty-api traffic and the latency detector
# ---------------------------------------------------------------------------

VIGIA_APP = "loyalty-api"
VIGIA_SEED = 174          # a day on which the old rule raises a night false alarm (see the docstring)
VIGIA_DAY = datetime(2026, 10, 7, 6, 0, tzinfo=UTC)     # 7 October 2026, 00:00 in Mexico City (UTC-6)


def vigia(repos: Path) -> dict:
    """
    The day comes from Vigía's own simulator. Errors are set to zero because the
    demo ports only the latency half of the detector. The seed was picked from
    the first 300 because it shows the night-bucket problem the calibration
    found; across 40 calibration runs the old rule raised 18 false alarms in
    2,400 application-days and the calibrated one raised 1.
    """
    repo = repos / "vigia"
    sys.path.insert(0, str(repo / "scripts"))
    try:
        import calibrate_detector as cd
        import traffic_model as tm
    finally:
        sys.path.remove(str(repo / "scripts"))
    det = cd.load_detector()
    profile = tm.PROFILES[VIGIA_APP]
    start, end = VIGIA_DAY - timedelta(days=1), VIGIA_DAY + timedelta(days=1)
    incident = tm.Incident(VIGIA_APP, VIGIA_DAY + timedelta(hours=15), 60, latency_factor=2.5,
                           description="every call 2.5 times slower for an hour")
    rng = np.random.default_rng([2026, VIGIA_SEED])
    events = pd.concat([tm.generate_events(profile, start, VIGIA_DAY, rng, [incident]),
                        tm.generate_events(profile, VIGIA_DAY, end, rng, [incident])], ignore_index=True)
    series = cd.bucket_series(events, start, end, 15)
    if len(series) != 192:
        raise SystemExit("vigia: expected 192 buckets of 15 minutes")
    series["errors_5xx"] = 0
    series["error_rate"] = 0.0
    series["p95_latency_ms"] = series["p95_latency_ms"].round(2)

    configs = {"default": det.DetectorConfig(),
               "old": det.DetectorConfig(min_requests=30, latency_threshold=3.5)}
    reference = {}
    for name, config in configs.items():
        scored, episodes = det.detect(series, config, 15)
        index = {b: i for i, b in enumerate(series["bucket"])}
        reference[name] = {
            "min_requests": config.min_requests, "threshold": config.latency_threshold,
            "z": [None if math.isnan(z) else round(float(z), 12) for z in scored["latency_score"]],
            "episodes": [[index[e.start], e.buckets, round(e.max_score, 9),
                          bool(cd.overlaps(e, incident))] for e in episodes],
        }
    if [e[3] for e in reference["default"]["episodes"]] != [True] or \
            sorted(e[3] for e in reference["old"]["episodes"]) != [False, True]:
        raise SystemExit("vigia: the chosen day no longer shows the night false alarm")
    cfg = det.DetectorConfig()
    return {
        "source": f"vigia: scripts/traffic_model.py ({VIGIA_APP}, seed {VIGIA_SEED}) and anomaly.py",
        "app": VIGIA_APP,
        "first_bucket_local": (start - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M"),
        "bucket_minutes": 15,
        "requests": [int(n) for n in series["requests"]],
        "p95": [float(v) for v in series["p95_latency_ms"]],
        "incident": {"start_bucket": 96 + 60, "buckets": 4, "factor": 2.5},
        "config": {"window": cfg.window, "min_relative_increase": cfg.min_relative_increase,
                   "max_gap_buckets": cfg.max_gap_buckets, "min_episode_buckets": cfg.min_episode_buckets,
                   "strong_score": cfg.strong_score},
        "reference": reference,
        "calibration": [[30, 3.5, 18], [100, 3.5, 4], [100, 4.5, 1]],
    }


# ---------------------------------------------------------------------------
# notes: the sample note split and ranked like the pipeline does it
# ---------------------------------------------------------------------------

NOTES_QUERIES = ["sistema alemán", "ISR", "aguinaldo exento", "tabla de amortización", "error del profesor"]


def notes(repos: Path) -> dict:
    repo = repos / "class-notes-pipeline"
    sys.path.insert(0, str(repo))
    try:
        from extensiones import indice
    finally:
        sys.path.remove(str(repo))
    rel = "Diplomado Finanzas/Clase 24 septiembre.md"
    md = (repo / "ejemplos" / "vault-ejemplo" / rel).read_text(encoding="utf-8")
    fragments = indice.fragmentos_de_nota(md, rel)
    documents = {f.id: indice.terminos(f.documento()) for f in fragments}
    if not indice._Raiz._stemmer:
        raise SystemExit("notes: install snowballstemmer, the pipeline stems Spanish words with it")
    reference = {q: indice.ranking_bm25(q, documents)[:5] for q in NOTES_QUERIES}
    position = {f.id: i for i, f in enumerate(fragments)}
    return {
        "source": "class-notes-pipeline: ejemplos/vault-ejemplo, split and ranked by extensiones/indice.py",
        "note": fragments[0].nota,
        "stopwords": sorted(indice.STOPWORDS),
        "fragments": [{"source": f.fuente, "section": f.seccion, "minute": f.minuto, "text": f.texto,
                       "terms": len(documents[f.id])} for f in fragments],
        "reference": {q: [position[k] for k in keys] for q, keys in reference.items()},
        "k1": 1.5, "b": 0.75,
    }


# ---------------------------------------------------------------------------
# retail: stores against their zone
# ---------------------------------------------------------------------------

def retail(repos: Path) -> dict:
    repo = repos / "Retail-Business-Data-Cases"
    fact = pd.read_csv(repo / "bi" / "fact_envios.csv", usecols=["envio_id", "zona", "tienda_destino",
                                                                  "transportista", "flag_valido_kpi",
                                                                  "flag_otif_operativo"])
    k = fact[fact["flag_valido_kpi"] == 1]
    stores = (k.groupby(["tienda_destino", "zona"])
               .agg(n=("envio_id", "size"), ok=("flag_otif_operativo", "sum")).reset_index())

    # The notebook's test (analisis.ipynb, cell 30), to check the demo against
    def wilson(ok, n, z=1.96):
        p = ok / n
        d = 1 + z ** 2 / n
        centre = (p + z ** 2 / (2 * n)) / d
        half = z * np.sqrt(p * (1 - p) / n + z ** 2 / (4 * n ** 2)) / d
        return centre - half, centre + half

    zone = k.groupby("zona")["flag_otif_operativo"].mean()
    flagged = [r.tienda_destino for r in stores.itertuples()
               if wilson(r.ok, r.n)[1] < zone[r.zona]]
    if flagged != ["T1054"]:
        raise SystemExit(f"retail: the notebook flags T1054 alone, this data flags {flagged}")
    west = k[k["zona"] == "Occidente"].groupby("transportista")["flag_otif_operativo"].agg(["size", "mean"])
    return {
        "source": "Retail-Business-Data-Cases: bi/fact_envios.csv, valid shipments, test of analisis.ipynb cell 30",
        "stores": [[r.tienda_destino, r.zona, int(r.n), int(r.ok)] for r in stores.itertuples()],
        "west_carriers": [[c, int(r["size"]), round(float(r["mean"]), 4)] for c, r in west.iterrows()],
        "expected_flagged": flagged,
    }


# ---------------------------------------------------------------------------
# inflation: the thesis equations, integrated with SciPy as the reference
# ---------------------------------------------------------------------------

def inflation() -> dict:
    from scipy.integrate import solve_ivp

    s6 = math.sqrt(6.0)

    def potential(phi, k):
        return (s6 * np.tanh(phi / s6)) ** k

    def slope_of(phi, k):
        return k * (s6 * np.tanh(phi / s6)) ** (k - 1) / np.cosh(phi / s6) ** 2

    def rhs(_t, y, k):
        phi, v, _n = y
        hubble = math.sqrt((0.5 * v * v + potential(phi, k)) / 3.0)
        return [v, -3.0 * hubble * v - slope_of(phi, k), hubble]

    out = {}
    for k in (2, 4, 6):
        x_end = 0.5 * math.asinh(k / math.sqrt(3.0))
        phi0 = s6 * 0.5 * math.acosh((2 * k / 3) * 60.0 + math.cosh(2 * x_end))
        v0 = -slope_of(phi0, k) / (3.0 * math.sqrt(potential(phi0, k) / 3.0))

        def end(_t, y, k):
            return y[1] ** 2 - potential(y[0], k)
        end.terminal, end.direction = True, 1
        first = solve_ivp(rhs, (0, 1e5), [phi0, v0, 0.0], args=(k,), method="DOP853",
                          rtol=1e-12, atol=1e-14, events=end)
        t_end, y_end = first.t_events[0][0], first.y_events[0][0]
        n_end = y_end[2]

        def stop(_t, y, k):
            return y[2] - (n_end + 4.01)
        stop.terminal = True
        second = solve_ivp(rhs, (t_end, t_end + 1e7), y_end, args=(k,), method="DOP853", rtol=1e-12, atol=1e-14,
                           events=stop, dense_output=True, max_step=0.05)
        t = np.linspace(t_end, second.t[-1], 4_000_001)
        y = second.sol(t)
        n, log_rho = y[2], np.log(0.5 * y[1] ** 2 + potential(y[0], k))
        window = (n >= n_end + 2) & (n <= n_end + 4)
        nw, lw = n[window], log_rho[window]
        w = np.diff(nw)

        def mean(f):
            return float(np.sum(0.5 * (f[1:] + f[:-1]) * w) / np.sum(w))

        slope = (mean(nw * lw) - mean(nw) * mean(lw)) / (mean(nw * nw) - mean(nw) ** 2)
        out[str(k)] = {"phi0": phi0, "n_end": float(n_end), "phi_end": float(y_end[0]),
                       "phi_end_slow_roll": s6 * x_end, "slope": slope, "expected": -6 * k / (k + 2)}
    return {"source": "SciPy solve_ivp, DOP853, rtol 1e-12, fit of ln rho against N from 2 to 4 e-folds after the end",
            "runs": out}


# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--repos", type=Path, default=ROOT.parent / "repos",
                        help="folder with the project repositories (default: ../repos)")
    args = parser.parse_args(argv)
    repos = args.repos.expanduser().resolve()
    sections = {"btc": btc(repos), "api": api(repos), "qa": qa(repos), "vigia": vigia(repos),
                "notes": notes(repos), "retail": retail(repos), "inflation": inflation()}
    body = ",\n".join(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False, separators=(',', ':'))}"
                      for k, v in sections.items())
    OUT.write_text("/* Generated by tools/demo_data.py from the project repositories. Do not edit by hand. */\n"
                   f"window.LQDemoData = {{\n{body}\n}};\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
