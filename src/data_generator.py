"""Sample data for Tesla: one region's quarterly baseline plan and the uncertainty assumptions used in simulation."""
from pathlib import Path

import numpy as np
import pandas as pd


def generate(seed: int = 42) -> dict:
    rng = np.random.default_rng(seed)
    jitter = lambda v, s=0.02: round(v * (1 + rng.normal(0, s)), 2)
    baseline = pd.DataFrame([
        ("quarterly_demand_cars", jitter(120000), "Cars customers would buy this quarter at today's price"),
        ("avg_selling_price_usd", jitter(47000, 0.01), "Average selling price per car"),
        ("cogs_per_car_usd", jitter(38500, 0.01), "Cost of goods per car"),
        ("cars_per_shift_per_quarter", jitter(9800), "Assembly output of one weekly shift over a quarter"),
        ("shifts_per_week", 14, "Current shifts per week across the lines"),
        ("line_uptime", 0.92, "Share of scheduled time lines are running"),
        ("labour_hours_per_car", jitter(22), "Direct labour hours to build one car"),
        ("production_workers", 11500, "Production workforce"),
        ("hours_per_worker_per_quarter", 480, "Available hours per worker per quarter"),
        ("battery_cells_gwh", jitter(9.2), "Battery cell supply per quarter (GWh)"),
        ("kwh_per_car", 70, "Average battery pack size"),
        ("delivery_slots", jitter(132000), "Cars delivery centres can hand over per quarter"),
        ("fixed_opex_usd", 520e6, "Fixed operating cost per quarter"),
    ], columns=["parameter", "value", "description"])
    uncertainty = pd.DataFrame([("demand", 0.06, 0.0), ("assembly_capacity", 0.05, 0.0), ("labour_productivity", 0.04, 0.0), ("battery_supply", 0.07, 0.08), ("delivery_capacity", 0.04, 0.0)],
                               columns=["factor", "std_dev", "disruption_probability"])
    levers = pd.DataFrame([("extra_shift", 9e6, 0, "Per extra weekly shift: overtime pay and shift premiums per quarter"),
                           ("new_line", 0, 380e6, "New assembly line: +25% capacity and +20% labour pool, 20-quarter depreciation"),
                           ("battery_contract_10pct", 6.4e6, 0, "Per extra 10% of cell supply"),
                           ("delivery_partner_10pct", 3e6, 0, "Per extra 10% of delivery slots via third parties")], columns=["lever", "cost_per_quarter_usd", "investment_usd", "description"])
    return {"baseline": baseline, "uncertainty": uncertainty, "levers": levers}


# ---------------------------------------------------------------------------
# Save and load helpers
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def save(data: dict, folder: Path = DATA_DIR) -> None:
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for name, df in data.items():
        df.to_csv(folder / f"{name}.csv", index=False)


def load_or_generate(folder: Path = DATA_DIR, seed: int = 42) -> dict:
    """Read the CSVs in data/ if they exist, otherwise generate fresh sample data."""
    folder = Path(folder)
    names = list(generate(seed).keys())
    if all((folder / f"{n}.csv").exists() for n in names):
        return {n: pd.read_csv(folder / f"{n}.csv") for n in names}
    return generate(seed)


if __name__ == "__main__":
    d = generate(42)
    save(d)
    for n, df in d.items():
        print(f"data/{n}.csv  {len(df):,} rows x {df.shape[1]} columns")
