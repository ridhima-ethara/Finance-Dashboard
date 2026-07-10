import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { ArrowUpRightSquare, DollarSign, Send, X, Zap, Info, Cpu, Server, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";

// TPM/R&D top-up request dialog — bifurcated into Models / Infra / Subscriptions asks
// with per-line justification. Routed to CTO first, then CFO for final sign-off.
const TopupRequestDialog = ({ open, onOpenChange, project, defaultPhaseId }) => {
  const { createTopupRequest, visibleProjects } = useApp();
  const projectList = useMemo(() => (project ? [project] : visibleProjects), [project, visibleProjects]);

  const [projectId, setProjectId] = useState(project?.id || projectList[0]?.id || "");
  const activeProject = useMemo(
    () => projectList.find((p) => p.id === projectId) || project,
    [projectId, projectList, project]
  );
  const phases = activeProject?.phases || [];
  const [phaseId, setPhaseId] = useState(defaultPhaseId || phases[0]?.id || "");
  const [urgency, setUrgency] = useState("Normal");
  const [reason, setReason] = useState("");

  // Bifurcated budget items
  const [models, setModels] = useState({ enabled: true, amount: 1500, note: "" });
  const [infra, setInfra] = useState({ enabled: true, amount: 800, note: "" });
  const [subs, setSubs] = useState({ enabled: false, amount: 0, note: "" });

  const activePhase = phases.find((ph) => ph.id === phaseId);
  const totalAmount = (models.enabled ? Number(models.amount) || 0 : 0)
    + (infra.enabled ? Number(infra.amount) || 0 : 0)
    + (subs.enabled ? Number(subs.amount) || 0 : 0);

  const submit = () => {
    if (!activeProject) { toast.error("Select a project"); return; }
    if (totalAmount <= 0) { toast.error("Enter at least one budget-item amount"); return; }
    if (!reason.trim()) { toast.error("Justification is required"); return; }
    const effectivePhase = activePhase || phases[0] || { id: "general", name: "Project-wide" };
    const breakdown = {
      models: models.enabled ? { amount: Number(models.amount) || 0, note: models.note } : null,
      infra: infra.enabled ? { amount: Number(infra.amount) || 0, note: infra.note } : null,
      subs: subs.enabled ? { amount: Number(subs.amount) || 0, note: subs.note } : null,
    };
    createTopupRequest({
      projectId: activeProject.id,
      phaseId: effectivePhase.id,
      phaseName: effectivePhase.name,
      amount: totalAmount,
      reason,
      urgency,
      breakdown,
    });
    toast.success("Top-up request submitted", {
      description: `${activeProject.name} · ${fmtCurrency(totalAmount, { compact: false })} · routed to CTO → CFO`,
    });
    setModels({ enabled: true, amount: 1500, note: "" });
    setInfra({ enabled: true, amount: 800, note: "" });
    setSubs({ enabled: false, amount: 0, note: "" });
    setReason(""); setUrgency("Normal");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="topup-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <ArrowUpRightSquare className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise top-up request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Two-stage approval · bifurcated by budget item · CTO reviews first, CFO gives final sign-off
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!project && (
            <Field label="Project">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                data-testid="tur-project"
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                {projectList.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#12121A]">{p.name}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Bifurcated ask */}
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Ask · budget items</div>
            <div className="space-y-2">
              <ItemRow
                testidPrefix="tur-models"
                icon={Cpu}
                label="Models"
                helper="AI model spend (Bedrock, OpenAI, Anthropic)"
                value={models}
                onChange={setModels}
              />
              <ItemRow
                testidPrefix="tur-infra"
                icon={Server}
                label="Infrastructure"
                helper="Compute (EC2), storage, networking"
                value={infra}
                onChange={setInfra}
              />
              <ItemRow
                testidPrefix="tur-subs"
                icon={CreditCard}
                label="Subscriptions"
                helper="Seat-based tools (GitHub, Copilot, etc.)"
                value={subs}
                onChange={setSubs}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Total ask</span>
              <span className="text-fuchsia-300 font-display text-xl font-semibold tabular" data-testid="tur-total">
                {fmtCurrency(totalAmount, { compact: false })}
              </span>
            </div>
          </div>

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
              CTO reviews the bifurcated ask &amp; may partially approve per line → once CTO approves, CFO sees the same breakdown for final sign-off. Approved amount is added to <span className="text-white font-semibold">{activeProject?.name}</span>.
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

const ItemRow = ({ icon: Icon, label, helper, value, onChange, testidPrefix }) => (
  <div className={`rounded-xl border p-3 transition-colors ${value.enabled ? "border-fuchsia-500/30 bg-fuchsia-500/[0.04]" : "border-white/5 bg-white/[0.02]"}`} data-testid={`${testidPrefix}-row`}>
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange({ ...value, enabled: !value.enabled })}
        data-testid={`${testidPrefix}-toggle`}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${value.enabled ? "border-fuchsia-400 bg-fuchsia-500" : "border-white/20 bg-transparent"}`}
      >
        {value.enabled && <span className="text-[10px] text-white font-bold">✓</span>}
      </button>
      <Icon className={`w-4 h-4 flex-shrink-0 ${value.enabled ? "text-fuchsia-300" : "text-zinc-500"}`} />
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
          className={`w-full h-9 pl-7 pr-2 rounded-md bg-white/[0.04] border border-white/10 text-sm text-right tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 ${value.enabled ? "text-white" : "text-zinc-600"}`}
        />
      </div>
    </div>
    {value.enabled && (
      <input
        value={value.note}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
        placeholder="Line note · e.g. Opus 4.8 fine-tune sweep"
        data-testid={`${testidPrefix}-note`}
        className="mt-2 w-full h-8 px-3 rounded-md bg-white/[0.03] border border-white/10 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
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

export default TopupRequestDialog;
