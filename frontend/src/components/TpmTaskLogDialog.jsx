import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  CalendarDays,
  Send,
  X,
  ClipboardList,
  Layers,
  ListChecks,
  StickyNote,
  FolderKanban,
  Cpu,
  Coins,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { BEDROCK_MODELS } from "../data/mockCatalog";

const buildUsageRow = (seed = {}) => {
  const meta = BEDROCK_MODELS.find((model) => model.id === seed.modelId) || BEDROCK_MODELS[0];
  return {
    id: seed.id || `mdl-${Math.random().toString(36).slice(2, 8)}`,
    modelId: meta?.id || "",
    modelName: seed.modelName || meta?.name || "",
    tasksDone: Number(seed.tasksDone || 0),
    cost: Number(seed.cost || 0),
    inputTokens: Number(seed.inputTokens || 0),
    outputTokens: Number(seed.outputTokens || 0),
  };
};

const buildInitialUsage = (editingLog) => {
  if (Array.isArray(editingLog?.modelUsage) && editingLog.modelUsage.length) {
    return editingLog.modelUsage.map((row) => buildUsageRow(row));
  }
  if (editingLog?.modelId || editingLog?.modelName || editingLog?.cost || editingLog?.tasksDone) {
    return [buildUsageRow(editingLog)];
  }
  return [buildUsageRow()];
};

const TpmTaskLogDialog = ({ open, onOpenChange, project, phase, editingLog }) => {
  const { logPhaseTask, updatePhaseTask, getPhaseLogs, visibleProjects, user } = useApp();
  const isEdit = !!editingLog;

  const projectList = useMemo(() => (project ? [project] : visibleProjects), [project, visibleProjects]);
  const [projectId, setProjectId] = useState(project?.id || visibleProjects[0]?.id || "");
  const activeProject = useMemo(
    () => projectList.find((entry) => entry.id === projectId) || project || projectList[0] || null,
    [projectId, projectList, project]
  );
  const projectPhases = useMemo(() => activeProject?.phases || [], [activeProject]);
  const [phaseId, setPhaseId] = useState(phase?.id || projectPhases[0]?.id || "");

  useEffect(() => {
    if (!projectPhases.find((entry) => entry.id === phaseId)) {
      setPhaseId(projectPhases[0]?.id || "");
    }
  }, [projectPhases, phaseId]);

  const currentPhase = projectPhases.find((entry) => entry.id === phaseId) || phase || null;

  const [trajectories, setTrajectories] = useState(editingLog?.trajectories ?? 0);
  const [date, setDate] = useState(editingLog?.date || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(editingLog?.notes || "");
  const [modelUsage, setModelUsage] = useState(() => buildInitialUsage(editingLog));

  useEffect(() => {
    if (!open) return;
    setTrajectories(editingLog?.trajectories ?? 0);
    setDate(editingLog?.date || new Date().toISOString().slice(0, 10));
    setNotes(editingLog?.notes || "");
    setModelUsage(buildInitialUsage(editingLog));
  }, [editingLog, open]);

  const existingLogs = useMemo(
    () => (activeProject && phaseId ? getPhaseLogs(activeProject.id, phaseId) : []),
    [activeProject, phaseId, getPhaseLogs]
  );
  const doneAlready = useMemo(
    () => existingLogs.reduce((sum, log) => sum + (Number(log.tasksDone) || 0), 0),
    [existingLogs]
  );
  const phaseTotalTasks = Number(currentPhase?.totalTasks || currentPhase?.tasks || activeProject?.totalTasks || 0);

  const taskTotal = useMemo(
    () => modelUsage.reduce((sum, row) => sum + Number(row.tasksDone || 0), 0),
    [modelUsage]
  );
  const costTotal = useMemo(
    () => modelUsage.reduce((sum, row) => sum + Number(row.cost || 0), 0),
    [modelUsage]
  );
  const inputTokenTotal = useMemo(
    () => modelUsage.reduce((sum, row) => sum + Number(row.inputTokens || 0), 0),
    [modelUsage]
  );
  const outputTokenTotal = useMemo(
    () => modelUsage.reduce((sum, row) => sum + Number(row.outputTokens || 0), 0),
    [modelUsage]
  );
  const doneAlreadyExcludingEdit = isEdit ? doneAlready - (Number(editingLog?.tasksDone) || 0) : doneAlready;
  const projectedDone = doneAlreadyExcludingEdit + taskTotal;
  const progressPct = phaseTotalTasks > 0 ? Math.min(100, Math.round((projectedDone / phaseTotalTasks) * 100)) : 0;
  const primaryUsage = [...modelUsage].sort((left, right) => Number(right.cost || 0) - Number(left.cost || 0))[0];

  const updateUsageRow = (id, key, value) => {
    setModelUsage((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, [key]: value };
      if (key === "modelId") {
        const meta = BEDROCK_MODELS.find((model) => model.id === value);
        next.modelName = meta?.name || "";
      }
      if (["tasksDone", "cost", "inputTokens", "outputTokens"].includes(key)) {
        next[key] = Number(value || 0);
      }
      return next;
    }));
  };

  const addUsageRow = () => setModelUsage((rows) => [...rows, buildUsageRow()]);
  const removeUsageRow = (id) => setModelUsage((rows) => rows.length > 1 ? rows.filter((row) => row.id !== id) : rows);

  const reset = () => {
    setTrajectories(0);
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setModelUsage([buildUsageRow()]);
  };

  const submit = () => {
    if (!activeProject) { toast.error("Select a project"); return; }
    if (!phaseId) { toast.error("Select a phase"); return; }
    if (!date) { toast.error("Date is required"); return; }
    if (taskTotal <= 0) { toast.error("Enter task count for at least one model"); return; }
    if (Number(trajectories) <= 0) { toast.error("Enter trajectory count"); return; }
    if (costTotal <= 0) { toast.error("Enter model costing"); return; }
    if (modelUsage.some((row) => !row.modelId)) { toast.error("Select a model for each usage row"); return; }

    const autoName = `${currentPhase?.name || "Phase"} · ${date} · ${taskTotal} task${taskTotal === 1 ? "" : "s"} · ${trajectories} trajector${Number(trajectories) === 1 ? "y" : "ies"}`;
    const payload = {
      name: autoName,
      assignee: user?.name || "TPM",
      hours: 0,
      cost: costTotal,
      tasksDone: taskTotal,
      trajectories: Number(trajectories) || 0,
      date,
      notes,
      evidence: "",
      modelId: primaryUsage?.modelId || "",
      modelName: primaryUsage?.modelName || "",
      inputTokens: inputTokenTotal,
      outputTokens: outputTokenTotal,
      modelUsage,
    };

    if (isEdit) {
      updatePhaseTask(activeProject.id, phase?.id || phaseId, editingLog.id, payload);
      toast.success("Task log updated", { description: `${activeProject.name} · ${currentPhase?.name || phaseId}` });
    } else {
      logPhaseTask({ projectId: activeProject.id, phaseId, ...payload });
      toast.success("Daily task logged", {
        description: `${activeProject.name} · ${currentPhase?.name || phaseId} · ${taskTotal} task${taskTotal === 1 ? "" : "s"}`,
      });
      reset();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="task-log-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <ClipboardList className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">{isEdit ? "Edit task log" : "Log daily task"}</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {activeProject?.name ? `${activeProject.name} · ` : ""}capture per-model task split, costing, and token usage
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!isEdit && !project && projectList.length > 0 && (
            <Field label="Project *">
              <div className="relative">
                <FolderKanban className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  data-testid="task-project"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  {projectList.map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                      {entry.name}{entry.client ? ` · ${entry.client}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          {!isEdit && (
            <Field label="Phase *">
              <div className="relative">
                <Layers className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={phaseId}
                  onChange={(e) => setPhaseId(e.target.value)}
                  data-testid="task-phase"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  {projectPhases.length === 0 && <option value="">— No phases available —</option>}
                  {projectPhases.map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                      {activeProject?.name ? `${activeProject.name} · ` : ""}{entry.name}{entry.totalTasks ? ` · ${entry.totalTasks} tasks planned` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          {phaseTotalTasks > 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3" data-testid="task-progress">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                <span className="flex items-center gap-1"><ListChecks className="w-3 h-3 text-fuchsia-300" /> Phase progress</span>
                <span className="tabular">
                  <span className="text-white font-semibold">{projectedDone.toLocaleString()}</span>
                  <span className="text-zinc-500"> / {phaseTotalTasks.toLocaleString()} tasks</span>
                  <span className="ml-2 text-fuchsia-300 font-semibold">{progressPct}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${progressPct}%` }} data-testid="task-progress-bar" />
              </div>
            </div>
          )}

          <Field label="Date *">
            <div className="relative">
              <CalendarDays className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="task-date"
                className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
          </Field>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="task-model-usage">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-fuchsia-300" /> Model usage
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Multi-model split with per-model task count, costing, and input/output tokens.</div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={addUsageRow}
                data-testid="task-add-model-row"
                className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1"
              >
                <Plus className="w-3 h-3" /> Add model
              </Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[1.8fr_.7fr_.9fr_1fr_1fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
                <span>Model</span>
                <span className="text-right">Tasks</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Input tokens</span>
                <span className="text-right">Output tokens</span>
                <span />
              </div>
              {modelUsage.map((row) => (
                <div key={row.id} className="grid grid-cols-[1.8fr_.7fr_.9fr_1fr_1fr_28px] gap-2 items-center">
                  <select
                    value={row.modelId}
                    onChange={(e) => updateUsageRow(row.id, "modelId", e.target.value)}
                    data-testid={`task-model-${row.id}`}
                    className={rowInp}
                  >
                    {BEDROCK_MODELS.map((model) => (
                      <option key={model.id} value={model.id} className="bg-[#12121A]">
                        {model.name} · {model.provider}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={row.tasksDone}
                    onChange={(e) => updateUsageRow(row.id, "tasksDone", e.target.value)}
                    data-testid={`task-model-tasks-${row.id}`}
                    className={`${rowInp} text-right tabular`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.cost}
                    onChange={(e) => updateUsageRow(row.id, "cost", e.target.value)}
                    data-testid={`task-model-cost-${row.id}`}
                    className={`${rowInp} text-right tabular`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={row.inputTokens}
                    onChange={(e) => updateUsageRow(row.id, "inputTokens", e.target.value)}
                    data-testid={`task-model-input-${row.id}`}
                    className={`${rowInp} text-right tabular`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={row.outputTokens}
                    onChange={(e) => updateUsageRow(row.id, "outputTokens", e.target.value)}
                    data-testid={`task-model-output-${row.id}`}
                    className={`${rowInp} text-right tabular`}
                  />
                  <button
                    type="button"
                    onClick={() => removeUsageRow(row.id)}
                    data-testid={`task-remove-model-row-${row.id}`}
                    className="w-7 h-7 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Field label="Total tasks">
              <div className={`${summaryInp} text-white`} data-testid="task-total-tasks">{taskTotal.toLocaleString()}</div>
            </Field>
            <Field label="Trajectories *">
              <input
                type="number"
                min="1"
                step="1"
                value={trajectories}
                onChange={(e) => setTrajectories(Number(e.target.value) || 0)}
                data-testid="task-trajectories"
                className={`${summaryInp} tabular`}
              />
            </Field>
            <Field label="Total cost">
              <div className={`${summaryInp} text-fuchsia-300`} data-testid="task-total-cost">{fmtCurrency(costTotal, { compact: false })}</div>
            </Field>
            <Field label="Input tokens">
              <div className={`${summaryInp} text-zinc-200`} data-testid="task-total-input">{inputTokenTotal.toLocaleString()}</div>
            </Field>
            <Field label="Output tokens">
              <div className={`${summaryInp} text-zinc-200`} data-testid="task-total-output">{outputTokenTotal.toLocaleString()}</div>
            </Field>
          </div>

          {(taskTotal > 0 || trajectories > 0) && costTotal > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-zinc-500">
              <div>
                Avg cost / task: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(costTotal / Math.max(taskTotal, 1), { compact: false })}</span>
              </div>
              <div>
                Avg cost / trajectory: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(costTotal / Math.max(Number(trajectories), 1), { compact: false })}</span>
              </div>
              <div>
                Tokens / task: <span className="text-fuchsia-300 font-semibold tabular">{Math.round((inputTokenTotal + outputTokenTotal) / Math.max(taskTotal, 1)).toLocaleString()}</span>
              </div>
            </div>
          )}

          <Field label="Note / remark" hint="Optional">
            <div className="relative">
              <StickyNote className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Progress notes, blockers, or handoff context"
                data-testid="task-notes"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
            </div>
          </Field>

          <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2 text-[11px] text-zinc-300">
            <Coins className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            Logged totals roll into the non-CFO dashboards as owned consumption, while CFO still retains the actual-vs-approved finance view.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            data-testid="task-log-cancel"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            onClick={submit}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="task-log-submit"
          >
            <Send className="w-3.5 h-3.5" /> {isEdit ? "Save changes" : "Log task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const rowInp = "w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";
const summaryInp = "w-full h-10 px-3 rounded-lg bg-white/[0.03] border border-white/5 text-sm flex items-center";

const Field = ({ label, hint, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      {hint && <div className="text-[10px] text-zinc-600">{hint}</div>}
    </div>
    {children}
  </div>
);

export default TpmTaskLogDialog;
