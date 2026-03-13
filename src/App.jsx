import React, { useMemo, useState } from "react";

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function InputNumber({ value, onChange, step = 1, placeholder = "" }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      step={step}
      value={value === 0 ? "" : String(value)}
      placeholder={placeholder}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9.]/g, "");
        if (digits === "") {
          onChange(0);
          return;
        }
        onChange(Number(digits));
      }}
      className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
    >
      {options.map((o) => {
        const option = typeof o === "object" ? o : { value: o, label: o };
        return <option key={String(option.value)} value={option.value}>{option.label}</option>;
      })}
    </select>
  );
}

export default function ExitPlanningAppPrototype() {

  const currency = (n) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
      Number.isFinite(n) ? n : 0
    );
  const percent = (n) => `${Math.round((n || 0) * 100)}%`;
  const qozExposureOptions = Array.from({ length: 21 }, (_, i) => ({
    value: i * 0.05,
    label: i === 0 ? "None" : `${i * 5}%`,
  }));
  const liquidityFloorOptions = [
    { value: 0, label: "None" },
    { value: 250000, label: "$250,000" },
    { value: 500000, label: "$500,000" },
    { value: 750000, label: "$750,000" },
    { value: 1000000, label: "$1,000,000" },
    { value: 1500000, label: "$1,500,000" },
    { value: 2000000, label: "$2,000,000" },
    { value: 3000000, label: "$3,000,000" },
    { value: 5000000, label: "$5,000,000" },
  ];

  const [input, setInput] = useState({
    age: 48,
    netLiquidityAfterTax: 1000000,
    estateExposure: "Yes",
    healthRating: "Select NT",
    married: "Yes",
    charitableIntent: 3,
    desireForLeverage: 1,
    maxQozExposure: 0,
    minLiquidityFloor: 0,
    appreciatedSale: "Yes",
    ltcgExists: "Yes",
    primaryObjective: "Tax Deferral",
    grossExitValue: 15000000,
    costBasis: 100000,
    federalRate: 0.2,
    stateRate: 0.05,
    niit: 0.038,
    crtPayoutRate: 0.05,
  });

  const set = (key, value) => setInput((s) => ({ ...s, [key]: value }));

  const data = useMemo(() => {
    const totalTaxRate = input.federalRate + input.stateRate + input.niit;
    const gain = Math.max(0, input.grossExitValue - input.costBasis);
    const baselineTax = gain * totalTaxRate;
    const baselineNet = input.grossExitValue - baselineTax;

    const qualifies = {
      managed: input.netLiquidityAfterTax >= 1000000,
      qoz: input.ltcgExists === "Yes" && gain > 0,
      crt: input.charitableIntent >= 3 && gain > 0,
      daf: input.charitableIntent >= 4,
      pf: input.healthRating !== "Tobacco" && input.desireForLeverage >= 3,
      slat: input.married === "Yes" && input.estateExposure === "Yes",
      grat: input.appreciatedSale === "Yes" && input.estateExposure === "Yes",
    };

    const include = {
      managed: qualifies.managed ? "Core" : "No",
      qoz: qualifies.qoz ? "Core" : "No",
      crt: !qualifies.crt ? "No" : input.charitableIntent >= 5 ? "Core" : "Optional",
      daf: !qualifies.daf ? "No" : input.charitableIntent >= 5 ? "Optional" : "No",
      pf: qualifies.pf ? "Optional" : "No",
      slat: qualifies.slat ? "Optional" : "No",
      grat: qualifies.grat ? "Optional" : "No",
    };

    const overlayModules = [
      include.pf !== "No" ? "Premium Finance" : null,
      include.slat !== "No" ? "SLAT" : null,
      include.grat !== "No" ? "GRAT" : null,
    ].filter(Boolean);

    const coreStrategies = [
      include.crt === "Core" ? "CRT" : null,
      include.qoz === "Core" ? "QOZ" : null,
      include.managed === "Core" ? "Managed Money Allocation" : null,
    ].filter(Boolean);

    const modeledStrategies = [
      include.crt !== "No" ? "CRT" : null,
      include.qoz !== "No" ? "QOZ" : null,
      include.daf !== "No" ? "DAF" : null,
      include.managed !== "No" ? "Managed Money Allocation" : null,
    ].filter(Boolean);

    const nextBestOptionalModeledStrategy = include.crt === "Optional" ? "CRT" : include.daf === "Optional" ? "DAF" : "";

    const normalizeAlloc = (alloc) => {
      const qozCap = input.maxQozExposure || 0;
      const gated = {
        crt: include.crt === "No" ? 0 : alloc.crt,
        qoz: include.qoz === "No" ? 0 : Math.min(alloc.qoz, qozCap > 0 ? qozCap : alloc.qoz),
        daf: include.daf === "No" ? 0 : alloc.daf,
      };
      const total = gated.crt + gated.qoz + gated.daf;
      if (total <= 0.9) return gated;
      const scale = 0.9 / total;
      return {
        crt: gated.crt * scale,
        qoz: gated.qoz * scale,
        daf: gated.daf * scale,
      };
    };

    const coreAlloc = normalizeAlloc({ crt: 0, qoz: qualifies.qoz ? 0.5 : 0, daf: 0 });
    const fixedCoreOptionalAlloc = normalizeAlloc({
      crt:
        include.crt === "No"
          ? 0
          : (input.charitableIntent >= 4 ? 0.3 : input.charitableIntent === 3 ? 0.15 : 0) +
            (input.estateExposure === "Yes" && input.charitableIntent >= 3 ? 0.1 : 0),
      qoz: include.qoz === "No" ? 0 : gain >= 5000000 ? 0.5 : gain >= 1000000 ? 0.4 : 0,
      daf: include.daf === "No" ? 0 : input.charitableIntent >= 4 ? 0.1 : input.charitableIntent === 3 ? 0.05 : 0,
    });

    const runScenario = (alloc) => {
      const crt = gain * alloc.crt;
      const qoz = gain * alloc.qoz;
      const daf = gain * alloc.daf;
      const taxableGain = Math.max(0, gain - crt - qoz - daf);
      const immediateTax = taxableGain * totalTaxRate;
      const netAfterTax = input.grossExitValue - immediateTax;
      const capitalCommitted = crt + qoz + daf;
      const liquidityRemaining = netAfterTax - capitalCommitted;
      const annualCashFlow = crt * input.crtPayoutRate;
      const improvementVsBaseline = netAfterTax - baselineNet;
      const improvementPerDollarCommitted = capitalCommitted > 0 ? improvementVsBaseline / capitalCommitted : 0;
      const liquidityLockup = crt + qoz;
      return {
        crt,
        qoz,
        daf,
        taxableGain,
        immediateTax,
        netAfterTax,
        capitalCommitted,
        liquidityRemaining,
        annualCashFlow,
        improvementVsBaseline,
        improvementPerDollarCommitted,
        liquidityLockup,
      };
    };

    const core = runScenario(coreAlloc);
    const fixedCoreOptional = runScenario(fixedCoreOptionalAlloc);

    const optimizerSeeds = [
      { name: "A", crt: 0, qoz: 0.5, daf: 0 },
      { name: "B", crt: 0.2, qoz: 0.5, daf: 0 },
      { name: "C", crt: 0.3, qoz: 0.5, daf: 0.05 },
      { name: "D", crt: 0.4, qoz: 0.4, daf: 0.05 },
      { name: "E", crt: 0.25, qoz: 0.6, daf: 0.05 },
    ];

    const optimizerRunsBase = optimizerSeeds.map((seed) => {
      const alloc = normalizeAlloc(seed);
      return { name: seed.name, alloc, ...runScenario(alloc) };
    });

    const maxTaxSavings = Math.max(...optimizerRunsBase.map((s) => s.improvementVsBaseline), 1);
    const maxLiquidity = Math.max(...optimizerRunsBase.map((s) => s.liquidityRemaining), 1);
    const maxCashFlow = Math.max(...optimizerRunsBase.map((s) => s.annualCashFlow), 1);

    const optimizerRuns = optimizerRunsBase.map((s) => {
      const liquidityFloorPenalty = input.minLiquidityFloor > 0 && s.liquidityRemaining < input.minLiquidityFloor ? -0.35 : 0;
      return {
        ...s,
        meetsLiquidityFloor: input.minLiquidityFloor === 0 || s.liquidityRemaining >= input.minLiquidityFloor,
        optimizerScore:
          (s.improvementVsBaseline / maxTaxSavings) * 0.5 +
          (s.liquidityRemaining / maxLiquidity) * 0.3 +
          ((maxCashFlow === 0 ? 0 : s.annualCashFlow / maxCashFlow) * 0.2) +
          liquidityFloorPenalty,
      };
    });

    const winningScenario = optimizerRuns.reduce((best, current) =>
      current.optimizerScore > best.optimizerScore ? current : best
    );

    const strategicCore = { estate: include.qoz === "Core" ? 2 : 0, income: 1, philanthropy: 1, total: 4 };
    const strategicCoreOptional = {
      estate: include.crt !== "No" ? 4 : 2,
      income: winningScenario.crt > 0 ? 4 : 1,
      philanthropy: winningScenario.daf > 0 ? 4 : 1,
      total: (include.crt !== "No" ? 4 : 2) + (winningScenario.crt > 0 ? 4 : 1) + (winningScenario.daf > 0 ? 4 : 1),
    };

    const recommendedPath = winningScenario.crt > 0 || winningScenario.daf > 0 ? "Optimized Optional" : "Core Stack";
    const rec = recommendedPath === "Core Stack" ? core : winningScenario;
    const recStrategic = recommendedPath === "Core Stack" ? strategicCore : strategicCoreOptional;

    const why = [
      recommendedPath === "Core Stack"
        ? "Recommended Core Stack because it improves after-tax proceeds while keeping complexity and committed capital more controlled."
        : "Recommended Optimized Optional because the optimizer selected a more efficient structured mix for the client’s goals.",
      `Net after-tax proceeds: ${currency(rec.netAfterTax)} (${currency(rec.improvementVsBaseline)} improvement vs baseline).`,
      `Capital committed: ${currency(rec.capitalCommitted)}; liquidity remaining: ${currency(rec.liquidityRemaining)}.`,
      rec.annualCashFlow > 0 ? `Creates estimated annual cash flow of ${currency(rec.annualCashFlow)} from CRT payout.` : null,
      modeledStrategies.length ? `Modeled strategies included: ${modeledStrategies.join(", ")}.` : null,
      recommendedPath === "Optimized Optional"
        ? `Winning optimizer scenario: ${winningScenario.name} (CRT ${percent(winningScenario.alloc.crt)}, QOZ ${percent(winningScenario.alloc.qoz)}, DAF ${percent(winningScenario.alloc.daf)}).`
        : null,
      overlayModules.length ? `Overlay modules to evaluate next: ${overlayModules.join(", ")}.` : null,
      input.minLiquidityFloor > 0
        ? `Liquidity floor applied: ${currency(input.minLiquidityFloor)}${rec.liquidityRemaining < input.minLiquidityFloor ? " (recommended scenario is below floor)" : ""}.`
        : null,
    ].filter(Boolean);

    return {
      gain,
      totalTaxRate,
      baselineTax,
      baselineNet,
      include,
      coreStrategies,
      modeledStrategies,
      overlayModules,
      nextBestOptionalModeledStrategy,
      core,
      fixedCoreOptional,
      winningScenario,
      optimizerRuns,
      strategicCore,
      strategicCoreOptional,
      recommendedPath,
      rec,
      recStrategic,
      why,
      alloc: { core: coreAlloc, coreOptional: winningScenario.alloc },
    };
  }, [input]);

  const scenarioRows = [
    {
      label: "Net After-Tax Proceeds",
      baseline: data.baselineNet,
      core: data.core.netAfterTax,
      opt: data.winningScenario.netAfterTax,
      fmt: currency,
    },
    {
      label: "Improvement vs Baseline",
      baseline: 0,
      core: data.core.improvementVsBaseline,
      opt: data.winningScenario.improvementVsBaseline,
      fmt: currency,
    },
    {
      label: "Total Economic Commitment",
      baseline: 0,
      core: data.core.capitalCommitted,
      opt: data.winningScenario.capitalCommitted,
      fmt: currency,
    },
    {
      label: "Improvement per $1 Committed",
      baseline: 0,
      core: data.core.improvementPerDollarCommitted,
      opt: data.winningScenario.improvementPerDollarCommitted,
      fmt: (n) => n.toFixed(2),
    },
    {
      label: "Annual Cash Flow Impact",
      baseline: 0,
      core: data.core.annualCashFlow,
      opt: data.winningScenario.annualCashFlow,
      fmt: currency,
    },
    {
      label: "Liquidity Lock-Up",
      baseline: 0,
      core: data.core.liquidityLockup,
      opt: data.winningScenario.liquidityLockup,
      fmt: currency,
    },
    {
      label: "Strategic Score (sum)",
      baseline: 0,
      core: data.strategicCore.total,
      opt: data.strategicCoreOptional.total,
      fmt: (n) => n,
    },
    {
      label: "Liquidity Remaining",
      baseline: data.baselineNet,
      core: data.core.liquidityRemaining,
      opt: data.winningScenario.liquidityRemaining,
      fmt: currency,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Exit Planning App Prototype</h1>
              <p className="mt-2 text-sm text-slate-600">Internal front-end prototype for the Veritas exit planning engine.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-100 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Recommended Path</div>
                <div className="mt-2 text-xl font-semibold text-slate-900">{data.recommendedPath}</div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Baseline Net Deployable</div>
                <div className="mt-2 text-xl font-semibold text-slate-900">{currency(data.baselineNet)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Inputs</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Age"><Select value={input.age} onChange={(v) => set("age", Number(v))} options={Array.from({ length: 53 }, (_, i) => 28 + i)} /></Field>
              <Field label="Net Liquidity After Tax"><InputNumber value={input.netLiquidityAfterTax} onChange={(v) => set("netLiquidityAfterTax", v)} placeholder="Enter amount" /></Field>
              <Field label="Estate Exposure"><Select value={input.estateExposure} onChange={(v) => set("estateExposure", v)} options={["Yes", "No"]} /></Field>
              <Field label="Health Rating"><Select value={input.healthRating} onChange={(v) => set("healthRating", v)} options={["Ultra", "Select NT", "NT", "Select T", "Tobacco"]} /></Field>
              <Field label="Married"><Select value={input.married} onChange={(v) => set("married", v)} options={["Yes", "No"]} /></Field>
              <Field label="Charitable Intent (1-5)"><Select value={input.charitableIntent} onChange={(v) => set("charitableIntent", Number(v))} options={[1, 2, 3, 4, 5]} /></Field>
              <Field label="Desire for Leverage (1-5)"><Select value={input.desireForLeverage} onChange={(v) => set("desireForLeverage", Number(v))} options={[1, 2, 3, 4, 5]} /></Field>
              <Field label="Max QOZ Exposure"><Select value={input.maxQozExposure} onChange={(v) => set("maxQozExposure", Number(v))} options={qozExposureOptions} /></Field>
              <Field label="Minimum Liquidity Floor"><Select value={input.minLiquidityFloor} onChange={(v) => set("minLiquidityFloor", Number(v))} options={liquidityFloorOptions} /></Field>
              <Field label="Sale of Highly Appreciated Asset?"><Select value={input.appreciatedSale} onChange={(v) => set("appreciatedSale", v)} options={["Yes", "No"]} /></Field>
              <Field label="Long-Term Capital Gain?"><Select value={input.ltcgExists} onChange={(v) => set("ltcgExists", v)} options={["Yes", "No"]} /></Field>
              <Field label="Primary Objective"><Select value={input.primaryObjective} onChange={(v) => set("primaryObjective", v)} options={["Tax Deferral", "Income Creation", "Estate Planning"]} /></Field>
              <Field label="Gross Exit Value"><InputNumber value={input.grossExitValue} onChange={(v) => set("grossExitValue", v)} placeholder="Enter amount" /></Field>
              <Field label="Cost Basis"><InputNumber value={input.costBasis} onChange={(v) => set("costBasis", v)} placeholder="Enter amount" /></Field>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Recommendation</h2>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-slate-100 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Recommended Path</div>
                <div className="mt-1 text-2xl font-semibold">{data.recommendedPath}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-medium text-slate-700">Why</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-700 list-disc pl-5">
                  {data.why.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-700">Core Strategies to Model</div>
                  <div className="mt-2 text-sm text-slate-900">{data.coreStrategies.join(", ") || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-700">Modeled Strategies to Run</div>
                  <div className="mt-2 text-sm text-slate-900">{data.modeledStrategies.join(", ") || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-700">Next Best Optional Modeled Strategy</div>
                  <div className="mt-2 text-sm text-slate-900">{data.nextBestOptionalModeledStrategy || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-700">Overlay Modules</div>
                  <div className="mt-2 text-sm text-slate-900">{data.overlayModules.join(", ") || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Output Card</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-3 pr-4 font-medium">Metric</th>
                  <th className="py-3 pr-4 font-medium">Baseline</th>
                  <th className="py-3 pr-4 font-medium">Core Stack</th>
                  <th className="py-3 pr-4 font-medium">Optimized Optional</th>
                </tr>
              </thead>
              <tbody>
                {scenarioRows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium text-slate-800">{row.label}</td>
                    <td className="py-3 pr-4 text-slate-700">{row.fmt(row.baseline)}</td>
                    <td className="py-3 pr-4 text-slate-700">{row.fmt(row.core)}</td>
                    <td className="py-3 pr-4 text-slate-700">{row.fmt(row.opt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Allocation Presets</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-medium text-slate-700">Core Stack</div>
                <div className="mt-2 text-sm text-slate-900">CRT {percent(data.alloc.core.crt)}, QOZ {percent(data.alloc.core.qoz)}, DAF {percent(data.alloc.core.daf)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-medium text-slate-700">Optimized Optional Winner ({data.winningScenario.name})</div>
                <div className="mt-2 text-sm text-slate-900">CRT {percent(data.alloc.coreOptional.crt)}, QOZ {percent(data.alloc.coreOptional.qoz)}, DAF {percent(data.alloc.coreOptional.daf)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">App Output</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-slate-600">Recommended Path</span><span className="font-medium text-slate-900">{data.recommendedPath}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-600">Net After-Tax Proceeds (Baseline)</span><span className="font-medium text-slate-900">{currency(data.baselineNet)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-600">Net After-Tax Proceeds (Recommended)</span><span className="font-medium text-slate-900">{currency(data.rec.netAfterTax)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-600">Capital Committed (Recommended)</span><span className="font-medium text-slate-900">{currency(data.rec.capitalCommitted)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-600">Liquidity Remaining (Recommended)</span><span className="font-medium text-slate-900">{currency(data.rec.liquidityRemaining)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-600">Strategic Score (Recommended)</span><span className="font-medium text-slate-900">{data.recStrategic.total}</span></div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Optimizer Scenarios</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-3 pr-4 font-medium">Scenario</th>
                  <th className="py-3 pr-4 font-medium">Allocation Mix</th>
                  <th className="py-3 pr-4 font-medium">Net After-Tax</th>
                  <th className="py-3 pr-4 font-medium">Committed</th>
                  <th className="py-3 pr-4 font-medium">Liquidity</th>
                  <th className="py-3 pr-4 font-medium">Cash Flow</th>
                  <th className="py-3 pr-4 font-medium">Floor</th>
                  <th className="py-3 pr-4 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.optimizerRuns.map((s) => (
                  <tr key={s.name} className={`border-b border-slate-100 ${s.name === data.winningScenario.name ? "bg-slate-50" : ""}`}>
                    <td className="py-3 pr-4 font-medium text-slate-800">{s.name}{s.name === data.winningScenario.name ? " (Winner)" : ""}</td>
                    <td className="py-3 pr-4 text-slate-700">CRT {percent(s.alloc.crt)}, QOZ {percent(s.alloc.qoz)}, DAF {percent(s.alloc.daf)}</td>
                    <td className="py-3 pr-4 text-slate-700">{currency(s.netAfterTax)}</td>
                    <td className="py-3 pr-4 text-slate-700">{currency(s.capitalCommitted)}</td>
                    <td className="py-3 pr-4 text-slate-700">{currency(s.liquidityRemaining)}</td>
                    <td className="py-3 pr-4 text-slate-700">{currency(s.annualCashFlow)}</td>
                    <td className="py-3 pr-4 text-slate-700">{s.meetsLiquidityFloor ? "Pass" : "Below Floor"}</td>
                    <td className="py-3 pr-4 text-slate-700">{s.optimizerScore.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
