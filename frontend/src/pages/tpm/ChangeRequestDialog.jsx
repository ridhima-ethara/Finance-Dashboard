import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { GitPullRequest, X, Send } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { toast } from "sonner";

const ChangeRequestDialog = ({ open, onOpenChange }) => {
  const { visibleProjects } = useApp();
  const [project, setProject] = useState(visibleProjects[0]?.id || "");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState("");
  const [tasks, setTasks] = useState("");
  const [timeline, setTimeline] = useState("");
  const [urgency, setUrgency] = useState("Normal");

  const submit = () => {
    if (!reason.trim()) return toast.error("Please explain the reason");
    toast.success("Change request submitted", {
      description: `${visibleProjects.find((p) => p.id === project)?.name || "Project"} · ${urgency} · routed for CTO review`,
    });
    onOpenChange(false);
    setReason(""); setAmount(""); setPhase(""); setTasks(""); setTimeline("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-[#12121A] border border-white/10 text-zinc-100" data-testid="cr-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
              <GitPullRequest className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise change request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Modify scope, timeline, or budget · routed to CTO for review
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Field label="Project">
            <select value={project} onChange={(e) => setProject(e.target.value)} data-testid="cr-project" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40">
              {visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Additional budget (optional)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" data-testid="cr-amount" className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
              </div>
            </Field>
            <Field label="Urgency">
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
                {["Low", "Normal", "High"].map((u) => (
                  <button key={u} onClick={() => setUrgency(u)} data-testid={`cr-urgency-${u.toLowerCase()}`} className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium ${urgency === u ? "bg-amber-500/15 text-amber-300" : "text-zinc-400 hover:text-zinc-100"}`}>
                    {u}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Affected phase">
            <input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="e.g. Phase 2 — Model tuning" data-testid="cr-phase" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
          </Field>

          <Field label="Affected tasks">
            <input value={tasks} onChange={(e) => setTasks(e.target.value)} placeholder="Task IDs or names, comma-separated" data-testid="cr-tasks" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
          </Field>

          <Field label="Timeline change">
            <input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. Extend by 5 days" data-testid="cr-timeline" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
          </Field>

          <Field label="Reason">
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the change — why is it needed, what changes downstream?" data-testid="cr-reason" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]" data-testid="cr-cancel">
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
          <Button onClick={submit} className="bg-amber-500 hover:bg-amber-600 text-black" data-testid="cr-submit">
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Submit change request
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

export default ChangeRequestDialog;
