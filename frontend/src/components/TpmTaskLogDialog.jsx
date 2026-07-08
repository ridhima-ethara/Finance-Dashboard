import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { CalendarDays, Clock3, DollarSign, Paperclip, Send, User as UserIcon, X, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { TEAM } from "../data/mockUsers";

// Dialog to log a daily task entry against a specific project/phase (TPM only).
const TpmTaskLogDialog = ({ open, onOpenChange, project, phase, editingLog }) => {
  const { logPhaseTask, updatePhaseTask } = useApp();
  const isEdit = !!editingLog;
  const [name, setName] = useState(editingLog?.name || "");
  const [assignee, setAssignee] = useState(editingLog?.assignee || TEAM[0]?.name || "");
  const [hours, setHours] = useState(editingLog?.hours ?? 4);
  const [cost, setCost] = useState(editingLog?.cost ?? 0);
  const [date, setDate] = useState(editingLog?.date || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(editingLog?.notes || "");
  const [evidence, setEvidence] = useState(editingLog?.evidence || "");

  const reset = () => {
    setName(""); setAssignee(TEAM[0]?.name || ""); setHours(4); setCost(0);
    setDate(new Date().toISOString().slice(0, 10)); setNotes(""); setEvidence("");
  };

  const submit = () => {
    if (!name.trim()) { toast.error("Task name is required"); return; }
    if (!assignee) { toast.error("Assignee is required"); return; }
    if (!date) { toast.error("Date is required"); return; }
    if (isEdit) {
      updatePhaseTask(project.id, phase.id, editingLog.id, { name, assignee, hours, cost, date, notes, evidence });
      toast.success("Task log updated", { description: `${project.name} · ${phase.name}` });
    } else {
      logPhaseTask({ projectId: project.id, phaseId: phase.id, name, assignee, hours, cost, date, notes, evidence });
      toast.success("Daily task logged", { description: `${project.name} · ${phase.name} · ${assignee} · ${hours}h` });
      reset();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-[#12121A] border border-white/10 text-zinc-100" data-testid="task-log-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <ClipboardList className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">{isEdit ? "Edit task log" : "Log daily task"}</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {project?.name} · {phase?.name} · visible to CTO & CFO
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Field label="Task name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Opus 4.8 fine-tune sweep · run 12"
              data-testid="task-name"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Assignee">
              <div className="relative">
                <UserIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  data-testid="task-assignee"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  {TEAM.map((m) => (
                    <option key={m.id} value={m.name} className="bg-[#12121A]">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label="Date">
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Hours spent">
              <div className="relative">
                <Clock3 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value) || 0)}
                  data-testid="task-hours"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
            </Field>

            <Field label="Cost incurred (USD)">
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value) || 0)}
                  data-testid="task-cost"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Progress notes, blockers, or handoff context"
              data-testid="task-notes"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </Field>

          <Field label="Evidence link (optional)">
            <div className="relative">
              <Paperclip className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="PR URL, dashboard screenshot, doc link…"
                data-testid="task-evidence"
                className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
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

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

export default TpmTaskLogDialog;
