import { useEffect, useMemo, useRef, useState } from "react";
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
import { EC2_INSTANCES, PLATFORM_PROVIDERS, SUBSCRIPTION_CATALOG } from "../data/mockCatalog";
import { ADD_CUSTOM_MODEL_OPTION, buildModelOptionLabel, promptForCustomModel } from "../lib/modelCatalog";
import { normalizeBudgetType } from "../lib/projectMetrics";

const MODEL_PLATFORM_PRIORITY = PLATFORM_PROVIDERS;
const MODEL_PLATFORM_MAP = {
  AWS: new Set(["AI21", "Amazon", "Anthropic", "Cohere", "DeepSeek", "Meta", "Mistral", "Stability AI"]),
  OpenAI: new Set(["OpenAI"]),
  OpenRouter: new Set(["MiniMax", "NVIDIA", "xAI", "Z.AI", "Zhipu AI"]),
  GCP: new Set(["Google"]),
  Moonshot: new Set(["Moonshot AI"]),
};

const uid = (prefix = "row") => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const getInfraProvider = (instance = {}) => String(instance?.provider || "AWS").trim() || "AWS";
const buildInfraOption = (instance = {}) => ({
  value: instance.code,
  label: `${instance.code} · ${instance.family} · ${instance.vCPU} vCPU · ${instance.memoryGiB} GiB`,
  provider: getInfraProvider(instance),
});
const getInstancesForProvider = (provider = "") => {
  const filtered = EC2_INSTANCES.filter((instance) => getInfraProvider(instance) === provider);
  return filtered.length ? filtered : EC2_INSTANCES;
};
const buildInfraOptions = (provider = "") => getInstancesForProvider(provider).map(buildInfraOption);
const getModelPlatform = (model = {}) => {
  const explicit = String(model?.platform || "").trim();
  if (explicit) return explicit;
  const provider = String(model?.provider || "").trim();
  if (MODEL_PLATFORM_PRIORITY.includes(provider)) return provider;
  const matched = MODEL_PLATFORM_PRIORITY.find((platform) => MODEL_PLATFORM_MAP[platform]?.has(provider));
  return matched || "OpenRouter";
};
const getModelsForProvider = (catalog = [], provider = "") => {
  const filtered = catalog.filter((model) => (model.platform || model.provider) === provider);
  return filtered.length ? filtered : catalog;
};

const SUBSCRIPTION_OPTIONS = SUBSCRIPTION_CATALOG.map((subscription) => ({
  value: subscription.id,
  label: `${subscription.name} · $${subscription.monthly}/month`,
  name: subscription.name,
}));

const buildModelLine = (modelOptions = [], provider = "") => ({
  id: uid("mdl"),
  optionId: modelOptions[0]?.value || "",
  optionLabel: modelOptions[0]?.label || "",
  provider: provider || modelOptions[0]?.platform || modelOptions[0]?.provider || "",
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

const buildInfraState = (providerOptions = []) => {
  const provider = providerOptions[0] || getInfraProvider(EC2_INSTANCES[0]);
  const option = buildInfraOptions(provider)[0] || buildInfraOption(EC2_INSTANCES[0]);
  return {
    enabled: true,
    provider,
    optionId: option.value,
    optionLabel: option.label,
    amount: 0,
    note: "",
  };
};

const buildModelState = (modelOptions = [], providerOptions = []) => {
  const provider = providerOptions[0] || modelOptions[0]?.platform || modelOptions[0]?.provider || "";
  const providerModels = getModelsForProvider(modelOptions, provider);
  return {
    enabled: true,
    lines: [buildModelLine(providerModels.length ? providerModels : modelOptions, provider)],
  };
};

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
  const { createTopupRequest, visibleProjects, batchDeliveries, budgets, modelCatalog, addCustomModel } = useApp();
  const projectList = useMemo(() => (project ? [project] : visibleProjects), [project, visibleProjects]);
  const modelOptions = useMemo(() => modelCatalog.map((model) => ({
    value: model.id,
    label: buildModelOptionLabel(model),
    provider: model.provider,
    platform: getModelPlatform(model),
  })), [modelCatalog]);
  const modelProviderOptions = useMemo(
    () => MODEL_PLATFORM_PRIORITY.filter((provider) => getModelsForProvider(modelOptions, provider).length > 0),
    [modelOptions]
  );
  const infraProviderOptions = useMemo(
    () => MODEL_PLATFORM_PRIORITY.filter((provider) => getInstancesForProvider(provider).length > 0),
    []
  );

  const [projectId, setProjectId] = useState(project?.id || projectList[0]?.id || "");
  const [phaseId, setPhaseId] = useState(defaultPhaseId || "");
  const [sampleIteration, setSampleIteration] = useState(1);
  const [urgency, setUrgency] = useState("Normal");
  const [reason, setReason] = useState("");
  const [models, setModels] = useState(() => buildModelState(modelOptions, modelProviderOptions));
  const [infra, setInfra] = useState(() => buildInfraState(infraProviderOptions));
  const [subs, setSubs] = useState(buildSubscriptionState);
  const wasOpenRef = useRef(false);
  const lastProjectIdRef = useRef(project?.id || projectList[0]?.id || "");

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
    const currentProjectId = activeProject?.id || "";
    const openedNow = open && !wasOpenRef.current;
    const projectChangedWhileOpen = open && wasOpenRef.current && lastProjectIdRef.current !== currentProjectId;

    if (openedNow || projectChangedWhileOpen) {
      setUrgency("Normal");
      setReason("");
      setModels(buildModelState(modelOptions, modelProviderOptions));
      setInfra(buildInfraState(infraProviderOptions));
      setSubs(buildSubscriptionState());
    }

    wasOpenRef.current = open;
    lastProjectIdRef.current = currentProjectId;
  }, [activeProject?.id, infraProviderOptions, modelOptions, modelProviderOptions, open]);

  const activePhase = isRndProject
    ? phaseOptions.find((option) => option.sampleIteration === sampleIteration) || phaseOptions[0] || null
    : phaseOptions.find((option) => option.id === phaseId) || phaseOptions[0] || null;

  const modelsAmount = sumEnabledLineAmounts(models);
  const infraAmount = infra.enabled ? Number(infra.amount || 0) : 0;
  const subsAmount = sumEnabledLineAmounts(subs);
  const totalAmount = modelsAmount + infraAmount + subsAmount;

  const updateMultiLine = (setter, lineId, updater) => {
    setter((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === lineId ? updater(line) : line)),
    }));
  };

  const addMultiLine = (setter, factory) => setter((current) => ({ ...current, lines: [...current.lines, factory()] }));
  const removeMultiLine = (setter, lineId) => setter((current) => ({
    ...current,
    lines: current.lines.length === 1 ? current.lines : current.lines.filter((line) => line.id !== lineId),
  }));

  const updateModelProvider = (lineId, provider) => {
    updateMultiLine(setModels, lineId, (line) => {
      const providerModels = getModelsForProvider(modelOptions, provider);
      const nextOption = providerModels.find((entry) => entry.value === line.optionId) || providerModels[0] || modelOptions[0];
      return {
        ...line,
        provider,
        optionId: nextOption?.value || "",
        optionLabel: nextOption?.label || "",
      };
    });
  };

  const handleModelOptionChange = (lineId, value) => {
    if (value === ADD_CUSTOM_MODEL_OPTION) {
      const created = promptForCustomModel(addCustomModel);
      if (!created) return;
      updateMultiLine(setModels, lineId, (line) => ({
        ...line,
        optionId: created.id,
        optionLabel: buildModelOptionLabel(created),
        provider: getModelPlatform(created),
      }));
      toast.success("Custom model added", {
        description: `${created.name} · ${created.provider} is now available in all model dropdowns.`,
      });
      return;
    }

    updateMultiLine(setModels, lineId, (line) => {
      const providerModels = getModelsForProvider(modelOptions, line.provider);
      const option = providerModels.find((entry) => entry.value === value) || modelOptions.find((entry) => entry.value === value);
      return {
        ...line,
        optionId: value,
        optionLabel: option?.label || "",
        provider: option?.platform || line.provider || "",
      };
    });
  };

  const updateInfraProvider = (provider) => {
    const option = buildInfraOptions(provider)[0] || buildInfraOption(EC2_INSTANCES[0]);
    setInfra((current) => ({
      ...current,
      provider,
      optionId: option.value,
      optionLabel: option.label,
    }));
  };

  const submit = () => {
    if (!activeProject) {
      toast.error("Select a project");
      return;
    }
    if (phaseOptions.length > 0 && !activePhase) {
      toast.error(`Select a ${isRndProject ? "sample" : "phase"}`);
      return;
    }
    if (totalAmount <= 0) {
      toast.error("Enter at least one budget change line amount");
      return;
    }
    if (!reason.trim()) {
      toast.error("Justification is required");
      return;
    }

    const modelEntries = models.enabled
      ? models.lines.filter((line) => Number(line.amount || 0) > 0)
      : [];
    const infraEntries = infra.enabled && Number(infra.amount || 0) > 0
      ? [{
          id: "infra-line-1",
          optionId: infra.optionId,
          optionLabel: infra.optionLabel,
          provider: infra.provider,
          note: infra.note,
          amount: Number(infra.amount || 0),
        }]
      : [];
    const subEntries = subs.enabled
      ? subs.lines.filter((line) => Number(line.amount || 0) > 0)
      : [];

    const breakdown = {
      total: totalAmount,
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
      infra: infraEntries.length ? {
        amount: infraAmount,
        optionId: infraEntries[0].optionId,
        optionLabel: joinLineLabels(infraEntries),
        note: joinLineNotes(infraEntries),
        entries: infraEntries,
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
      baseAmount: totalAmount,
      bufferPct: 0,
      bufferAmount: 0,
      reason,
      urgency,
      breakdown,
      sampleIteration: isRndProject ? sampleIteration : null,
    });

    toast.success("Budget change request submitted", {
      description: `${activeProject.name} · ${fmtCurrency(totalAmount, { compact: false })} · routed to CTO -> CFO`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="topup-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <ArrowUpRightSquare className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise budget change request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Two-stage approval · provider-first models and infra · CTO reviews first, CFO gives final sign-off
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
                helper="Choose provider first, then the matching model line for each uplift."
                icon={Cpu}
                enabled={models.enabled}
                onToggle={() => setModels((current) => ({ ...current, enabled: !current.enabled }))}
                lines={models.lines}
                addLabel="Add model"
                total={modelsAmount}
                onAdd={() => addMultiLine(setModels, () => {
                  const provider = modelProviderOptions[0] || "";
                  const providerModels = getModelsForProvider(modelOptions, provider);
                  return buildModelLine(providerModels, provider);
                })}
                onRemove={(lineId) => removeMultiLine(setModels, lineId)}
                onProviderChange={updateModelProvider}
                getProviderValue={(line) => line.provider}
                providerOptions={modelProviderOptions}
                onOptionChange={handleModelOptionChange}
                onAmountChange={(lineId, value) => updateMultiLine(setModels, lineId, (line) => ({ ...line, amount: Number(value || 0) }))}
                onNoteChange={(lineId, value) => updateMultiLine(setModels, lineId, (line) => ({ ...line, note: value }))}
                getOptions={(line) => getModelsForProvider(modelOptions, line.provider)}
                notePlaceholder="Why this model uplift is needed"
                testidPrefix="tur-models"
                allowCustomOption
                optionLabel="Model"
              />

              <SingleLineSection
                title="Infrastructure"
                helper="Choose provider first, then the matching infra capacity request."
                icon={Server}
                enabled={infra.enabled}
                onToggle={() => setInfra((current) => ({ ...current, enabled: !current.enabled }))}
                provider={infra.provider}
                onProviderChange={updateInfraProvider}
                providerOptions={infraProviderOptions}
                optionId={infra.optionId}
                amount={infra.amount}
                note={infra.note}
                total={infraAmount}
                onOptionChange={(value) => {
                  const option = buildInfraOptions(infra.provider).find((entry) => entry.value === value) || buildInfraOption(EC2_INSTANCES[0]);
                  setInfra((current) => ({
                    ...current,
                    optionId: value,
                    optionLabel: option.label,
                  }));
                }}
                onAmountChange={(value) => setInfra((current) => ({ ...current, amount: Number(value || 0) }))}
                onNoteChange={(value) => setInfra((current) => ({ ...current, note: value }))}
                options={buildInfraOptions(infra.provider)}
                notePlaceholder="Why this infra uplift is needed"
                testidPrefix="tur-infra"
                optionLabel="Infra"
              />

              <MultiLineSection
                title="Subscriptions"
                helper="Keep monthly subscription asks visible in the same approval flow."
                icon={CreditCard}
                enabled={subs.enabled}
                onToggle={() => setSubs((current) => ({ ...current, enabled: !current.enabled }))}
                lines={subs.lines}
                addLabel="Add subscription"
                total={subsAmount}
                onAdd={() => addMultiLine(setSubs, buildSubscriptionLine)}
                onRemove={(lineId) => removeMultiLine(setSubs, lineId)}
                onOptionChange={(lineId, value) => updateMultiLine(setSubs, lineId, (line) => {
                  const option = SUBSCRIPTION_OPTIONS.find((entry) => entry.value === value);
                  return {
                    ...line,
                    optionId: value,
                    optionLabel: option?.label || "",
                    billingUnit: "per month",
                  };
                })}
                onAmountChange={(lineId, value) => updateMultiLine(setSubs, lineId, (line) => ({ ...line, amount: Number(value || 0) }))}
                onNoteChange={(lineId, value) => updateMultiLine(setSubs, lineId, (line) => ({ ...line, note: value }))}
                getOptions={() => SUBSCRIPTION_OPTIONS}
                notePlaceholder="Seats, teams, or tooling context"
                testidPrefix="tur-subs"
                billingUnitLabel="per month"
                optionLabel="Subscription"
              />
            </div>
          </div>

          <div className="text-right space-y-1">
            <div className="text-[11px] text-zinc-500">Requested total</div>
            <div className="text-fuchsia-300 font-display text-2xl font-semibold tabular" data-testid="tur-total">
              {fmtCurrency(totalAmount, { compact: false })}
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
              placeholder="Why is the budget change needed? What deliverable does it unlock?"
              data-testid="tur-reason"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </Field>

          <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
            <Zap className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">Flow: </span>
              CTO reviews the line-item ask and may partially approve it. CFO sees the same model, infra, and subscription breakdown for final sign-off.
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
  onProviderChange,
  getProviderValue,
  providerOptions = [],
  onOptionChange,
  onAmountChange,
  onNoteChange,
  getOptions,
  notePlaceholder,
  testidPrefix,
  billingUnitLabel,
  allowCustomOption = false,
  optionLabel = "Item",
}) => {
  const hasProvider = providerOptions.length > 0 && typeof onProviderChange === "function" && typeof getProviderValue === "function";
  const rowClass = hasProvider
    ? "grid grid-cols-1 md:grid-cols-[140px_1.2fr_120px_1fr_28px] gap-2 items-start"
    : "grid grid-cols-1 md:grid-cols-[1.35fr_120px_1fr_28px] gap-2 items-start";

  return (
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
          {lines.map((line, index) => {
            const options = getOptions(line);
            return (
              <div key={line.id} className={rowClass}>
                {hasProvider && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Provider</div>
                    <select
                      value={getProviderValue(line) || providerOptions[0] || ""}
                      onChange={(event) => onProviderChange(line.id, event.target.value)}
                      data-testid={`${testidPrefix}-provider-${line.id}`}
                      className={inputCls}
                    >
                      {providerOptions.map((provider) => (
                        <option key={provider} value={provider} className="bg-[#12121A]">
                          {provider}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">{optionLabel} {index + 1}</div>
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
                    {allowCustomOption && (
                      <option value={ADD_CUSTOM_MODEL_OPTION} className="bg-[#12121A]">
                        + Add new model...
                      </option>
                    )}
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
            );
          })}
        </div>
      )}
    </div>
  );
};

const SingleLineSection = ({
  title,
  helper,
  icon,
  enabled,
  onToggle,
  provider,
  onProviderChange,
  providerOptions = [],
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
  optionLabel = "Item",
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
      <div className="mt-3 grid grid-cols-1 md:grid-cols-[140px_1.2fr_120px_1fr] gap-2 items-start">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Provider</div>
          <select
            value={provider}
            onChange={(event) => onProviderChange(event.target.value)}
            data-testid={`${testidPrefix}-provider`}
            className={inputCls}
          >
            {providerOptions.map((entry) => (
              <option key={entry} value={entry} className="bg-[#12121A]">
                {entry}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">{optionLabel}</div>
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
