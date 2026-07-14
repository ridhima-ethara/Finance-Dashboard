import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { GitPullRequest, X, Send, Cpu, Server, CreditCard, DollarSign, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { toast } from "sonner";
import { fmtCurrency } from "../../lib/format";
import { EC2_INSTANCES, SUBSCRIPTION_CATALOG } from "../../data/mockCatalog";
import { ADD_CUSTOM_MODEL_OPTION, buildModelOptionLabel, promptForCustomModel } from "../../lib/modelCatalog";

const uid = (prefix = "row") => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const INFRA_OPTIONS = EC2_INSTANCES.map((instance) => ({
  value: instance.code,
  label: `${instance.code} · ${instance.family} · ${instance.vCPU} vCPU · ${instance.memoryGiB} GiB`,
}));

const SUBSCRIPTION_OPTIONS = SUBSCRIPTION_CATALOG.map((subscription) => ({
  value: subscription.id,
  label: `${subscription.name} · $${subscription.monthly}/month`,
}));

const buildModelLine = (modelOptions = []) => ({
  id: uid("mdl"),
  optionId: modelOptions[0]?.value || "",
  optionLabel: modelOptions[0]?.label || "",
  provider: modelOptions[0]?.provider || "",
  amount: 0,
  note: "",
});

const buildInfraLine = () => ({
  id: uid("inf"),
  optionId: INFRA_OPTIONS[0]?.value || "",
  optionLabel: INFRA_OPTIONS[0]?.label || "",
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
  })), [modelCatalog]);

  const [project, setProject] = useState(visibleProjects[0]?.id || "");
  const [reason, setReason] = useState("");
  const [expectedTasks, setExpectedTasks] = useState("");
  const [timeline, setTimeline] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [models, setModels] = useState(() => buildSectionState(() => buildModelLine(modelOptions)));
  const [infra, setInfra] = useState(() => buildSectionState(buildInfraLine));
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
      setModels(buildSectionState(() => buildModelLine(modelOptions)));
      setInfra(buildSectionState(buildInfraLine));
      setSubs(buildSectionState(buildSubscriptionLine));
    }
    wasOpenRef.current = open;
  }, [modelOptions, open]);

  const modelsAmount = sumEnabledLineAmounts(models);
  const infraAmount = sumEnabledLineAmounts(infra);
  const subsAmount = sumEnabledLineAmounts(subs);
  const totalAsk = modelsAmount + infraAmount + subsAmount;

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

  const handleModelOptionChange = (lineId, value) => {
    if (value === ADD_CUSTOM_MODEL_OPTION) {
      const created = promptForCustomModel(addCustomModel);
      if (!created) return;
      setModels((current) => ({
        ...current,
        lines: current.lines.map((line) => (
          line.id === lineId
            ? {
                ...line,
                optionId: created.id,
                optionLabel: buildModelOptionLabel(created),
                provider: created.provider || "",
              }
            : line
        )),
      }));
      toast.success("Custom model added", {
        description: `${created.name} · ${created.provider} is now available in all model dropdowns.`,
      });
      return;
    }
    updateMultiLine(setModels, lineId, "optionId", value, modelOptions, (option) => ({ provider: option?.provider || "" }));
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

    const projectName = visibleProjects.find((p) => p.id === project)?.name || "Project";
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
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="cr-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
              <GitPullRequest className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise change request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Modify scope, timeline, or budget · line-item breakdown with models, infra, and subscriptions · routed to CTO for review
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Project">
            <select value={project} onChange={(e) => setProject(e.target.value)} data-testid="cr-project" className={selectCls}>
              {visibleProjects.length === 0 && <option value="">— No projects available —</option>}
              {visibleProjects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#12121A]">
                  {p.name}{p.client ? ` · ${p.client}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Budget-item asks (optional)</div>
            <div className="space-y-3">
              <MultiLineSection
                title="Models"
                helper="Multi-select the Bedrock models involved in the change and capture the revised model delta per line."
                icon={Cpu}
                enabled={models.enabled}
                onToggle={() => setModels((current) => ({ ...current, enabled: !current.enabled }))}
                lines={models.lines}
                addLabel="Add model"
                total={modelsAmount}
                onAdd={() => addMultiLine(setModels, () => buildModelLine(modelOptions))}
                onRemove={(lineId) => removeMultiLine(setModels, lineId)}
                onOptionChange={handleModelOptionChange}
                onAmountChange={(lineId, value) => updateMultiLine(setModels, lineId, "amount", value, modelOptions, () => ({}))}
                onNoteChange={(lineId, value) => updateMultiLine(setModels, lineId, "note", value, modelOptions, () => ({}))}
                options={modelOptions}
                notePlaceholder="Model change note · e.g. move eval traffic to Claude Sonnet 4.6"
                testidPrefix="cr-models"
                allowCustomOption
              />

              <MultiLineSection
                title="Infrastructure"
                helper="Multi-select the EC2 / infra lines involved in the change and capture the revised infra delta per line."
                icon={Server}
                enabled={infra.enabled}
                onToggle={() => setInfra((current) => ({ ...current, enabled: !current.enabled }))}
                lines={infra.lines}
                addLabel="Add infra line"
                total={infraAmount}
                onAdd={() => addMultiLine(setInfra, buildInfraLine)}
                onRemove={(lineId) => removeMultiLine(setInfra, lineId)}
                onOptionChange={(lineId, value) => updateMultiLine(setInfra, lineId, "optionId", value, INFRA_OPTIONS, () => ({}))}
                onAmountChange={(lineId, value) => updateMultiLine(setInfra, lineId, "amount", value, INFRA_OPTIONS, () => ({}))}
                onNoteChange={(lineId, value) => updateMultiLine(setInfra, lineId, "note", value, INFRA_OPTIONS, () => ({}))}
                options={INFRA_OPTIONS}
                notePlaceholder="Infra change note · e.g. add g5.2xlarge for the rerun window"
                testidPrefix="cr-infra"
              />

              <MultiLineSection
                title="Subscriptions"
                helper="Multi-select subscriptions and keep the seat / tooling delta visible per month."
                icon={CreditCard}
                enabled={subs.enabled}
                onToggle={() => setSubs((current) => ({ ...current, enabled: !current.enabled }))}
                lines={subs.lines}
                addLabel="Add subscription"
                total={subsAmount}
                onAdd={() => addMultiLine(setSubs, buildSubscriptionLine)}
                onRemove={(lineId) => removeMultiLine(setSubs, lineId)}
                onOptionChange={(lineId, value) => updateMultiLine(setSubs, lineId, "optionId", value, SUBSCRIPTION_OPTIONS, () => ({ billingUnit: "per month" }))}
                onAmountChange={(lineId, value) => updateMultiLine(setSubs, lineId, "amount", value, SUBSCRIPTION_OPTIONS, () => ({}))}
                onNoteChange={(lineId, value) => updateMultiLine(setSubs, lineId, "note", value, SUBSCRIPTION_OPTIONS, () => ({}))}
                options={SUBSCRIPTION_OPTIONS}
                notePlaceholder="Seats or tooling context"
                testidPrefix="cr-subs"
                billingUnitLabel="per month"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Total additional ask</span>
              <span className="text-amber-300 font-semibold tabular" data-testid="cr-total">{fmtCurrency(totalAsk, { compact: false })}</span>
            </div>
          </div>

          <Field label="Urgency">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
              {["Low", "Normal", "High"].map((u) => (
                <button key={u} onClick={() => setUrgency(u)} data-testid={`cr-urgency-${u.toLowerCase()}`} className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${urgency === u ? "bg-amber-500/15 text-amber-300" : "text-zinc-400 hover:text-zinc-100"}`}>
                  {u}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Expected tasks">
            <input value={expectedTasks} onChange={(e) => setExpectedTasks(e.target.value)} placeholder="e.g. 250 expected tasks after scope change" data-testid="cr-tasks" className={inputCls} />
          </Field>

          <Field label="Timeline change">
            <input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. Extend by 5 days" data-testid="cr-timeline" className={inputCls} />
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
  onOptionChange,
  onAmountChange,
  onNoteChange,
  options,
  notePlaceholder,
  testidPrefix,
  billingUnitLabel,
  allowCustomOption = false,
}) => (
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
        ))}
      </div>
    )}
  </div>
);

export default ChangeRequestDialog;
