import { useEffect, useMemo, useState } from "react";
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
  { id: "projects", label: "Projects" },
  { id: "rl", label: "RL Environment" },
  { id: "tooling", label: "Tooling" },
];

const getProjectTypeId = (project = {}) => {
  const value = `${project.type || ""} ${project.teamType || ""}`.toLowerCase();
  if (value.includes("tool")) return "tooling";
  if (value.includes("r&d") || value.includes("rnd") || value.includes("rl env")) return "rl";
  return "projects";
};

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
  const changes = seedRows.slice(1).map((row, index) => {
    const previous = Number(seedRows[index].actual || 0);
    return previous > 0 ? (Number(row.actual || 0) - previous) / previous : 0;
  }).filter(Number.isFinite);
  const observedGrowth = changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : 0;
  const observedVolatility = changes.length
    ? Math.sqrt(changes.reduce((sum, value) => sum + ((value - observedGrowth) ** 2), 0) / changes.length)
    : 0;
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
  let prior = Number(lastRow.actual || 0);
  [1, 2, 3].forEach((step) => {
    const monthDate = new Date(lastDate);
    monthDate.setMonth(lastDate.getMonth() + step);
    const b = Math.max(0, Math.round(prior * (1 + observedGrowth)));
    prior = b;
    rows.push({
      month: monthDate.toLocaleDateString("en-US", { month: "short" }),
      base: b,
      optimistic: Math.round(Math.max(0, b * (1 - observedVolatility))),
      pessimistic: Math.round(b * (1 + observedVolatility)),
      actual: null,
    });
  });
  return rows;
};

const MonthlyForecast = () => {
  const [projType, setProjType] = useState("projects");
  const [tasks, setTasks] = useState(24);
  const [selectedModel, setSelectedModel] = useState("all");
  const [nextPhaseTasks, setNextPhaseTasks] = useState(0);
  const [nextTrajectoriesPerTask, setNextTrajectoriesPerTask] = useState(0);
  const { projects, taskLogs, budgetReviews } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const categoryProjects = useMemo(
    () => projects.filter((project) => getProjectTypeId(project) === projType),
    [projects, projType]
  );
  useEffect(() => {
    setSelectedProjectId("");
    setSelectedModel("all");
  }, [projType]);
  const monthlySpend = useMemo(() => buildMonthlySpendRows(categoryProjects, taskLogs), [categoryProjects, taskLogs]);
  const forecast = useMemo(() => buildForecast(monthlySpend), [monthlySpend]);

  // ------- Task-cost exponential projection -------
  // Build historical cost/task series per phase across the portfolio (or a chosen project).
  const historicalPhases = useMemo(() => {
    const src = selectedProjectId ? categoryProjects.filter((p) => p.id === selectedProjectId) : categoryProjects;
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
        const loggedTrajectories = logs.reduce((s, l) => s + (Number(l.trajectories) || 0), 0);
        const loggedCost = logs.reduce((sum, log) => {
          const modelCost = Array.isArray(log.modelUsage)
            ? log.modelUsage.reduce((modelSum, usage) => modelSum + Number(usage.cost || 0), 0)
            : 0;
          return sum + Number(log.cost || modelCost || 0);
        }, 0);
        const expectedTrajectoriesPerTask = Number(
          ph.trajectoriesPerTask
          || ph.trajectories
          || (review?.totalTrajectories && totalTasks ? Number(review.totalTrajectories) / totalTasks : 0)
          || 0
        );
        const costPerTask = planned > 0 ? Math.round((budget / planned) * 100) / 100 : 0;
        const actualPerTask = loggedTasks > 0 ? Math.round((loggedCost / loggedTasks) * 100) / 100 : null;
        const plannedCostPerTrajectory = planned > 0 && expectedTrajectoriesPerTask > 0
          ? budget / (planned * expectedTrajectoriesPerTask)
          : 0;
        const actualCostPerTrajectory = loggedTrajectories > 0 ? loggedCost / loggedTrajectories : null;
        out.push({
          key,
          idx: idx + 1,
          projectName: p.name,
          phaseName: ph.name,
          planned,
          budget,
          costPerTask,
          actualPerTask,
          expectedTrajectoriesPerTask,
          plannedCostPerTrajectory,
          actualCostPerTrajectory,
        });
      });
    });
    return out;
  }, [selectedProjectId, categoryProjects, taskLogs, budgetReviews]);

  // Exponential fit y = a * e^(b*x), fitted to recent cost per trajectory.
  const expoFit = useMemo(() => {
    const pts = historicalPhases
      .map((p, i) => ({ x: i + 1, y: p.actualCostPerTrajectory ?? p.plannedCostPerTrajectory }))
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
      const fittedCostPerTrajectory = expoFit.a * Math.exp(expoFit.b * x);
      series.push({
        phase: `${p.projectName.split(" ")[0]} · ${p.phaseName}`,
        actual: p.actualPerTask ?? p.costPerTask,
        fitted: Math.round(fittedCostPerTrajectory * p.expectedTrajectoriesPerTask * 100) / 100,
        projected: null,
      });
    });
    const lastX = historicalPhases.length;
    [1, 2, 3].forEach((k) => {
      const x = lastX + k;
      const expectedTrajectories = nextTrajectoriesPerTask || historicalPhases[historicalPhases.length - 1]?.expectedTrajectoriesPerTask || 0;
      const y = Math.round(expoFit.a * Math.exp(expoFit.b * x) * expectedTrajectories * 100) / 100;
      series.push({
        phase: `Next +${k}`,
        actual: null,
        fitted: y,
        projected: y,
      });
    });
    return series;
  }, [historicalPhases, expoFit, nextTrajectoriesPerTask]);

  const nextPhaseEstimate = useMemo(() => {
    if (!expoFit) return null;
    const x = historicalPhases.length + 1;
    const costPerTrajectory = Math.round(expoFit.a * Math.exp(expoFit.b * x) * 100) / 100;
    const perTask = costPerTrajectory * nextTrajectoriesPerTask;
    const totalBudget = nextPhaseTasks > 0 && nextTrajectoriesPerTask > 0
      ? Math.round(nextPhaseTasks * nextTrajectoriesPerTask * costPerTrajectory)
      : null;
    return { costPerTrajectory, perTask, planned: nextPhaseTasks, trajectoriesPerTask: nextTrajectoriesPerTask, totalBudget };
  }, [expoFit, historicalPhases, nextPhaseTasks, nextTrajectoriesPerTask]);

  // Recommendation inputs and risk are derived only from saved projects and task logs.
  const modelObservations = useMemo(() => {
    const map = new Map();
    const categoryProjectIds = new Set(categoryProjects.map((project) => project.id));
    Object.entries(taskLogs || {})
      .filter(([key]) => categoryProjectIds.has(String(key).split("::")[0]))
      .flatMap(([, logs]) => logs || [])
      .forEach((log) => {
      const usages = Array.isArray(log.modelUsage) && log.modelUsage.length ? log.modelUsage : [];
      usages.forEach((usage) => {
        const name = usage.modelName || usage.modelId;
        if (!name) return;
        const current = map.get(name) || { name, cost: 0, tasks: 0 };
        current.cost += Number(usage.cost || 0);
        current.tasks += Number(usage.tasksDone || 0);
        map.set(name, current);
      });
    });
    return Array.from(map.values()).filter((entry) => entry.cost > 0 && entry.tasks > 0);
  }, [categoryProjects, taskLogs]);
  const projectTypeStats = useMemo(() => PROJECT_TYPES.map((type) => {
    const matching = projects.filter((project) => getProjectTypeId(project) === type.id);
    const overrunCount = matching.filter((project) => Number(project.actualSpend || project.cfoActualSpend || 0) > Number(project.approvedBudget || 0)).length;
    return {
      ...type,
      count: matching.length,
      overrunPct: matching.length ? Math.round((overrunCount / matching.length) * 100) : 0,
      bufferPct: matching.length ? matching.reduce((sum, project) => sum + Number(project.buffer || 0), 0) / matching.length : 0,
    };
  }), [projects]);
  const selectedObservation = selectedModel === "all" ? null : modelObservations.find((entry) => entry.name === selectedModel);
  const allObservedCost = modelObservations.reduce((sum, entry) => sum + entry.cost, 0);
  const allObservedTasks = modelObservations.reduce((sum, entry) => sum + entry.tasks, 0);
  const observedPerTask = selectedObservation
    ? selectedObservation.cost / selectedObservation.tasks
    : allObservedTasks > 0 ? allObservedCost / allObservedTasks : 0;
  const baseEstimate = Math.round(tasks * observedPerTask);
  const selectedTypeStats = projectTypeStats.find((type) => type.id === projType);
  const configuredBufferPct = Math.round(selectedTypeStats?.bufferPct || 0);
  const buffered = Math.round(baseEstimate * (1 + configuredBufferPct / 100));
  const overrunProb = selectedTypeStats?.overrunPct || 0;
  const risk = overrunProb >= 50 ? "High" : overrunProb > 0 ? "Medium" : "Low";

  const similar = useMemo(() => (
    projects
      .filter((project) => project.id !== selectedProjectId && getProjectTypeId(project) === projType)
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
          match: "high",
        };
      })
  ), [projects, projType, selectedProjectId]);
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
                <option value="all">All logged models</option>
                {modelObservations.map((model) => (
                  <option key={model.name} value={model.name}>{model.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <RecommendCell label="Base estimate" value={fmtCurrency(baseEstimate, { compact: false })} color="text-sky-300" testid="rec-base" />
            <RecommendCell label={`+${configuredBufferPct}% observed buffer`} value={fmtCurrency(buffered, { compact: false })} color="text-amber-300" testid="rec-buffered" />
            <RecommendCell label="Risk rating" value={risk} color={risk === "High" ? "text-red-300" : risk === "Medium" ? "text-amber-300" : "text-emerald-300"} testid="rec-risk" />
          </div>

          <div className="mt-4 text-xs text-zinc-400 leading-relaxed rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <span>
              Based on {selectedTypeStats?.count || 0} current projects in this category, <span className="text-fuchsia-300 font-semibold tabular">{overrunProb}%</span> are over approved budget. The displayed buffer is the observed average configured on those projects.
            </span>
          </div>
        </div>

        {/* Overrun probability + Similar historical projects */}
        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="overrun-prob">
            <div className="font-display font-semibold text-[15px] text-white mb-1">Overrun probability by project type</div>
            <div className="text-xs text-zinc-500 mb-3">Current project data · higher = more likely to exceed approved budget</div>
            <div className="space-y-2.5">
              {projectTypeStats.map((t) => {
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
            <div className="text-xs text-zinc-500 mt-0.5">Observed month-over-month trend with lower and upper ranges based on recorded volatility</div>
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
              <Area type="monotone" dataKey="pessimistic" name="Observed upper range" stroke="#EF4444" strokeDasharray="5 3" fill="url(#pess)" strokeWidth={2} />
              <Line type="monotone" dataKey="base" name="Base forecast" stroke="#4F8EF7" strokeWidth={2.5} dot={{ r: 4, fill: "#4F8EF7" }} />
              <Line type="monotone" dataKey="optimistic" name="Observed lower range" stroke="#10B981" strokeDasharray="5 3" strokeWidth={2} dot={false} />
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
              Pessimistic spend ({fmtCurrency(projectedPessimistic)}) would require an additional request; consider keeping a{" "}
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
              Estimated next-phase budget = planned tasks × expected trajectories/task × projected recent cost/trajectory
            </div>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <Field label="Scope">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                data-testid="task-cost-project-scope"
                className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                <option value="">Whole portfolio</option>
                {categoryProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Next phase tasks *">
              <input type="number" min="0" value={nextPhaseTasks || ""} onChange={(e) => setNextPhaseTasks(Number(e.target.value) || 0)} placeholder="Define tasks" className="h-9 w-32 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-200 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" data-testid="next-phase-planned-tasks" />
            </Field>
            <Field label="Expected traj/task *">
              <input type="number" min="0" step="0.1" value={nextTrajectoriesPerTask || ""} onChange={(e) => setNextTrajectoriesPerTask(Number(e.target.value) || 0)} placeholder="Define ratio" className="h-9 w-32 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-200 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" data-testid="next-phase-trajectories-per-task" />
            </Field>
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
              <ForecastCell label="Projected cost / trajectory" value={fmtCurrency(nextPhaseEstimate?.costPerTrajectory || 0, { compact: false })} accent="text-fuchsia-300" testid="fc-next-cost-per-task" />
              <ForecastCell label="Next phase · budget est." value={nextPhaseEstimate?.totalBudget != null ? fmtCurrency(nextPhaseEstimate.totalBudget, { compact: false }) : "Define inputs"} accent="text-fuchsia-300" testid="fc-next-budget" />
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
                  {nextPhaseEstimate?.totalBudget != null ? <>
                    The projected recent cost is <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(nextPhaseEstimate.costPerTrajectory, { compact: false })}</span> per trajectory.
                    Applying <span className="text-white font-semibold tabular">{nextPhaseEstimate.planned.toLocaleString()}</span> planned tasks × <span className="text-white font-semibold tabular">{nextPhaseEstimate.trajectoriesPerTask}</span> trajectories/task produces an estimated budget of <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(nextPhaseEstimate.totalBudget, { compact: false })}</span>.
                  </> : <>Define the next phase’s planned tasks and expected trajectories per task above to calculate its estimated budget.</>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Suggested phase budget</span>
                  <span className="text-white font-display font-semibold text-xl tabular ml-auto">{nextPhaseEstimate?.totalBudget != null ? fmtCurrency(nextPhaseEstimate.totalBudget, { compact: false }) : "—"}</span>
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">Recent phases · cost/trajectory</div>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {historicalPhases.slice(-6).reverse().map((p) => (
                    <div key={p.key} className="flex items-center justify-between text-[11px] py-1 border-b border-white/5 last:border-0" data-testid={`hist-row-${p.key}`}>
                      <span className="text-zinc-300 truncate">{p.projectName} · <span className="text-fuchsia-300">{p.phaseName}</span></span>
                      <span className="text-white font-semibold tabular">
                        {fmtCurrency(p.actualCostPerTrajectory ?? p.plannedCostPerTrajectory, { compact: false })}
                        {p.actualCostPerTrajectory ? <span className="text-emerald-300 text-[9px] ml-1">actual</span> : <span className="text-zinc-500 text-[9px] ml-1">plan</span>}
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
