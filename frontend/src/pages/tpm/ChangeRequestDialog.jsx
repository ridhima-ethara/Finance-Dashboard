import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { GitPullRequest, X, Send, Cpu, Server, CreditCard, DollarSign, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { toast } from "sonner";
import { fmtCurrency } from "../../lib/format";
import { EC2_INSTANCES, PLATFORM_PROVIDERS, SUBSCRIPTION_CATALOG } from "../../data/mockCatalog";
import { ADD_CUSTOM_MODEL_OPTION, buildModelOptionLabel, promptForCustomModel } from "../../lib/modelCatalog";

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
}));

const buildModelLine = (modelOptions = [], provider = "") => ({
  id: uid("mdl"),
  optionId: modelOptions[0]?.value || "",
  optionLabel: modelOptions[0]?.label || "",
  provider: provider || modelOptions[0]?.platform || modelOptions[0]?.provider || "",
  amount: 0,
  note: "",
});

const buildInfraLine = (providerOptions = []) => {
  const provider = providerOptions[0] || getInfraProvider(EC2_INSTANCES[0]);
  const option = buildInfraOptions(provider)[0] || buildInfraOption(EC2_INSTANCES[0]);
  return {
    id: uid("inf"),
    provider,
    optionId: option.value,
    optionLabel: option.label,
    amount: 0,
    note: "",
  };
};

const buildSubscriptionLine = () => ({
  id: uid("sub"),
  optionId: SUBSCRIPTION_OPTIONS[0]?.value || "",
  optionLabel: SUBSCRIPTION_OPTIONS[0]?.label || "",
  amount: 0,
  note: "",
  billingUnit: "per month",
});

const buildSectionState = (factory) => ({
  enabled: false,
  lines: [factory()],
});

const sumEnabledLineAmounts = (section) => (
  section?.enabled
    ? (section.lines || []).reduce((sum, line) => sum + Number(line.amount || 0), 0)
    : 0
);

const joinLineLabels = (lines = []) => lines.map((line) => line.optionLabel).filter(Boolean).join(" | ");
const joinLineNotes = (lines = []) => lines.map((line) => String(line.note || "").trim()).filter(Boolean).join(" | ");

const ChangeRequestDialog = ({ open, onOpenChange }) => {
  const { visibleProjects, createChangeRequest, modelCatalog, addCustomModel } = useApp();
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

  const [project, setProject] = useState(visibleProjects[0]?.id || "");
  const [reason, setReason] = useState("");
  const [expectedTasks, setExpectedTasks] = useState("");
  const [timeline, setTimeline] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [models, setModels] = useState(() => buildSectionState(() => {
    const provider = modelProviderOptions[0] || "";
    return buildModelLine(getModelsForProvider(modelOptions, provider), provider);
  }));
  const [infra, setInfra] = useState(() => buildSectionState(() => buildInfraLine(infraProviderOptions)));
  const [subs, setSubs] = useState(() => buildSectionState(buildSubscriptionLine));
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!visibleProjects.some((entry) => entry.id === project)) {
      setProject(visibleProjects[0]?.id || "");
    }
  }, [project, visibleProjects]);

  useEffect(() => {
    const openedNow = open && !wasOpenRef.current;
    if (openedNow) {
      setReason("");
      setExpectedTasks("");
      setTimeline("");
      setUrgency("Normal");
      setModels(buildSectionState(() => {
        const provider = modelProviderOptions[0] || "";
        return buildModelLine(getModelsForProvider(modelOptions, provider), provider);
      }));
      setInfra(buildSectionState(() => buildInfraLine(infraProviderOptions)));
      setSubs(buildSectionState(buildSubscriptionLine));
    }
    wasOpenRef.current = open;
  }, [infraProviderOptions, modelOptions, modelProviderOptions, open]);

  const modelsAmount = sumEnabledLineAmounts(models);
  const infraAmount = sumEnabledLineAmounts(infra);
  const subsAmount = sumEnabledLineAmounts(subs);
  const totalAsk = modelsAmount + infraAmount + subsAmount;

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
      const option = providerModels.find((entry) => entry.value === line.optionId) || providerModels[0] || modelOptions[0];
      return {
        ...line,
        provider,
        optionId: option?.value || "",
        optionLabel: option?.label || "",
      };
    });
  };

  const updateInfraProvider = (lineId, provider) => {
    updateMultiLine(setInfra, lineId, (line) => {
      const option = buildInfraOptions(provider).find((entry) => entry.value === line.optionId) || buildInfraOptions(provider)[0] || buildInfraOption(EC2_INSTANCES[0]);
      return {
        ...line,
        provider,
        optionId: option.value,
        optionLabel: option.label,
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

  const submit = () => {
    if (!reason.trim()) return toast.error("Please explain the reason");
    if (!project) return toast.error("Select a project first");

    const modelEntries = models.enabled
      ? models.lines.filter((line) => Number(line.amount || 0) > 0)
      : [];
    const infraEntries = infra.enabled
      ? infra.lines.filter((line) => Number(line.amount || 0) > 0)
      : [];
    const subEntries = subs.enabled
      ? subs.lines.filter((line) => Number(line.amount || 0) > 0)
      : [];

    const breakdown = {
      models: modelEntries.length ? {
        amount: modelsAmount,
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
        optionLabel: joinLineLabels(infraEntries),
        note: joinLineNotes(infraEntries),
        entries: infraEntries.map((line) => ({
          id: line.id,
          optionId: line.optionId,
          optionLabel: line.optionLabel,
          note: line.note,
          amount: Number(line.amount || 0),
          provider: line.provider || "",
        })),
      } : null,
      subs: subEntries.length ? {
        amount: subsAmount,
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

    const projectName = visibleProjects.find((entry) => entry.id === project)?.name || "Project";
    createChangeRequest({
      projectId: project,
      reason,
      urgency,
      expectedTasks,
      timelineDelta: timeline,
      breakdown,
    });
    toast.success("Change request submitted", {
      description: `${projectName} · ${totalAsk > 0 ? fmtCurrency(totalAsk, { compact: false }) : "no $ ask"} · ${urgency} · routed to CTO`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="cr-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
              <GitPullRequest className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise change request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Modify scope, timeline, or budget · provider-first models and infra · routed to CTO for review
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Project">
            <select value={project} onChange={(event) => setProject(event.target.value)} data-testid="cr-project" className={selectCls}>
              {visibleProjects.length === 0 && <option value="">— No projects available —</option>}
              {visibleProjects.map((entry) => (
                <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                  {entry.name}{entry.client ? ` · ${entry.client}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Budget-item asks (optional)</div>
            <div className="space-y-3">
              <MultiLineSection
                title="Models"
                helper="Choose provider first, then the matching model change line."
                icon={Cpu}
                enabled={models.enabled}
                onToggle={() => setModels((current) => ({ ...current, enabled: !current.enabled }))}
                lines={models.lines}
                addLabel="Add model"
                total={modelsAmount}
                onAdd={() => addMultiLine(setModels, () => {
                  const provider = modelProviderOptions[0] || "";
                  return buildModelLine(getModelsForProvider(modelOptions, provider), provider);
                })}
                onRemove={(lineId) => removeMultiLine(setModels, lineId)}
                onProviderChange={updateModelProvider}
                getProviderValue={(line) => line.provider}
                providerOptions={modelProviderOptions}
                onOptionChange={handleModelOptionChange}
                onAmountChange={(lineId, value) => updateMultiLine(setModels, lineId, (line) => ({ ...line, amount: Number(value || 0) }))}
                onNoteChange={(lineId, value) => updateMultiLine(setModels, lineId, (line) => ({ ...line, note: value }))}
                getOptions={(line) => getModelsForProvider(modelOptions, line.provider)}
                notePlaceholder="Model change note"
                testidPrefix="cr-models"
                allowCustomOption
                optionLabel="Model"
              />

              <MultiLineSection
                title="Infrastructure"
                helper="Choose provider first, then the matching infra delta per line."
                icon={Server}
                enabled={infra.enabled}
                onToggle={() => setInfra((current) => ({ ...current, enabled: !current.enabled }))}
                lines={infra.lines}
                addLabel="Add infra line"
                total={infraAmount}
                onAdd={() => addMultiLine(setInfra, () => buildInfraLine(infraProviderOptions))}
                onRemove={(lineId) => removeMultiLine(setInfra, lineId)}
                onProviderChange={updateInfraProvider}
                getProviderValue={(line) => line.provider}
                providerOptions={infraProviderOptions}
                onOptionChange={(lineId, value) => updateMultiLine(setInfra, lineId, (line) => {
                  const option = buildInfraOptions(line.provider).find((entry) => entry.value === value) || buildInfraOption(EC2_INSTANCES[0]);
                  return {
                    ...line,
                    optionId: value,
                    optionLabel: option.label,
                  };
                })}
                onAmountChange={(lineId, value) => updateMultiLine(setInfra, lineId, (line) => ({ ...line, amount: Number(value || 0) }))}
                onNoteChange={(lineId, value) => updateMultiLine(setInfra, lineId, (line) => ({ ...line, note: value }))}
                getOptions={(line) => buildInfraOptions(line.provider)}
                notePlaceholder="Infra change note"
                testidPrefix="cr-infra"
                optionLabel="Infra"
              />

              <MultiLineSection
                title="Subscriptions"
                helper="Keep subscription asks visible in the same CTO review flow."
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
                notePlaceholder="Seats or tooling context"
                testidPrefix="cr-subs"
                billingUnitLabel="per month"
                optionLabel="Subscription"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Total additional ask</span>
              <span className="text-amber-300 font-semibold tabular" data-testid="cr-total">{fmtCurrency(totalAsk, { compact: false })}</span>
            </div>
          </div>

          <Field label="Urgency">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
              {["Low", "Normal", "High"].map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setUrgency(entry)}
                  data-testid={`cr-urgency-${entry.toLowerCase()}`}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${
                    urgency === entry ? "bg-amber-500/15 text-amber-300" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Expected tasks">
            <input
              value={expectedTasks}
              onChange={(event) => setExpectedTasks(event.target.value)}
              placeholder="e.g. 250 expected tasks after scope change"
              data-testid="cr-tasks"
              className={inputCls}
            />
          </Field>

          <Field label="Timeline change">
            <input
              value={timeline}
              onChange={(event) => setTimeline(event.target.value)}
              placeholder="e.g. Extend by 5 days"
              data-testid="cr-timeline"
              className={inputCls}
            />
          </Field>

          <Field label="Justification">
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain the change — why is it needed, what changes downstream?"
              data-testid="cr-reason"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
            />
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

const selectCls = "w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40";
const inputCls = "w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40";

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

const SectionToggle = ({ enabled, onToggle, title, helper, icon: Icon, total, testid }) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={onToggle}
      data-testid={testid}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${enabled ? "border-amber-400 bg-amber-500" : "border-white/20 bg-transparent"}`}
    >
      {enabled && <span className="text-[10px] text-black font-bold">✓</span>}
    </button>
    <Icon className="w-4 h-4 flex-shrink-0 text-amber-300" />
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
    <div className={`rounded-xl border p-3 ${enabled ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-white/5 bg-white/[0.02]"}`} data-testid={`${testidPrefix}-row`}>
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
            className="h-8 rounded-md border border-amber-500/25 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs gap-1"
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

export default ChangeRequestDialog;
