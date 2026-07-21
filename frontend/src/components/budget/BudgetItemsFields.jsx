import { useEffect, useMemo, useRef, useState } from "react";
import { Cpu, CreditCard, Plus, Server, Trash2, UserPlus } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { EC2_INSTANCES, BEDROCK_MODELS, INFRA_STORAGE_TYPES, PLATFORM_PROVIDERS, SUBSCRIPTION_CATALOG } from "../../data/mockCatalog";
import { ADD_CUSTOM_MODEL_OPTION, buildModelOptionLabel, promptForCustomModel } from "../../lib/modelCatalog";

const HOURS_PER_MONTH = 730;
const MODEL_PLATFORM_PRIORITY = PLATFORM_PROVIDERS;
const MODEL_PLATFORM_MAP = {
  AWS: new Set(["AI21", "Amazon", "Anthropic", "Cohere", "DeepSeek", "Meta", "Mistral", "Stability AI"]),
  OpenAI: new Set(["OpenAI"]),
  OpenRouter: new Set(["MiniMax", "NVIDIA", "xAI", "Z.AI", "Zhipu AI"]),
  GCP: new Set(["Google"]),
  Moonshot: new Set(["Moonshot AI"]),
};

const uid = (prefix = "row") => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const getModelPlatform = (model = {}) => {
  const explicit = String(model?.platform || "").trim();
  if (explicit) return explicit;
  const provider = String(model?.provider || "").trim();
  if (MODEL_PLATFORM_PRIORITY.includes(provider)) return provider;
  const matched = MODEL_PLATFORM_PRIORITY.find((platform) => MODEL_PLATFORM_MAP[platform]?.has(provider));
  return matched || "OpenRouter";
};
const getModelsForProvider = (catalog = [], provider = "") => {
  const filtered = catalog.filter((model) => getModelPlatform(model) === provider);
  return filtered.length ? filtered : catalog;
};

const getInfraProvider = (instance = {}) => String(instance?.provider || "AWS").trim() || "AWS";
const getInstancesForProvider = (provider = "") => {
  const filtered = EC2_INSTANCES.filter((instance) => getInfraProvider(instance) === provider);
  return filtered.length ? filtered : EC2_INSTANCES;
};
const getStorageTypesForProvider = (provider = "") => {
  const options = INFRA_STORAGE_TYPES[provider];
  return Array.isArray(options) && options.length ? options : ["Standard SSD"];
};
const getDefaultStorageType = (provider = "") => getStorageTypesForProvider(provider)[0] || "Standard SSD";
const normalizeStorageTypeForProvider = (provider = "", storageType = "") => {
  const options = getStorageTypesForProvider(provider);
  return options.includes(storageType) ? storageType : getDefaultStorageType(provider);
};
const getInfraInstanceCount = (value = 1) => Math.max(1, Number(value || 1));
const getPerInstanceStorage = (value = 100) => Math.max(0, Number(value || 0));
const getDailyRateFromMonthly = (monthlyAmount = 0) => Number(monthlyAmount || 0) / 30;
const calculateInfraEstimate = ({ monthlyCost = 0, instanceCount = 1, days = 0 } = {}) =>
  Math.round(getDailyRateFromMonthly(monthlyCost) * getInfraInstanceCount(instanceCount) * Number(days || 0) * 100) / 100;

// Seed cost/task from model catalog (~4K in + 1K out per trajectory) — user can override.
const seedCostPerTask = (model) => {
  if (!model) return 0.05;
  return Math.round((model.pricePer1kIn * 4 + model.pricePer1kOut * 1) * 10000) / 10000;
};

const emptyModelItem = (modelCatalog = BEDROCK_MODELS) => {
  const providerModels = getModelsForProvider(modelCatalog, MODEL_PLATFORM_PRIORITY[0]);
  const m = providerModels[0] || modelCatalog[0] || BEDROCK_MODELS[0];
  return { id: uid("mdl"), modelId: m.id, provider: getModelPlatform(m), usageTag: "Trajectory building", costPerTask: seedCostPerTask(m) };
};
const emptyInfraItem = () => {
  const inst = EC2_INSTANCES[0];
  const provider = getInfraProvider(inst);
  return {
    id: uid("inf"),
    provider,
    instance: inst.code,
    instanceCount: 1,
    monthlyCost: Math.round(inst.hourly * HOURS_PER_MONTH * 100) / 100,
    storageType: getDefaultStorageType(provider),
    perInstanceStorage: 100,
  };
};
const emptySubItem = () => {
  const s = SUBSCRIPTION_CATALOG[0];
  return { id: uid("sub"), subscription: s.name, pricePerSeat: s.monthly, seats: 1, days: null, members: [] };
};

const modelEstCost = (line, units) => Math.round(Number(line.costPerTask || 0) * Number(units || 0) * 100) / 100;
const infraEstCost = (line, days) => calculateInfraEstimate({ monthlyCost: Number(line.monthlyCost || 0), instanceCount: line.instanceCount, days });
const subEstCost = (line, fallbackDays) =>
  Math.round((Number(line.pricePerSeat || 0) * Number(line.seats || 1) * Number(line.days ?? fallbackDays) / 30) * 100) / 100;

const ACCENTS = {
  fuchsia: {
    text: "text-fuchsia-300",
    ring1: "focus:ring-1 focus:ring-fuchsia-500/40",
    ring2: "focus:ring-2 focus:ring-fuchsia-500/40",
    add: "border border-fuchsia-500/25 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-300",
    cardOn: "border-fuchsia-500/30 bg-fuchsia-500/[0.04]",
    toggleOn: "border-fuchsia-400 bg-fuchsia-500",
  },
  amber: {
    text: "text-amber-300",
    ring1: "focus:ring-1 focus:ring-amber-500/40",
    ring2: "focus:ring-2 focus:ring-amber-500/40",
    add: "border border-amber-500/25 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200",
    cardOn: "border-amber-500/30 bg-amber-500/[0.04]",
    toggleOn: "border-amber-400 bg-amber-500",
  },
};

const BudgetItemsFields = ({ open = true, resetKey = "", selectedProject = null, accent = "fuchsia", onChange }) => {
  const { modelCatalog, addCustomModel } = useApp();
  const ac = ACCENTS[accent] || ACCENTS.fuchsia;
  const rowInp = `h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none ${ac.ring1}`;
  const sizeInp = `w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none ${ac.ring2}`;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const modelProviderOptions = useMemo(
    () => MODEL_PLATFORM_PRIORITY.filter((platform) => getModelsForProvider(modelCatalog, platform).length > 0),
    [modelCatalog]
  );
  const infraProviderOptions = useMemo(
    () => MODEL_PLATFORM_PRIORITY.filter((platform) => getInstancesForProvider(platform).length > 0),
    []
  );

  const [sizing, setSizing] = useState({ tasks: 500, trajectories: 3, days: 30 });
  const [selectedTypes, setSelectedTypes] = useState({ models: true, infra: false, subs: false });
  const [models, setModels] = useState(() => [emptyModelItem(modelCatalog)]);
  const [infra, setInfra] = useState(() => [emptyInfraItem()]);
  const [subs, setSubs] = useState(() => [emptySubItem()]);

  // Reset to defaults whenever the dialog is (re)opened or the project changes while open.
  const wasOpenRef = useRef(false);
  const lastResetKeyRef = useRef(resetKey);
  useEffect(() => {
    const openedNow = open && !wasOpenRef.current;
    const projectChangedWhileOpen = open && wasOpenRef.current && lastResetKeyRef.current !== resetKey;
    if (openedNow || projectChangedWhileOpen) {
      setSizing({ tasks: 500, trajectories: 3, days: 30 });
      setSelectedTypes({ models: true, infra: false, subs: false });
      setModels([emptyModelItem(modelCatalog)]);
      setInfra([emptyInfraItem()]);
      setSubs([emptySubItem()]);
    }
    wasOpenRef.current = open;
    lastResetKeyRef.current = resetKey;
  }, [open, resetKey, modelCatalog]);

  const modelPricingUnits = Math.max(0, Number(sizing.tasks || 0) * Number(sizing.trajectories || 0));
  const durationDays = Math.max(0, Number(sizing.days || 0));

  const subscriptionMemberPool = useMemo(() => {
    const coreMembers = [
      ...(selectedProject?.tpm ? [{ name: selectedProject.tpm, role: "TPM", email: selectedProject.tpmEmail || "" }] : []),
      ...((selectedProject?.plMembers || []).map((name) => ({ name, role: "Project Lead", email: "" }))),
      ...((selectedProject?.qlMembers || []).map((name) => ({ name, role: "Quality Lead", email: "" }))),
      ...((selectedProject?.rndMembers || []).map((name) => ({ name, role: "R&D", email: "" }))),
    ];
    const roster = [
      ...(selectedProject?.teamMembers || []),
      ...(selectedProject?.kickoffMail?.recipients || []),
      ...coreMembers,
    ];
    const seen = new Set();
    return roster.reduce((acc, member, index) => {
      const key = String(member?.email || member?.id || member?.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return acc;
      seen.add(key);
      acc.push({
        id: member?.id || member?.email || `${member?.name || "member"}-${index}`,
        name: member?.name || "Unknown member",
        role: member?.role || "Member",
        email: member?.email || "",
      });
      return acc;
    }, []);
  }, [selectedProject]);

  const modelsTotal = selectedTypes.models ? models.reduce((sum, line) => sum + modelEstCost(line, modelPricingUnits), 0) : 0;
  const infraTotal = selectedTypes.infra ? infra.reduce((sum, line) => sum + infraEstCost(line, durationDays), 0) : 0;
  const subsTotal = selectedTypes.subs ? subs.reduce((sum, line) => sum + subEstCost(line, durationDays), 0) : 0;
  const total = Math.round((modelsTotal + infraTotal + subsTotal) * 100) / 100;

  const buildSection = (entries, extra = {}) => {
    const kept = entries.filter((entry) => entry.amount > 0 || entry.optionLabel);
    if (!kept.length) return null;
    return {
      amount: kept.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
      optionId: kept[0]?.optionId || "",
      optionLabel: kept.map((entry) => entry.optionLabel).filter(Boolean).join(" | "),
      note: kept.map((entry) => entry.note).filter(Boolean).join(" | "),
      entries: kept,
      ...extra,
    };
  };

  const breakdown = useMemo(() => {
    const modelEntries = selectedTypes.models
      ? models.map((line) => {
          const meta = modelCatalog.find((m) => m.id === line.modelId) || null;
          return {
            id: line.id,
            optionId: line.modelId,
            optionLabel: meta ? buildModelOptionLabel(meta) : line.modelId || "Model",
            note: line.usageTag || "",
            amount: modelEstCost(line, modelPricingUnits),
            provider: line.provider || meta?.provider || "",
          };
        })
      : [];
    const infraEntries = selectedTypes.infra
      ? infra.map((line) => {
          const count = getInfraInstanceCount(line.instanceCount);
          const monthly = Number(line.monthlyCost || 0);
          return {
            id: line.id,
            optionId: line.instance,
            optionLabel: `${line.instance} · ${count} × ${line.storageType} ${getPerInstanceStorage(line.perInstanceStorage)}GB · ${fmtCurrency(monthly, { compact: false })}/mo`,
            note: `${count} instance${count === 1 ? "" : "s"} · ${line.storageType} ${getPerInstanceStorage(line.perInstanceStorage)}GB · ${durationDays} days`,
            amount: infraEstCost(line, durationDays),
            provider: line.provider || "",
          };
        })
      : [];
    const subEntries = selectedTypes.subs
      ? subs.map((line) => {
          const meta = SUBSCRIPTION_CATALOG.find((s) => s.name === line.subscription) || null;
          const seats = Number(line.seats || 1);
          return {
            id: line.id,
            optionId: meta?.id || "",
            optionLabel: `${line.subscription} · ${seats} seat${seats === 1 ? "" : "s"}`,
            note: line.members.length ? `Members: ${line.members.join(", ")}` : "",
            amount: subEstCost(line, durationDays),
            provider: meta?.provider || "",
            billingUnit: "per month",
          };
        })
      : [];
    return {
      total,
      models: buildSection(modelEntries),
      infra: buildSection(infraEntries),
      subs: buildSection(subEntries, { billingUnit: "per month" }),
    };
  }, [selectedTypes, models, infra, subs, modelPricingUnits, durationDays, modelCatalog, total]);

  useEffect(() => {
    onChangeRef.current?.({ breakdown, total });
  }, [breakdown, total]);

  const updateModelRow = (id, key, value) =>
    setModels((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: value };
      if (key === "provider") {
        const providerModels = getModelsForProvider(modelCatalog, next.provider);
        const meta = providerModels.find((m) => m.id === next.modelId) || providerModels[0] || modelCatalog[0] || BEDROCK_MODELS[0];
        next.modelId = meta.id;
        next.provider = getModelPlatform(meta);
        next.costPerTask = seedCostPerTask(meta);
      }
      if (key === "modelId") {
        const meta = modelCatalog.find((m) => m.id === next.modelId) || modelCatalog[0] || BEDROCK_MODELS[0];
        next.provider = getModelPlatform(meta);
        next.costPerTask = seedCostPerTask(meta);
      }
      return next;
    }));
  const handleModelSelect = (rowId, value) => {
    if (value === ADD_CUSTOM_MODEL_OPTION) {
      const created = promptForCustomModel(addCustomModel);
      if (!created) return;
      setModels((rows) => rows.map((row) => (row.id === rowId ? { ...row, modelId: created.id, provider: getModelPlatform(created), costPerTask: seedCostPerTask(created) } : row)));
      return;
    }
    updateModelRow(rowId, "modelId", value);
  };

  const updateInfraRow = (id, key, value) =>
    setInfra((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: value };
      if (key === "instanceCount") next.instanceCount = getInfraInstanceCount(value);
      if (key === "perInstanceStorage") next.perInstanceStorage = getPerInstanceStorage(value);
      if (key === "storageType") next.storageType = normalizeStorageTypeForProvider(next.provider || "", String(value || ""));
      if (key === "provider") {
        const meta = getInstancesForProvider(next.provider)[0] || EC2_INSTANCES[0];
        next.instance = meta.code;
        next.monthlyCost = Math.round(meta.hourly * HOURS_PER_MONTH * 100) / 100;
        next.storageType = normalizeStorageTypeForProvider(next.provider, next.storageType || "");
      }
      if (key === "instance") {
        const inst = EC2_INSTANCES.find((x) => x.code === next.instance) || EC2_INSTANCES[0];
        next.provider = getInfraProvider(inst);
        next.monthlyCost = Math.round(inst.hourly * HOURS_PER_MONTH * 100) / 100;
        next.storageType = normalizeStorageTypeForProvider(next.provider, next.storageType || "");
      }
      return next;
    }));

  const updateSubRow = (id, key, value) =>
    setSubs((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: value };
      if (key === "subscription") {
        const s = SUBSCRIPTION_CATALOG.find((x) => x.name === next.subscription) || SUBSCRIPTION_CATALOG[0];
        next.pricePerSeat = s.monthly;
      }
      return next;
    }));
  const updateSubMembers = (id, members) =>
    setSubs((rows) => rows.map((r) => (r.id === id ? { ...r, members, seats: Math.max(members.length, 1) } : r)));

  const removeRow = (setter) => (id) => setter((rows) => (rows.length === 1 ? rows : rows.filter((x) => x.id !== id)));

  const toggleType = (key) => setSelectedTypes((state) => ({ ...state, [key]: !state[key] }));

  return (
    <div className="space-y-3" data-testid="budget-items-fields">
      <div>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Sizing for cost estimate</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <SizeField label="Tasks">
            <input type="number" min="0" value={sizing.tasks} onChange={(e) => setSizing((s) => ({ ...s, tasks: e.target.value }))} data-testid="bif-tasks" className={sizeInp + " tabular"} />
          </SizeField>
          <SizeField label="Trajectories / task">
            <input type="number" min="0" value={sizing.trajectories} onChange={(e) => setSizing((s) => ({ ...s, trajectories: e.target.value }))} data-testid="bif-trajectories" className={sizeInp + " tabular"} />
          </SizeField>
          <SizeField label="Duration (days)">
            <input type="number" min="0" value={sizing.days} onChange={(e) => setSizing((s) => ({ ...s, days: e.target.value }))} data-testid="bif-days" className={sizeInp + " tabular"} />
          </SizeField>
        </div>
        <div className="mt-1.5 text-[11px] text-zinc-500">
          Model cost = cost/task × <span className={ac.text}>{modelPricingUnits.toLocaleString()}</span> pricing units · infra & subscriptions prorated over <span className={ac.text}>{durationDays.toLocaleString()}</span> days.
        </div>
      </div>

      {/* Models */}
      <SectionCard ac={ac} icon={Cpu} title="Models" helper="Provider → model → usage tag · cost auto-computed" enabled={selectedTypes.models} onToggle={() => toggleType("models")} subtotal={modelsTotal}
        addLabel="Add model" onAdd={() => setModels((r) => [...r, emptyModelItem(modelCatalog)])} testidPrefix="bif-models">
        <div className="space-y-1.5">
          <div className="hidden md:grid grid-cols-[.9fr_1.3fr_1fr_1fr_1fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
            <span>Provider</span><span>Model</span><span>Usage tag</span><span className="text-right">Cost / task ($)</span><span className="text-right">Est. cost</span><span />
          </div>
          {models.map((r) => {
            const providerModels = getModelsForProvider(modelCatalog, r.provider || modelProviderOptions[0] || "");
            return (
              <div key={r.id} data-testid={`bif-models-row-${r.id}`} className="grid grid-cols-1 md:grid-cols-[.9fr_1.3fr_1fr_1fr_1fr_28px] gap-2 items-center py-1">
                <select value={r.provider || modelProviderOptions[0] || ""} onChange={(e) => updateModelRow(r.id, "provider", e.target.value)} data-testid={`bif-models-provider-${r.id}`} className={rowInp}>
                  {modelProviderOptions.map((provider) => <option key={provider} value={provider} className="bg-[#12121A]">{provider}</option>)}
                </select>
                <select value={r.modelId} onChange={(e) => handleModelSelect(r.id, e.target.value)} data-testid={`bif-models-select-${r.id}`} className={rowInp}>
                  {providerModels.map((m) => <option key={m.id} value={m.id} className="bg-[#12121A]">{buildModelOptionLabel(m)}</option>)}
                  <option value={ADD_CUSTOM_MODEL_OPTION} className="bg-[#12121A]">+ Add new model...</option>
                </select>
                <select value={r.usageTag} onChange={(e) => updateModelRow(r.id, "usageTag", e.target.value)} data-testid={`bif-models-usage-${r.id}`} className={rowInp}>
                  <option value="Trajectory building" className="bg-[#12121A]">Trajectory building</option>
                  <option value="QC checks" className="bg-[#12121A]">QC checks</option>
                </select>
                <input type="number" min="0" step="0.001" value={r.costPerTask} onChange={(e) => updateModelRow(r.id, "costPerTask", e.target.value)} data-testid={`bif-models-cost-${r.id}`} className={rowInp + " tabular text-right"} />
                <div className={`h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs ${ac.text} text-right leading-8`} data-testid={`bif-models-est-${r.id}`}>{fmtCurrency(modelEstCost(r, modelPricingUnits), { compact: false })}</div>
                <RemoveBtn onClick={() => removeRow(setModels)(r.id)} testid={`bif-models-remove-${r.id}`} />
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Infrastructure */}
      <SectionCard ac={ac} icon={Server} title="Infrastructure" helper="Provider, instance count, storage · monthly spend" enabled={selectedTypes.infra} onToggle={() => toggleType("infra")} subtotal={infraTotal}
        addLabel="Add infra" onAdd={() => setInfra((r) => [...r, emptyInfraItem()])} testidPrefix="bif-infra">
        <div className="space-y-2">
          {infra.map((r) => {
            const providerInstances = getInstancesForProvider(r.provider || infraProviderOptions[0] || getInfraProvider(EC2_INSTANCES[0]));
            const storageOptions = getStorageTypesForProvider(r.provider);
            const perDay = Math.round(getDailyRateFromMonthly(Number(r.monthlyCost || 0)) * getInfraInstanceCount(r.instanceCount) * 100) / 100;
            return (
              <div key={r.id} data-testid={`bif-infra-row-${r.id}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="grid grid-cols-1 md:grid-cols-[.85fr_1.6fr_.9fr_.7fr_28px] gap-2 items-end">
                  <CompactField label="Provider">
                    <select value={r.provider || infraProviderOptions[0] || ""} onChange={(e) => updateInfraRow(r.id, "provider", e.target.value)} data-testid={`bif-infra-provider-${r.id}`} className={`${rowInp} w-full`}>
                      {infraProviderOptions.map((option) => <option key={option} value={option} className="bg-[#12121A]">{option}</option>)}
                    </select>
                  </CompactField>
                  <CompactField label="Infra instance">
                    <select value={r.instance} onChange={(e) => updateInfraRow(r.id, "instance", e.target.value)} data-testid={`bif-infra-select-${r.id}`} className={`${rowInp} w-full`}>
                      {providerInstances.map((i) => <option key={i.code} value={i.code} className="bg-[#12121A]">{i.code} · {i.family} · {i.vCPU} vCPU · {i.memoryGiB} GiB</option>)}
                    </select>
                  </CompactField>
                  <CompactField label="Monthly ($)">
                    <input type="number" min="0" step="10" value={r.monthlyCost} onChange={(e) => updateInfraRow(r.id, "monthlyCost", e.target.value)} data-testid={`bif-infra-monthly-${r.id}`} className={`${rowInp} w-full tabular text-right`} />
                  </CompactField>
                  <CompactField label="No. instances">
                    <input type="number" min="1" step="1" value={r.instanceCount || 1} onChange={(e) => updateInfraRow(r.id, "instanceCount", e.target.value)} data-testid={`bif-infra-count-${r.id}`} className={`${rowInp} w-full tabular text-right`} />
                  </CompactField>
                  <div className="flex items-end justify-end h-full">
                    <RemoveBtn onClick={() => removeRow(setInfra)(r.id)} testid={`bif-infra-remove-${r.id}`} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_.65fr_.8fr_.85fr] gap-2 items-end">
                  <CompactField label="Storage type">
                    <select value={normalizeStorageTypeForProvider(r.provider, r.storageType || "")} onChange={(e) => updateInfraRow(r.id, "storageType", e.target.value)} data-testid={`bif-infra-storage-type-${r.id}`} className={`${rowInp} w-full`}>
                      {storageOptions.map((option) => <option key={option} value={option} className="bg-[#12121A]">{option}</option>)}
                    </select>
                  </CompactField>
                  <CompactField label="Per instance storage (GB)">
                    <input type="number" min="0" step="10" value={r.perInstanceStorage ?? 100} onChange={(e) => updateInfraRow(r.id, "perInstanceStorage", e.target.value)} data-testid={`bif-infra-storage-size-${r.id}`} className={`${rowInp} w-full tabular text-right`} />
                  </CompactField>
                  <CompactField label="Days">
                    <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-zinc-300 text-right leading-8">{durationDays.toLocaleString()}</div>
                  </CompactField>
                  <CompactField label="≈ $/day">
                    <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-zinc-300 text-right leading-8">{fmtCurrency(perDay, { compact: false })}</div>
                  </CompactField>
                  <CompactField label="Est. cost">
                    <div className={`h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs ${ac.text} text-right leading-8`} data-testid={`bif-infra-est-${r.id}`}>{fmtCurrency(infraEstCost(r, durationDays), { compact: false })}</div>
                  </CompactField>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Subscriptions */}
      <SectionCard ac={ac} icon={CreditCard} title="Subscriptions" helper="$ per seat + assign members · seat-based" enabled={selectedTypes.subs} onToggle={() => toggleType("subs")} subtotal={subsTotal}
        addLabel="Add subscription" onAdd={() => setSubs((r) => [...r, emptySubItem()])} testidPrefix="bif-subs">
        <div className="space-y-3">
          <div className="hidden md:grid grid-cols-[1.25fr_.78fr_.55fr_.72fr_.9fr_1.35fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
            <span>Subscription</span><span className="text-right">Price ($)</span><span className="text-right">Seats</span><span className="text-right">Days</span><span className="text-right">Est. cost</span><span>Members</span><span />
          </div>
          {subs.map((r) => (
            <div key={r.id} data-testid={`bif-subs-row-${r.id}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="grid grid-cols-1 md:grid-cols-[1.25fr_.78fr_.55fr_.72fr_.9fr_1.35fr_28px] gap-2 items-start">
                <select value={r.subscription} onChange={(e) => updateSubRow(r.id, "subscription", e.target.value)} data-testid={`bif-subs-select-${r.id}`} className={rowInp}>
                  {SUBSCRIPTION_CATALOG.map((s) => <option key={s.id} value={s.name} className="bg-[#12121A]">{s.name}</option>)}
                </select>
                <input type="number" min="0" step="1" value={r.pricePerSeat} onChange={(e) => updateSubRow(r.id, "pricePerSeat", e.target.value)} data-testid={`bif-subs-price-${r.id}`} className={rowInp + " tabular text-right"} title="$ per seat / month" />
                <input type="number" min="1" value={r.seats} onChange={(e) => updateSubRow(r.id, "seats", e.target.value)} data-testid={`bif-subs-seats-${r.id}`} className={rowInp + " tabular text-right"} title="Seats" />
                <input type="number" min="1" step="1" value={r.days ?? durationDays} onChange={(e) => updateSubRow(r.id, "days", e.target.value)} data-testid={`bif-subs-days-${r.id}`} className={rowInp + " tabular text-right"} title="Subscription days" />
                <div className={`h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs ${ac.text} text-right leading-8`} data-testid={`bif-subs-est-${r.id}`}>{fmtCurrency(subEstCost(r, durationDays), { compact: false })}</div>
                <div data-testid={`bif-subs-members-${r.id}`}>
                  {subscriptionMemberPool.length === 0 ? (
                    <div className="min-h-[40px] rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">No members on this project yet</div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" data-testid={`bif-subs-member-trigger-${r.id}`} className="w-full min-h-[32px] rounded-md bg-white/[0.04] border border-white/10 px-3 py-1.5 text-left text-xs text-zinc-100 hover:bg-white/[0.07] transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{r.members.length ? `${r.members.length} member${r.members.length === 1 ? "" : "s"}` : "Assign members"}</span>
                            <span className="text-zinc-500"><UserPlus className="w-3.5 h-3.5" /></span>
                          </div>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto border-white/10 text-zinc-100">
                        {subscriptionMemberPool.map((member) => {
                          const checked = r.members.includes(member.name);
                          const subtitle = [member.email, member.role].filter(Boolean).join(" · ");
                          return (
                            <DropdownMenuCheckboxItem
                              key={member.id}
                              checked={checked}
                              onSelect={(event) => event.preventDefault()}
                              onCheckedChange={() => updateSubMembers(r.id, checked ? r.members.filter((entry) => entry !== member.name) : Array.from(new Set([...r.members, member.name])))}
                              className="items-start gap-2 py-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="truncate">{member.name}</div>
                                <div className="text-[10px] text-zinc-500">{subtitle}</div>
                              </div>
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="pt-1">
                  <RemoveBtn onClick={() => removeRow(setSubs)(r.id)} testid={`bif-subs-remove-${r.id}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

const SizeField = ({ label, children }) => (
  <div>
    <div className="mb-1 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    {children}
  </div>
);

const CompactField = ({ label, children }) => (
  <div>
    <div className="mb-1 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    {children}
  </div>
);

const RemoveBtn = ({ onClick, testid }) => (
  <button type="button" onClick={onClick} data-testid={testid} className="w-7 h-7 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center">
    <Trash2 className="w-3 h-3" />
  </button>
);

const SectionCard = ({ ac, icon: Icon, title, helper, enabled, onToggle, subtotal, addLabel, onAdd, testidPrefix, children }) => (
  <div className={`rounded-xl border p-3 ${enabled ? ac.cardOn : "border-white/5 bg-white/[0.02]"}`} data-testid={`${testidPrefix}-card`}>
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggle} data-testid={`${testidPrefix}-toggle`} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${enabled ? ac.toggleOn : "border-white/20 bg-transparent"}`}>
          {enabled && <span className="text-[10px] text-black font-bold">✓</span>}
        </button>
        <Icon className={`w-4 h-4 flex-shrink-0 ${ac.text}`} />
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${enabled ? "text-white" : "text-zinc-400"}`}>{title}</div>
          <div className="text-[10px] text-zinc-500">{helper}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Subtotal</div>
          <div className="text-sm font-semibold text-white tabular">{fmtCurrency(subtotal, { compact: false })}</div>
        </div>
        {enabled && (
          <Button type="button" size="sm" onClick={onAdd} className={`h-8 rounded-md text-xs gap-1 ${ac.add}`} data-testid={`${testidPrefix}-add`}>
            <Plus className="w-3 h-3" /> {addLabel}
          </Button>
        )}
      </div>
    </div>
    {enabled && <div className="mt-3">{children}</div>}
  </div>
);

export default BudgetItemsFields;
