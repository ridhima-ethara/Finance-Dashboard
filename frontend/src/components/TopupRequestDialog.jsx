import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { ArrowUpRightSquare, DollarSign, Send, X, Zap, Info } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";

// TPM top-up request dialog — routed to CTO first, then CFO for final sign-off.
const TopupRequestDialog = ({ open, onOpenChange, project, defaultPhaseId }) => {
  const { createTopupRequest, visibleProjects } = useApp();
  const projectList = project ? [project] : visibleProjects;

  const [projectId, setProjectId] = useState(project?.id || projectList[0]?.id || "");
  const activeProject = useMemo(
    () => projectList.find((p) => p.id === projectId) || project,
    [projectId, projectList, project]
  );
  const phases = activeProject?.phases || [];
  const [phaseId, setPhaseId] = useState(defaultPhaseId || phases[0]?.id || "");
  const [amount, setAmount] = useState(2500);
  const [urgency, setUrgency] = useState("Normal");
  const [reason, setReason] = useState("");

  const activePhase = phases.find((ph) => ph.id === phaseId);

  const submit = () => {
    if (!activeProject) { toast.error("Select a project"); return; }
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!reason.trim()) { toast.error("Justification is required"); return; }
    const effectivePhase = activePhase || phases[0] || { id: "general", name: "Project-wide" };
    createTopupRequest({
      projectId: activeProject.id,
      phaseId: effectivePhase.id,
      phaseName: effectivePhase.name,
      amount,
      reason,
      urgency,
    });
    toast.success("Top-up request submitted", {
      description: `${activeProject.name} · $${Number(amount).toLocaleString()} · routed to CTO`,
    });
    setAmount(2500); setReason(""); setUrgency("Normal");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-[#12121A] border border-white/10 text-zinc-100" data-testid="topup-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <ArrowUpRightSquare className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise top-up request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Two-stage approval · CTO reviews first, CFO gives final sign-off
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!project && (
            <Field label="Project">
              <select
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); }}
                data-testid="tur-project"
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                {projectList.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#12121A]">{p.name}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Phase selection removed per product spec — top-up applies project-wide */}


          <div className="grid grid-cols-2 gap-3">
            <Field label="Additional amount (USD)">
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  data-testid="tur-amount"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
            </Field>

            <Field label="Urgency">
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
                {["Low", "Normal", "High"].map((u) => (
                  <button
                    key={u}
                    onClick={() => setUrgency(u)}
                    data-testid={`tur-urgency-${u.toLowerCase()}`}
                    className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${urgency === u ? (u === "High" ? "bg-red-500/15 text-red-300" : "bg-fuchsia-500/15 text-fuchsia-300") : "text-zinc-400 hover:text-zinc-100"}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Justification">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why is the top-up needed? What deliverable does it unlock?"
              data-testid="tur-reason"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </Field>

          <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
            <Zap className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">Flow: </span>
              CTO reviews & may partially approve → CFO gives final sign-off. Approved amount is added to <span className="text-white font-semibold">{activeProject?.name}</span>.
            </div>
          </div>

          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 flex items-start gap-2 text-[11px] text-zinc-500">
            <Info className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
            Partial approvals allowed at both stages — final amount is what CFO signs off.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            data-testid="tur-cancel"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            onClick={submit}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="tur-submit"
          >
            <Send className="w-3.5 h-3.5" /> Submit request
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

export default TopupRequestDialog;
