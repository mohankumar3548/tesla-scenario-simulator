# Tesla Growth Simulator

AI solution 14 of 14 · Business Analytics · built for **Tesla**

Prepared by **K Mohan Kumar**.

**Live website:** https://mohankumar3548.github.io/tesla-scenario-simulator/

## Problem statement

Management wants to increase sales by 20% but does not know whether existing employees, inventory, production capacity and logistics can support the additional demand. Build an AI scenario-analysis system that simulates business consequences of different strategic decisions.

## Why Tesla

Tesla's growth depends on factories, battery cells, workers and delivery logistics scaling together, and it has hit production ramp limits before. This tool tests whether a sales target is possible and what it would cost to get there.

## Project structure

```
tesla-scenario-simulator/
├── index.html                 Website entry point (served by GitHub Pages)
├── frontend/
│   ├── css/style.css          Layout, typography, light and dark themes
│   └── js/
│       ├── engine.js          Maths, models, charts, page layout and AI analyst panel
│       └── model.js           Sample data and the algorithm for this problem (browser version)
├── app.py                     Streamlit dashboard (Python version of the website)
├── src/
│   ├── data_generator.py      Builds the sample dataset and saves it to data/
│   ├── model.py               The algorithm in Python (pandas, NumPy, scikit-learn)
│   ├── report.py              Writes results to reports/
│   ├── utils.py               Formatting and forecasting helpers
│   └── meta.json              Problem statement, company and algorithm steps
├── data/                      Sample data as CSV
├── reports/                   Results: results.json, summary.md and CSV tables
├── tests/test_model.py        pytest tests for the data and the model
├── requirements.txt
└── pytest.ini
```

## Algorithm

1. **Baseline business model**: Demand, line capacity, labour hours, battery cells, delivery slots, costs
2. **Map dependencies**: Demand needs cars built, cars need labour and cells, cars need delivery slots
3. **Set the scenario**: Sales growth, shifts, new line, battery contract, price, delivery partners
4. **Monte Carlo simulation**: 2,000 runs with uncertain demand, yield, productivity and supply
5. **Find the binding constraint**: Which resource runs out first in each run
6. **Search for the cheapest plan**: Try every combination of levers, keep the cheapest that hits the target 80% of the time
7. **Financial impact**: Revenue, cost, margin and investment per scenario
8. **Scenario Q&A**: AI analyst answers what-if questions

The same algorithm is implemented twice: in JavaScript (`frontend/js/model.js`) so the website runs in any browser with no server, and in Python (`src/model.py`) for analysis, the Streamlit dashboard and the tests.

## How to run

**Website:** open the live link above, or open `index.html` in a browser.

**Python:**

```bash
pip install -r requirements.txt
python -m src.data_generator     # create the sample data in data/
python -m src.model              # run the algorithm and write reports/
streamlit run app.py             # open the interactive dashboard
pytest                           # run the tests
```

## Data

One region's quarterly plan: 4 assembly lines, battery supply, workforce, delivery centres and cost base (sample data). Files: `data/baseline.csv`, `data/levers.csv`, `data/uncertainty.csv`. All figures are illustrative and are not Tesla's actual numbers.

## Results (default settings, Python run)

| Measure | Value | Note |
|---|---|---|
| Chance to meet demand | 22% | 144,878 cars (+20%) with your levers |
| With today's resources | 4% | Limited by battery cells |
| Expected deliveries | 132,364 | 80% range 123,695 to 140,011 |
| Quarterly profit | $483.8M | +$71.4M vs today |
| Cheapest plan | New line, +30% cells, +20% delivery | 83% odds, $44.2M a quarter |

### Recommended actions

1. **Today's resources cannot deliver +20%.** Odds are 4% with no changes. Battery cells runs out first in 50% of runs.
2. **Cheapest route: New line, +30% cells, +20% delivery.** Meets demand in 83% of runs for $44.2M extra a quarter; quarterly profit $545.1M.
3. **Fix assembly capacity first under your plan.** It is still the limit in 42% of runs.
4. **Lock battery supply before adding shifts.** Cell supply has the widest swing, including an 8% chance of a supplier disruption.

Full output: [`reports/summary.md`](reports/summary.md) and [`reports/results.json`](reports/results.json).

## AI analyst panel

The website includes an "Ask the AI analyst" panel that answers questions about the results through Claude. It works when the page is opened as a Claude artifact on claude.ai. On GitHub Pages the models, charts and controls run in full and the panel shows that it is unavailable.
