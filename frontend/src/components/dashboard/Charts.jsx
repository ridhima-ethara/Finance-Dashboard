import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
} from "recharts";
import { CreditCard, CheckCircle2, Circle } from "lucide-react";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { useApp } from "../../context/AppContext";
import {
  buildItActualDailyRows,
  buildItMonthEndRows,
  summarizeProjectModelUsage,
} from "../../lib/projectMetrics";

const COLORS = {
  budget: "#E619B8",
  estimated: "#F59E0B",
  actual: "#10B981",
  actualSoft: "#22D3EE",
  info: "#3B82F6",
  slate: "#94A3B8",
  amber: "#F59E0B",
};

const PIE_COLORS = ["#E619B8", "#3B82F6", "#10B981", "#F59E0B", "#F97316", "#94A3B8"];

const CardShell = ({ title, subtitle, right, children, testid }) => (
  <div
    data-testid={testid}
    className="bg-[#12121A] rounded-2xl border border-white/10 p-5 card-hover"
  >
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <div className="text-[15px] font-semibold text-white font-display">{title}</div>
        {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label, valueFormatter = fmtCurrency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#12121A] border border-white/10 rounded-xl shadow-lg px-3 py-2 tabular">
      <div className="text-xs font-semibold text-white">{label}</div>
      <div className="mt-1 space-y-0.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: entry.color }} />
              <span className="text-zinc-400 capitalize">{entry.name}</span>
            </div>
            <span className="font-semibold text-white">{valueFormatter(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const getProjectLabel = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ") || "Project";
};

export const BudgetActualChart = ({ projectsOverride = null }) => {
  const { projects: contextProjects } = useApp();
  const projects = projectsOverride || contextProjects;
  const data = useMemo(
    () => projects.slice(0, 6).map((project) => ({
      name: getProjectLabel(project.name),
      Budget: Number(project.approvedBudget || 0),
      Estimated: Number(project.estimatedBudget || project.approvedBudget || 0),
      Actual: Number(project.cfoActualSpend || project.actualSpend || 0),
    })),
    [projects]
  );

  return (
    <CardShell
      testid="chart-budget-actual"
      title="Actual · Budget · Estimated"
      subtitle="Per project · L3 actuals from IT filing"
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap={16}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#71717A" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Legend
              iconType="square"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => <span className="text-zinc-400 text-xs">{value}</span>}
            />
            <Bar dataKey="Budget" fill={COLORS.budget} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="Estimated" fill={COLORS.amber} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="Actual" fill={COLORS.actual} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
};

export const ModelExpensesChart = ({ projectsOverride = null }) => {
  const { projects: contextProjects, taskLogs, itMonthlyActuals } = useApp();
  const projects = projectsOverride || contextProjects;
  const data = useMemo(() => {
    const byModel = {};

    projects.forEach((project) => {
      (project.budgetItems?.models || []).forEach((line) => {
        const key = line.modelId || line.meta?.id || line.meta?.name || line.modelName || line.label || "Model";
        const label = line.meta?.name || line.modelName || line.label || key;
        byModel[key] = byModel[key] || { name: label, Budget: 0, Estimated: 0, Actual: 0 };
        const amount = Number(line.estCost || line.amount || 0);
        byModel[key].Budget += amount;
        byModel[key].Estimated += amount;
      });

      summarizeProjectModelUsage(project, taskLogs, itMonthlyActuals[project.id] || {}).forEach((row) => {
        const key = row.modelId || row.modelName || "Model";
        byModel[key] = byModel[key] || { name: row.modelName || key, Budget: 0, Estimated: 0, Actual: 0 };
        byModel[key].Actual += Number(row.cost || 0);
      });
    });

    return Object.values(byModel)
      .sort((left, right) => right.Actual - left.Actual || right.Budget - left.Budget)
      .slice(0, 8);
  }, [projects, taskLogs, itMonthlyActuals]);

  return (
    <CardShell
      testid="chart-model-expenses"
      title="Model-wise expenses"
      subtitle="Budgeted model lines vs IT-filed actual usage"
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap={16}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#71717A" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="Budget" fill="#E619B8" radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="Estimated" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="Actual" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
};

export const InfraStackedChart = ({ projectsOverride = null }) => {
  const { projects: contextProjects } = useApp();
  const projects = projectsOverride || contextProjects;
  const data = useMemo(
    () => projects.slice(0, 6).map((project) => ({
      name: getProjectLabel(project.name),
      Budget: Number((project.budgetItems?.infra || []).reduce((sum, line) => sum + Number(line.estCost || line.amount || 0), 0)),
      Actual: Number(project.itActuals?.infraActual || 0),
    })),
    [projects]
  );

  return (
    <CardShell
      testid="chart-infra"
      title="Infrastructure actuals by project"
      subtitle="Budgeted infra lines vs IT-filed infra actuals"
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={8}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#71717A" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="Budget" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="Actual" fill="#22D3EE" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
};

export const MonthlySpendChart = ({ projectsOverride = null }) => {
  const { projects: contextProjects, itMonthlyActuals } = useApp();
  const projects = projectsOverride || contextProjects;
  const data = useMemo(() => {
    const rows = buildItActualDailyRows(projects, itMonthlyActuals);
    return Array.from(rows.reduce((map, row) => {
      const current = map.get(row.date) || { date: row.date, budget: 0, actual: 0, overrun: 0 };
      current.budget += Number(row.budget || 0);
      current.actual += Number(row.actual || 0);
      map.set(row.date, current);
      return map;
    }, new Map()).values())
      .map((row) => ({
        ...row,
        overrun: Math.max(0, Number(row.actual || 0) - Number(row.budget || 0)),
      }))
      .slice(-14);
  }, [projects, itMonthlyActuals]);
  const overrunDays = data.filter((row) => row.overrun > 0);

  return (
    <CardShell
      testid="chart-monthly-spend"
      title="Daily actual spend trend"
      subtitle="Portfolio-wide · IT daily actuals vs approved daily allocation"
      right={
        <div className="text-xs text-zinc-500 tabular">
          {overrunDays.length > 0 ? (
            <>
              <span className="font-semibold text-red-300">{overrunDays.length}</span> day{overrunDays.length === 1 ? "" : "s"} exceeded
            </>
          ) : (
            <span className="font-semibold text-emerald-300">No daily overruns</span>
          )}
        </div>
      }
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gBudget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E619B8" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#E619B8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(value) => value.slice(5)} />
            <YAxis
              tick={{ fontSize: 11, fill: "#71717A" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Area type="monotone" dataKey="budget" name="Budget" stroke="#E619B8" fill="url(#gBudget)" strokeWidth={2} />
            <Area type="monotone" dataKey="actual" name="Actual" stroke="#10B981" fill="url(#gActual)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {overrunDays.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {overrunDays.slice(-5).reverse().map((row) => (
            <div key={row.date} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] text-red-200 tabular">
              {row.date.slice(5)} · +{fmtCurrency(row.overrun, { compact: false })}
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
};

export const MonthEndActualChart = ({ projectsOverride = null }) => {
  const { projects: contextProjects, itMonthlyActuals } = useApp();
  const projects = projectsOverride || contextProjects;
  const data = useMemo(
    () => buildItMonthEndRows(projects, itMonthlyActuals).slice(-6).map((row) => ({
      name: getProjectLabel(row.projectName),
      Budget: row.budget,
      Actual: row.actual,
      monthLabel: row.monthLabel,
      variance: row.variance,
    })),
    [projects, itMonthlyActuals]
  );

  return (
    <CardShell
      testid="chart-month-end-actual"
      title="Month-end actuals vs monthly allocation"
      subtitle="IT monthly close compared with the current month budget allocation"
      right={
        <div className="text-xs text-zinc-500 tabular">
          <span className="font-semibold text-white">{data.length}</span> project{data.length === 1 ? "" : "s"} filed
        </div>
      }
    >
      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-xs text-zinc-500">
          No month-end actuals have been filed by IT yet.
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={6} barCategoryGap={18}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#71717A" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Legend
                iconType="square"
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) => <span className="text-zinc-400 text-xs">{value}</span>}
              />
              <Bar dataKey="Budget" fill={COLORS.info} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Actual" fill={COLORS.actualSoft} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardShell>
  );
};

export const CategoryDonut = ({ projectsOverride = null }) => {
  const { projects: contextProjects } = useApp();
  const projects = projectsOverride || contextProjects;
  const breakdown = useMemo(() => {
    const totals = projects.reduce((sum, project) => ({
      models: sum.models + Number(project.itActuals?.modelActual || 0),
      infra: sum.infra + Number(project.itActuals?.infraActual || 0),
      subs: sum.subs + Number(project.itActuals?.subsActual || 0),
    }), { models: 0, infra: 0, subs: 0 });
    const total = totals.models + totals.infra + totals.subs;
    const rows = [
      { name: "Models", actual: totals.models, color: "#E619B8" },
      { name: "Infrastructure", actual: totals.infra, color: "#3B82F6" },
      { name: "Subscriptions", actual: totals.subs, color: "#10B981" },
    ];
    return rows.map((row) => ({
      ...row,
      value: total > 0 ? Math.round((row.actual / total) * 100) : 0,
    })).filter((row) => row.actual > 0 || total === 0);
  }, [projects]);

  const totalPct = breakdown.reduce((sum, row) => sum + row.value, 0);
  const totalActual = breakdown.reduce((sum, row) => sum + Number(row.actual || 0), 0);

  return (
    <CardShell
      testid="chart-category-donut"
      title="Expense breakdown"
      subtitle="Portfolio actuals by category"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-5 h-full">
        <div className="w-[180px] h-[180px] relative mx-auto lg:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={breakdown}
                dataKey="value"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {breakdown.map((row, index) => (
                  <Cell key={index} fill={row.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload;
                  return (
                    <div className="bg-[#12121A] border border-white/10 rounded-xl shadow-lg px-3 py-2 tabular">
                      <div className="text-xs font-semibold text-white">{row.name}</div>
                      <div className="mt-1 text-xs text-zinc-400">{fmtCurrency(row.actual, { compact: false })}</div>
                      <div className="text-xs text-zinc-400">{row.value}% of actuals</div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Actual mix</div>
            <div className="font-display text-xl font-semibold text-white">{totalPct}%</div>
            <div className="text-[11px] text-zinc-500 mt-1">{fmtCurrency(totalActual, { compact: false })}</div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 gap-2">
          {breakdown.map((row) => (
            <div key={row.name} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: row.color }} />
                <div>
                  <div className="text-zinc-200 font-medium">{row.name}</div>
                  <div className="text-[11px] text-zinc-500">{row.value}% of actuals</div>
                </div>
              </div>
              <span className="font-semibold text-white tabular">{fmtCurrency(row.actual, { compact: false })}</span>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
};

export const UtilizationBars = ({ projectsOverride = null }) => {
  const { projects: contextProjects } = useApp();
  const projects = projectsOverride || contextProjects;
  const data = useMemo(
    () => projects
      .map((project) => ({
        name: project.name,
        util: Number(project.cfoUtilization || project.utilization || 0),
        buffer: Number(project.buffer || 0),
      }))
      .sort((left, right) => right.util - left.util)
      .slice(0, 6),
    [projects]
  );

  return (
    <CardShell
      testid="chart-utilization"
      title="Budget utilization"
      subtitle="Top utilization projects · L3 actuals with buffer guardrails"
    >
      <div className="space-y-3">
        {data.map((row) => {
          const color = row.util >= 100 ? "#EF4444" : row.util >= 85 ? "#F59E0B" : "#10B981";
          const bg = row.util >= 100 ? "#FEE2E2" : row.util >= 85 ? "#FEF3C7" : "#D1FAE5";
          const buffer = Number(row.buffer || 0);
          const hasBuffer = buffer > 0;
          const scaleMax = 100 + buffer;
          const utilLeft = Math.min((Math.min(row.util, scaleMax) / scaleMax) * 100, 100);
          const bufferStartPct = (100 / scaleMax) * 100;
          const bufferWidthPct = 100 - bufferStartPct;
          return (
            <div key={row.name} data-testid={`util-bar-${row.name}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-200 font-medium">{row.name}</span>
                <span className="font-semibold tabular flex items-center gap-2">
                  <span style={{ color }}>{fmtPct(row.util)}</span>
                  {hasBuffer && <span className="text-[9px] text-zinc-500 font-medium">buffer +{buffer}%</span>}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full" style={{ background: bg }}>
                {hasBuffer && (
                  <div
                    className="absolute inset-y-0 rounded-r-full"
                    style={{
                      left: `${bufferStartPct}%`,
                      width: `${bufferWidthPct}%`,
                      backgroundImage: "repeating-linear-gradient(45deg, rgba(0,0,0,0.14) 0 3px, transparent 3px 6px)",
                    }}
                  />
                )}
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{ width: `${utilLeft}%`, background: color }}
                />
                {hasBuffer && <div className="absolute inset-y-0 w-px bg-zinc-800" style={{ left: `${bufferStartPct}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
};

export const SubscriptionsPanel = ({ projectsOverride = null }) => {
  const { projects: contextProjects } = useApp();
  const projects = projectsOverride || contextProjects;
  const subscriptions = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => {
      (project.budgetItems?.subs || []).forEach((line, index) => {
        const label = line.subscription || line.optionLabel || line.label || `Subscription ${index + 1}`;
        const existing = map.get(label) || {
          id: label,
          name: label,
          budget: 0,
          actual: 0,
          projects: new Set(),
        };
        existing.budget += Number(line.estCost || line.amount || 0);
        existing.projects.add(project.name);
        map.set(label, existing);
      });

      if ((project.budgetItems?.subs || []).length === 0 && Number(project.itActuals?.subsActual || 0) > 0) {
        const label = "Unmapped subscriptions";
        const existing = map.get(label) || {
          id: label,
          name: label,
          budget: 0,
          actual: 0,
          projects: new Set(),
        };
        existing.projects.add(project.name);
        map.set(label, existing);
      }
    });

    const rows = Array.from(map.values()).map((row) => ({
      ...row,
      projects: Array.from(row.projects),
    }));

    const totalActual = projects.reduce((sum, project) => sum + Number(project.itActuals?.subsActual || 0), 0);
    if (rows.length) {
      const baseTotal = rows.reduce((sum, row) => sum + row.budget, 0);
      rows.forEach((row) => {
        row.actual = baseTotal > 0 ? (row.budget / baseTotal) * totalActual : 0;
      });
    }

    return rows.sort((left, right) => right.actual - left.actual || right.budget - left.budget);
  }, [projects]);

  const totalBudget = subscriptions.reduce((sum, row) => sum + row.budget, 0);
  const totalActual = subscriptions.reduce((sum, row) => sum + row.actual, 0);

  return (
    <CardShell
      testid="panel-subscriptions"
      title={
        <span className="inline-flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-zinc-500" />
          Subscription actuals
        </span>
      }
      subtitle="Budgeted subscription asks vs IT-filed actuals"
      right={
        <div className="text-xs text-zinc-500 tabular">
          <span className="font-semibold text-white">{subscriptions.length}</span> lines ·{" "}
          <span className="font-semibold text-white">{fmtCurrency(totalActual, { compact: false })}</span> actual
        </div>
      }
    >
      <div className="space-y-2">
        {subscriptions.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-xs text-zinc-500">
            No subscription budget or actual data has been filed yet.
          </div>
        )}
        {subscriptions.map((subscription, index) => (
          <div
            key={subscription.id}
            data-testid={`sub-${subscription.id}`}
            className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group"
          >
            <div
              className="w-10 h-10 rounded-lg text-white text-xs font-semibold flex items-center justify-center flex-shrink-0"
              style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
            >
              {subscription.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">{subscription.name}</div>
              <div className="text-xs text-zinc-500">
                Budget {fmtCurrency(subscription.budget, { compact: false })} · Actual {fmtCurrency(subscription.actual, { compact: false })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-400">{subscription.projects.length} project{subscription.projects.length === 1 ? "" : "s"}</div>
              <div className="text-[11px] text-zinc-500">{subscription.projects.slice(0, 2).join(", ") || "—"}</div>
            </div>
          </div>
        ))}
        {subscriptions.length > 0 && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-400">
            Subscription budget {fmtCurrency(totalBudget, { compact: false })} · actual {fmtCurrency(totalActual, { compact: false })}
          </div>
        )}
      </div>
    </CardShell>
  );
};

const STAGES = [
  { key: "req", label: "Budget Request", done: true },
  { key: "cto", label: "L2 Review", done: true },
  { key: "cfo", label: "L3 Approval", done: true, current: true },
  { key: "it", label: "IT Provisioning", done: false },
  { key: "exec", label: "Execution", done: false },
  { key: "rec", label: "Recovery", done: false },
];

export const WorkflowStrip = () => (
  <CardShell
    testid="workflow-strip"
    title="Budget approval workflow"
    subtitle="Project → L2 → L3 → IT → Execution → Recovery"
  >
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {STAGES.map((stage, index) => (
        <div key={stage.key} className="flex items-center gap-2 flex-shrink-0">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
              stage.current
                ? "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400"
                : stage.done
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-white/5 border-white/10 text-zinc-500"
            }`}
          >
            {stage.done ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Circle className="w-3.5 h-3.5" />
            )}
            {stage.label}
          </div>
          {index < STAGES.length - 1 && <div className="w-4 h-px bg-white/10" />}
        </div>
      ))}
    </div>
  </CardShell>
);
