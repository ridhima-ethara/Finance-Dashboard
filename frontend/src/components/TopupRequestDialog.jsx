import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { ArrowUpRightSquare, DollarSign, Send, X, Zap, Info, Cpu, Server, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { BEDROCK_MODELS, EC2_INSTANCES, SUBSCRIPTION_CATALOG } from "../data/mockCatalog";
import { normalizeBudgetType } from "../lib/projectMetrics";

const MODEL_OPTIONS = BEDROCK_MODELS.map((model) => ({
  value: model.id,
  label: `${model.name} · ${model.provider}`,
}));

const INFRA_OPTIONS = EC2_INSTANCES.map((instance) => ({
  value: instance.code,
  label: `${instance.code} · ${instance.family} · ${instance.vCPU} vCPU · ${instance.memoryGiB} GiB`,
}));

const SUBSCRIPTION_OPTIONS = SUBSCRIPTION_CATALOG.map((subscription) => ({
  value: subscription.id,
  label: `${subscription.name} · $${subscription.monthly}/month`,
}));

const buildModelState = (enabled = true) => ({
  enabled,
  amount: 1500,
  note: "",
  optionId: MODEL_OPTIONS[0]?.value || "",
  optionLabel: MODEL_OPTIONS[0]?.label || "",
});

const buildInfraState = (enabled = true) => ({
  enabled,
  amount: 800,
  note: "",
  optionId: INFRA_OPTIONS[0]?.value || "",
  optionLabel: INFRA_OPTIONS[0]?.label || "",
});

const buildSubState = (enabled = false) => ({
  enabled,
  amount: 0,
  note: "",
  optionId: SUBSCRIPTION_OPTIONS[0]?.value || "",
  optionLabel: SUBSCRIPTION_OPTIONS[0]?.label || "",
  billingUnit: "per month",
});

// TPM/R&D top-up request dialog — bifurcated into Models / Infra / Subscriptions asks
// with per-line justification. Routed to CTO first, then CFO for final sign-off.
const TopupRequestDialog = ({ open, onOpenChange, project, defaultPhaseId }) => {
  const { createTopupRequest, visibleProjects, batchDeliveries, budgets } = useApp();
  const projectList = useMemo(() => (project ? [project] : visibleProjects), [project, visibleProjects]);

  const [projectId, setProjectId] = useState(project?.id || projectList[0]?.id || "");
  const activeProject = useMemo(
    () => projectList.find((p) => p.id === projectId) || project,
    [projectId, projectList, project]
  );
  const phases = useMemo(() => activeProject?.phases || [], [activeProject]);
  const isRndProject = activeProject?.type === "R&D";
  const sampleOptions = useMemo(() => {
    if (!isRndProject) return [];
    const maxSampleIteration = Math.max(
      1,
      ...batchDeliveries
        .filter((entry) => entry.projectId === activeProject?.id && entry.stage === "rnd-review")
        .map((entry) => Number(entry.sampleIteration || 1)),
      ...budgets
        .filter((entry) => entry.projectId === activeProject?.id)
        .map((entry) => Number(normalizeBudgetType(entry.budgetType) === "Rework" ? entry.sampleIteration || 2 : 1))
    );
    return Array.from({ length: Math.max(3, maxSampleIteration + 1) }, (_, index) => ({
      id: phases[0]?.id || "sample",
      name: `Sample ${index + 1}`,
      sampleIteration: index + 1,
    }));
  }, [activeProject?.id, batchDeliveries, budgets, isRndProject, phases]);
  const phaseOptions = useMemo(() => (
    isRndProject
      ? sampleOptions
      : phases
  ), [isRndProject, phases, sampleOptions]);
  const [phaseId, setPhaseId] = useState(defaultPhaseId || phases[0]?.id || "");
  const [sampleIteration, setSampleIteration] = useState(phaseOptions[0]?.sampleIteration || 1);
  const [urgency, setUrgency] = useState("Normal");
  const [reason, setReason] = useState("");

  // Bifurcated budget items
  const [models, setModels] = useState(() => buildModelState(true));
  const [infra, setInfra] = useState(() => buildInfraState(true));
  const [subs, setSubs] = useState(() => buildSubState(false));

  useEffect(() => {
    if (project?.id) {
      setProjectId(project.id);
      return;
    }
    if (!projectList.some((entry) => entry.id === projectId)) {
      setProjectId(projectList[0]?.id || "");
    }
  }, [project, projectId, projectList]);

  useEffect(() => {
    if (!phaseOptions.length) {
      setPhaseId("");
      return;
    }
    if (!isRndProject && defaultPhaseId && phaseOptions.some((phase) => phase.id === defaultPhaseId) && phaseId !== defaultPhaseId) {
      setPhaseId(defaultPhaseId);
      return;
    }
    const fallbackPhaseId = phaseOptions.some((phase) => phase.id === defaultPhaseId) ? defaultPhaseId : phaseOptions[0]?.id;
    if (!phaseOptions.some((phase) => phase.id === phaseId)) {
      setPhaseId(fallbackPhaseId || "");
    }
  }, [defaultPhaseId, isRndProject, phaseId, phaseOptions]);

  useEffect(() => {
    if (!isRndProject) {
      setSampleIteration(1);
      return;
    }
    const matched = phaseOptions.find((option) => option.sampleIteration === sampleIteration);
    if (!matched) {
      setSampleIteration(phaseOptions[0]?.sampleIteration || 1);
    }
  }, [isRndProject, phaseOptions, sampleIteration]);

  const activePhase = isRndProject
    ? phaseOptions.find((option) => option.sampleIteration === sampleIteration) || phaseOptions[0]
    : phaseOptions.find((ph) => ph.id === phaseId);
  const totalAmount = (models.enabled ? Number(models.amount) || 0 : 0)
    + (infra.enabled ? Number(infra.amount) || 0 : 0)
    + (subs.enabled ? Number(subs.amount) || 0 : 0);

  const submit = () => {
    if (!activeProject) { toast.error("Select a project"); return; }
    if (!activePhase && phaseOptions.length) { toast.error(`Select a ${isRndProject ? "sample" : "phase"}`); return; }
    if (totalAmount <= 0) { toast.error("Enter at least one budget-item amount"); return; }
    if (!reason.trim()) { toast.error("Justification is required"); return; }
    const effectivePhase = activePhase || phaseOptions[0] || { id: "general", name: isRndProject ? `Sample ${sampleIteration}` : "Project-wide" };
    const breakdown = {
      models: models.enabled ? {
        amount: Number(models.amount) || 0,
        note: models.note,
        optionId: models.optionId,
        optionLabel: models.optionLabel,
      } : null,
      infra: infra.enabled ? {
        amount: Number(infra.amount) || 0,
        note: infra.note,
        optionId: infra.optionId,
        optionLabel: infra.optionLabel,
      } : null,
      subs: subs.enabled ? {
        amount: Number(subs.amount) || 0,
        note: subs.note,
        optionId: subs.optionId,
        optionLabel: subs.optionLabel,
        billingUnit: "per month",
      } : null,
    };
    createTopupRequest({
      projectId: activeProject.id,
      phaseId: effectivePhase.id,
      phaseName: isRndProject ? `Sample ${sampleIteration}` : effectivePhase.name,
      amount: totalAmount,
      reason,
      urgency,
      breakdown,
      sampleIteration: isRndProject ? sampleIteration : null,
    });
    toast.success("Top-up request submitted", {
      description: `${activeProject.name} · ${fmtCurrency(totalAmount, { compact: false })} · routed to CTO → CFO`,
    });
    setModels(buildModelState(true));
    setInfra(buildInfraState(true));
    setSubs(buildSubState(false));
    setSampleIteration(phaseOptions[0]?.sampleIteration || 1);
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

          {phaseOptions.length > 0 && (
            isRndProject ? (
              <Field label="Sample">
                <select
                  value={sampleIteration}
                  onChange={(e) => setSampleIteration(Number(e.target.value) || 1)}
                  data-testid="tur-sample"
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  {phaseOptions.map((phase) => (
                    <option key={phase.name} value={phase.sampleIteration} className="bg-[#12121A]">{phase.name}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Phase">
                <select
                  value={phaseId}
                  onChange={(e) => setPhaseId(e.target.value)}
                  data-testid="tur-phase"
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  {phaseOptions.map((phase) => (
                    <option key={phase.id} value={phase.id} className="bg-[#12121A]">{phase.name}</option>
                  ))}
                </select>
              </Field>
            )
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
                optionLabel="Bedrock model"
                options={MODEL_OPTIONS}
                notePlaceholder="Why this model change is needed"
              />
              <ItemRow
                testidPrefix="tur-infra"
                icon={Server}
                label="Infrastructure"
                helper="Compute (EC2), storage, networking"
                value={infra}
                onChange={setInfra}
                optionLabel="EC2 instance"
                options={INFRA_OPTIONS}
                notePlaceholder="Why this infra uplift is needed"
              />
              <ItemRow
                testidPrefix="tur-subs"
                icon={CreditCard}
                label="Subscriptions"
                helper="Seat-based tools billed monthly"
                value={subs}
                onChange={setSubs}
                optionLabel="Subscription · per month"
                options={SUBSCRIPTION_OPTIONS}
                notePlaceholder="Seats, teams, or tooling context"
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

const ItemRow = ({ icon: Icon, label, helper, value, onChange, testidPrefix, optionLabel, options, notePlaceholder }) => (
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
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">{optionLabel}</div>
          <select
            value={value.optionId}
            onChange={(e) => {
              const option = options.find((entry) => entry.value === e.target.value);
              onChange({
                ...value,
                optionId: e.target.value,
                optionLabel: option?.label || "",
              });
            }}
            data-testid={`${testidPrefix}-option`}
            className="w-full h-9 px-3 rounded-md bg-white/[0.03] border border-white/10 text-[11px] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#12121A]">
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Line note</div>
          <input
            value={value.note}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            placeholder={notePlaceholder}
            data-testid={`${testidPrefix}-note`}
            className="w-full h-9 px-3 rounded-md bg-white/[0.03] border border-white/10 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
          />
        </div>
      </div>
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
