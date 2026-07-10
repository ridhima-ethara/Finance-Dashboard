import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { CalendarDays, DollarSign, Send, X, ClipboardList, Layers, ListChecks, StickyNote, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";

// Dialog to log a daily task entry (TPM only). Now supports:
//  • Project picker + Phase picker (inside the dialog)
//  • Estimated cost, tasks done count, progress bar vs phase total, note.
const TpmTaskLogDialog = ({ open, onOpenChange, project, phase, editingLog }) => {
  const { logPhaseTask, updatePhaseTask, getPhaseLogs, visibleProjects, user } = useApp();
  const isEdit = !!editingLog;

  // If a project was passed in (opened from a specific project page), lock to it.
  // Otherwise let the user pick any of their visible projects.
  const projectList = useMemo(() => {
    if (project) return [project];
    return visibleProjects;
  }, [project, visibleProjects]);

  const [projectId, setProjectId] = useState(project?.id || visibleProjects[0]?.id || "");
  const activeProject = useMemo(
    () => projectList.find((p) => p.id === projectId) || project || projectList[0] || null,
    [projectId, projectList, project]
  );
  const projectPhases = useMemo(() => activeProject?.phases || [], [activeProject]);
  const [phaseId, setPhaseId] = useState(phase?.id || projectPhases[0]?.id || "");

  // Keep the selected phase in sync when the project changes
  useEffect(() => {
    if (!projectPhases.find((p) => p.id === phaseId)) {
      setPhaseId(projectPhases[0]?.id || "");
    }
  }, [projectPhases, phaseId]);

  const currentPhase = projectPhases.find((p) => p.id === phaseId) || phase || null;

  const [estCost, setEstCost] = useState(editingLog?.cost ?? 0);
  const [tasksDone, setTasksDone] = useState(editingLog?.tasksDone ?? 1);
  const [trajectories, setTrajectories] = useState(editingLog?.trajectories ?? 0);
  const [date, setDate] = useState(editingLog?.date || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(editingLog?.notes || "");

  const existingLogs = useMemo(() => (activeProject && phaseId ? getPhaseLogs(activeProject.id, phaseId) : []), [activeProject, phaseId, getPhaseLogs]);
  const doneAlready = useMemo(() => existingLogs.reduce((s, l) => s + (Number(l.tasksDone) || 0), 0), [existingLogs]);
  const doneAlreadyExcludingEdit = isEdit ? doneAlready - (Number(editingLog?.tasksDone) || 0) : doneAlready;
  const phaseTotalTasks = Number(currentPhase?.totalTasks || currentPhase?.tasks || activeProject?.totalTasks || 0);
  const projectedDone = doneAlreadyExcludingEdit + (Number(tasksDone) || 0);
  const progressPct = phaseTotalTasks > 0 ? Math.min(100, Math.round((projectedDone / phaseTotalTasks) * 100)) : 0;

  const reset = () => {
    setEstCost(0); setTasksDone(1); setTrajectories(0);
    setDate(new Date().toISOString().slice(0, 10)); setNotes("");
  };

  const submit = () => {
    if (!activeProject) { toast.error("Select a project"); return; }
    if (!phaseId) { toast.error("Select a phase"); return; }
    if (!date) { toast.error("Date is required"); return; }
    if (Number(tasksDone) <= 0) { toast.error("Enter task count"); return; }
    if (Number(trajectories) <= 0) { toast.error("Enter trajectory count"); return; }
    if (!Number(estCost) || Number(estCost) <= 0) { toast.error("Estimated cost is required"); return; }
    const autoName = `${currentPhase?.name || "Phase"} · ${date} · ${tasksDone} task${Number(tasksDone) === 1 ? "" : "s"} · ${trajectories} trajector${Number(trajectories) === 1 ? "y" : "ies"}`;
    const payload = {
      name: autoName,
      assignee: user?.name || "TPM",
      hours: 0,
      cost: Number(estCost) || 0,
      tasksDone: Number(tasksDone) || 0,
      trajectories: Number(trajectories) || 0,
      date,
      notes,
      evidence: "",
    };
    if (isEdit) {
      updatePhaseTask(activeProject.id, phase.id, editingLog.id, payload);
      toast.success("Task log updated", { description: `${activeProject.name} · ${currentPhase?.name || phaseId}` });
    } else {
      logPhaseTask({ projectId: activeProject.id, phaseId, ...payload });
      toast.success("Daily task logged", {
        description: `${activeProject.name} · ${currentPhase?.name || phaseId} · ${tasksDone} task${Number(tasksDone) === 1 ? "" : "s"}`,
      });
      reset();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="task-log-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <ClipboardList className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">{isEdit ? "Edit task log" : "Log daily task"}</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {activeProject?.name ? `${activeProject.name} · ` : ""}pick a phase &amp; record what was delivered today
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
                  {projectList.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#12121A]">
                      {p.name}{p.client ? ` · ${p.client}` : ""}
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
                  {projectPhases.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#12121A]">
                      {activeProject?.name ? `${activeProject.name} · ` : ""}{p.name}{p.totalTasks ? ` · ${p.totalTasks} tasks planned` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          {/* Progress bar for total tasks in phase */}
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
              {progressPct >= 100 && (
                <div className="mt-1.5 text-[10px] text-emerald-300">All planned tasks completed for this phase.</div>
              )}
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tasks *" hint="Count completed in this log">
              <div className="relative">
                <ListChecks className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={tasksDone}
                  onChange={(e) => setTasksDone(Number(e.target.value) || 0)}
                  data-testid="task-tasks-done"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
            </Field>

            <Field label="Trajectories *" hint="Total trajectories used">
              <div className="relative">
                <Layers className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={trajectories}
                  onChange={(e) => setTrajectories(Number(e.target.value) || 0)}
                  data-testid="task-trajectories"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Field label="Estimated cost (USD) *" hint="Spend attributed to this log">
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={estCost}
                  onChange={(e) => setEstCost(Number(e.target.value) || 0)}
                  data-testid="task-cost"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
            </Field>
          </div>

          {(tasksDone > 0 || trajectories > 0) && estCost > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-zinc-500">
              <div>
                Avg cost / task: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(Number(estCost) / Math.max(Number(tasksDone), 1), { compact: false })}</span>
              </div>
              <div>
                Avg cost / trajectory: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(Number(estCost) / Math.max(Number(trajectories), 1), { compact: false })}</span>
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

          <div className="text-[11px] text-zinc-500 leading-relaxed">
            Editable within <span className="text-fuchsia-300 font-semibold">24 hours</span> · locked after that for audit integrity.
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
