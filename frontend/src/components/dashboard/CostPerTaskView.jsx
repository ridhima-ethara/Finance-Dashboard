import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { BUDGET_REVIEWS } from "../../data/mockTpm";
import { fmtCurrency } from "../../lib/format";
import { Cpu, ListChecks, TrendingUp, TrendingDown, Layers, Filter } from "lucide-react";
import { Link } from "react-router-dom";

// CFO-facing cost analytics: per-project & per-phase unit economics.
//   Cost / task       = phase budget / planned tasks
//   Cost / trajectory = phase budget / (tasks × trajectories/task)
//   Actual cost / task = sum(log.cost) / sum(log.tasksDone) (from TPM daily logs)
const CostPerTaskView = () => {
  const { projects, taskLogs } = useApp();
  const [scope, setScope] = useState("all"); // all | rnd | production
  const [sort, setSort] = useState("costPerTask");

  const rows = useMemo(() => {
    const out = [];
    projects.forEach((p) => {
      // fetch tasks-per-phase either from custom project (BudgetBuilder) or from BUDGET_REVIEWS fallback
      const review = BUDGET_REVIEWS.find((r) => r.projectId === p.id);
      const reviewTasks = Number(review?.tasks || 0);
      const reviewPhases = Number(review?.phases || (p.phases?.length || 1));
      const perPhaseTasksFallback = reviewTasks && reviewPhases ? Math.round(reviewTasks / reviewPhases) : 0;

      (p.phases || []).forEach((ph) => {
        const planned = Number(ph.totalTasks || ph.tasks || perPhaseTasksFallback || 0);
        const trajPerTask = Number(ph.trajectoriesPerTask || 3);
        const trajectories = planned * trajPerTask;
        const budget = Number(ph.estimated || 0);
        const actual = Number(ph.actual || 0);
        const key = `${p.id}::${ph.id}`;
        const logs = taskLogs[key] || [];
        const loggedTasks = logs.reduce((s, l) => s + (Number(l.tasksDone) || 0), 0);
        const loggedCost = logs.reduce((s, l) => s + (Number(l.cost) || 0), 0);
        out.push({
          projectId: p.id,
          projectName: p.name,
          projectType: p.type || "R&D",
          phaseId: ph.id,
          phaseName: ph.name,
          planned,
          trajPerTask,
          trajectories,
          budget,
          actual,
          loggedTasks,
          loggedCost,
          costPerTask: planned > 0 ? Math.round((budget / planned) * 100) / 100 : 0,
          costPerTraj: trajectories > 0 ? Math.round((budget / trajectories) * 1000) / 1000 : 0,
          actualPerTask: loggedTasks > 0 ? Math.round((loggedCost / loggedTasks) * 100) / 100 : 0,
        });
      });
    });
    return out;
  }, [projects, taskLogs]);

  const filtered = useMemo(() => {
    let r = rows.filter((x) => x.planned > 0); // only phases with derivable unit economics
    if (scope === "rnd") r = r.filter((x) => (x.projectType || "").toLowerCase().includes("r&d") || (x.projectType || "").toLowerCase() === "rnd");
    else if (scope === "production") r = r.filter((x) => (x.projectType || "").toLowerCase() === "production");
    r = [...r];
    if (sort === "costPerTask") r.sort((a, b) => b.costPerTask - a.costPerTask);
    else if (sort === "costPerTraj") r.sort((a, b) => b.costPerTraj - a.costPerTraj);
    else if (sort === "budget") r.sort((a, b) => b.budget - a.budget);
    return r;
  }, [rows, scope, sort]);

  const totals = useMemo(() => {
    const tasks = filtered.reduce((s, r) => s + r.planned, 0);
    const traj = filtered.reduce((s, r) => s + r.trajectories, 0);
    const budget = filtered.reduce((s, r) => s + r.budget, 0);
    return {
      tasks,
      traj,
      budget,
      avgPerTask: tasks > 0 ? Math.round((budget / tasks) * 100) / 100 : 0,
      avgPerTraj: traj > 0 ? Math.round((budget / traj) * 1000) / 1000 : 0,
    };
  }, [filtered]);

  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="cfo-cost-per-task-view">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <Cpu className="w-3 h-3" /> Unit economics
          </div>
          <div className="font-display font-semibold text-[15px] text-white mt-1">Cost per task &amp; per trajectory</div>
          <div className="text-xs text-zinc-500 mt-0.5">Per-phase breakdown across the portfolio · derived from planned tasks × trajectories</div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1" data-testid="cpt-scope">
            {[
              { k: "all", label: "All" },
              { k: "rnd", label: "R&D" },
              { k: "production", label: "Production" },
            ].map((s) => (
              <button
                key={s.k}
                onClick={() => setScope(s.k)}
                data-testid={`cpt-scope-${s.k}`}
                className={`px-3 py-1 rounded-md text-[11px] font-medium ${scope === s.k ? "bg-fuchsia-500/15 text-fuchsia-200" : "text-zinc-400 hover:text-zinc-100"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Filter className="w-3 h-3 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              data-testid="cpt-sort"
              className="pl-6 pr-2 h-8 rounded-md bg-white/[0.04] border border-white/10 text-[11px] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
            >
              <option value="costPerTask">Sort · Cost / task (high → low)</option>
              <option value="costPerTraj">Sort · Cost / trajectory</option>
              <option value="budget">Sort · Phase budget</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <SummaryCell icon={ListChecks} label="Total tasks" value={totals.tasks.toLocaleString()} testid="cpt-total-tasks" />
        <SummaryCell icon={Layers} label="Total trajectories" value={totals.traj.toLocaleString()} testid="cpt-total-traj" />
        <SummaryCell label="Portfolio budget" value={fmtCurrency(totals.budget, { compact: false })} accent="text-white" testid="cpt-total-budget" />
        <SummaryCell label="Avg cost / task" value={fmtCurrency(totals.avgPerTask, { compact: false })} accent="text-fuchsia-300" testid="cpt-avg-per-task" />
        <SummaryCell label="Avg cost / trajectory" value={`$${totals.avgPerTraj.toFixed(3)}`} accent="text-fuchsia-300" testid="cpt-avg-per-traj" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-xs text-zinc-500">
          No phases match the selected scope.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Project</th>
                <th className="text-left py-2 px-3">Phase</th>
                <th className="text-right py-2 px-3">Planned tasks</th>
                <th className="text-right py-2 px-3">Trajectories</th>
                <th className="text-right py-2 px-3">Phase budget</th>
                <th className="text-right py-2 px-3">Cost / task</th>
                <th className="text-right py-2 px-3">Cost / trajectory</th>
                <th className="text-right py-2 px-3">Actual / task</th>
                <th className="text-right py-2 px-3">Variance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const variance = r.actualPerTask > 0 ? r.actualPerTask - r.costPerTask : null;
                const varPct = r.costPerTask > 0 && variance !== null ? Math.round((variance / r.costPerTask) * 100) : null;
                const varUp = variance !== null && variance > 0;
                return (
                  <tr key={`${r.projectId}-${r.phaseId}`} data-testid={`cpt-row-${r.projectId}-${r.phaseId}`} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="py-2.5 px-3">
                      <Link to={`/projects/${r.projectId}`} className="text-white font-medium hover:text-fuchsia-300">
                        {r.projectName}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-fuchsia-300">{r.phaseName}</td>
                    <td className="py-2.5 px-3 text-right tabular text-zinc-200">{r.planned.toLocaleString() || "—"}</td>
                    <td className="py-2.5 px-3 text-right tabular text-zinc-200">{r.trajectories.toLocaleString() || "—"}</td>
                    <td className="py-2.5 px-3 text-right tabular text-white font-semibold">{fmtCurrency(r.budget, { compact: false })}</td>
                    <td className="py-2.5 px-3 text-right tabular text-fuchsia-300 font-semibold">{r.planned > 0 ? fmtCurrency(r.costPerTask, { compact: false }) : "—"}</td>
                    <td className="py-2.5 px-3 text-right tabular text-fuchsia-300">{r.trajectories > 0 ? `$${r.costPerTraj.toFixed(3)}` : "—"}</td>
                    <td className="py-2.5 px-3 text-right tabular text-zinc-200">{r.actualPerTask > 0 ? fmtCurrency(r.actualPerTask, { compact: false }) : "—"}</td>
                    <td className="py-2.5 px-3 text-right tabular">
                      {variance === null ? (
                        <span className="text-zinc-600 text-[11px]">no logs</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 font-semibold ${varUp ? "text-red-300" : "text-emerald-300"}`}>
                          {varUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {varUp ? "+" : ""}{varPct}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const SummaryCell = ({ icon: Icon, label, value, accent = "text-white", testid }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5" data-testid={testid}>
    <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-0.5">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </div>
    <div className={`text-base font-semibold tabular ${accent}`}>{value}</div>
  </div>
);

export default CostPerTaskView;
