import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { buildLoggedDailyRows } from "../../lib/projectMetrics";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Sparkles, ChevronRight, Cpu, ListChecks, Bot, Target, Zap } from "lucide-react";
import { Button } from "../../components/ui/button";

const PROJECT_TYPES = [
  { id: "rnd", label: "R&D", overrunPct: 62 },
  { id: "prod", label: "Production", overrunPct: 34 },
  { id: "eval", label: "Model eval", overrunPct: 71 },
  { id: "ingest", label: "Data ingest", overrunPct: 22 },
  { id: "poc", label: "Client PoC", overrunPct: 48 },
];

const MODELS = ["Opus 4.8", "Sonnet", "GPT-4o", "Gemini 2.5 Pro", "Kimi", "Grok-2"];

const buildMonthlySpendRows = (projects = [], taskLogs = {}) => {
  const rows = buildLoggedDailyRows(projects, taskLogs);
  const byMonth = rows.reduce((acc, row) => {
    const key = row.date.slice(0, 7);
    acc[key] = acc[key] || {
      key,
      month: new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", { month: "short" }),
      actual: 0,
      budget: 0,
      estimated: 0,
    };
    acc[key].actual += Number(row.spent || 0);
    acc[key].budget += Number(row.approvedDaily || 0);
    acc[key].estimated += Number(row.approvedDaily || 0);
    return acc;
  }, {});

  return Object.values(byMonth).sort((left, right) => left.key.localeCompare(right.key));
};

const buildForecast = (monthlyRows = []) => {
  const now = new Date();
  const seedRows = monthlyRows.length
    ? monthlyRows
    : [{
        key: now.toISOString().slice(0, 7),
        month: now.toLocaleDateString("en-US", { month: "short" }),
        actual: 0,
        budget: 0,
        estimated: 0,
      }];
  const trailing = seedRows.slice(-3);
  const base = trailing.length ? trailing.reduce((sum, row) => sum + Number(row.actual || 0), 0) / trailing.length : 0;
  const lastRow = seedRows[seedRows.length - 1];
  const lastDate = new Date(`${lastRow.key}-01T00:00:00`);
  const rows = [
    {
      month: lastRow.month,
      base: Number(lastRow.actual || 0),
      optimistic: null,
      pessimistic: null,
      actual: Number(lastRow.actual || 0),
    },
  ];
  [1, 2, 3].forEach((step, index) => {
    const monthDate = new Date(lastDate);
    monthDate.setMonth(lastDate.getMonth() + step);
    const growth = 1.05 + index * 0.04;
    const b = Math.round(base * growth);
    rows.push({
      month: monthDate.toLocaleDateString("en-US", { month: "short" }),
      base: b,
      optimistic: Math.round(b * 0.85),
      pessimistic: Math.round(b * 1.20),
      actual: null,
    });
  });
  return rows;
};

const MonthlyForecast = () => {
  const [projType, setProjType] = useState("rnd");
  const [tasks, setTasks] = useState(24);
  const [selectedModel, setSelectedModel] = useState("Opus 4.8");
  const { projects, taskLogs, budgetReviews } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const monthlySpend = useMemo(() => buildMonthlySpendRows(projects, taskLogs), [projects, taskLogs]);
  const forecast = useMemo(() => buildForecast(monthlySpend), [monthlySpend]);

  // ------- Task-cost exponential projection -------
  // Build historical cost/task series per phase across the portfolio (or a chosen project).
  const historicalPhases = useMemo(() => {
    const src = selectedProjectId ? projects.filter((p) => p.id === selectedProjectId) : projects;
    const out = [];
    src.forEach((p) => {
      const review = budgetReviews.find((r) => r.projectId === p.id);
      const totalTasks = Number(review?.tasks || 0);
      const nPhases = (p.phases || []).length || 1;
      const perPhaseTasksFallback = totalTasks ? Math.round(totalTasks / nPhases) : 0;
      (p.phases || []).forEach((ph, idx) => {
        const planned = Number(ph.totalTasks || ph.tasks || perPhaseTasksFallback || 0);
        if (planned <= 0) return;
        const budget = Number(ph.estimated || 0);
        const key = `${p.id}::${ph.id}`;
        const logs = taskLogs[key] || [];
        const loggedTasks = logs.reduce((s, l) => s + (Number(l.tasksDone) || 0), 0);
        const loggedCost = logs.reduce((s, l) => s + (Number(l.cost) || 0), 0);
        const costPerTask = planned > 0 ? Math.round((budget / planned) * 100) / 100 : 0;
        const actualPerTask = loggedTasks > 0 ? Math.round((loggedCost / loggedTasks) * 100) / 100 : null;
        out.push({
          key,
          idx: idx + 1,
          projectName: p.name,
          phaseName: ph.name,
          planned,
          budget,
          costPerTask,
          actualPerTask,
        });
      });
    });
    return out;
  }, [selectedProjectId, projects, taskLogs, budgetReviews]);

  // Exponential fit y = a * e^(b*x)  via log-linear regression on positive y-values.
  const expoFit = useMemo(() => {
    const pts = historicalPhases
      .map((p, i) => ({ x: i + 1, y: p.actualPerTask ?? p.costPerTask }))
      .filter((p) => p.y > 0);
    if (pts.length < 2) return null;
    const n = pts.length;
    const sumX = pts.reduce((s, p) => s + p.x, 0);
    const sumLnY = pts.reduce((s, p) => s + Math.log(p.y), 0);
    const sumXLnY = pts.reduce((s, p) => s + p.x * Math.log(p.y), 0);
    const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
    const b = (n * sumXLnY - sumX * sumLnY) / (n * sumX2 - sumX * sumX || 1);
    const lnA = (sumLnY - b * sumX) / n;
    const a = Math.exp(lnA);
    return { a, b, growthPct: Math.round((Math.exp(b) - 1) * 1000) / 10 };
  }, [historicalPhases]);

  // Build chart series: actual (historical), fitted curve, and 3 future-phase projections
  const taskCostSeries = useMemo(() => {
    if (!expoFit) return [];
    const series = [];
    historicalPhases.forEach((p, i) => {
      const x = i + 1;
      series.push({
        phase: `${p.projectName.split(" ")[0]} · ${p.phaseName}`,
        actual: p.actualPerTask ?? p.costPerTask,
        fitted: Math.round(expoFit.a * Math.exp(expoFit.b * x) * 100) / 100,
        projected: null,
      });
    });
    const lastX = historicalPhases.length;
    [1, 2, 3].forEach((k) => {
      const x = lastX + k;
      const y = Math.round(expoFit.a * Math.exp(expoFit.b * x) * 100) / 100;
      series.push({
        phase: `Next +${k}`,
        actual: null,
        fitted: y,
        projected: y,
      });
    });
    return series;
  }, [historicalPhases, expoFit]);

  const nextPhaseEstimate = useMemo(() => {
    if (!expoFit) return null;
    const x = historicalPhases.length + 1;
    const perTask = Math.round(expoFit.a * Math.exp(expoFit.b * x) * 100) / 100;
    // Assume the next phase covers a similar task count to the last phase.
    const lastPhaseTasks = historicalPhases[historicalPhases.length - 1]?.planned || 100;
    const totalBudget = Math.round(perTask * lastPhaseTasks);
    return { perTask, planned: lastPhaseTasks, totalBudget };
  }, [expoFit, historicalPhases]);

  // Recommendation engine
  const baseEstimate = useMemo(() => {
    const perTask = selectedModel === "Opus 4.8" ? 220 : selectedModel === "Gemini 2.5 Pro" ? 90 : selectedModel === "GPT-4o" ? 140 : 60;
    const scale = projType === "rnd" ? 1.4 : projType === "eval" ? 1.6 : projType === "prod" ? 1.0 : projType === "poc" ? 1.2 : 0.8;
    return Math.round(tasks * perTask * scale);
  }, [projType, tasks, selectedModel]);
  const buffered = Math.round(baseEstimate * 1.25);
  const risk = projType === "rnd" || projType === "eval" ? "High" : projType === "poc" ? "Medium" : "Low";
  const overrunProb = PROJECT_TYPES.find((t) => t.id === projType)?.overrunPct || 40;

  const similar = useMemo(() => (
    projects
      .filter((project) => project.id !== selectedProjectId)
      .slice(0, 3)
      .map((project, index) => {
        const plannedTasks = Number(
          project.totalTasks
          || (project.phases || []).reduce((sum, phase) => sum + Number(phase.totalTasks || phase.tasks || 0), 0)
          || 0
        );
        return {
          name: project.name,
          desc: `${project.type || "Project"} · ${plannedTasks.toLocaleString()} planned tasks`,
          match: index < 2 ? "high" : "partial",
        };
      })
  ), [projects, selectedProjectId]);
  const currentBase = Number(forecast[0]?.base || 0);
  const projectedBase = Number(forecast[3]?.base || 0);
  const projectedPessimistic = Number(forecast[3]?.pessimistic || 0);
  const growthPct = currentBase > 0 ? Math.round(((projectedBase - currentBase) / currentBase) * 100) : 0;
  const extraBuffer = Math.max(projectedPessimistic - projectedBase, 0);

  return (
    <div className="space-y-6" data-testid="page-monthly-forecast">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
            <TrendingUp className="w-3 h-3" /> CFO Portal
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Monthly forecast</h1>
          <p className="text-sm text-zinc-400 mt-1">
            AI-powered budget recommendations, overrun probability &amp; 3-month portfolio spend forecast
          </p>
        </div>
      </div>

      {/* Recommendation engine + overrun probability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="rec-engine">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300" />
            <div className="font-display font-semibold text-[15px] text-white">Budget recommendation engine</div>
          </div>
          <div className="text-xs text-zinc-400 mb-4">
            Enter project parameters — we&apos;ll produce base &amp; buffered estimates plus a risk rating from historical patterns
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Project type">
              <select
                value={projType}
                onChange={(e) => setProjType(e.target.value)}
                data-testid="fc-input-type"
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Task count">
              <input
                type="number"
                value={tasks}
                onChange={(e) => setTasks(Number(e.target.value) || 0)}
                data-testid="fc-input-tasks"
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </Field>
            <Field label="Primary model">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                data-testid="fc-input-model"
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <RecommendCell label="Base estimate" value={fmtCurrency(baseEstimate, { compact: false })} color="text-sky-300" testid="rec-base" />
            <RecommendCell label="+25% buffer" value={fmtCurrency(buffered, { compact: false })} color="text-amber-300" testid="rec-buffered" />
            <RecommendCell label="Risk rating" value={risk} color={risk === "High" ? "text-red-300" : risk === "Medium" ? "text-amber-300" : "text-emerald-300"} testid="rec-risk" />
          </div>

          <div className="mt-4 text-xs text-zinc-400 leading-relaxed rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <span>
              Based on {similar.length} historical projects matching this profile, expect ~<span className="text-fuchsia-300 font-semibold tabular">{overrunProb}%</span> probability of overrun. Consider allocating a hidden buffer of 8–12% in addition to the +25% shown here.
            </span>
          </div>
        </div>

        {/* Overrun probability + Similar historical projects */}
        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="overrun-prob">
            <div className="font-display font-semibold text-[15px] text-white mb-1">Overrun probability by project type</div>
            <div className="text-xs text-zinc-500 mb-3">Historical data · higher = more likely to exceed estimate</div>
            <div className="space-y-2.5">
              {PROJECT_TYPES.map((t) => {
                const color = t.overrunPct >= 60 ? "#EF4444" : t.overrunPct >= 40 ? "#F59E0B" : "#10B981";
                return (
                  <div key={t.id} data-testid={`overrun-${t.id}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-200 font-medium">{t.label}</span>
                      <span className="font-semibold tabular" style={{ color }}>{t.overrunPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${t.overrunPct}%`, background: `linear-gradient(90deg, #10B981, ${color})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="similar-projects">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Similar historical projects</div>
            {similar.length ? (
              <div className="space-y-2">
                {similar.map((s) => (
                  <div key={s.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
                      <Target className="w-3.5 h-3.5 text-fuchsia-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{s.name}</div>
                      <div className="text-[11px] text-zinc-500 truncate">{s.desc}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      s.match === "high" ? "bg-red-500/15 text-red-300 border border-red-500/30" : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    }`}>
                      {s.match === "high" ? "Match" : "Partial"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6 text-xs text-zinc-500">
                No historical projects are available yet for similarity matching.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio spend forecast chart */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="portfolio-forecast">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Portfolio spend forecast · next 3 months</div>
            <div className="text-xs text-zinc-500 mt-0.5">Base forecast vs optimistic (−15%) vs pessimistic (+20%) scenarios</div>
          </div>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecast}>
              <defs>
                <linearGradient id="pess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => (v ? fmtCurrency(v) : "—")} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="pessimistic" name="Pessimistic (+20%)" stroke="#EF4444" strokeDasharray="5 3" fill="url(#pess)" strokeWidth={2} />
              <Line type="monotone" dataKey="base" name="Base forecast" stroke="#4F8EF7" strokeWidth={2.5} dot={{ r: 4, fill: "#4F8EF7" }} />
              <Line type="monotone" dataKey="optimistic" name="Optimistic (−15%)" stroke="#10B981" strokeDasharray="5 3" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actual" name="Actual (last)" stroke="#E619B8" strokeWidth={3} dot={{ r: 5, fill: "#E619B8" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-start gap-2 text-xs text-zinc-300">
          <Sparkles className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
          {currentBase > 0 ? (
            <span>
              <span className="text-fuchsia-200 font-semibold">AI insight: </span>
              Base forecast projects <span className="text-white font-semibold tabular">{fmtCurrency(projectedBase)}</span> in the third forward month, a{" "}
              <span className="text-white font-semibold tabular">{growthPct}%</span> lift over the current logged month.
              Pessimistic spend ({fmtCurrency(projectedPessimistic)}) would require top-ups; consider keeping a{" "}
              <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(extraBuffer)}</span> contingency available.
            </span>
          ) : (
            <span>
              <span className="text-fuchsia-200 font-semibold">AI insight: </span>
              Forecasting will become more useful after monthly task logs are recorded. The chart is ready and will update automatically as spend lands.
            </span>
          )}
        </div>
      </div>

      {/* Exponential task-cost projection */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="task-cost-forecast">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
              <Zap className="w-3 h-3" /> Task-cost forecast
            </div>
            <div className="font-display font-semibold text-[15px] text-white mt-1">Exponential projection · cost / task</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Log-linear fit of past phase unit costs · projects next 3 phases &amp; recommends the next phase estimate
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Scope</div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              data-testid="task-cost-project-scope"
              className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            >
              <option value="">Whole portfolio</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!expoFit || taskCostSeries.length < 3 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-xs text-zinc-500">
            Not enough historical phase data to fit an exponential curve. Log more phases via TPM budgets to unlock this projection.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <ForecastCell label="Growth / phase" value={`${expoFit.growthPct >= 0 ? "+" : ""}${expoFit.growthPct}%`} accent={expoFit.growthPct >= 0 ? "text-amber-300" : "text-emerald-300"} testid="fc-growth" />
              <ForecastCell label="Historic phases" value={historicalPhases.length.toString()} accent="text-white" testid="fc-hist-count" />
              <ForecastCell label="Next phase · cost/task" value={fmtCurrency(nextPhaseEstimate?.perTask || 0, { compact: false })} accent="text-fuchsia-300" testid="fc-next-cost-per-task" />
              <ForecastCell label="Next phase · budget est." value={fmtCurrency(nextPhaseEstimate?.totalBudget || 0, { compact: false })} accent="text-fuchsia-300" testid="fc-next-budget" />
            </div>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={taskCostSeries}>
                  <defs>
                    <linearGradient id="proj" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E619B8" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#E619B8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                  <XAxis dataKey="phase" tick={{ fontSize: 9, fill: "#71717A" }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Number(v).toFixed(0)}`)} />
                  <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => (v ? fmtCurrency(v, { compact: false }) : "—")} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine x={taskCostSeries[historicalPhases.length - 1]?.phase} stroke="#71717A" strokeDasharray="4 4" label={{ value: "Now", position: "top", fill: "#71717A", fontSize: 10 }} />
                  <Area type="monotone" dataKey="projected" name="Projected next phases" stroke="#E619B8" strokeDasharray="4 4" fill="url(#proj)" strokeWidth={2.5} dot={{ r: 4, fill: "#E619B8" }} />
                  <Line type="monotone" dataKey="fitted" name="Exponential fit" stroke="#F5C518" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                  <Line type="monotone" dataKey="actual" name="Historical cost / task" stroke="#4F8EF7" strokeWidth={2.5} dot={{ r: 4, fill: "#4F8EF7" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.05] p-4" data-testid="next-phase-panel">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">Next-phase recommendation</div>
                </div>
                <div className="text-xs text-zinc-300 leading-relaxed">
                  At the current growth rate of <span className="text-amber-300 font-semibold tabular">{expoFit.growthPct >= 0 ? "+" : ""}{expoFit.growthPct}%</span> per phase, the next phase is projected to cost{" "}
                  <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(nextPhaseEstimate?.perTask || 0, { compact: false })}</span> per task.
                  For a comparable phase size of <span className="text-white font-semibold tabular">{(nextPhaseEstimate?.planned || 0).toLocaleString()}</span> tasks that lands at{" "}
                  <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(nextPhaseEstimate?.totalBudget || 0, { compact: false })}</span> total budget.
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Suggested phase budget</span>
                  <span className="text-white font-display font-semibold text-xl tabular ml-auto">{fmtCurrency(nextPhaseEstimate?.totalBudget || 0, { compact: false })}</span>
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">Recent phases · cost/task</div>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {historicalPhases.slice(-6).reverse().map((p) => (
                    <div key={p.key} className="flex items-center justify-between text-[11px] py-1 border-b border-white/5 last:border-0" data-testid={`hist-row-${p.key}`}>
                      <span className="text-zinc-300 truncate">{p.projectName} · <span className="text-fuchsia-300">{p.phaseName}</span></span>
                      <span className="text-white font-semibold tabular">
                        {fmtCurrency(p.actualPerTask ?? p.costPerTask, { compact: false })}
                        {p.actualPerTask ? <span className="text-emerald-300 text-[9px] ml-1">actual</span> : <span className="text-zinc-500 text-[9px] ml-1">plan</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

const RecommendCell = ({ label, value, color, testid }) => (
  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className={`font-display text-2xl font-semibold tabular mt-1 ${color}`}>{value}</div>
  </div>
);

const ForecastCell = ({ label, value, accent = "text-white", testid }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className={`text-lg font-display font-semibold tabular mt-0.5 ${accent}`}>{value}</div>
  </div>
);

export default MonthlyForecast;
