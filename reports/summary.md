# Tesla Growth Simulator: results

Built for Tesla. Prepared by K Mohan Kumar.

## Key figures

- **Chance to meet demand:** 22% (144,878 cars (+20%) with your levers)
- **With today's resources:** 4% (Limited by battery cells)
- **Expected deliveries:** 132,364 (80% range 123,695 to 140,011)
- **Quarterly profit:** $483.8M (+$71.4M vs today)
- **Cheapest plan:** New line, +30% cells, +20% delivery (83% odds, $44.2M a quarter)

## Algorithm, as it ran

1. **Baseline business model**: Base quarter: 120,731 cars, $5.62B revenue
2. **Map dependencies**: 5 linked constraints
3. **Set the scenario**: +1 shifts, line no, +10% cells, +10% delivery, price +0%
4. **Monte Carlo simulation**: 2000 runs, mean 132,364 cars delivered
5. **Find the binding constraint**: Binding most often: Assembly capacity (42% of runs)
6. **Search for the cheapest plan**: 160 lever combinations tested; 14 reach 80% odds
7. **Financial impact**: Profit $412.3M -> $483.8M per quarter
8. **Scenario Q&A**: Ready

## Recommended actions

1. **Today's resources cannot deliver +20%.** Odds are 4% with no changes. Battery cells runs out first in 50% of runs. *Impact: 4% odds*
2. **Cheapest route: New line, +30% cells, +20% delivery.** Meets demand in 83% of runs for $44.2M extra a quarter; quarterly profit $545.1M. *Impact: $44.2M/qtr*
3. **Fix assembly capacity first under your plan.** It is still the limit in 42% of runs. *Impact: Priority*
4. **Lock battery supply before adding shifts.** Cell supply has the widest swing, including an 8% chance of a supplier disruption. *Impact: Risk*

_Generated from sample data. Figures are illustrative._
