import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { DAILY_CONSUMPTION_LOG } from "../../data/mockTpm";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Calendar,
  Save,
  Plus,
  Trash2,
  Activity,
  Cpu,
  Zap,
  ListChecks,
  GitBranch,
  DollarSign,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";

const MODELS = ["Opus 4.8", "Sonnet", "GPT-4o", "Gemini 2.5 Pro", "Kimi", "Grok-2"];

// Heat intensity helper — % of approved daily budget consumed
const heatColor = (pct) => {
  if (pct === null || pct === undefined) return { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.05)" };
  if (pct >= 120) return { bg: "rgba(239,68,68,0.85)", border: "rgba(239,68,68,0.95)" };
  if (pct >= 100) return { bg: "rgba(239,68,68,0.55)", border: "rgba(239,68,68,0.7)" };
  if (pct >= 80) return { bg: "rgba(245,158,11,0.55)", border: "rgba(245,158,11,0.7)" };
  if (pct >= 60) return { bg: "rgba(230,25,184,0.55)", border: "rgba(230,25,184,0.7)" };
  if (pct >= 40) return { bg: "rgba(230,25,184,0.35)", border: "rgba(230,25,184,0.5)" };
  if (pct >= 20) return { bg: "rgba(16,185,129,0.35)", border: "rgba(16,185,129,0.5)" };
  return { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)" };
};

const Consumption = () => {
  const { user, visibleProjects } = useApp();
  const today = new Date().toISOString().slice(0, 10);

  // Today's log rows entered by TPM
  const [rows, setRows] = useState(() => {
    const first = visibleProjects[0]?.id;
    return first
      ? [{ id: 1, projectId: first, model: "Opus 4.8", tasks: "", trajectories: "", cost: "" }]
      : [];
  });

  const addRow = () => {
    const first = visibleProjects[0]?.id || "";
    setRows((r) => [
      ...r,
      { id: Date.now(), projectId: first, model: "Opus 4.8", tasks: "", trajectories: "", cost: "" },
    ]);
  };
  const removeRow = (id) => setRows((r) => r.filter((row) => row.id !== id));
  const updateRow = (id, key, val) => setRows((r) => r.map((row) => (row.id === id ? { ...row, [key]: val } : row)));

  const totals = useMemo(() => {
    return rows.reduce(
      (s, r) => ({
        tasks: s.tasks + (Number(r.tasks) || 0),
        trajectories: s.trajectories + (Number(r.trajectories) || 0),
        cost: s.cost + (Number(r.cost) || 0),
      }),
      { tasks: 0, trajectories: 0, cost: 0 }
    );
  }, [rows]);

  const submit = () => {
    const validRows = rows.filter((r) => Number(r.cost) > 0 || Number(r.tasks) > 0);
    if (validRows.length === 0) {
      toast.error("Add at least one row with tasks or cost");
      return;
    }
    toast.success(`Today's consumption submitted`, {
      description: `${validRows.length} project entr${validRows.length === 1 ? "y" : "ies"} · ${totals.tasks} tasks · ${totals.trajectories} trajectories · ${fmtCurrency(totals.cost, { compact: false })}`,
    });
    // reset
    setRows(rows.map((r) => ({ ...r, tasks: "", trajectories: "", cost: "" })));
  };

  // Heatmap prep: last 14 days x visibleProjects
  const projectIds = visibleProjects.map((p) => p.id);
  const heatmap = useMemo(() => {
    const dates = Array.from(new Set(DAILY_CONSUMPTION_LOG.map((d) => d.date))).sort();
    return { dates, rows: projectIds };
  }, [projectIds]);

  const cellFor = (projectId, date) => {
    const entry = DAILY_CONSUMPTION_LOG.find((d) => d.projectId === projectId && d.date === date);
    if (!entry) return null;
    const pct = entry.approvedDaily ? Math.round((entry.spent / entry.approvedDaily) * 100) : 0;
    return { ...entry, pct };
  };

  // Per-project comparison
  const perProject = visibleProjects.map((p) => {
    const entries = DAILY_CONSUMPTION_LOG.filter((d) => d.projectId === p.id);
    const totalSpent = entries.reduce((s, e) => s + e.spent, 0);
    const totalApproved = entries.reduce((s, e) => s + e.approvedDaily, 0);
    return {
      name: p.name.split(" ")[0],
      approved: totalApproved,
      actual: totalSpent,
      variance: totalApproved - totalSpent,
    };
  });

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
            Log today&apos;s consumption
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · project-wise tasks, trajectories &amp; cost — {user?.role === "TPM" ? "your projects" : "all projects"}
          </p>
        </div>
      </div>

      {/* Live totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total tasks (today)" value={String(totals.tasks || 0)} icon={ListChecks} tone="magenta" testid="stat-tasks" />
        <Stat label="Total trajectories" value={String(totals.trajectories || 0)} icon={GitBranch} tone="magenta" testid="stat-traj" />
        <Stat label="Total cost" value={fmtCurrency(totals.cost || 0, { compact: false })} icon={DollarSign} tone="magenta" testid="stat-cost" />
        <Stat label="Projects logged" value={String(rows.filter((r) => Number(r.cost) > 0 || Number(r.tasks) > 0).length)} icon={Activity} testid="stat-logged" />
      </div>

      {/* Submission table */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="submit-consumption">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Today&apos;s log · {today}</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Enter per-project actuals — model, tasks, trajectories and cost for today
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={addRow}
              variant="outline"
              className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2"
              data-testid="btn-add-row"
            >
              <Plus className="w-3.5 h-3.5" /> Add row
            </Button>
            <Button
              onClick={submit}
              className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
              data-testid="btn-submit-consumption"
            >
              <Save className="w-3.5 h-3.5" />
              Submit today&apos;s log
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3 w-1/3">Project</th>
                <th className="text-left py-2 px-3">Model</th>
                <th className="text-right py-2 px-3">Tasks</th>
                <th className="text-right py-2 px-3">Trajectories</th>
                <th className="text-right py-2 px-3">Cost (USD)</th>
                <th className="text-right py-2 px-3">Approved / day</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const project = visibleProjects.find((p) => p.id === row.projectId);
                const approvedDaily = project ? Math.round(project.approvedBudget / 30) : 0;
                const cost = Number(row.cost) || 0;
                const pctOfApproved = approvedDaily ? Math.round((cost / approvedDaily) * 100) : 0;
                return (
                  <tr key={row.id} data-testid={`row-${row.id}`} className="border-b border-white/5">
                    <td className="py-3 px-3">
                      <select
                        value={row.projectId}
                        onChange={(e) => updateRow(row.id, "projectId", e.target.value)}
                        data-testid={`select-project-${row.id}`}
                        className="w-full h-9 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                      >
                        {visibleProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={row.model}
                        onChange={(e) => updateRow(row.id, "model", e.target.value)}
                        data-testid={`select-model-${row.id}`}
                        className="w-full h-9 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                      >
                        {MODELS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={row.tasks}
                        onChange={(e) => updateRow(row.id, "tasks", e.target.value)}
                        placeholder="0"
                        data-testid={`input-tasks-${row.id}`}
                        className="w-full h-9 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-right text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={row.trajectories}
                        onChange={(e) => updateRow(row.id, "trajectories", e.target.value)}
                        placeholder="0"
                        data-testid={`input-traj-${row.id}`}
                        className="w-full h-9 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-right text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                        <input
                          type="number"
                          value={row.cost}
                          onChange={(e) => updateRow(row.id, "cost", e.target.value)}
                          placeholder="0"
                          data-testid={`input-cost-${row.id}`}
                          className="w-full h-9 pl-6 pr-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-right text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="text-xs text-zinc-300 tabular">{fmtCurrency(approvedDaily, { compact: false })}</div>
                      {cost > 0 && (
                        <div
                          className={`text-[10px] font-semibold tabular mt-0.5 ${
                            pctOfApproved >= 100 ? "text-red-300" : pctOfApproved >= 80 ? "text-amber-300" : "text-emerald-300"
                          }`}
                        >
                          {pctOfApproved}% used
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => removeRow(row.id)}
                        data-testid={`btn-remove-${row.id}`}
                        className="w-8 h-8 rounded-md hover:bg-red-500/15 text-zinc-500 hover:text-red-300 flex items-center justify-center transition-colors"
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-start gap-2 text-xs text-zinc-400">
          <Info className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
          <span>
            Costs entered here are compared against the approved daily budget for each project. Anomalies (over 100% of daily budget) are highlighted and surfaced to CTO in Project Monitoring.
          </span>
        </div>
      </div>

      {/* HEATMAP */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="heatmap">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">
              Consumption heatmap
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              % of approved daily budget consumed · last 14 days · project × day
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-400">
            <LegendChip color="rgba(16,185,129,0.35)" label="&lt; 40%" />
            <LegendChip color="rgba(230,25,184,0.55)" label="40–80%" />
            <LegendChip color="rgba(245,158,11,0.55)" label="80–100%" />
            <LegendChip color="rgba(239,68,68,0.55)" label="&gt; 100%" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest text-left pr-2 pb-1 sticky left-0 bg-[#12121A]">
                  Project
                </th>
                {heatmap.dates.map((d) => (
                  <th key={d} className="text-[9px] text-zinc-500 font-medium tabular pb-1 text-center w-8">
                    {d.slice(-2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.rows.map((pid) => {
                const proj = visibleProjects.find((p) => p.id === pid);
                if (!proj) return null;
                return (
                  <tr key={pid} data-testid={`heat-row-${pid}`}>
                    <td className="text-xs text-zinc-200 pr-3 py-0.5 whitespace-nowrap sticky left-0 bg-[#12121A]">
                      <div className="truncate max-w-[140px]">{proj.name}</div>
                    </td>
                    {heatmap.dates.map((d) => {
                      const cell = cellFor(pid, d);
                      const { bg, border } = heatColor(cell?.pct);
                      return (
                        <td key={d}>
                          <div
                            className="w-7 h-7 rounded-md border cursor-default relative group"
                            style={{ background: bg, borderColor: border }}
                            title={cell ? `${d} · ${cell.pct}% (${fmtCurrency(cell.spent, { compact: false })} of ${fmtCurrency(cell.approvedDaily, { compact: false })}) · ${cell.tasks} tasks / ${cell.trajectories} trajectories` : d}
                          >
                            {cell && cell.pct >= 100 && (
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90">!</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approved vs Actual */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="chart-approved-vs-actual">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Approved vs Actual (last 14 days)</div>
            <div className="text-xs text-zinc-500 mt-0.5">Sum of daily approved budget vs actual consumption per project</div>
          </div>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perProject}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
              <Tooltip
                contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }}
                formatter={(v) => fmtCurrency(v, { compact: false })}
              />
              <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="approved" name="Approved" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="actual" name="Actual" fill="#E619B8" radius={[3, 3, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent submissions */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="recent-submissions">
        <div className="font-display font-semibold text-[15px] text-white mb-3">Your recent submissions</div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-3">Project</th>
                <th className="text-left py-2 px-3">Model</th>
                <th className="text-right py-2 px-3">Tasks</th>
                <th className="text-right py-2 px-3">Trajectories</th>
                <th className="text-right py-2 px-3">Cost</th>
                <th className="text-right py-2 px-3">Approved / day</th>
                <th className="text-right py-2 px-3">Health</th>
              </tr>
            </thead>
            <tbody>
              {DAILY_CONSUMPTION_LOG.filter((d) => projectIds.includes(d.projectId))
                .slice(-10)
                .reverse()
                .map((d, i) => {
                  const pct = d.approvedDaily ? Math.round((d.spent / d.approvedDaily) * 100) : 0;
                  return (
                    <tr key={i} data-testid={`sub-${i}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-3 px-3 text-white font-medium tabular">
                        {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-3 px-3 text-zinc-200">{d.projectName}</td>
                      <td className="py-3 px-3 text-fuchsia-300 text-xs">{d.model}</td>
                      <td className="py-3 px-3 text-right text-zinc-200 tabular">{d.tasks}</td>
                      <td className="py-3 px-3 text-right text-zinc-200 tabular">{d.trajectories}</td>
                      <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(d.spent, { compact: false })}</td>
                      <td className="py-3 px-3 text-right text-zinc-400 tabular">{fmtCurrency(d.approvedDaily, { compact: false })}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          pct >= 100 ? "bg-red-500/15 text-red-300" : pct >= 80 ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"
                        }`}>
                          {pct >= 100 ? <span>Over</span> : pct >= 80 ? <span>Watch</span> : <><CheckCircle2 className="w-3 h-3" /> OK</>} · {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI insight */}
      <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-zinc-300">
          <span className="text-fuchsia-200 font-semibold">Consumption insight: </span>
          Submitting today&apos;s log before 6 PM ensures Finance and CTO see your true burn rate. Cells in the heatmap turn red when a day exceeds 100% of the approved daily budget — investigate immediately or raise a change request.
        </div>
      </div>
    </div>
  );
};

const LegendChip = ({ color, label }) => (
  <span className="inline-flex items-center gap-1">
    <span className="w-3 h-3 rounded-sm border" style={{ background: color, borderColor: color }} />
    {label}
  </span>
);

const Stat = ({ label, value, icon: Icon, tone = "neutral", testid }) => {
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
    </div>
  );
};

export default Consumption;
