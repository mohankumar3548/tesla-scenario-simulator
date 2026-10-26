"""Monte Carlo what-if simulator for a sales growth target at Tesla."""
import itertools
import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.utils import bar, kpi, money, num, pct, rec, table

META = json.loads(Path(__file__).with_name("meta.json").read_text())
PARAMS = [
    {"name": "growth_pct", "label": "Sales growth target (%)", "min": 0, "max": 40, "step": 5, "default": 20},
    {"name": "extra_shifts", "label": "Extra shifts per week", "min": 0, "max": 4, "step": 1, "default": 1},
    {"name": "new_line", "label": "Add a new assembly line", "options": ["No", "Yes"], "default": "No"},
    {"name": "extra_cells_pct", "label": "Extra battery cell contract (%)", "min": 0, "max": 30, "step": 5, "default": 10},
    {"name": "delivery_partners_pct", "label": "Third-party delivery slots (%)", "min": 0, "max": 30, "step": 5, "default": 10},
    {"name": "price_change_pct", "label": "Price change (%)", "min": -10, "max": 5, "step": 1, "default": 0},
]
RUNS, ELASTICITY = 2000, -1.8
RESOURCES = ["Demand", "Assembly capacity", "Labour", "Battery cells", "Delivery slots"]


def capacities(B, growth, shifts, line, cells, dlv, price):
    cap = B["cars_per_shift_per_quarter"] * (B["shifts_per_week"] + shifts) * (1.25 if line else 1) * B["line_uptime"]
    labour = B["production_workers"] * (1 + shifts / B["shifts_per_week"] * 0.9) * B["hours_per_worker_per_quarter"] / B["labour_hours_per_car"] * (1.2 if line else 1)
    cell = B["battery_cells_gwh"] * (1 + cells / 100) * 1e6 / B["kwh_per_car"]
    slots = B["delivery_slots"] * (1 + dlv / 100)
    demand = B["quarterly_demand_cars"] * (1 + growth / 100) * (1 + price / 100) ** ELASTICITY
    return np.array([demand, cap, labour, cell, slots])


def simulate(B, U, lv, growth, shifts, line, cells, dlv, price, n, seed):
    rng = np.random.default_rng(seed)
    base = capacities(B, growth, shifts, line, cells, dlv, price)
    noise = np.column_stack([1 + rng.normal(0, s, n) - (rng.random(n) < p) * 0.12 for s, p in zip(U.std_dev, U.disruption_probability)])
    lim = base * noise
    delivered = lim.min(1); binding = lim.argmin(1)
    hit = float((delivered >= lim[:, 0] * 0.98).mean())   # supply serves realised demand
    var = shifts * lv.loc["extra_shift", "cost_per_quarter_usd"] + cells / 10 * lv.loc["battery_contract_10pct", "cost_per_quarter_usd"] + dlv / 10 * lv.loc["delivery_partner_10pct", "cost_per_quarter_usd"]
    invest = lv.loc["new_line", "investment_usd"] if line else 0
    return delivered, binding, hit, base, var, invest


def finance(B, units, price, var, invest, shifts):
    asp = B["avg_selling_price_usd"] * (1 + price / 100)
    rev = units * asp; cost = units * B["cogs_per_car_usd"] * (1.015 if shifts > 2 else 1) + B["fixed_opex_usd"] + var + invest / 20
    return rev, rev - cost


def run(data, growth_pct=20, extra_shifts=1, new_line="No", extra_cells_pct=10, delivery_partners_pct=10, price_change_pct=0):
    B = data["baseline"].set_index("parameter")["value"].astype(float).to_dict()
    U, lv = data["uncertainty"], data["levers"].set_index("lever")
    line = new_line == "Yes"; target = B["quarterly_demand_cars"] * (1 + growth_pct / 100)
    d, bnd, p, base, var, inv = simulate(B, U, lv, growth_pct, extra_shifts, line, extra_cells_pct, delivery_partners_pct, price_change_pct, RUNS, 1)
    d0, bnd0, p0, _, _, _ = simulate(B, U, lv, growth_pct, 0, False, 0, 0, 0, RUNS, 2)
    rev, prof = finance(B, d.mean(), price_change_pct, var, inv, extra_shifts)
    rev0, prof0 = finance(B, B["quarterly_demand_cars"], 0, 0, 0, 0)
    plans = []
    for s, ln, c, dl in itertools.product(range(5), [False, True], [0, 10, 20, 30], [0, 10, 20, 30]):
        dd, _, pp_, _, vv, ii = simulate(B, U, lv, growth_pct, s, ln, c, dl, 0, 400, s * 1000 + c * 10 + dl + ln * 7)
        r_, pr_ = finance(B, dd.mean(), 0, vv, ii, s)
        desc = ", ".join(x for x in [f"+{s} shift{'s' * (s > 1)}" * bool(s), "new line" * ln, f"+{c}% cells" * bool(c), f"+{dl}% delivery" * bool(dl)] if x) or "No changes"
        plans.append({"plan": desc.capitalize() if desc[0].islower() else desc, "odds": round(pp_, 2), "extra_cost_per_quarter": round(vv + ii / 20), "profit_per_quarter": round(pr_), "investment": ii, "cars": round(dd.mean())})
    P = pd.DataFrame(plans); ok = P[P.odds >= 0.8].sort_values("extra_cost_per_quarter")
    best = ok.iloc[0] if len(ok) else None
    share = lambda b: pd.Series(np.bincount(b, minlength=5) / len(b), index=RESOURCES)
    binding = pd.DataFrame({"resource": RESOURCES, "today": share(bnd0).round(3).values, "your_plan": share(bnd).round(3).values}).sort_values("your_plan", ascending=False)
    cap = pd.DataFrame({"resource": RESOURCES, "cars_supported": base.round(0), "target": round(target)})
    hist_counts, edges = np.histogram(d, bins=20)
    hist = pd.DataFrame({"deliveries": [f"{e / 1000:.0f}k" for e in edges[:-1]], "runs": hist_counts})
    fin = pd.DataFrame({"measure": ["Cars delivered", "Revenue", "Operating profit", "Margin", "Up-front investment", "Odds of meeting demand"],
                        "today": [num(B["quarterly_demand_cars"]), money(rev0), money(prof0), pct(prof0 / rev0), "$0", pct(p0, 0)],
                        "your_plan": [num(d.mean()), money(rev), money(prof), pct(prof / rev), money(inv), pct(p, 0)]})
    top_today = binding.sort_values("today", ascending=False)
    return {
        "steps": [f"Base quarter: {num(B['quarterly_demand_cars'])} cars, {money(rev0)} revenue", "5 linked constraints",
                  f"+{extra_shifts} shifts, line {new_line.lower()}, +{extra_cells_pct}% cells, +{delivery_partners_pct}% delivery, price {price_change_pct:+d}%",
                  f"{RUNS} runs, mean {num(d.mean())} cars delivered", f"Binding most often: {binding.iloc[0].resource} ({pct(binding.iloc[0].your_plan, 0)} of runs)",
                  f"{len(P)} lever combinations tested; {len(ok)} reach 80% odds", f"Profit {money(prof0)} -> {money(prof)} per quarter", "Ready"],
        "kpis": [kpi("Chance to meet demand", pct(p, 0), f"{num(target)} cars (+{growth_pct}%) with your levers"), kpi("With today's resources", pct(p0, 0), f"Limited by {top_today.iloc[0].resource.lower()}"),
                 kpi("Expected deliveries", num(d.mean()), f"80% range {num(np.quantile(d, 0.1))} to {num(np.quantile(d, 0.9))}"),
                 kpi("Quarterly profit", money(prof), f"{'+' if prof >= prof0 else '-'}{money(abs(prof - prof0))} vs today"),
                 kpi("Cheapest plan", best.plan if best is not None else "Not reachable", f"{pct(best.odds, 0)} odds, {money(best.extra_cost_per_quarter)} a quarter" if best is not None else "No combination reaches 80%")],
        "charts": [bar("Capacity vs target (cars per quarter)", cap, "resource", ["cars_supported", "target"]), bar("Simulated deliveries", hist, "deliveries", "runs", horizontal=False),
                   bar("What stops growth (share of runs where each resource binds)", binding, "resource", ["today", "your_plan"])],
        "tables": [table("Financial impact per quarter", fin), table("Cheapest plans that reach 80% odds", ok.head(8)), table("All lever combinations", P.sort_values("odds", ascending=False))],
        "recs": [rec(f"Today's resources {'can' if p0 >= 0.8 else 'cannot'} deliver +{growth_pct}%", f"Odds are {pct(p0, 0)} with no changes. {top_today.iloc[0].resource} runs out first in {pct(top_today.iloc[0].today, 0)} of runs.", f"{pct(p0, 0)} odds"),
                 rec(f"Cheapest route: {best.plan}", f"Meets demand in {pct(best.odds, 0)} of runs for {money(best.extra_cost_per_quarter)} extra a quarter; quarterly profit {money(best.profit_per_quarter)}.", money(best.extra_cost_per_quarter) + "/qtr") if best is not None
                 else rec("Lower the target or add capacity", "No mix of shifts, a new line, cells and delivery partners reaches 80% odds.", "Not reachable"),
                 rec(f"Fix {binding.iloc[0].resource.lower()} first under your plan", f"It is still the limit in {pct(binding.iloc[0].your_plan, 0)} of runs.", "Priority"),
                 rec("Lock battery supply before adding shifts", "Cell supply has the widest swing, including an 8% chance of a supplier disruption.", "Risk")],
    }


if __name__ == "__main__":
    from src.data_generator import load_or_generate
    from src.report import write_reports

    out = run(load_or_generate(), **{p["name"]: p["default"] for p in PARAMS})
    for k in out["kpis"]:
        print(f"{k['label']}: {k['value']}  {k['note']}")
    print("Reports written to", write_reports(out, META, Path(__file__).resolve().parent.parent / "reports"))
