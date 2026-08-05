import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronRight, Cpu, Database, RefreshCw } from "lucide-react";
import { fmtCurrency } from "../lib/format";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const number = (value) => Number(value || 0);
const totalTokens = (totals = {}) => number(totals.input_tokens) + number(totals.output_tokens) + number(totals.input_cache_tokens) + number(totals.output_cache_tokens);
const statusStyle = (status = "") => {
  const normalized = status.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "passed") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (normalized === "rerun") return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  return "bg-red-500/10 text-red-300 border-red-500/20";
};

const kaijuDemoSnapshot = (project, phase, date) => {
  const task = (taskId, member, status, trajectories) => {
    const totals = trajectories.reduce((sum, trajectory) => ({ input_tokens: sum.input_tokens + trajectory.totals.input_tokens, output_tokens: sum.output_tokens + trajectory.totals.output_tokens, input_cache_tokens: sum.input_cache_tokens + trajectory.totals.input_cache_tokens, output_cache_tokens: sum.output_cache_tokens + trajectory.totals.output_cache_tokens, cost: sum.cost + trajectory.totals.cost }), { input_tokens: 0, output_tokens: 0, input_cache_tokens: 0, output_cache_tokens: 0, cost: 0 });
    const models = Object.values(trajectories.reduce((map, trajectory) => { const model = trajectory.model; const current = map[model.model_id] || { ...model, input_tokens: 0, output_tokens: 0, input_cache_tokens: 0, output_cache_tokens: 0, cost: 0, trajectory_count: 0 }; Object.keys(totals).forEach((key) => { current[key] += Number(trajectory.totals[key] || 0); }); current.trajectory_count += 1; map[model.model_id] = current; return map; }, {}));
    return { task_id: taskId, status, assignee: { member_id: member.toLowerCase().replace(/\s/g, "-"), member_name: member }, trajectory_count: trajectories.length, totals, models, trajectories };
  };
  const trajectory = (id, member, modelId, modelName, input, output, cache, cost) => ({ trajectory_id: id, assignee: { member_name: member }, model: { model_id: modelId, model_name: modelName }, totals: { input_tokens: input, output_tokens: output, input_cache_tokens: cache, output_cache_tokens: 0, cost } });
  const tasks = [
    task("KAIJU-TASK-184", "Aarav Sharma", "passed", [trajectory("TRJ-184-01", "Aarav Sharma", "gpt-4o", "GPT-4o", 124800, 8400, 18200, 1.42), trajectory("TRJ-184-02", "Aarav Sharma", "claude-sonnet", "Claude Sonnet", 96300, 7100, 12600, 1.18)]),
    task("KAIJU-TASK-185", "Meera Nair", "rerun", [trajectory("TRJ-185-01", "Meera Nair", "claude-sonnet", "Claude Sonnet", 142500, 9800, 21400, 1.73), trajectory("TRJ-185-02", "Meera Nair", "claude-sonnet", "Claude Sonnet", 131200, 8900, 19600, 1.55), trajectory("TRJ-185-03", "Meera Nair", "gpt-4o", "GPT-4o", 108400, 7600, 15000, 1.29)]),
    task("KAIJU-TASK-186", "Kabir Singh", "failed", [trajectory("TRJ-186-01", "Kabir Singh", "gemini-pro", "Gemini 2.5 Pro", 78400, 5200, 9300, 0.84)]),
  ];
  const totals = tasks.reduce((sum, entry) => { Object.keys(sum).forEach((key) => { if (key === "task_count" || key === "trajectory_count") return; sum[key] += Number(entry.totals[key] || 0); }); sum.task_count += 1; sum.trajectory_count += entry.trajectory_count; return sum; }, { input_tokens: 0, output_tokens: 0, input_cache_tokens: 0, output_cache_tokens: 0, cost: 0, task_count: 0, trajectory_count: 0 });
  const statusBreakdown = ["passed", "failed", "rerun"].reduce((result, status) => { const matching = tasks.filter((entry) => entry.status === status); result[status] = { count: matching.length, cost: matching.reduce((sum, entry) => sum + entry.totals.cost, 0), trajectory_count: matching.reduce((sum, entry) => sum + entry.trajectory_count, 0) }; return result; }, {});
  return { generated_at: new Date().toISOString(), range: { from: date, to: date }, demo: true, project_id: project.id, overall: { phase_id: phase?.id, phase_name: phase?.name, totals, status_breakdown: statusBreakdown, tasks } };
};

const DailyTaskApiDialog = ({ open, onOpenChange, project, phase, initialDate = "" }) => {
  const [date, setDate] = useState(localDate);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (open && initialDate) setDate(String(initialDate).slice(0, 10));
  }, [open, initialDate]);

  const load = async () => {
    if (!project?.id || !open) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ project_id: project.id, from: date, to: date });
    if (phase?.id) params.set("phase_id", phase.id);
    try {
      const response = await fetch(`${BACKEND_URL}/api/task-log/analytics?${params.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Unable to load task activity");
      setSnapshot(payload);
    } catch (requestError) {
      if (String(project?.name || "").trim().toLowerCase() === "kaiju") {
        setSnapshot(kaijuDemoSnapshot(project, phase, date));
        setError("");
      } else {
        setSnapshot(null);
        setError(requestError.message || "Unable to load task activity");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // load is intentionally tied to the selected project, phase, date and open state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id, phase?.id, date]);

  const scope = useMemo(() => {
    if (!snapshot) return null;
    if (snapshot.is_phase_based && Array.isArray(snapshot.phases)) {
      return snapshot.phases.find((entry) => entry.phase_id === phase?.id || entry.phase_name === phase?.name) || snapshot.phases[0] || snapshot.overall;
    }
    return snapshot.overall || snapshot;
  }, [snapshot, phase?.id, phase?.name]);
  const tasks = scope?.tasks || [];
  const totals = scope?.totals || {};
  const statusBreakdown = scope?.status_breakdown || {};

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto bg-[#0F0F17] text-zinc-100 border-white/10" data-testid="daily-task-api-dialog">
      <DialogHeader>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300"><Database className="h-3.5 w-3.5" /> Automated task activity</div>
        <DialogTitle className="text-xl text-white">{project?.name} · {phase?.name || "Project"}</DialogTitle>
        <DialogDescription className="text-xs text-zinc-400">Read-only activity from the task analytics API. A task may use multiple models; each individual trajectory uses exactly one model.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-3">
        <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Activity date</span><div className="relative"><CalendarDays className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-9 rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-xs text-zinc-100" data-testid="task-api-date" /></div></label>
        <div className="flex items-center gap-2">{snapshot?.demo && <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-amber-300">Kaiju API preview</span>}<span className="text-[10px] text-zinc-500">{snapshot?.generated_at ? `Generated ${new Date(snapshot.generated_at).toLocaleString()}` : "Live API snapshot"}</span><Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 gap-1.5 border-white/10 bg-white/[0.03] text-zinc-300"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Fetch task log</Button></div>
      </div>

      {loading && <div className="rounded-xl border border-white/5 py-16 text-center text-sm text-zinc-500"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin text-fuchsia-300" />Loading API activity…</div>}
      {!loading && error && <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-5 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-amber-300" /><div className="mt-2 text-sm font-semibold text-amber-200">Task activity is unavailable</div><div className="mx-auto mt-1 max-w-xl text-xs text-zinc-400">{error}</div><div className="mt-2 text-[10px] text-zinc-500">Configure TASK_LOG_API_URL on the backend to connect the serving API.</div></div>}

      {!loading && !error && scope && <>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Tasks" value={number(totals.task_count || tasks.length).toLocaleString()} />
          <Metric label="Trajectories" value={number(totals.trajectory_count || tasks.reduce((sum, task) => sum + number(task.trajectory_count), 0)).toLocaleString()} tone="magenta" />
          <Metric label="Tokens" value={totalTokens(totals).toLocaleString()} />
          <Metric label="Cost" value={fmtCurrency(number(totals.cost), { compact: false })} tone="positive" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Token breakdown</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini label="Input" value={number(totals.input_tokens)} /><Mini label="Output" value={number(totals.output_tokens)} /><Mini label="Input cache" value={number(totals.input_cache_tokens)} /><Mini label="Output cache" value={number(totals.output_cache_tokens)} /></div>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 lg:min-w-[260px]">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Status</div>
            <div className="flex flex-wrap gap-2">{["passed", "failed", "rerun"].map((key) => { const entry = statusBreakdown[key] || statusBreakdown[key === "rerun" ? "re_run" : key] || {}; return <span key={key} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusStyle(key)}`}>{key === "rerun" ? "Re-run" : key} · {number(entry.count)}</span>; })}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/5" data-testid="task-api-list">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 bg-white/[0.025] px-3 py-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-500"><span>Task and member</span><span>Trajectories</span><span>Models</span><span className="text-right">Cost</span></div>
          {tasks.map((task) => {
            const openTask = Boolean(expanded[task.task_id]);
            const models = task.models || [];
            const trajectories = task.trajectories || [];
            return <div key={task.task_id} className="border-t border-white/[0.04]">
              <button type="button" onClick={() => setExpanded((current) => ({ ...current, [task.task_id]: !openTask }))} className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-3 text-left hover:bg-white/[0.02]">
                <div className="flex min-w-0 items-center gap-2">{openTask ? <ChevronDown className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />}<div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-xs font-semibold text-white">{task.task_id}</span><span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${statusStyle(task.status)}`}>{task.status}</span></div><div className="mt-0.5 truncate text-[10px] text-zinc-500">{task.assignee?.member_name || "Unassigned"}</div></div></div>
                <span className="text-xs tabular text-zinc-300">{number(task.trajectory_count || trajectories.length)}</span>
                <span className="max-w-[180px] truncate text-[10px] text-zinc-400">{models.map((model) => model.model_name).join(", ") || "—"}</span>
                <span className="text-right text-xs font-semibold tabular text-fuchsia-300">{fmtCurrency(number(task.totals?.cost), { compact: false })}</span>
              </button>
              {openTask && <div className="bg-white/[0.015] px-4 pb-3 pt-2">{models.length > 0 && <><div className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Task model usage</div><div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{models.map((model) => <div key={model.model_id || model.model_name} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5"><div className="text-[11px] font-semibold text-zinc-200">{model.model_name}</div><div className="mt-1 flex justify-between text-[9px] text-zinc-500"><span>{number(model.trajectory_count)} trajectories</span><span>{totalTokens(model).toLocaleString()} tokens</span><b className="text-fuchsia-300">{fmtCurrency(number(model.cost), { compact: false })}</b></div></div>)}</div></>}<div className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Trajectories · one model per trajectory</div>{trajectories.length ? <div className="space-y-1.5">{trajectories.map((trajectory) => <Trajectory key={trajectory.trajectory_id} trajectory={trajectory} />)}</div> : <div className="rounded-lg border border-dashed border-white/10 py-4 text-center text-[10px] text-zinc-500">No trajectory details returned for this task.</div>}</div>}
            </div>;
          })}
          {!tasks.length && <div className="py-12 text-center"><Cpu className="mx-auto h-6 w-6 text-zinc-600" /><div className="mt-2 text-sm font-semibold text-zinc-300">No task activity for this day</div><div className="mt-1 text-xs text-zinc-500">The API returned no tasks for the selected activity date.</div></div>}
        </div>
      </>}
    </DialogContent>
  </Dialog>;
};

const Metric = ({ label, value, tone = "neutral" }) => { const color = tone === "positive" ? "text-emerald-300" : tone === "magenta" ? "text-fuchsia-300" : "text-white"; return <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3"><div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div><div className={`mt-1 text-xl font-display font-semibold tabular ${color}`}>{value}</div></div>; };
const Mini = ({ label, value }) => <div className="rounded-lg bg-white/[0.025] px-2.5 py-2"><div className="text-[9px] uppercase tracking-widest text-zinc-500">{label}</div><div className="mt-0.5 text-xs font-semibold tabular text-zinc-200">{number(value).toLocaleString()}</div></div>;
const Trajectory = ({ trajectory }) => {
  // Contract correction: one trajectory has exactly one model. Accept model{}
  // primarily and models[0] only for compatibility with the draft contract.
  const model = trajectory.model || trajectory.models?.[0] || {};
  return <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-3 rounded-lg border border-white/5 bg-[#12121A] px-3 py-2 text-[10px]"><div><div className="font-semibold text-zinc-200">{trajectory.trajectory_id}</div><div className="text-zinc-500">{trajectory.assignee?.member_name || "Unassigned"}</div></div><div><div className="flex items-center gap-1 text-zinc-300"><Cpu className="h-3 w-3 text-fuchsia-300" />{model.model_name || "Unknown model"}</div><div className="text-zinc-500">One model</div></div><div className="text-right tabular text-zinc-400">{totalTokens(trajectory.totals).toLocaleString()} tokens</div><div className="text-right font-semibold tabular text-fuchsia-300">{fmtCurrency(number(trajectory.totals?.cost), { compact: false })}</div></div>;
};

export default DailyTaskApiDialog;
