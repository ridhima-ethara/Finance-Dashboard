import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { DAILY_ACTIVITY } from "../../data/mockAi";
import { AI_COST_TREND } from "../../data/mockTpm";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { Calendar, Save, TrendingUp, Activity, DollarSign, Zap, Cpu, Server, Coins, Package, ChevronRight, Sparkles } from "lucide-react";

// Category configurations
const CATS = [
  { id: "model", label: "AI Models", icon: Cpu, color: "#E619B8" },
  { id: "infra", label: "Infrastructure", icon: Server, color: "#3B82F6" },
  { id: "employee", label: "Employee", icon: DollarSign, color: "#10B981" },
  { id: "other", label: "Other", icon: Package, color: "#F59E0B" },
];

const Consumption = () => {
  const { user, visibleProjects } = useApp();
  const [selectedProject, setSelectedProject] = useState(visibleProjects[0]?.id || "");
  const [estimate, setEstimate] = useState({ model: "", infra: "", employee: "", other: "" });

  const today = DAILY_ACTIVITY[DAILY_ACTIVITY.length - 1];
  const yesterday = DAILY_ACTIVITY[DAILY_ACTIVITY.length - 2];
  const dowChange = ((today.spend - yesterday.spend) / yesterday.spend) * 100;

  // Aggregate: last 14 days
  const last14 = DAILY_ACTIVITY.slice(-14);
  const last7 = DAILY_ACTIVITY.slice(-7);

  const totalEstimate = useMemo(() => {
    return Object.values(estimate).reduce((s, v) => s + (Number(v) || 0), 0);
  }, [estimate]);

  const submitEstimate = () => {
    if (totalEstimate === 0) {
      toast.error("Please enter at least one estimate");
      return;
    }
    toast.success("Daily estimate submitted", {
      description: `${fmtCurrency(totalEstimate, { compact: false })} across ${
        Object.values(estimate).filter((v) => Number(v) > 0).length
      } categories · ${visibleProjects.find((p) => p.id === selectedProject)?.name || "Project"}`,
    });
    setEstimate({ model: "", infra: "", employee: "", other: "" });
  };

  return (
    <div className="space-y-6" data-testid="page-consumption">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <Calendar className="w-3 h-3" />
            Daily consumption
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">
            Today&apos;s consumption
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {user?.role === "TPM" ? "your projects" : "portfolio-wide"}
          </p>
        </div>
      </div>

      {/* Today at a glance */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Total today" value={fmtCurrency(today.spend, { compact: false })} tone="magenta" icon={Zap} testid="cons-today" />
        <Stat
          label="Estimated"
          value={fmtCurrency(today.estimate, { compact: false })}
          sub={
            today.spend > today.estimate
              ? `+${fmtCurrency(today.spend - today.estimate, { compact: false })} over`
              : `${fmtCurrency(today.estimate - today.spend, { compact: false })} under`
          }
          tone={today.spend > today.estimate ? "negative" : "positive"}
          icon={TrendingUp}
          testid="cons-est"
        />
        <Stat
          label="vs yesterday"
          value={`${dowChange > 0 ? "+" : ""}${dowChange.toFixed(1)}%`}
          sub={fmtCurrency(yesterday.spend, { compact: false }) + " yesterday"}
          tone={dowChange > 0 ? "negative" : "positive"}
          icon={Activity}
          testid="cons-dow"
        />
        <Stat label="Expenses logged" value={String(today.expenses)} icon={Coins} testid="cons-expenses" />
        <Stat label="Approvals" value={String(today.approvals)} tone="warning" testid="cons-appr" />
        <Stat
          label="7-day avg"
          value={fmtCurrency(Math.round(last7.reduce((s, d) => s + d.spend, 0) / 7), { compact: false })}
          icon={DollarSign}
          testid="cons-avg7"
        />
      </div>

      {/* Trend + Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel testid="chart-daily-14" title="Daily spend trend" subtitle="Actual vs estimated · last 14 days" className="lg:col-span-2">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last14}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d) => d.slice(-5)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }}
                  formatter={(v) => fmtCurrency(v, { compact: false })}
                />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="spend" name="Actual" stroke="#E619B8" strokeWidth={2} dot={{ r: 3, fill: "#E619B8" }} />
                <Line type="monotone" dataKey="estimate" name="Estimate" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-cats" title="Today by category" subtitle="Category mix · %">
          <div className="space-y-3">
            {CATS.map((c) => {
              const val = today.byCategory[c.id] || 0;
              const pct = Math.round((val / today.spend) * 100);
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${c.color}22` }}>
                        <c.icon className="w-3 h-3" style={{ color: c.color }} />
                      </div>
                      <span className="text-zinc-200">{c.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold tabular">{fmtCurrency(val, { compact: false })}</span>
                      <span className="text-[10px] text-zinc-500 font-semibold tabular w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Submit daily estimate */}
      <Panel
        testid="submit-estimate"
        title="Submit tomorrow's estimate"
        subtitle="Provide line-item projections so Finance can plan accurately"
      >
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Project</div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              data-testid="est-project"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            >
              {visibleProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {CATS.map((c) => (
            <div key={c.id}>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5 flex items-center gap-1">
                <c.icon className="w-3 h-3" style={{ color: c.color }} />
                {c.label}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  value={estimate[c.id]}
                  onChange={(e) => setEstimate({ ...estimate, [c.id]: e.target.value })}
                  placeholder="0"
                  data-testid={`est-${c.id}`}
                  className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Total estimate:{" "}
            <span className="text-fuchsia-300 font-semibold text-sm tabular">
              {fmtCurrency(totalEstimate, { compact: false })}
            </span>
          </div>
          <Button
            onClick={submitEstimate}
            className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="btn-submit-estimate"
          >
            <Save className="w-3.5 h-3.5" />
            Submit estimate
          </Button>
        </div>
      </Panel>

      {/* Recent activity list */}
      <Panel testid="recent-activity" title="Last 7 days" subtitle="Daily consumption history">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-right py-2 px-3">Estimate</th>
                <th className="text-right py-2 px-3">Actual</th>
                <th className="text-right py-2 px-3">Variance</th>
                <th className="text-right py-2 px-3">Expenses</th>
                <th className="text-right py-2 px-3">Approvals</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {[...last7].reverse().map((d) => {
                const variance = d.estimate - d.spend;
                return (
                  <tr key={d.date} data-testid={`day-${d.date}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="py-3 px-3 text-white font-medium">
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
                    <td className="py-3 px-3 text-right text-zinc-400 tabular">{d.expenses}</td>
                    <td className="py-3 px-3 text-right text-zinc-400 tabular">{d.approvals}</td>
                    <td className="py-3 px-2 text-right">
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* AI insight */}
      <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-zinc-300">
          <span className="text-fuchsia-200 font-semibold">Consumption insight: </span>
          Your 7-day rolling average is{" "}
          <span className="text-fuchsia-300 font-semibold">
            {fmtCurrency(Math.round(last7.reduce((s, d) => s + d.spend, 0) / 7), { compact: false })}
          </span>
          . AI model costs are pacing{" "}
          <span className={today.byCategory.model > today.estimate * 0.45 ? "text-amber-300" : "text-emerald-300"}>
            {today.byCategory.model > today.estimate * 0.45 ? "above" : "in-line with"}
          </span>{" "}
          plan. Consider submitting tomorrow&apos;s estimate before 6 PM to avoid finance holds.
        </div>
      </div>
    </div>
  );
};

const Panel = ({ title, subtitle, children, testid, className = "" }) => (
  <div className={`bg-[#12121A] rounded-2xl border border-white/5 p-5 ${className}`} data-testid={testid}>
    <div className="flex items-start justify-between gap-2 mb-4">
      <div>
        <div className="font-display font-semibold text-[15px] text-white">{title}</div>
        {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
      </div>
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, sub, tone = "neutral", icon: Icon, testid }) => {
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
      <div className={`mt-2 font-display font-semibold text-xl tabular ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
};

export default Consumption;
