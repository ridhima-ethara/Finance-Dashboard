import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { PROJECTS } from "../../data/mockProjects";
import { getPhaseTasks } from "../../data/mockTpm";
import { fmtCurrency, fmtPct } from "../../lib/format";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Cpu,
  Server,
  User,
  Plus,
  Filter,
  ChevronRight,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "../../components/ui/button";

const statusStyles = {
  done: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", Icon: CheckCircle2 },
  "in-progress": { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30", text: "text-fuchsia-300", Icon: Clock3 },
  planned: { bg: "bg-white/[0.04]", border: "border-white/10", text: "text-zinc-400", Icon: Circle },
};

const PhaseWorkspace = () => {
  const { id, phaseId } = useParams();
  const nav = useNavigate();
  const { visibleProjects } = useApp();
  const [statusFilter, setStatusFilter] = useState("all");

  const project = useMemo(
    () => visibleProjects.find((p) => p.id === id) || PROJECTS.find((p) => p.id === id),
    [id, visibleProjects]
  );
  const phase = project?.phases?.find((ph) => ph.id === phaseId);
  const tasks = useMemo(() => getPhaseTasks(id, phaseId), [id, phaseId]);

  if (!project || !phase) {
    return (
      <div className="text-sm text-zinc-400">
        Phase not found.{" "}
        <button onClick={() => nav(-1)} className="text-fuchsia-300 underline">
          Go back
        </button>
      </div>
    );
  }

  const filteredTasks = tasks.filter((t) => (statusFilter === "all" ? true : t.status === statusFilter));
  const totalEst = tasks.reduce((s, t) => s + t.estCost, 0);
  const totalActual = tasks.reduce((s, t) => s + t.actualCost, 0);
  const totalVariance = totalEst - totalActual;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const inProgressCount = tasks.filter((t) => t.status === "in-progress").length;
  const plannedCount = tasks.filter((t) => t.status === "planned").length;
  const completion = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const utilization = phase.estimated ? Math.round((phase.actual / phase.estimated) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="page-phase-workspace">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link to={`/projects/${project.id}`} className="hover:text-zinc-300 inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              {project.name}
            </Link>
            <span>/</span>
            <span>Phase Workspace</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-sky-300">
            <Target className="w-3 h-3" />
            Phase workspace
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">{phase.name}</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {phase.dates} · {project.client} · {tasks.length} tasks · owner: <span className="text-zinc-200">{project.tpm}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2"
            data-testid="btn-add-task"
          >
            <Plus className="w-3.5 h-3.5" /> Add task
          </Button>
          <Button className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2" data-testid="btn-mark-complete">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark phase complete
          </Button>
        </div>
      </div>

      {/* Phase Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Estimated" value={fmtCurrency(phase.estimated)} icon={Cpu} testid="stat-estimated" />
        <StatCard label="Actual" value={fmtCurrency(phase.actual)} icon={Server} testid="stat-actual" tone="magenta" />
        <StatCard
          label="Variance"
          value={fmtCurrency(Math.abs(totalVariance), { compact: false })}
          sub={totalVariance >= 0 ? "under estimate" : "over estimate"}
          icon={totalVariance >= 0 ? TrendingUp : TrendingDown}
          tone={totalVariance >= 0 ? "positive" : "negative"}
          testid="stat-variance"
        />
        <StatCard
          label="Utilization"
          value={fmtPct(utilization)}
          sub={utilization > 100 ? "over" : "on track"}
          tone={utilization > 100 ? "negative" : utilization > 90 ? "warning" : "positive"}
          testid="stat-utilization"
        />
        <StatCard
          label="Completion"
          value={fmtPct(completion)}
          sub={`${doneCount} of ${tasks.length} done`}
          tone="magenta"
          testid="stat-completion"
        />
        <StatCard
          label="Task health"
          value={
            phase.health === "healthy" ? "Healthy" : phase.health === "watch" ? "Watch" : phase.health === "over" ? "Over" : "—"
          }
          tone={phase.health === "healthy" ? "positive" : phase.health === "watch" ? "warning" : "negative"}
          testid="stat-health"
        />
      </div>

      {/* Progress bar */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="progress-panel">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display font-semibold text-[14px] text-white">Phase progress</div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Done · {doneCount}
            </span>
            <span className="flex items-center gap-1.5 text-fuchsia-300">
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" /> In-progress · {inProgressCount}
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> Planned · {plannedCount}
            </span>
          </div>
        </div>
        <div className="relative h-3 rounded-full bg-white/[0.05] overflow-hidden flex">
          <div className="h-full bg-emerald-500/80" style={{ width: `${(doneCount / tasks.length) * 100}%` }} />
          <div className="h-full bg-fuchsia-500/80" style={{ width: `${(inProgressCount / tasks.length) * 100}%` }} />
          <div className="h-full bg-white/[0.06]" style={{ width: `${(plannedCount / tasks.length) * 100}%` }} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mr-2">
          <Filter className="w-3 h-3 inline mr-1" />
          Filter
        </span>
        {["all", "planned", "in-progress", "done"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            data-testid={`filter-${s}`}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize ${
              statusFilter === s
                ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {s === "all" ? `All (${tasks.length})` : `${s} (${tasks.filter((t) => t.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden" data-testid="tasks-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                <th className="text-left py-3 px-4">Task</th>
                <th className="text-left py-3 px-4">Owner</th>
                <th className="text-left py-3 px-4">Model</th>
                <th className="text-left py-3 px-4">Infra</th>
                <th className="text-right py-3 px-4">Estimated</th>
                <th className="text-right py-3 px-4">Actual</th>
                <th className="text-right py-3 px-4">Variance</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                const s = statusStyles[t.status] || statusStyles.planned;
                return (
                  <tr key={t.id} data-testid={`task-${t.id}`} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{t.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-zinc-300 text-xs">
                        <User className="w-3 h-3 text-zinc-500" />
                        {t.owner}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-fuchsia-300">{t.model}</td>
                    <td className="py-3 px-4 text-xs text-zinc-400">{t.infra}</td>
                    <td className="py-3 px-4 text-right text-zinc-200 tabular">{fmtCurrency(t.estCost, { compact: false })}</td>
                    <td className="py-3 px-4 text-right text-white font-semibold tabular">
                      {t.actualCost > 0 ? fmtCurrency(t.actualCost, { compact: false }) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right tabular">
                      {t.actualCost > 0 ? (
                        <span className={t.variance >= 0 ? "text-emerald-300" : "text-red-300"}>
                          {t.variance >= 0 ? "+" : ""}
                          {fmtCurrency(t.variance, { compact: false })}
                        </span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border ${s.bg} ${s.border} ${s.text}`}
                      >
                        <s.Icon className="w-3 h-3" />
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </td>
                  </tr>
                );
              })}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-zinc-500">
                    No tasks match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI insight */}
      <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-zinc-300">
          <span className="text-fuchsia-200 font-semibold">Phase insight: </span>
          {inProgressCount > 0 ? (
            <>
              {inProgressCount} task{inProgressCount > 1 ? "s" : ""} in progress consuming{" "}
              <span className="text-fuchsia-300 font-semibold">
                {fmtCurrency(
                  tasks.filter((t) => t.status === "in-progress").reduce((s, t) => s + t.actualCost, 0),
                  { compact: false }
                )}
              </span>
              . At this pace, phase will complete{" "}
              <span className={totalVariance >= 0 ? "text-emerald-300" : "text-red-300"}>
                {totalVariance >= 0 ? "under estimate by " : "over estimate by "}
                {fmtCurrency(Math.abs(totalVariance))}
              </span>
              .
            </>
          ) : (
            <>All tasks planned. Estimated total: {fmtCurrency(totalEst, { compact: false })}.</>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, icon: Icon, tone = "neutral", testid }) => {
  const tones = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-zinc-200",
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

export default PhaseWorkspace;
