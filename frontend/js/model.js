/* Tesla Growth Simulator: sample data generator and algorithm for Tesla. */
const TOOL = {
  num: 14, area: "Business Analytics", product: "What-If Business Simulator", seed: 141,
  title: "Tesla Growth Simulator", company: "Tesla",
  why: "Tesla's growth depends on factories, battery cells, workers and delivery logistics scaling together, and it has hit production ramp limits before. This tool tests whether a sales target is possible and what it would cost to get there.",
  statement: "Management wants to increase sales by 20% but does not know whether existing employees, inventory, production capacity and logistics can support the additional demand. Build an AI scenario-analysis system that simulates business consequences of different strategic decisions.",
  dataNote: "One region's quarterly plan: 4 assembly lines, battery supply, workforce, delivery centres and cost base (sample data).",
  steps: [
    ["Baseline business model", "Demand, line capacity, labour hours, battery cells, delivery slots, costs"],
    ["Map dependencies", "Demand needs cars built, cars need labour and cells, cars need delivery slots"],
    ["Set the scenario", "Sales growth, shifts, new line, battery contract, price, delivery partners"],
    ["Monte Carlo simulation", "2,000 runs with uncertain demand, yield, productivity and supply"],
    ["Find the binding constraint", "Which resource runs out first in each run"],
    ["Search for the cheapest plan", "Try every combination of levers, keep the cheapest that hits the target 80% of the time"],
    ["Financial impact", "Revenue, cost, margin and investment per scenario"],
    ["Scenario Q&A", "AI analyst answers what-if questions"]
  ],
  params: [
    { id: "g", label: "Sales growth target", min: 0, max: 40, step: 5, value: 20, fmt: v => "+" + v + "%" },
    { id: "shift", label: "Extra shifts per week", min: 0, max: 4, step: 1, value: 1, fmt: v => "+" + v },
    { id: "line", label: "Add a new assembly line", type: "select", value: "no", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes (+25% capacity, $380M)" }] },
    { id: "cells", label: "Extra battery cell contract", min: 0, max: 30, step: 5, value: 10, fmt: v => "+" + v + "%" },
    { id: "dlv", label: "Third-party delivery partners", min: 0, max: 30, step: 5, value: 10, fmt: v => "+" + v + "% slots" },
    { id: "price", label: "Price change", min: -10, max: 5, step: 1, value: 0, fmt: v => (v > 0 ? "+" : "") + v + "%" }
  ],
  questions: ["Can we hit +20% with what we have today?", "What is the cheapest way to reach the target?", "What if we cut prices by 5% instead?", "Which constraint should we fix first?"],
  generate(r) {
    return { base: { demand: 120000, asp: 47000, cogs: 38500, capPerShift: 9800, shifts: 14, labourHrsPerCar: 22, workers: 11500, hrsPerWorker: 480, cellsGWh: 9.2, kwhPerCar: 70, dlvSlots: 132000, opex: 520e6 } };
  },
  analyze(D, P, r) {
    const B = D.base, runs = 2000;
    const lever = (L, g, price) => {
      const cap = B.capPerShift * (B.shifts + L.shift) * (L.line ? 1.25 : 1) * 0.92;
      const labour = (B.workers * (1 + L.shift / B.shifts * 0.9)) * B.hrsPerWorker / B.labourHrsPerCar * (L.line ? 1.2 : 1);
      const cells = B.cellsGWh * (1 + L.cells / 100) * 1e6 / B.kwhPerCar;
      const dlv = B.dlvSlots * (1 + L.dlv / 100);
      const demand = B.demand * (1 + g / 100) * Math.pow(1 + price / 100, -1.8);
      const invest = (L.line ? 380e6 : 0) + L.shift * 6.5e6 * 4 / 4 + 0;
      const varCost = L.shift * 9e6 + L.cells / 100 * 64e6 + L.dlv / 100 * 30e6;
      return { cap, labour, cells, dlv, demand, invest, varCost };
    };
    const simulate = (L, g, price, rr, n) => {
      const v = lever(L, g, price); const out = [], dems = [], bind = { Demand: 0, "Assembly capacity": 0, Labour: 0, "Battery cells": 0, "Delivery slots": 0 };
      for (let i = 0; i < n; i++) {
        const dem = v.demand * (1 + rr.n(0, 0.06)), cap = v.cap * (1 + rr.n(0, 0.05)), lab = v.labour * (1 + rr.n(0, 0.04)), cel = v.cells * (1 + rr.n(0, 0.07) - (rr.chance(0.08) ? 0.12 : 0)), dl = v.dlv * (1 + rr.n(0, 0.04));
        const lim = { Demand: dem, "Assembly capacity": cap, Labour: lab, "Battery cells": cel, "Delivery slots": dl };
        const k = Object.keys(lim).reduce((a, b) => lim[a] < lim[b] ? a : b); bind[k]++; out.push(lim[k]); dems.push(dem);
      }
      const hit = out.filter((x, i) => x >= dems[i] * 0.98).length / n; return { v, out, bind, hit };
    };
    const target = B.demand * (1 + P.g / 100);
    const L = { shift: P.shift, line: P.line === "yes", cells: P.cells, dlv: P.dlv };
    const sim = simulate(L, P.g, P.price, r, runs);
    const p = sim.hit, mean = S.mean(sim.out), p10 = S.quantile(sim.out, 0.1), p90 = S.quantile(sim.out, 0.9);
    const fin = (Lx, units, price) => { const v = lever(Lx, P.g, price); const asp = B.asp * (1 + price / 100); const rev = units * asp, cost = units * B.cogs * (1 + (Lx.shift > 2 ? 0.015 : 0)) + B.opex + v.varCost + v.invest / 20; return { rev, profit: rev - cost, margin: (rev - cost) / rev, invest: v.invest }; };
    const base = simulate({ shift: 0, line: false, cells: 0, dlv: 0 }, P.g, 0, RNG(7), runs);
    const pBase = base.hit;
    const f = fin(L, mean, P.price), f0 = fin({ shift: 0, line: false, cells: 0, dlv: 0 }, B.demand, 0);
    // optimiser: enumerate levers
    const opts = []; for (const shift of [0, 1, 2, 3, 4]) for (const line of [false, true]) for (const cells of [0, 10, 20, 30]) for (const dlv of [0, 10, 20, 30]) { const Lx = { shift, line, cells, dlv }; const s2 = simulate(Lx, P.g, 0, RNG(shift * 1000 + cells * 10 + dlv + (line ? 7 : 0)), 300); const pp = s2.hit; const fx = fin(Lx, S.mean(s2.out), 0); opts.push({ Lx, p: pp, cost: s2.v.varCost + s2.v.invest / 20, fx }); }
    const ok = opts.filter(o => o.p >= 0.8).sort((a, b) => a.cost - b.cost); const best = ok[0];
    const bind = Object.entries(sim.bind).map(([k, v]) => ({ label: k, value: v / runs })).sort((a, b) => b.value - a.value);
    const bindBase = Object.entries(base.bind).map(([k, v]) => ({ label: k, value: v / runs })).sort((a, b) => b.value - a.value);
    const lim = [["Demand", sim.v.demand], ["Assembly capacity", sim.v.cap], ["Labour", sim.v.labour], ["Battery cells", sim.v.cells], ["Delivery slots", sim.v.dlv]];
    const lo = Math.min(...sim.out), hi = Math.max(...sim.out), nb = 24, w = (hi - lo) / nb || 1; const hist = S.range(nb).map(i => ({ label: F.num((lo + i * w) / 1000, 0) + "k", value: sim.out.filter(x => x >= lo + i * w && (i === nb - 1 ? x <= hi : x < lo + (i + 1) * w)).length, tone: lo + (i + 0.5) * w >= target * 0.98 ? "good" : "mut" }));
    const desc = Lx => [Lx.shift && `+${Lx.shift} shift${Lx.shift > 1 ? "s" : ""}`, Lx.line && "new line", Lx.cells && `+${Lx.cells}% cells`, Lx.dlv && `+${Lx.dlv}% delivery`].filter(Boolean).join(", ").replace(/^./, c => c.toUpperCase()) || "No changes";
    return {
      steps: [`Base quarter: ${F.num(B.demand)} cars, ${F.money(f0.rev)} revenue`, "5 linked constraints", desc(L) + (P.price ? `, price ${P.price > 0 ? "+" : ""}${P.price}%` : ""), `${runs} runs, mean ${F.num(mean)} cars delivered`, `Binding most often: ${bind[0].label} (${F.pct(bind[0].value, 0)} of runs)`, `${opts.length} lever combinations tested; ${ok.length} reach 80% odds`, `Profit ${F.money(f0.profit)} → ${F.money(f.profit)} per quarter`, "Ready"],
      kpis: [
        { label: "Chance to meet demand", value: F.pct(p, 0), note: `${F.num(target)} cars (+${P.g}%), with your levers`, tone: p >= 0.8 ? "good" : p >= 0.5 ? "warn" : "bad" },
        { label: "With today's resources", value: F.pct(pBase, 0), note: `Limited by ${bindBase[0].label.toLowerCase()}`, tone: pBase >= 0.8 ? "good" : "bad" },
        { label: "Expected deliveries", value: F.num(mean), note: `80% range ${F.num(p10)} to ${F.num(p90)}` },
        { label: "Quarterly profit", value: F.money(f.profit), note: `${F.sgn(f.profit - f0.profit, v => F.money(v))} vs today, margin ${F.pct(f.margin)}`, tone: f.profit >= f0.profit ? "good" : "bad" },
        { label: "Cheapest plan", value: best ? desc(best.Lx) : "Not reachable", note: best ? `${F.pct(best.p, 0)} odds, ${F.money(best.cost)} a quarter` : "Even every lever falls short", tone: best ? "good" : "bad" }
      ],
      sections: [
        { pair: [
          { title: "Capacity vs target", note: "Quarterly cars each resource can support with your settings. The dashed line is the target.", chart: C.bar(lim.map(([k, v]) => ({ label: k, value: v, tone: v < target ? "bad" : "" })), { fmt: v => F.num(v / 1000, 0) + "k", ref: target, labelW: 130 }) },
          { title: "Simulated deliveries", note: `${runs} runs. Green bars reach the target.`, chart: C.vbar(hist, { fmt: v => F.num(v), every: 4 }) }
        ] },
        { pair: [
          { title: "What stops growth", note: "Share of runs where each resource was the binding limit.", chart: C.grouped(bind.map(b => b.label), [{ name: "Today", values: bind.map(b => (bindBase.find(x => x.label === b.label) || { value: 0 }).value), tone: "c2" }, { name: "Your plan", values: bind.map(b => b.value), tone: "c1" }], { fmt: v => F.pct(v, 0), labelW: 130 }) + C.legend([{ label: "Today's resources", tone: "c2" }, { label: "Your plan", tone: "c1" }]) },
          { title: "Financial impact per quarter", html: T.table(["", "Today", "Your plan", best ? "Cheapest plan" : ""], [["Cars delivered", F.num(B.demand), F.num(mean), best ? F.num(S.mean(simulate(best.Lx, P.g, 0, RNG(3), 300).out)) : ""], ["Revenue", F.money(f0.rev), F.money(f.rev), best ? F.money(best.fx.rev) : ""], ["Operating profit", F.money(f0.profit), F.money(f.profit), best ? F.money(best.fx.profit) : ""], ["Margin", F.pct(f0.margin), F.pct(f.margin), best ? F.pct(best.fx.margin) : ""], ["Up-front investment", "$0", F.money(f.invest), best ? F.money(best.fx.invest) : ""], ["Odds of target", F.pct(pBase, 0), F.pct(p, 0), best ? F.pct(best.p, 0) : ""]], { right: [1, 2, 3] }) }
        ] },
        { title: "Cheapest plans that reach 80% odds", html: ok.length ? T.table(["Plan", "Odds", "Extra cost / quarter", "Profit / quarter", "Investment"], ok.slice(0, 6).map(o => [desc(o.Lx), F.pct(o.p, 0), F.money(o.cost), F.money(o.fx.profit), F.money(o.fx.invest)]), { right: [1, 2, 3, 4] }) : "<p>No combination of levers reaches the target with 80% odds. Lower the target or add capacity beyond these levers.</p>" }
      ],
      recs: [
        { title: pBase >= 0.8 ? `Today's resources can deliver +${P.g}%` : `Today's resources cannot deliver +${P.g}%`, body: `Odds are ${F.pct(pBase, 0)} with no changes. ${bindBase[0].label} runs out first in ${F.pct(bindBase[0].value, 0)} of runs, followed by ${bindBase[1].label.toLowerCase()}.`, impact: F.pct(pBase, 0) + " odds", tone: pBase >= 0.8 ? "good" : "bad" },
        best ? { title: `Cheapest route: ${desc(best.Lx)}`, body: `Reaches the target in ${F.pct(best.p, 0)} of runs for ${F.money(best.cost)} extra a quarter, with quarterly profit of ${F.money(best.fx.profit)}.`, impact: F.money(best.cost) + "/qtr", tone: "good" } : { title: "Lower the target or add capacity", body: "No mix of shifts, a new line, cells and delivery partners reaches the target with 80% odds.", impact: "Not reachable", tone: "bad" },
        { title: `Fix ${bind[0].label.toLowerCase()} first under your plan`, body: `With your settings it is still the limit in ${F.pct(bind[0].value, 0)} of runs. Adding to other resources first buys little.`, impact: "Priority", tone: "warn" },
        { title: "Lock battery supply before adding shifts", body: "Cell supply carries the widest swing in the simulation, including an 8% chance of a supplier disruption. A contract buffer protects the extra shifts from sitting idle.", impact: "Risk", tone: "" }
      ],
      context: { target_cars: Math.round(target), growth_pct: P.g, your_levers: { extra_shifts: P.shift, new_line: P.line, extra_cells_pct: P.cells, extra_delivery_pct: P.dlv, price_change_pct: P.price }, odds_with_your_plan: +p.toFixed(2), odds_today: +pBase.toFixed(2), expected_deliveries: Math.round(mean), range_p10_p90: [Math.round(p10), Math.round(p90)], capacity_by_resource: Object.fromEntries(lim.map(([k, v]) => [k, Math.round(v)])), binding_share_your_plan: bind.map(b => ({ resource: b.label, share: +b.value.toFixed(2) })), binding_share_today: bindBase.map(b => ({ resource: b.label, share: +b.value.toFixed(2) })), finance_today: { revenue: Math.round(f0.rev), profit: Math.round(f0.profit) }, finance_your_plan: { revenue: Math.round(f.rev), profit: Math.round(f.profit), investment: f.invest }, cheapest_plans: ok.slice(0, 5).map(o => ({ plan: desc(o.Lx), odds: +o.p.toFixed(2), extra_cost_per_quarter: Math.round(o.cost), profit: Math.round(o.fx.profit) })) }
    };
  }
};
