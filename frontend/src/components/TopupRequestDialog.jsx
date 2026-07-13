import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  ArrowUpRightSquare,
  Cpu,
  CreditCard,
  DollarSign,
  Info,
  Plus,
  Send,
  Server,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { BEDROCK_MODELS, EC2_INSTANCES, SUBSCRIPTION_CATALOG } from "../data/mockCatalog";
import { normalizeBudgetType } from "../lib/projectMetrics";

const MODEL_OPTIONS = BEDROCK_MODELS.map((model) => ({
  value: model.id,
  label: `${model.name} · ${model.provider}`,
  provider: model.provider,
}));

const INFRA_OPTIONS = EC2_INSTANCES.map((instance) => ({
  value: instance.code,
  label: `${instance.code} · ${instance.family} · ${instance.vCPU} vCPU · ${instance.memoryGiB} GiB`,
}));

const SUBSCRIPTION_OPTIONS = SUBSCRIPTION_CATALOG.map((subscription) => ({
  value: subscription.id,
  label: `${subscription.name} · $${subscription.monthly}/month`,
  name: subscription.name,
}));

const uid = (prefix = "row") => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const buildModelLine = () => ({
  id: uid("mdl"),
  optionId: MODEL_OPTIONS[0]?.value || "",
  optionLabel: MODEL_OPTIONS[0]?.label || "",
  provider: MODEL_OPTIONS[0]?.provider || "",
  amount: 0,
  note: "",
});

const buildSubscriptionLine = () => ({
  id: uid("sub"),
  optionId: SUBSCRIPTION_OPTIONS[0]?.value || "",
  optionLabel: SUBSCRIPTION_OPTIONS[0]?.label || "",
  amount: 0,
  note: "",
  billingUnit: "per month",
});

const buildInfraState = () => ({
  enabled: true,
  optionId: INFRA_OPTIONS[0]?.value || "",
  optionLabel: INFRA_OPTIONS[0]?.label || "",
  amount: 0,
  note: "",
});

const buildModelState = () => ({
  enabled: true,
  lines: [buildModelLine()],
});

const buildSubscriptionState = () => ({
  enabled: false,
  lines: [buildSubscriptionLine()],
});

const sumEnabledLineAmounts = (section) => (
  section?.enabled
    ? (section.lines || []).reduce((sum, line) => sum + Number(line.amount || 0), 0)
    : 0
);

const joinLineLabels = (lines = []) => lines.map((line) => line.optionLabel).filter(Boolean).join(" | ");
const joinLineNotes = (lines = []) => lines.map((line) => String(line.note || "").trim()).filter(Boolean).join(" | ");

const TopupRequestDialog = ({ open, onOpenChange, project, defaultPhaseId }) => {
  const { createTopupRequest, visibleProjects, batchDeliveries, budgets } = useApp();
  const projectList = useMemo(() => (project ? [project] : visibleProjects), [project, visibleProjects]);

  const [projectId, setProjectId] = useState(project?.id || projectList[0]?.id || "");
  const [phaseId, setPhaseId] = useState(defaultPhaseId || "");
  const [sampleIteration, setSampleIteration] = useState(1);
  const [urgency, setUrgency] = useState("Normal");
  const [reason, setReason] = useState("");
  const [bufferPct, setBufferPct] = useState(0);
  const [models, setModels] = useState(buildModelState);
  const [infra, setInfra] = useState(buildInfraState);
  const [subs, setSubs] = useState(buildSubscriptionState);

  const activeProject = useMemo(
    () => projectList.find((entry) => entry.id === projectId) || project || null,
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
  const phaseOptions = useMemo(
    () => (isRndProject ? sampleOptions : phases),
    [isRndProject, phases, sampleOptions]
  );

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
      setSampleIteration(1);
      return;
    }
    if (isRndProject) {
      if (!phaseOptions.some((option) => option.sampleIteration === sampleIteration)) {
        setSampleIteration(phaseOptions[0]?.sampleIteration || 1);
      }
      setPhaseId(phaseOptions[0]?.id || "");
      return;
    }
    const fallbackPhaseId = phaseOptions.some((option) => option.id === defaultPhaseId) ? defaultPhaseId : phaseOptions[0]?.id;
    if (!phaseOptions.some((option) => option.id === phaseId)) {
      setPhaseId(fallbackPhaseId || "");
    }
  }, [defaultPhaseId, isRndProject, phaseId, phaseOptions, sampleIteration]);

  useEffect(() => {
    if (!open) return;
    setUrgency("Normal");
    setReason("");
    setBufferPct(0);
    setModels(buildModelState());
    setInfra(buildInfraState());
    setSubs(buildSubscriptionState());
  }, [open, activeProject?.id]);

  const activePhase = isRndProject
    ? phaseOptions.find((option) => option.sampleIteration === sampleIteration) || phaseOptions[0] || null
    : phaseOptions.find((option) => option.id === phaseId) || phaseOptions[0] || null;

  const modelsAmount = sumEnabledLineAmounts(models);
  const infraAmount = infra.enabled ? Number(infra.amount || 0) : 0;
  const subsAmount = sumEnabledLineAmounts(subs);
  const baseAmount = modelsAmount + infraAmount + subsAmount;
  const bufferAmount = Math.round((baseAmount * Number(bufferPct || 0) / 100) * 100) / 100;
  const totalAmount = baseAmount + bufferAmount;

  const updateMultiLine = (setter, lineId, key, value, options, extra = {}) => {
    setter((current) => ({
      ...current,
      lines: current.lines.map((line) => {
        if (line.id !== lineId) return line;
        if (key === "optionId") {
          const option = options.find((entry) => entry.value === value);
          return {
            ...line,
            optionId: value,
            optionLabel: option?.label || "",
            ...extra(option),
          };
        }
        return {
          ...line,
          [key]: key === "amount" ? Number(value || 0) : value,
        };
      }),
    }));
  };

  const addMultiLine = (setter, factory) => setter((current) => ({ ...current, lines: [...current.lines, factory()] }));
  const removeMultiLine = (setter, lineId) => setter((current) => ({
    ...current,
    lines: current.lines.length === 1 ? current.lines : current.lines.filter((line) => line.id !== lineId),
  }));

  const submit = () => {
    if (!activeProject) {
      toast.error("Select a project");
      return;
    }
    if (phaseOptions.length > 0 && !activePhase) {
      toast.error(`Select a ${isRndProject ? "sample" : "phase"}`);
      return;
    }
    if (baseAmount <= 0) {
      toast.error("Enter at least one top-up line amount");
      return;
    }
    if (!reason.trim()) {
      toast.error("Justification is required");
      return;
    }

    const modelEntries = models.enabled
      ? models.lines.filter((line) => Number(line.amount || 0) > 0)
      : [];
    const subEntries = subs.enabled
      ? subs.lines.filter((line) => Number(line.amount || 0) > 0)
      : [];

    const breakdown = {
      total: baseAmount,
      models: modelEntries.length ? {
        amount: modelsAmount,
        optionId: modelEntries[0]?.optionId || "",
        optionLabel: joinLineLabels(modelEntries),
        note: joinLineNotes(modelEntries),
        entries: modelEntries.map((line) => ({
          id: line.id,
          optionId: line.optionId,
          optionLabel: line.optionLabel,
          note: line.note,
          amount: Number(line.amount || 0),
          provider: line.provider || "",
        })),
      } : null,
      infra: infra.enabled ? {
        amount: infraAmount,
        optionId: infra.optionId,
        optionLabel: infra.optionLabel,
        note: infra.note,
      } : null,
      subs: subEntries.length ? {
        amount: subsAmount,
        optionId: subEntries[0]?.optionId || "",
        optionLabel: joinLineLabels(subEntries),
        note: joinLineNotes(subEntries),
        billingUnit: "per month",
        entries: subEntries.map((line) => ({
          id: line.id,
          optionId: line.optionId,
          optionLabel: line.optionLabel,
          note: line.note,
          amount: Number(line.amount || 0),
          billingUnit: "per month",
        })),
      } : null,
    };

    createTopupRequest({
      projectId: activeProject.id,
      phaseId: activePhase?.id || "general",
      phaseName: isRndProject ? `Sample ${sampleIteration}` : activePhase?.name || "Project-wide",
      amount: totalAmount,
      baseAmount,
      bufferPct: Number(bufferPct || 0),
      bufferAmount,
      reason,
      urgency,
      breakdown,
      sampleIteration: isRndProject ? sampleIteration : null,
    });

    toast.success("Top-up request submitted", {
      description: `${activeProject.name} · ${fmtCurrency(totalAmount, { compact: false })} · routed to CTO -> CFO`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="topup-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <ArrowUpRightSquare className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise top-up request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Two-stage approval · line-item breakdown with optional buffer · CTO reviews first, CFO gives final sign-off
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!project && (
            <Field label="Project">
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                data-testid="tur-project"
                className={selectCls}
              >
                {projectList.map((entry) => (
                  <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {phaseOptions.length > 0 && (
            isRndProject ? (
              <Field label="Sample">
                <select
                  value={sampleIteration}
                  onChange={(event) => setSampleIteration(Number(event.target.value) || 1)}
                  data-testid="tur-sample"
                  className={selectCls}
                >
                  {phaseOptions.map((entry) => (
                    <option key={entry.name} value={entry.sampleIteration} className="bg-[#12121A]">
                      {entry.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Phase">
                <select
                  value={phaseId}
                  onChange={(event) => setPhaseId(event.target.value)}
                  data-testid="tur-phase"
                  className={selectCls}
                >
                  {phaseOptions.map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                      {entry.name}
                    </option>
                  ))}
                </select>
              </Field>
            )
          )}

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Ask · budget items</div>
            <div className="space-y-3">
              <MultiLineSection
                title="Models"
                helper="Multi-select Bedrock models and add one-line context for each model change."
                icon={Cpu}
                enabled={models.enabled}
                onToggle={() => setModels((current) => ({ ...current, enabled: !current.enabled }))}
                lines={models.lines}
                addLabel="Add model"
                amountTestId="tur-models-amount"
                total={modelsAmount}
                onAdd={() => addMultiLine(setModels, buildModelLine)}
                onRemove={(lineId) => removeMultiLine(setModels, lineId)}
                onOptionChange={(lineId, value) => updateMultiLine(setModels, lineId, "optionId", value, MODEL_OPTIONS, (option) => ({ provider: option?.provider || "" }))}
                onAmountChange={(lineId, value) => updateMultiLine(setModels, lineId, "amount", value, MODEL_OPTIONS, () => ({}))}
                onNoteChange={(lineId, value) => updateMultiLine(setModels, lineId, "note", value, MODEL_OPTIONS, () => ({}))}
                options={MODEL_OPTIONS}
                notePlaceholder="Why this model uplift is needed"
                testidPrefix="tur-models"
              />

              <SingleLineSection
                title="Infrastructure"
                helper="Pick the EC2 instance / infra ask for this top-up."
                icon={Server}
                enabled={infra.enabled}
                onToggle={() => setInfra((current) => ({ ...current, enabled: !current.enabled }))}
                optionId={infra.optionId}
                amount={infra.amount}
                note={infra.note}
                total={infraAmount}
                onOptionChange={(value) => {
                  const option = INFRA_OPTIONS.find((entry) => entry.value === value);
                  setInfra((current) => ({
                    ...current,
                    optionId: value,
                    optionLabel: option?.label || "",
                  }));
                }}
                onAmountChange={(value) => setInfra((current) => ({ ...current, amount: Number(value || 0) }))}
                onNoteChange={(value) => setInfra((current) => ({ ...current, note: value }))}
                options={INFRA_OPTIONS}
                notePlaceholder="Why this infra uplift is needed"
                testidPrefix="tur-infra"
              />

              <MultiLineSection
                title="Subscriptions"
                helper="Multi-select subscriptions and keep the request monthly where applicable."
                icon={CreditCard}
                enabled={subs.enabled}
                onToggle={() => setSubs((current) => ({ ...current, enabled: !current.enabled }))}
                lines={subs.lines}
                addLabel="Add subscription"
                amountTestId="tur-subs-amount"
                total={subsAmount}
                onAdd={() => addMultiLine(setSubs, buildSubscriptionLine)}
                onRemove={(lineId) => removeMultiLine(setSubs, lineId)}
                onOptionChange={(lineId, value) => updateMultiLine(setSubs, lineId, "optionId", value, SUBSCRIPTION_OPTIONS, () => ({ billingUnit: "per month" }))}
                onAmountChange={(lineId, value) => updateMultiLine(setSubs, lineId, "amount", value, SUBSCRIPTION_OPTIONS, () => ({}))}
                onNoteChange={(lineId, value) => updateMultiLine(setSubs, lineId, "note", value, SUBSCRIPTION_OPTIONS, () => ({}))}
                options={SUBSCRIPTION_OPTIONS}
                notePlaceholder="Seats, teams, or tooling context"
                testidPrefix="tur-subs"
                billingUnitLabel="per month"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <Field label="Buffer (%)">
              <div className="relative max-w-[220px]">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={bufferPct}
                  onChange={(event) => setBufferPct(Number(event.target.value) || 0)}
                  data-testid="tur-buffer-pct"
                  className="w-full h-10 px-3 pr-9 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
              </div>
            </Field>
            <div className="text-right space-y-1">
              <div className="text-[11px] text-zinc-500">Base ask <span className="text-zinc-300 font-semibold tabular">{fmtCurrency(baseAmount, { compact: false })}</span></div>
              <div className="text-[11px] text-zinc-500">Buffer <span className="text-zinc-300 font-semibold tabular">{fmtCurrency(bufferAmount, { compact: false })}</span></div>
              <div className="text-xs text-zinc-500">Total ask</div>
              <div className="text-fuchsia-300 font-display text-2xl font-semibold tabular" data-testid="tur-total">
                {fmtCurrency(totalAmount, { compact: false })}
              </div>
            </div>
          </div>

          <Field label="Urgency">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
              {["Low", "Normal", "High"].map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setUrgency(entry)}
                  data-testid={`tur-urgency-${entry.toLowerCase()}`}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${
                    urgency === entry
                      ? entry === "High"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-fuchsia-500/15 text-fuchsia-300"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Justification">
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
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
              CTO reviews the line-item ask and may partially approve it. CFO sees the same model, infra, subscription, and buffer breakdown for final sign-off.
            </div>
          </div>

          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 flex items-start gap-2 text-[11px] text-zinc-500">
            <Info className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
            Partial approvals are supported at both stages. The final CFO amount is what gets added to the project baseline.
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

const selectCls = "w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";
const inputCls = "w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

const SectionToggle = ({ enabled, onToggle, title, helper, icon: Icon, total, accent = "fuchsia", testid }) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={onToggle}
      data-testid={testid}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
        enabled
          ? accent === "amber"
            ? "border-amber-400 bg-amber-500"
            : "border-fuchsia-400 bg-fuchsia-500"
          : "border-white/20 bg-transparent"
      }`}
    >
      {enabled && <span className="text-[10px] text-white font-bold">✓</span>}
    </button>
    <Icon className={`w-4 h-4 flex-shrink-0 ${accent === "amber" ? "text-amber-300" : "text-fuchsia-300"}`} />
    <div className="flex-1 min-w-0">
      <div className={`text-sm font-semibold ${enabled ? "text-white" : "text-zinc-400"}`}>{title}</div>
      <div className="text-[10px] text-zinc-500">{helper}</div>
    </div>
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Subtotal</div>
      <div className="text-sm font-semibold text-white tabular">{fmtCurrency(total, { compact: false })}</div>
    </div>
  </div>
);

const MultiLineSection = ({
  title,
  helper,
  icon,
  enabled,
  onToggle,
  lines,
  addLabel,
  total,
  onAdd,
  onRemove,
  onOptionChange,
  onAmountChange,
  onNoteChange,
  options,
  notePlaceholder,
  testidPrefix,
  billingUnitLabel,
}) => (
  <div className={`rounded-xl border p-3 ${enabled ? "border-fuchsia-500/30 bg-fuchsia-500/[0.04]" : "border-white/5 bg-white/[0.02]"}`} data-testid={`${testidPrefix}-row`}>
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <SectionToggle
        enabled={enabled}
        onToggle={onToggle}
        title={title}
        helper={helper}
        icon={icon}
        total={total}
        testid={`${testidPrefix}-toggle`}
      />
      {enabled && (
        <Button
          type="button"
          size="sm"
          onClick={onAdd}
          className="h-8 rounded-md border border-fuchsia-500/25 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-300 text-xs gap-1"
          data-testid={`${testidPrefix}-add`}
        >
          <Plus className="w-3 h-3" /> {addLabel}
        </Button>
      )}
    </div>

    {enabled && (
      <div className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <div key={line.id} className="grid grid-cols-1 md:grid-cols-[1.35fr_120px_1fr_28px] gap-2 items-start">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">{title.slice(0, -1) || title} {index + 1}</div>
              <select
                value={line.optionId}
                onChange={(event) => onOptionChange(line.id, event.target.value)}
                data-testid={`${testidPrefix}-option-${line.id}`}
                className={inputCls}
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#12121A]">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
                Amount {billingUnitLabel ? `(${billingUnitLabel})` : ""}
              </div>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={line.amount}
                  onChange={(event) => onAmountChange(line.id, event.target.value)}
                  data-testid={`${testidPrefix}-amount-${line.id}`}
                  className={`${inputCls} pl-7 text-right tabular`}
                />
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Line note</div>
              <input
                value={line.note}
                onChange={(event) => onNoteChange(line.id, event.target.value)}
                placeholder={notePlaceholder}
                data-testid={`${testidPrefix}-note-${line.id}`}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(line.id)}
              data-testid={`${testidPrefix}-remove-${line.id}`}
              className="w-7 h-7 mt-6 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const SingleLineSection = ({
  title,
  helper,
  icon,
  enabled,
  onToggle,
  optionId,
  amount,
  note,
  total,
  onOptionChange,
  onAmountChange,
  onNoteChange,
  options,
  notePlaceholder,
  testidPrefix,
}) => (
  <div className={`rounded-xl border p-3 ${enabled ? "border-fuchsia-500/30 bg-fuchsia-500/[0.04]" : "border-white/5 bg-white/[0.02]"}`} data-testid={`${testidPrefix}-row`}>
    <SectionToggle
      enabled={enabled}
      onToggle={onToggle}
      title={title}
      helper={helper}
      icon={icon}
      total={total}
      testid={`${testidPrefix}-toggle`}
    />

    {enabled && (
      <div className="mt-3 grid grid-cols-1 md:grid-cols-[1.35fr_120px_1fr] gap-2 items-start">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">EC2 instance</div>
          <select
            value={optionId}
            onChange={(event) => onOptionChange(event.target.value)}
            data-testid={`${testidPrefix}-option`}
            className={inputCls}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#12121A]">
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Amount</div>
          <div className="relative">
            <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="number"
              min="0"
              step="50"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              data-testid={`${testidPrefix}-amount`}
              className={`${inputCls} pl-7 text-right tabular`}
            />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Line note</div>
          <input
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={notePlaceholder}
            data-testid={`${testidPrefix}-note`}
            className={inputCls}
          />
        </div>
      </div>
    )}
  </div>
);

export default TopupRequestDialog;
