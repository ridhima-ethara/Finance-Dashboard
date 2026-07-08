import { useMemo, useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Save, Send, Sparkles, ClipboardCheck, Cpu, Server, CreditCard,
  CheckCircle2, ChevronRight, UserPlus, MessageSquareWarning,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EC2_INSTANCES, BEDROCK_MODELS, SUBSCRIPTION_CATALOG } from "../../data/mockCatalog";
import { BUDGET_REVIEWS } from "../../data/mockTpm";
import { TEAM } from "../../data/mockUsers";

const uid = () => Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const HOURS_PER_MONTH = 730; // AWS standard

// Seed cost/task from the Bedrock catalog (~4K in + 1K out per trajectory) — user can override.
const seedCostPerTask = (model) => {
  if (!model) return 0.05;
  return Math.round((model.pricePer1kIn * 4 + model.pricePer1kOut * 1) * 10000) / 10000;
};

const emptyModelItem = (totalTrajectories = 0) => {
  const m = BEDROCK_MODELS[0];
  const costPerTask = seedCostPerTask(m);
  return {
    id: uid(),
    modelId: m.id,
    provider: m.provider,
    costPerTask,
    estCost: Math.round(costPerTask * totalTrajectories * 100) / 100,
  };
};
const emptyInfraItem = () => {
  const inst = EC2_INSTANCES[0];
  const monthly = Math.round(inst.hourly * HOURS_PER_MONTH * 100) / 100;
  return { id: uid(), instance: inst.code, monthlyCost: monthly, months: 1, estCost: monthly };
};
const emptySubItem = () => {
  const s = SUBSCRIPTION_CATALOG[0];
  return { id: uid(), subscription: s.name, pricePerSeat: s.monthly, seats: 1, months: 1, members: [], estCost: s.monthly };
};

const emptyPhase = (n, start, end) => ({
  id: `p${n}`,
  name: `Phase ${n}`,
  tasks: 100,
  trajectories: 3,
  start: start || todayISO(),
  end: end || plusDaysISO(14),
});

const BudgetBuilder = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editReviewId = params.get("edit");
  const { visibleProjects, submitBudget, budgetReviews, role, user } = useApp();
  const isRnd = role === "R&D";

  const [step, setStep] = useState(1); // 1=Details, 2=Budget Items, 3=Preview

  // Prefill from a returned review, if applicable
  const returnedReview = useMemo(() => {
    if (!editReviewId) return null;
    return budgetReviews.find((r) => r.id === editReviewId) || BUDGET_REVIEWS.find((r) => r.id === editReviewId) || null;
  }, [editReviewId, budgetReviews]);

  // ---- Step 1: Details ----
  const [projectId, setProjectId] = useState(returnedReview?.projectId || visibleProjects[0]?.id || "");
  const [priority, setPriority] = useState("Medium");
  // R&D users are locked to "RnD"; TPM can pick RnD or Production
  const initialBudgetType = isRnd ? "RnD" : (returnedReview ? "Production" : "Production");
  const [budgetType, setBudgetType] = useState(initialBudgetType);
  // R&D locked to single phase
  const [deliveryMode, setDeliveryMode] = useState(isRnd ? "single" : "single");

  const [singleStart, setSingleStart] = useState(todayISO());
  const [singleEnd, setSingleEnd] = useState(plusDaysISO(30));
  const [singlePhase, setSinglePhase] = useState({ tasks: 500, trajectories: 3 });
  const [phases, setPhases] = useState([
    { ...emptyPhase(1), start: todayISO(), end: plusDaysISO(15) },
    { ...emptyPhase(2), start: plusDaysISO(16), end: plusDaysISO(30) },
  ]);

  // ---- Step 2: Budget items ----
  const [selectedTypes, setSelectedTypes] = useState({ models: true, infra: true, subs: true });
  const [activeTab, setActiveTab] = useState("models");
  const [models, setModels] = useState([emptyModelItem(500 * 3)]);
  const [infra, setInfra] = useState([emptyInfraItem()]);
  const [subs, setSubs] = useState([emptySubItem()]);

  // If prefilling from a returned review, hydrate reasonable defaults
  useEffect(() => {
    if (!returnedReview) return;
    // Prefer stored modifiedPhases; fall back to review requested budget
    const proj = visibleProjects.find((p) => p.id === returnedReview.projectId);
    if (proj) setProjectId(proj.id);
    toast.info("Returned budget loaded — edit and resubmit", {
      description: returnedReview.ctoComment || "Address CTO comments below",
    });
  }, [returnedReview?.id]);

  const project = visibleProjects.find((p) => p.id === projectId);

  // Trajectories drive model volume (tasks × trajectories × costPerTraj)
  const totalTrajectories = useMemo(() => {
    if (deliveryMode === "single") return Number(singlePhase.tasks || 0) * Number(singlePhase.trajectories || 0);
    return phases.reduce((s, p) => s + Number(p.tasks || 0) * Number(p.trajectories || 0), 0);
  }, [deliveryMode, singlePhase, phases]);

  const totalTasks = useMemo(() => {
    if (deliveryMode === "single") return Number(singlePhase.tasks || 0);
    return phases.reduce((s, p) => s + Number(p.tasks || 0), 0);
  }, [deliveryMode, singlePhase, phases]);

  // Recompute model estCost whenever total trajectory volume changes (keeps user-entered costPerTask)
  useEffect(() => {
    setModels((rows) => rows.map((r) => {
      const meta = BEDROCK_MODELS.find((m) => m.id === r.modelId) || BEDROCK_MODELS[0];
      return {
        ...r,
        provider: meta.provider,
        estCost: Math.round(Number(r.costPerTask || 0) * totalTrajectories * 100) / 100,
      };
    }));
  }, [totalTrajectories]);

  const totals = useMemo(() => {
    const m = selectedTypes.models ? models.reduce((s, x) => s + Number(x.estCost || 0), 0) : 0;
    const i = selectedTypes.infra ? infra.reduce((s, x) => s + Number(x.estCost || 0), 0) : 0;
    const su = selectedTypes.subs ? subs.reduce((s, x) => s + Number(x.estCost || 0), 0) : 0;
    return { models: m, infra: i, subs: su, total: m + i + su };
  }, [models, infra, subs, selectedTypes]);

  const updateRow = (setter) => (id, key, v) => setter((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
  const removeRow = (setter) => (id) => setter((r) => r.filter((x) => x.id !== id));

  const updateModelRow = (id, key, v) => {
    setModels((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: v };
      if (key === "modelId") {
        const meta = BEDROCK_MODELS.find((m) => m.id === next.modelId) || BEDROCK_MODELS[0];
        next.provider = meta.provider;
        next.costPerTask = seedCostPerTask(meta);
      }
      next.estCost = Math.round(Number(next.costPerTask || 0) * totalTrajectories * 100) / 100;
      return next;
    }));
  };
  const updateInfraRow = (id, key, v) => {
    setInfra((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: v };
      if (["instance", "monthlyCost", "months"].includes(key)) {
        if (key === "instance") {
          const inst = EC2_INSTANCES.find((x) => x.code === next.instance) || EC2_INSTANCES[0];
          next.monthlyCost = Math.round(inst.hourly * HOURS_PER_MONTH * 100) / 100;
        }
        next.estCost = Math.round(Number(next.monthlyCost || 0) * Number(next.months || 1) * 100) / 100;
      }
      return next;
    }));
  };
  const updateSubRow = (id, key, v) => {
    setSubs((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: v };
      if (key === "subscription") {
        const s = SUBSCRIPTION_CATALOG.find((x) => x.name === next.subscription) || SUBSCRIPTION_CATALOG[0];
        next.pricePerSeat = s.monthly;
      }
      if (["subscription", "seats", "pricePerSeat", "months"].includes(key)) {
        next.estCost = Math.round(Number(next.pricePerSeat || 0) * Number(next.seats || 1) * Number(next.months || 1) * 100) / 100;
      }
      return next;
    }));
  };
  const toggleSubMember = (id, memberName) => {
    setSubs((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const has = r.members.includes(memberName);
      const members = has ? r.members.filter((m) => m !== memberName) : [...r.members, memberName];
      return { ...r, members, seats: Math.max(members.length, 1) };
    }));
  };

  const distributedPhases = useMemo(() => {
    if (deliveryMode === "single") {
      return [{ id: "p1", name: "Delivery", start: singleStart, end: singleEnd, budget: totals.total, tasks: Number(singlePhase.tasks), trajectories: Number(singlePhase.trajectories) }];
    }
    // weight by tasks × trajectories
    const totalTraj = phases.reduce((s, p) => s + Number(p.tasks || 0) * Number(p.trajectories || 0), 0) || 1;
    return phases.map((p) => {
      const traj = Number(p.tasks || 0) * Number(p.trajectories || 0);
      const share = traj / totalTraj;
      return { ...p, budget: Math.round(totals.total * share) };
    });
  }, [deliveryMode, phases, singleStart, singleEnd, singlePhase, totals.total]);

  const canProceedDetails = () => {
    if (!projectId) { toast.error("Select a project"); return false; }
    if (deliveryMode === "single") {
      if (!singlePhase.tasks || Number(singlePhase.tasks) <= 0) { toast.error("Enter number of tasks"); return false; }
      if (!singlePhase.trajectories || Number(singlePhase.trajectories) <= 0) { toast.error("Enter estimated trajectories per task"); return false; }
      if (!singleStart || !singleEnd) { toast.error("Set estimated start & end date"); return false; }
    } else {
      if (!phases.length) { toast.error("Add at least one phase"); return false; }
      for (const p of phases) {
        if (!p.name || !p.start || !p.end) { toast.error(`Complete ${p.name || "phase"} details`); return false; }
        if (!p.tasks || Number(p.tasks) <= 0) { toast.error(`Enter tasks for ${p.name}`); return false; }
        if (!p.trajectories || Number(p.trajectories) <= 0) { toast.error(`Enter trajectories for ${p.name}`); return false; }
      }
    }
    return true;
  };
  const canProceedItems = () => {
    if (!selectedTypes.models && !selectedTypes.infra && !selectedTypes.subs) { toast.error("Select at least one budget type"); return false; }
    if (totals.total <= 0) { toast.error("Add at least one budget item"); return false; }
    return true;
  };

  const saveDraft = () => toast.success("Draft saved", { description: `${project?.name || "Project"} · ${fmtCurrency(totals.total, { compact: false })} · auto-saved` });

  const doSubmit = () => {
    const items = {
      models: selectedTypes.models ? models.map((m) => ({ ...m, meta: BEDROCK_MODELS.find((x) => x.id === m.modelId) })) : [],
      infra: selectedTypes.infra ? infra.map((i) => ({ ...i, meta: EC2_INSTANCES.find((x) => x.code === i.instance) })) : [],
      subs: selectedTypes.subs ? subs : [],
    };
    submitBudget({
      projectId,
      projectName: project?.name || projectId,
      budgetType,
      priority,
      totalTasks: Number(totalTasks),
      totalTrajectories,
      delivery: { mode: deliveryMode, singleStart, singleEnd },
      phases: distributedPhases,
      items,
      totals,
      resubmitOfReviewId: returnedReview?.id || null,
    });
    toast.success(returnedReview ? "Budget resubmitted to CTO" : "Budget submitted", {
      description: `${project?.name || "Project"} · ${fmtCurrency(totals.total, { compact: false })} · ${distributedPhases.length} ${distributedPhases.length === 1 ? "phase" : "phases"}`,
    });
    nav(returnedReview ? "/" : "/projects");
  };

  const stepPill = (n, label, active, done) => (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
        done ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : active ? "bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300" : "bg-white/[0.04] border-white/10 text-zinc-500"
      }`}>
        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
      </div>
      <span className={`text-xs font-medium ${done ? "text-emerald-300" : active ? "text-fuchsia-300" : "text-zinc-500"}`}>{label}</span>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="page-budget-builder">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</Link>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ClipboardCheck className="w-3 h-3" /> {isRnd ? "R&D Portal · Budget Builder" : "Budget Builder"}
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">
            {project?.name || "New budget"}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Running total <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.total, { compact: false })}</span> · {deliveryMode === "single" ? "Single phase" : `${phases.length} phases`} · <span className="text-zinc-300 tabular">{totalTrajectories.toLocaleString()}</span> trajectories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={saveDraft} className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2" data-testid="bb-save-draft">
            <Save className="w-3.5 h-3.5" /> Save as draft
          </Button>
        </div>
      </div>

      {/* Returned review banner */}
      {returnedReview && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 flex items-start gap-3" data-testid="bb-returned-banner">
          <MessageSquareWarning className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-zinc-200 leading-relaxed">
            <div className="text-amber-200 font-semibold uppercase tracking-widest text-[10px] mb-0.5">Returned by CTO — please revise</div>
            <div><span className="text-white font-semibold">Comment:</span> {returnedReview.ctoComment || "—"}</div>
            <div className="text-[11px] text-zinc-400 mt-1">Original ask: <span className="text-white tabular">{fmtCurrency(returnedReview.requestedBudget, { compact: false })}</span> · Returned {new Date(returnedReview.ctoAt || Date.now()).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4 flex items-center gap-4 flex-wrap" data-testid="bb-stepper">
        {stepPill(1, "Details", step === 1, step > 1)}
        <div className="flex-1 h-px bg-white/10 min-w-[40px]" />
        {stepPill(2, "Budget Items", step === 2, step > 2)}
        <div className="flex-1 h-px bg-white/10 min-w-[40px]" />
        {stepPill(3, "Preview & Submit", step === 3, false)}
      </div>

      {/* Step 1 — Details */}
      {step === 1 && (
        <Card title="1. Basic Budget Details" testid="bb-step-details">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Project *">
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="bb-project" className={ipStyle}>
                <option value="" disabled>{visibleProjects.length ? "Select a project" : "— No projects assigned to you yet —"}</option>
                {visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.client ? ` · ${p.client}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Priority *">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} data-testid="bb-priority" className={ipStyle}>
                {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label={isRnd ? "Budget type · locked to R&D" : "Budget type *"}>
              <select
                value={budgetType}
                onChange={(e) => setBudgetType(e.target.value)}
                data-testid="bb-budget-type"
                disabled={isRnd}
                className={ipStyle + (isRnd ? " opacity-70 cursor-not-allowed" : "")}
              >
                {(isRnd ? ["RnD"] : ["Production", "RnD"]).map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Project delivery {isRnd && <span className="text-fuchsia-300">· R&D locked to single phase</span>}</div>
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
              <button
                onClick={() => setDeliveryMode("single")}
                data-testid="bb-delivery-single"
                className={`px-4 py-1.5 rounded-md text-xs font-medium ${deliveryMode === "single" ? "bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]" : "text-zinc-400 hover:text-zinc-100"}`}
              >
                Single phase
              </button>
              {!isRnd && (
                <button
                  onClick={() => setDeliveryMode("multiple")}
                  data-testid="bb-delivery-multiple"
                  className={`px-4 py-1.5 rounded-md text-xs font-medium ${deliveryMode === "multiple" ? "bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]" : "text-zinc-400 hover:text-zinc-100"}`}
                >
                  Multiple phases
                </button>
              )}
            </div>
          </div>

          {deliveryMode === "single" && (
            <div className="mt-4 space-y-3" data-testid="bb-single-phase">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Number of tasks *">
                  <input type="number" min="1" value={singlePhase.tasks} onChange={(e) => setSinglePhase((s) => ({ ...s, tasks: e.target.value }))} data-testid="bb-single-tasks" className={ipStyle + " tabular"} />
                </Field>
                <Field label="Est. trajectories / task *">
                  <input type="number" min="1" value={singlePhase.trajectories} onChange={(e) => setSinglePhase((s) => ({ ...s, trajectories: e.target.value }))} data-testid="bb-single-trajectories" className={ipStyle + " tabular"} />
                </Field>
              </div>
              <div className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-[11px] text-zinc-400" data-testid="bb-single-total-trajectories">
                Total trajectories · <span className="text-fuchsia-300 font-semibold tabular">{(Number(singlePhase.tasks || 0) * Number(singlePhase.trajectories || 0)).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Estimated Start Date *">
                  <input type="date" value={singleStart} onChange={(e) => setSingleStart(e.target.value)} data-testid="bb-single-start" className={ipStyle} />
                </Field>
                <Field label="Estimated End Date *">
                  <input type="date" value={singleEnd} onChange={(e) => setSingleEnd(e.target.value)} data-testid="bb-single-end" className={ipStyle} />
                </Field>
              </div>
            </div>
          )}

          {deliveryMode === "multiple" && !isRnd && (
            <div className="mt-4 space-y-3" data-testid="bb-multi-phases">
              <div className="text-[11px] text-zinc-500">Multiple phases deliver the project batch-by-batch. Each phase drives its own trajectory count → total updates automatically.</div>
              {phases.map((ph, i) => (
                <div key={ph.id} data-testid={`bb-phase-${ph.id}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25">Phase {i + 1}</span>
                    {phases.length > 1 && (
                      <button
                        onClick={() => setPhases((r) => r.filter((x) => x.id !== ph.id))}
                        data-testid={`bb-phase-remove-${ph.id}`}
                        className="w-7 h-7 rounded-md text-red-400 hover:bg-red-500/15 flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Field label="Phase name">
                      <input value={ph.name} onChange={(e) => updateRow(setPhases)(ph.id, "name", e.target.value)} data-testid={`bb-phase-name-${ph.id}`} className={ipStyle} />
                    </Field>
                    <Field label="Tasks">
                      <input type="number" min="0" value={ph.tasks} onChange={(e) => updateRow(setPhases)(ph.id, "tasks", e.target.value)} data-testid={`bb-phase-tasks-${ph.id}`} className={ipStyle + " tabular"} />
                    </Field>
                    <Field label="Trajectories / task">
                      <input type="number" min="0" value={ph.trajectories} onChange={(e) => updateRow(setPhases)(ph.id, "trajectories", e.target.value)} data-testid={`bb-phase-traj-${ph.id}`} className={ipStyle + " tabular"} />
                    </Field>
                    <Field label="Sub-total trajectories">
                      <div className={ipStyle + " tabular flex items-center text-fuchsia-300"}>{(Number(ph.tasks || 0) * Number(ph.trajectories || 0)).toLocaleString()}</div>
                    </Field>
                    <Field label="Start *">
                      <input type="date" value={ph.start} onChange={(e) => updateRow(setPhases)(ph.id, "start", e.target.value)} data-testid={`bb-phase-start-${ph.id}`} className={ipStyle} />
                    </Field>
                    <Field label="End *">
                      <input type="date" value={ph.end} onChange={(e) => updateRow(setPhases)(ph.id, "end", e.target.value)} data-testid={`bb-phase-end-${ph.id}`} className={ipStyle} />
                    </Field>
                  </div>
                </div>
              ))}
              <Button
                onClick={() => setPhases((r) => [...r, emptyPhase(r.length + 1, plusDaysISO(r.length * 15 + 1), plusDaysISO(r.length * 15 + 15))])}
                variant="outline"
                data-testid="bb-add-phase"
                className="w-full h-10 rounded-lg border-dashed border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-300 hover:bg-fuchsia-500/10 gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add phase
              </Button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <div className="text-xs text-zinc-400">
              Total trajectories: <span className="text-fuchsia-300 font-semibold tabular">{totalTrajectories.toLocaleString()}</span> · {totalTasks.toLocaleString()} tasks
            </div>
            <Button
              onClick={() => canProceedDetails() && setStep(2)}
              data-testid="bb-next-1"
              className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            >
              Next step <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 — Budget Items */}
      {step === 2 && (
        <Card title="2. Budget Items" subtitle={`Trajectories: ${totalTrajectories.toLocaleString()} · costs auto-update from step 1`} testid="bb-step-items">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Budget types</div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { k: "models", label: "Models", desc: "AI models · cost = provider × trajectories" },
                { k: "infra", label: "Infrastructure", desc: "Enter monthly $ — daily cost auto-shown" },
                { k: "subs", label: "Subscriptions", desc: "$ per seat + assign members" },
              ].map((t) => {
                const on = selectedTypes[t.k];
                return (
                  <button
                    key={t.k}
                    onClick={() => setSelectedTypes((s) => ({ ...s, [t.k]: !s[t.k] }))}
                    data-testid={`bb-type-${t.k}`}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      on ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                    }`}
                    title={t.desc}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 border-b border-white/5 flex items-center gap-4">
            {[
              { k: "models", label: "Models" },
              { k: "infra", label: "Infrastructure" },
              { k: "subs", label: "Subscriptions" },
            ].filter((t) => selectedTypes[t.k]).map((t) => (
              <button
                key={t.k}
                onClick={() => setActiveTab(t.k)}
                data-testid={`bb-tab-${t.k}`}
                className={`px-2 pb-3 text-sm font-medium transition-colors relative ${
                  activeTab === t.k ? "text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t.label}
                {activeTab === t.k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-fuchsia-500" />}
              </button>
            ))}
          </div>

          {/* Models */}
          {activeTab === "models" && selectedTypes.models && (
            <div className="mt-4" data-testid="bb-pane-models">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">AI Models · Bedrock</div>
                  <span className="text-[11px] text-zinc-500">· est. cost = tasks × trajectories × cost/task</span>
                </div>
                <Button size="sm" onClick={() => setModels((r) => [...r, emptyModelItem(totalTrajectories)])} data-testid="bb-add-model" className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add model
                </Button>
              </div>
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
                  <span>Model</span><span>Provider</span><span className="text-right">Cost / task ($)</span><span className="text-right">Est. cost</span><span />
                </div>
                {models.map((r) => {
                  const meta = BEDROCK_MODELS.find((m) => m.id === r.modelId);
                  return (
                    <div key={r.id} data-testid={`bb-row-model-${r.id}`} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_28px] gap-2 items-center py-1">
                      <select value={r.modelId} onChange={(e) => updateModelRow(r.id, "modelId", e.target.value)} data-testid={`bb-model-select-${r.id}`} className={rowInp}>
                        {BEDROCK_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-zinc-300 leading-8 truncate">{meta?.provider}</div>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={r.costPerTask}
                        onChange={(e) => updateModelRow(r.id, "costPerTask", e.target.value)}
                        data-testid={`bb-model-cost-per-task-${r.id}`}
                        className={rowInp + " tabular text-right"}
                      />
                      <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-fuchsia-300 tabular text-right leading-8" data-testid={`bb-model-est-cost-${r.id}`}>{fmtCurrency(r.estCost, { compact: false })}</div>
                      <RemoveBtn onClick={() => removeRow(setModels)(r.id)} testid={`bb-model-remove-${r.id}`} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Formula: <span className="text-fuchsia-300 font-semibold tabular">{totalTasks.toLocaleString()}</span> tasks × <span className="text-fuchsia-300 font-semibold tabular">{deliveryMode === "single" ? singlePhase.trajectories : "avg"}</span> trajectories/task × cost/task · Total models: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.models, { compact: false })}</span>
              </div>
            </div>
          )}

          {/* Infra */}
          {activeTab === "infra" && selectedTypes.infra && (
            <div className="mt-4" data-testid="bb-pane-infra">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">Infrastructure · monthly spend</div>
                  <span className="text-[11px] text-zinc-500">· daily cost shown alongside</span>
                </div>
                <Button size="sm" onClick={() => setInfra((r) => [...r, emptyInfraItem()])} data-testid="bb-add-infra" className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add instance
                </Button>
              </div>
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1.6fr_1fr_.7fr_.9fr_.9fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
                  <span>EC2 Instance</span><span className="text-right">Monthly cost ($)</span><span className="text-right">Months</span><span className="text-right">≈ $/day</span><span className="text-right">Est. cost</span><span />
                </div>
                {infra.map((r) => {
                  const perDay = Math.round((Number(r.monthlyCost || 0) / 30) * 100) / 100;
                  return (
                    <div key={r.id} data-testid={`bb-row-infra-${r.id}`} className="grid grid-cols-[1.6fr_1fr_.7fr_.9fr_.9fr_28px] gap-2 items-center py-1">
                      <select value={r.instance} onChange={(e) => updateInfraRow(r.id, "instance", e.target.value)} data-testid={`bb-infra-select-${r.id}`} className={rowInp}>
                        {EC2_INSTANCES.map((i) => <option key={i.code} value={i.code}>{i.code} · {i.family} · {i.vCPU} vCPU · {i.memoryGiB} GiB</option>)}
                      </select>
                      <input type="number" min="0" step="10" value={r.monthlyCost} onChange={(e) => updateInfraRow(r.id, "monthlyCost", e.target.value)} data-testid={`bb-infra-monthly-${r.id}`} className={rowInp + " tabular text-right"} />
                      <input type="number" min="1" value={r.months} onChange={(e) => updateInfraRow(r.id, "months", e.target.value)} className={rowInp + " tabular text-right"} />
                      <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-zinc-300 tabular text-right leading-8">${perDay.toLocaleString()}</div>
                      <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-fuchsia-300 tabular text-right leading-8">{fmtCurrency(r.estCost, { compact: false })}</div>
                      <RemoveBtn onClick={() => removeRow(setInfra)(r.id)} testid={`bb-infra-remove-${r.id}`} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Total infrastructure: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.infra, { compact: false })}</span>
              </div>
            </div>
          )}

          {/* Subs */}
          {activeTab === "subs" && selectedTypes.subs && (
            <div className="mt-4" data-testid="bb-pane-subs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">Subscriptions · seat-based</div>
                  <span className="text-[11px] text-zinc-500">· assign members below each row</span>
                </div>
                <Button size="sm" onClick={() => setSubs((r) => [...r, emptySubItem()])} data-testid="bb-add-sub" className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add subscription
                </Button>
              </div>
              <div className="space-y-3">
                {subs.map((r) => (
                  <div key={r.id} data-testid={`bb-row-sub-${r.id}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                    <div className="grid grid-cols-[1.4fr_.8fr_.6fr_.8fr_.9fr_28px] gap-2 items-center">
                      <select value={r.subscription} onChange={(e) => updateSubRow(r.id, "subscription", e.target.value)} data-testid={`bb-sub-select-${r.id}`} className={rowInp}>
                        {SUBSCRIPTION_CATALOG.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                      <input type="number" min="0" step="1" value={r.pricePerSeat} onChange={(e) => updateSubRow(r.id, "pricePerSeat", e.target.value)} data-testid={`bb-sub-price-${r.id}`} className={rowInp + " tabular text-right"} title="$ per seat / month" />
                      <input type="number" min="1" value={r.seats} onChange={(e) => updateSubRow(r.id, "seats", e.target.value)} className={rowInp + " tabular text-right"} title="Seats" />
                      <input type="number" min="1" value={r.months} onChange={(e) => updateSubRow(r.id, "months", e.target.value)} className={rowInp + " tabular text-right"} title="Months" />
                      <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-fuchsia-300 tabular text-right leading-8">{fmtCurrency(r.estCost, { compact: false })}</div>
                      <RemoveBtn onClick={() => removeRow(setSubs)(r.id)} testid={`bb-sub-remove-${r.id}`} />
                    </div>
                    <div className="grid grid-cols-[45px_1fr] gap-2 items-start pl-1">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pt-1.5"><UserPlus className="w-3 h-3 inline mr-1" />Members</div>
                      <div className="flex flex-wrap gap-1.5" data-testid={`bb-sub-members-${r.id}`}>
                        {TEAM.slice(0, 8).map((m) => {
                          const on = r.members.includes(m.name);
                          return (
                            <button
                              key={m.id}
                              onClick={() => toggleSubMember(r.id, m.name)}
                              data-testid={`bb-sub-${r.id}-member-${m.id}`}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                                on ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                              }`}
                            >
                              {m.name.split(" ")[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Total subscriptions: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.subs, { compact: false })}</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button onClick={() => setStep(1)} variant="outline" data-testid="bb-back-2" className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Previous
            </Button>
            <Button
              onClick={() => canProceedItems() && setStep(3)}
              data-testid="bb-next-2"
              className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            >
              Next step <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3 — Preview */}
      {step === 3 && (
        <div className="space-y-4">
          <Card title="3. Preview & Submit" subtitle="Final review before submitting" testid="bb-step-preview">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MiniStat label="Total budget" value={fmtCurrency(totals.total, { compact: false })} tone="magenta" />
              <MiniStat label="Trajectories" value={totalTrajectories.toLocaleString()} />
              <MiniStat label="Tasks" value={totalTasks.toLocaleString()} />
              <MiniStat label="Delivery" value={deliveryMode === "single" ? "Single phase" : `${phases.length} phases`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SummaryCard title="Category summary" rows={[
                { k: "Models", v: totals.models, on: selectedTypes.models },
                { k: "Infrastructure", v: totals.infra, on: selectedTypes.infra },
                { k: "Subscriptions", v: totals.subs, on: selectedTypes.subs },
              ].filter((x) => x.on)} />
              <SummaryCard title="Phase summary" rows={distributedPhases.map((p) => ({ id: p.id, k: `${p.name} · ${p.start || ""} → ${p.end || ""}`, v: p.budget }))} />
            </div>
            <div className="mt-4 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3 text-xs">
              <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
              <div className="text-zinc-300">
                <span className="text-fuchsia-200 font-semibold">AI insight: </span>
                Model spend ({fmtCurrency(totals.models, { compact: false })}) is <span className="text-fuchsia-300 font-semibold">{totals.total ? Math.round((totals.models / totals.total) * 100) : 0}%</span> of total. {totalTrajectories > 5000 && "High trajectory count — consider a cheaper primary model to reduce variance."}
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <Button onClick={() => setStep(2)} variant="outline" data-testid="bb-back-3" className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Previous
            </Button>
            <Button onClick={doSubmit} data-testid="bb-submit" className="h-10 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)] px-5">
              <Send className="w-4 h-4" /> {returnedReview ? "Resubmit budget" : "Submit budget"}
            </Button>
          </div>
        </div>
      )}
      {user && null}
    </div>
  );
};

const ipStyle = "w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";
const rowInp = "h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40";

const Card = ({ title, subtitle, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="mb-4">
      <div className="font-display font-semibold text-lg text-white">{title}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const Field = ({ label, hint, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      {hint && <div className="text-[10px] text-zinc-600">{hint}</div>}
    </div>
    {children}
  </div>
);

const RemoveBtn = ({ onClick, testid }) => (
  <button onClick={onClick} data-testid={testid} className="w-7 h-7 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center">
    <Trash2 className="w-3 h-3" />
  </button>
);

const MiniStat = ({ label, value, tone = "neutral" }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular ${tones[tone]}`}>{value}</div>
    </div>
  );
};

const SummaryCard = ({ title, rows }) => (
  <div className="bg-[#0F0F17] rounded-xl border border-white/5 p-4">
    <div className="text-[13px] font-semibold text-white mb-2">{title}</div>
    <div className="space-y-1.5">
      {rows.length === 0 && <div className="text-xs text-zinc-500">No items</div>}
      {rows.map((r, i) => (
        <div key={r.id || `${r.k}-${i}`} className="flex items-center justify-between text-xs">
          <span className="text-zinc-300 truncate flex-1 mr-2">{r.k}</span>
          <span className="text-white font-semibold tabular">{fmtCurrency(r.v, { compact: false })}</span>
        </div>
      ))}
    </div>
  </div>
);

// AlertTriangle used inline where needed via imports; keep exported default only.

export default BudgetBuilder;
