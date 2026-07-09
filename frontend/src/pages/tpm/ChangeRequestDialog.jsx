import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { GitPullRequest, X, Send, Cpu, Server, CreditCard, DollarSign } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { toast } from "sonner";
import { fmtCurrency } from "../../lib/format";

// Bifurcated change request — mirrors TopupRequestDialog structure: per-line ask + note.
const ChangeRequestDialog = ({ open, onOpenChange }) => {
  const { visibleProjects } = useApp();
  const [project, setProject] = useState(visibleProjects[0]?.id || "");
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState("");
  const [tasks, setTasks] = useState("");
  const [timeline, setTimeline] = useState("");
  const [urgency, setUrgency] = useState("Normal");

  const [models, setModels] = useState({ enabled: false, amount: 0, note: "" });
  const [infra, setInfra] = useState({ enabled: false, amount: 0, note: "" });
  const [subs, setSubs] = useState({ enabled: false, amount: 0, note: "" });

  const totalAsk = (models.enabled ? Number(models.amount) || 0 : 0)
    + (infra.enabled ? Number(infra.amount) || 0 : 0)
    + (subs.enabled ? Number(subs.amount) || 0 : 0);

  const submit = () => {
    if (!reason.trim()) return toast.error("Please explain the reason");
    toast.success("Change request submitted", {
      description: `${visibleProjects.find((p) => p.id === project)?.name || "Project"} · ${totalAsk > 0 ? fmtCurrency(totalAsk, { compact: false }) : "no $ ask"} · ${urgency} · routed to CTO`,
    });
    onOpenChange(false);
    setReason(""); setPhase(""); setTasks(""); setTimeline("");
    setModels({ enabled: false, amount: 0, note: "" });
    setInfra({ enabled: false, amount: 0, note: "" });
    setSubs({ enabled: false, amount: 0, note: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="cr-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
              <GitPullRequest className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise change request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Modify scope, timeline, or budget · bifurcated by budget item · routed to CTO for review
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Field label="Project">
            <select value={project} onChange={(e) => setProject(e.target.value)} data-testid="cr-project" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40">
              {visibleProjects.length === 0 && <option value="">— No projects available —</option>}
              {visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.client ? ` · ${p.client}` : ""}</option>)}
            </select>
          </Field>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Budget-item asks (optional)</div>
            <div className="space-y-2">
              <ItemRow testidPrefix="cr-models" icon={Cpu} label="Models" helper="AI model spend delta" value={models} onChange={setModels} />
              <ItemRow testidPrefix="cr-infra" icon={Server} label="Infrastructure" helper="Compute / storage delta" value={infra} onChange={setInfra} />
              <ItemRow testidPrefix="cr-subs" icon={CreditCard} label="Subscriptions" helper="Seat-based tools delta" value={subs} onChange={setSubs} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Total additional ask</span>
              <span className="text-amber-300 font-semibold tabular" data-testid="cr-total">{fmtCurrency(totalAsk, { compact: false })}</span>
            </div>
          </div>

          <Field label="Urgency">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
              {["Low", "Normal", "High"].map((u) => (
                <button key={u} onClick={() => setUrgency(u)} data-testid={`cr-urgency-${u.toLowerCase()}`} className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium ${urgency === u ? "bg-amber-500/15 text-amber-300" : "text-zinc-400 hover:text-zinc-100"}`}>
                  {u}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Affected phase">
            <input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="e.g. Phase 2 — Model tuning" data-testid="cr-phase" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
          </Field>

          <Field label="Affected tasks">
            <input value={tasks} onChange={(e) => setTasks(e.target.value)} placeholder="Task IDs or names, comma-separated" data-testid="cr-tasks" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
          </Field>

          <Field label="Timeline change">
            <input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. Extend by 5 days" data-testid="cr-timeline" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
          </Field>

          <Field label="Justification">
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the change — why is it needed, what changes downstream?" data-testid="cr-reason" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]" data-testid="cr-cancel">
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button onClick={submit} className="bg-amber-500 hover:bg-amber-600 text-black" data-testid="cr-submit">
            <Send className="w-3.5 h-3.5 mr-1.5" /> Submit change request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ItemRow = ({ icon: Icon, label, helper, value, onChange, testidPrefix }) => (
  <div className={`rounded-xl border p-3 transition-colors ${value.enabled ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-white/5 bg-white/[0.02]"}`} data-testid={`${testidPrefix}-row`}>
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange({ ...value, enabled: !value.enabled })}
        data-testid={`${testidPrefix}-toggle`}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${value.enabled ? "border-amber-400 bg-amber-500" : "border-white/20 bg-transparent"}`}
      >
        {value.enabled && <span className="text-[10px] text-black font-bold">✓</span>}
      </button>
      <Icon className={`w-4 h-4 flex-shrink-0 ${value.enabled ? "text-amber-300" : "text-zinc-500"}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${value.enabled ? "text-white" : "text-zinc-400"}`}>{label}</div>
        <div className="text-[10px] text-zinc-500 truncate">{helper}</div>
      </div>
      <div className="relative w-32 flex-shrink-0">
        <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="number"
          min="0"
          step="100"
          value={value.amount}
          disabled={!value.enabled}
          onChange={(e) => onChange({ ...value, amount: Number(e.target.value) || 0 })}
          data-testid={`${testidPrefix}-amount`}
          className={`w-full h-9 pl-7 pr-2 rounded-md bg-white/[0.04] border border-white/10 text-sm text-right tabular focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${value.enabled ? "text-white" : "text-zinc-600"}`}
        />
      </div>
    </div>
    {value.enabled && (
      <input
        value={value.note}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
        placeholder="Line note · e.g. Additional Opus 4.8 runs needed"
        data-testid={`${testidPrefix}-note`}
        className="mt-2 w-full h-8 px-3 rounded-md bg-white/[0.03] border border-white/10 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
      />
    )}
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

export default ChangeRequestDialog;
