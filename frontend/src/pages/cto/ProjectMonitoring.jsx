import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { DAILY_ACTIVITY } from "../../data/mockAi";
import { fmtCurrency, fmtPct } from "../../lib/format";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Activity, TrendingUp, Wallet, Flame, Clock3, Gauge, AlertTriangle, ChevronRight, Filter } from "lucide-react";

const ProjectMonitoring = () => {
  const { visibleProjects } = useApp();
  const [selected, setSelected] = useState(visibleProjects[0]?.id || null);
  const [range, setRange] = useState("30d");

  useEffect(() => {
    if (!selected || !visibleProjects.some((project) => project.id === selected)) {
      setSelected(visibleProjects[0]?.id || null);
    }
  }, [selected, visibleProjects]);

  const project = useMemo(() => visibleProjects.find((p) => p.id === selected), [selected, visibleProjects]);
  const daily = useMemo(() => (range === "7d" ? DAILY_ACTIVITY.slice(-7) : DAILY_ACTIVITY.slice(-30)), [range]);

  const weekly = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < DAILY_ACTIVITY.length; i += 7) {
      const chunk = DAILY_ACTIVITY.slice(i, i + 7);
      if (chunk.length === 0) continue;
      const total = chunk.reduce((s, d) => s + d.spend, 0);
      const est = chunk.reduce((s, d) => s + d.estimate, 0);
      weeks.push({ week: `W${Math.floor(i / 7) + 1}`, spend: total, estimate: est });
    }
    return weeks;
  }, []);

  if (!project) {
    return (
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-8 text-center">
        <div className="text-sm text-zinc-400">No projects to monitor</div>
      </div>
    );
  }

  const today = DAILY_ACTIVITY[DAILY_ACTIVITY.length - 1] || { spend: 0, estimate: 0, approvals: 0, expenses: 0 };
  const burnRate = project.burnRate * 1000;
  const remaining = project.approvedBudget - project.actualSpend;
  const runway = burnRate ? Math.round(remaining / burnRate) : "—";
  const eac = Math.round(project.actualSpend + burnRate * runway);
  const exhaustDate = typeof runway === "number" ? new Date(Date.now() + runway * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

  return (
    <div className="space-y-6" data-testid="page-monitoring">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <Activity className="w-3 h-3" />
            CTO Portal
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Project monitoring</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Live budget health, burn rate &amp; forecasted exhaustion
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 h-9">
          {["7d", "30d"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              data-testid={`range-${r}`}
              className={`px-3 rounded-md text-xs font-medium ${
                range === r ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {r === "7d" ? "Last 7 days" : "Last 30 days"}
            </button>
          ))}
        </div>
      </div>

      {/* Project selector */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Select project</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {visibleProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              data-testid={`select-${p.id}`}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                selected === p.id
                  ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  p.utilization >= 100 ? "bg-red-400" : p.utilization >= 90 ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Daily estimated" value={fmtCurrency(today.estimate, { compact: false })} icon={TrendingUp} testid="mon-est" />
        <Stat label="Daily actual" value={fmtCurrency(today.spend, { compact: false })} tone="magenta" icon={Activity} testid="mon-actual" />
        <Stat label="Budget remaining" value={fmtCurrency(remaining)} tone={remaining > 0 ? "positive" : "negative"} icon={Wallet} testid="mon-rem" />
        <Stat label="Burn rate" value={`$${burnRate.toLocaleString()}/d`} icon={Flame} tone="warning" testid="mon-burn" />
        <Stat label="Budget health" value={project.health} tone={project.health === "healthy" ? "positive" : project.health === "watch" ? "warning" : "negative"} icon={Gauge} testid="mon-health" />
        <Stat label="EAC (est. at completion)" value={fmtCurrency(eac)} icon={Clock3} testid="mon-eac" />
        <Stat label="Exhaustion in" value={typeof runway === "number" ? `${runway}d` : "—"} sub={exhaustDate} icon={AlertTriangle} tone={typeof runway === "number" && runway < 14 ? "negative" : "warning"} testid="mon-exhaust" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel testid="chart-daily-trend" title="Daily cost trend" subtitle={range === "7d" ? "Actual vs estimated · last 7 days" : "Actual vs estimated · last 30 days"}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(-5)} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="spend" name="Actual" stroke="#E619B8" strokeWidth={2} dot={{ r: 3, fill: "#E619B8" }} />
                <Line type="monotone" dataKey="estimate" name="Estimate" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-weekly-trend" title="Weekly cost trend" subtitle="Cumulative by week">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="estimate" name="Estimate" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="spend" name="Actual" fill="#E619B8" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Utilization + phases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel testid="phase-consumption" title="Phase-wise consumption" subtitle={`${project.name} · budget usage by phase`} className="lg:col-span-2">
          <div className="space-y-2.5">
            {project.phases.map((p) => {
              const pct = p.estimated ? Math.round((p.actual / p.estimated) * 100) : 0;
              const color = pct >= 100 ? "#EF4444" : pct >= 90 ? "#F59E0B" : "#E619B8";
              return (
                <Link
                  to={`/projects/${project.id}/phase/${p.id}`}
                  key={p.id}
                  data-testid={`phase-${p.id}`}
                  className="block hover:opacity-95"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-100 font-medium">{p.name}</span>
                      <span className="text-[10px] text-zinc-500">{p.dates}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 tabular">
                        {fmtCurrency(p.actual, { compact: false })} / {fmtCurrency(p.estimated, { compact: false })}
                      </span>
                      <span className="font-semibold tabular w-10 text-right" style={{ color }}>
                        {fmtPct(pct)}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel testid="util-summary" title="Utilization" subtitle={`${project.utilization}% of ${fmtCurrency(project.approvedBudget)}`}>
          <div className="relative h-40 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#1F1F2A" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={project.utilization >= 100 ? "#EF4444" : project.utilization >= 90 ? "#F59E0B" : "#E619B8"}
                strokeWidth="10"
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={2 * Math.PI * 52 * (1 - Math.min(project.utilization, 100) / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-3xl font-semibold text-white tabular">{fmtPct(project.utilization)}</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">utilization</div>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Approved</span>
              <span className="text-white font-semibold tabular">{fmtCurrency(project.approvedBudget)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Actual</span>
              <span className="text-white font-semibold tabular">{fmtCurrency(project.actualSpend)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Remaining</span>
              <span className={`font-semibold tabular ${remaining > 0 ? "text-emerald-300" : "text-red-300"}`}>{fmtCurrency(remaining)}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Daily consumption table */}
      <Panel testid="daily-consumption-table" title="Daily consumption log" subtitle="Last 7 days · project-wide">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-right py-2 px-3">Estimated</th>
                <th className="text-right py-2 px-3">Actual</th>
                <th className="text-right py-2 px-3">Variance</th>
                <th className="text-right py-2 px-3">Approvals</th>
                <th className="text-right py-2 px-3">Expenses</th>
              </tr>
            </thead>
            <tbody>
              {DAILY_ACTIVITY.slice(-7).reverse().map((d) => {
                const variance = d.estimate - d.spend;
                return (
                  <tr key={d.date} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="py-3 px-3 text-white font-medium tabular">
                      {new Date(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtCurrency(d.estimate, { compact: false })}</td>
                    <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(d.spend, { compact: false })}</td>
                    <td className="py-3 px-3 text-right tabular">
                      <span className={variance >= 0 ? "text-emerald-300" : "text-red-300"}>
                        {variance >= 0 ? "+" : ""}
                        {fmtCurrency(variance, { compact: false })}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-400 tabular">{d.approvals}</td>
                    <td className="py-3 px-3 text-right text-zinc-400 tabular">{d.expenses}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

const Panel = ({ title, subtitle, children, testid, className = "" }) => (
  <div className={`bg-[#12121A] rounded-2xl border border-white/5 p-5 ${className}`} data-testid={testid}>
    <div className="mb-3">
      <div className="font-display font-semibold text-[15px] text-white">{title}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, sub, icon: Icon, tone = "neutral", testid }) => {
  const tones = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-white",
    magenta: "text-fuchsia-300",
  };
  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${tones[tone]}`} />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display font-semibold text-lg tabular ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-zinc-500 tabular">{sub}</div>}
    </div>
  );
};

export default ProjectMonitoring;
