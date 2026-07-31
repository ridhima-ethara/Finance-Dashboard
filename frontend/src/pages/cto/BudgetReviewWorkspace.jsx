import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import GeneralBudgetTableCard from "../../components/budget/GeneralBudgetTableCard";
import { useApp } from "../../context/AppContext";
import { areBudgetItemsEqual, areBudgetPhasesEqual } from "../../lib/budgetReview";
import { buildProjectBudgetBuilderHref } from "../../lib/projectBudgetRoute";
import { EC2_INSTANCES, SUBSCRIPTION_CATALOG } from "../../data/mockCatalog";
import {
  ArrowLeft,
  X,
  Send,
  User,
  Building2,
  Calendar,
  ClipboardCheck,
  Cpu,
  Server,
  Layers,
  Edit3,
  FileText,
  Undo2,
  Lock,
  CheckCircle2,
} from "lucide-react";

const cloneLines = (lines = []) => lines.map((line) => ({
  ...line,
  meta: line?.meta ? { ...line.meta } : line?.meta,
  members: Array.isArray(line?.members) ? [...line.members] : line?.members,
}));

const getSelectedMemberNames = (line = {}) => {
  const source = line.members || line.selectedMembers || line.memberNames || line.allocatedMembers || [];
  return (Array.isArray(source) ? source : [])
    .map((member) => typeof member === "string" ? member : member?.name || member?.label || "")
    .filter(Boolean);
};

const cloneReviewItems = (items = {}) => ({
  models: cloneLines(items.models || []),
  infra: cloneLines(items.infra || []),
  subs: cloneLines(items.subs || []),
  misc: cloneLines(items.misc || []),
});

const sumLineItems = (lines = []) => (Array.isArray(lines) ? lines : []).reduce(
  (sum, line) => sum + Number(line?.estCost || line?.amount || 0),
  0
);

const BudgetReviewWorkspace = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { ctoModifyBudgetReview, ctoRejectBudgetReview, ctoReturnBudgetReview, budgetReviews, projects, role, user, batchDeliveries, modelCatalog } = useApp();
  const review = useMemo(() => budgetReviews.find((r) => r.id === id) || null, [budgetReviews, id]);
  const project = useMemo(() => projects.find((p) => p.id === review?.projectId) || null, [projects, review]);
  const projectMemberOptions = useMemo(() => {
    const members = [
      ...(project?.teamMembers || []),
      ...(project?.kickoffMail?.recipients || []),
    ];
    const seen = new Set();
    return members.filter((member) => {
      const key = String(member.email || member.id || member.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [project]);
  const priorModification = useMemo(
    () => (review ? budgetReviews.find((r) => r.id === review.id) : null),
    [budgetReviews, review]
  );

  const [isEditing, setIsEditing] = useState(false);
  const amount = review?.recommendedBudget || review?.requestedBudget || 0;
  const [comment, setComment] = useState("");

  const phases = review?.requestedPhases?.length ? review.requestedPhases : (project?.phases || []);
  const buildInitialPhases = () => {
    if (!review) return [];
    if (priorModification?.modifiedPhases?.length) return priorModification.modifiedPhases;
    return phases.map((p, index) => {
      const isRaisedPhase = (review.activePhaseId && p.id === review.activePhaseId) || (!review.activePhaseId && index === 0);
      return {
        id: p.id,
        name: p.name,
        start: p.start || "",
        end: p.end || "",
        tasks: Number(p.tasks || p.totalTasks || 0),
        trajectories: Number(p.trajectories || p.trajectoriesPerTask || 0),
        budget: isRaisedPhase ? Number(p.budget || review.requestedBudget || 0) : 0,
        budgetStatus: isRaisedPhase ? "raised" : "not-estimated",
        infra: isRaisedPhase ? Number(review.infraCost || 0) : 0,
        model: isRaisedPhase ? Number(review.aiCost || 0) : 0,
        subs: isRaisedPhase ? Number(review.subsCost || 0) : 0,
      };
    });
  };
  const buildInitialItems = useCallback(() => {
    if (!review) return { models: [], infra: [], subs: [], misc: [] };
    if (priorModification?.modifiedItems) return cloneReviewItems(priorModification.modifiedItems);
    const submittedItems = cloneReviewItems(review.items || {});
    if (submittedItems.models.length || submittedItems.infra.length || submittedItems.subs.length || submittedItems.misc.length) return submittedItems;
    return {
      models: Number(review.aiCost || 0) > 0
        ? [{ id: "models-summary", label: "Models", estCost: Number(review.aiCost || 0), amount: Number(review.aiCost || 0), meta: { name: "Models" } }]
        : [],
      infra: Number(review.infraCost || 0) > 0
        ? [{ id: "infra-summary", label: "Infrastructure", estCost: Number(review.infraCost || 0), amount: Number(review.infraCost || 0), meta: { code: "Infrastructure" } }]
        : [],
      subs: Number(review.subsCost || 0) > 0
        ? [{ id: "subs-summary", label: "Subscriptions", estCost: Number(review.subsCost || 0), amount: Number(review.subsCost || 0), subscription: "Subscriptions" }]
        : [],
      misc: Number(review.miscCost || 0) > 0
        ? [{ id: "general-summary", label: "General request", optionLabel: "General request", estCost: Number(review.miscCost || 0), amount: Number(review.miscCost || 0), note: "Submitted general request" }]
        : [],
    };
  }, [priorModification?.modifiedItems, review]);
  const [modifiedPhases, setModifiedPhases] = useState(buildInitialPhases);
  const [modifiedItems, setModifiedItems] = useState(buildInitialItems);
  useEffect(() => {
    if (priorModification?.modifiedPhases?.length) setModifiedPhases(priorModification.modifiedPhases);
  }, [priorModification?.id, priorModification?.modifiedPhases]);
  useEffect(() => {
    setModifiedItems(buildInitialItems());
  }, [buildInitialItems]);

  const canEdit = role === "CTO" && isEditableCtoReview(review);
  const isRndReview =
    review?.requesterRole === "R&D"
    || ["Testing", "RnD", "Rework"].includes(review?.budgetType)
    || (review.recoveryType || "").toLowerCase().includes("r&d")
    || (review.type || "").toLowerCase().includes("r&d");
  const returnTarget = isRndReview ? "R&D" : "TPM";
  const canReviseReturnedReview = !canEdit
    && review?.status === "returned-to-tpm"
    && review?.tpm === user?.name
    && (
      (role === "R&D" && review?.returnedTo === "R&D")
      || (role === "TPM" && (review?.returnedTo === "TPM" || !review?.returnedTo))
    );
  const resubmitHref = (() => {
    if (!canReviseReturnedReview || !review) return "";
    return buildProjectBudgetBuilderHref(review.projectId, {
      edit: review.id,
      budgetType: review.budgetType,
      sampleIteration: review.sampleIteration,
    });
  })();

  if (!review || !project) {
    return (
      <div className="text-sm text-zinc-400">
        Review not found.{" "}
        <button onClick={() => nav(-1)} className="text-fuchsia-300 underline">Go back</button>
      </div>
    );
  }

  const requestedBudget = review.requestedBudget;
  const currentBudget = review.currentBudget;
  const phaseTotals = modifiedPhases.map((p) => ({
    ...p,
    total: Number(p.infra || 0) + Number(p.model || 0) + Number(p.subs || 0),
  }));
  const itemBasedTotals = {
    total: sumLineItems(modifiedItems.models) + sumLineItems(modifiedItems.infra) + sumLineItems(modifiedItems.subs) + sumLineItems(modifiedItems.misc),
    model: sumLineItems(modifiedItems.models),
    infra: sumLineItems(modifiedItems.infra),
    subs: sumLineItems(modifiedItems.subs),
    misc: sumLineItems(modifiedItems.misc),
  };
  const modifiedTotal = itemBasedTotals.total;
  const modifiedInfra = itemBasedTotals.infra;
  const modifiedModel = itemBasedTotals.model;
  const modifiedSubs = itemBasedTotals.subs;
  const modifiedGeneral = itemBasedTotals.misc;
  const modifiedDeltaVsRequested = modifiedTotal - requestedBudget;

  const updateItem = (bucket, itemId, updater) => {
    setModifiedItems((items) => ({
      ...items,
      [bucket]: (items[bucket] || []).map((line) => (
        line.id === itemId ? updater(line) : line
      )),
    }));
  };
  const updateItemCost = (bucket, itemId, val) => {
    updateItem(bucket, itemId, (line) => ({
      ...line,
      estCost: Number(val) || 0,
      amount: Number(val) || 0,
    }));
  };
  const updatePhase = (phaseId, key, value) => {
    setModifiedPhases((entries) => entries.map((phase) => (
      phase.id === phaseId
        ? { ...phase, [key]: ["tasks", "trajectories"].includes(key) ? Math.max(0, Number(value) || 0) : value }
        : phase
    )));
  };
  const updateItemTitle = (bucket, itemId, val) => {
    const nextValue = String(val || "");
    updateItem(bucket, itemId, (line) => {
      if (bucket === "models") {
        const selectedModel = (modelCatalog || []).find((model) => model.name === nextValue || model.id === nextValue);
        return {
          ...line,
          modelId: selectedModel?.id || line.modelId,
          label: selectedModel?.name || nextValue,
          modelName: selectedModel?.name || nextValue,
          provider: selectedModel?.provider || line.provider,
          meta: { ...(line.meta || {}), ...(selectedModel || {}), name: selectedModel?.name || nextValue },
        };
      }
      if (bucket === "infra") {
        const selectedInstance = EC2_INSTANCES.find((instance) => instance.code === nextValue);
        return {
          ...line,
          label: nextValue,
          optionLabel: nextValue,
          instance: nextValue,
          provider: selectedInstance?.provider || line.provider,
          meta: { ...(line.meta || {}), ...(selectedInstance || {}), code: nextValue },
        };
      }
      if (bucket === "subs") {
        const selectedSubscription = SUBSCRIPTION_CATALOG.find((subscription) => subscription.name === nextValue);
        return {
          ...line,
          label: nextValue,
          optionLabel: nextValue,
          subscription: nextValue,
          pricePerSeat: selectedSubscription?.monthly || line.pricePerSeat,
        };
      }
      return {
        ...line,
        label: nextValue,
        optionLabel: nextValue,
      };
    });
  };
  const updateItemDetail = (bucket, itemId, val) => {
    const nextValue = String(val || "");
    updateItem(bucket, itemId, (line) => {
      if (bucket === "models") {
        return {
          ...line,
          provider: nextValue,
          meta: { ...(line.meta || {}), provider: nextValue },
        };
      }
      if (bucket === "infra") {
        return {
          ...line,
          meta: { ...(line.meta || {}), family: nextValue },
        };
      }
      return {
        ...line,
        note: nextValue,
        detail: nextValue,
      };
    });
  };
  const updateSubscriptionSeats = (itemId, val) => {
    updateItem("subs", itemId, (line) => ({
      ...line,
      seats: Math.max(0, Number(val) || 0),
    }));
  };
  const updateSubscriptionMembers = (itemId, members) => {
    updateItem("subs", itemId, (line) => ({ ...line, members }));
  };
  const toggleSubscriptionMember = (itemId, currentMembers, memberName) => {
    const selected = Array.isArray(currentMembers) ? currentMembers : [];
    updateSubscriptionMembers(
      itemId,
      selected.includes(memberName)
        ? selected.filter((name) => name !== memberName)
        : [...selected, memberName]
    );
  };
  const getEditableTitleValue = (bucket, line) => {
    if (bucket === "models") return line.meta?.name || line.modelName || line.label || "";
    if (bucket === "infra") return line.meta?.code || line.instance || line.optionLabel || line.label || "";
    if (bucket === "subs") return line.subscription || line.optionLabel || line.label || "";
    return line.optionLabel || line.label || "";
  };
  const getEditableDetailValue = (bucket, line) => {
    if (bucket === "models") return line.meta?.provider || line.provider || "";
    if (bucket === "infra") return line.meta?.family || line.provider || "";
    return line.note || line.detail || "";
  };
  const getTitleOptions = (bucket) => {
    if (bucket === "models") return (modelCatalog || []).map((model) => model.name);
    if (bucket === "infra") return EC2_INSTANCES.map((instance) => instance.code);
    if (bucket === "subs") return SUBSCRIPTION_CATALOG.map((subscription) => subscription.name);
    return [];
  };
  const getDetailOptions = (bucket, line) => {
    if (bucket === "models") return Array.from(new Set((modelCatalog || []).map((model) => model.provider).filter(Boolean)));
    if (bucket === "infra") {
      const selected = EC2_INSTANCES.find((instance) => instance.code === (line.instance || line.meta?.code));
      return Array.from(new Set(EC2_INSTANCES
        .filter((instance) => !selected?.provider || instance.provider === selected.provider)
        .map((instance) => instance.family)
        .filter(Boolean)));
    }
    return [];
  };
  const resetToOriginal = () => {
    setModifiedPhases(buildInitialPhases());
    setModifiedItems(buildInitialItems());
  };

  const effectiveAmount = isEditing ? modifiedTotal : amount;
  const savings = requestedBudget - effectiveAmount;
  const modifiedPhasePayload = isRndReview
    ? [{
        id: review.requestedPhases?.[0]?.id || phases[0]?.id || "p1",
        name: review.requestedPhases?.[0]?.name || phases[0]?.name || `${review.budgetType || "Budget"} estimate`,
        infra: modifiedInfra,
        model: modifiedModel,
        subs: modifiedSubs,
      }]
    : phaseTotals.map((p) => ({
        id: p.id, name: p.name, start: p.start, end: p.end, tasks: p.tasks,
        trajectories: p.trajectories, budget: p.budget, budgetStatus: p.budgetStatus,
        infra: p.infra, model: p.model, subs: p.subs,
      }));
  const itemSections = [
    {
      key: "models",
      label: "Models",
      lineLabel: "Model",
      detailLabel: "Provider",
      color: "text-fuchsia-300",
      lines: modifiedItems.models,
      fallback: "No model line submitted.",
      getTitle: (line) => line.meta?.name || line.modelName || line.label || "Model allocation",
      getDetail: (line) => line.meta?.provider || line.provider || "Submitted model line",
    },
    {
      key: "infra",
      label: "Infrastructure",
      lineLabel: "Infrastructure",
      detailLabel: "Provider / Family",
      color: "text-sky-300",
      lines: modifiedItems.infra,
      fallback: "No infrastructure line submitted.",
      getTitle: (line) => line.meta?.code || line.instance || line.optionLabel || line.label || "Infrastructure allocation",
      getDetail: (line) => line.meta?.family || "Submitted infrastructure line",
    },
    {
      key: "subs",
      label: "Subscriptions",
      lineLabel: "Subscription",
      detailLabel: "Members",
      color: "text-emerald-300",
      lines: modifiedItems.subs,
      fallback: "No subscription line submitted.",
      getTitle: (line) => line.subscription || line.optionLabel || line.label || "Subscription allocation",
      getDetail: (line) => getSelectedMemberNames(line).length ? getSelectedMemberNames(line).join(", ") : "No members selected",
    },
    {
      key: "misc",
      label: "General",
      lineLabel: "General request",
      detailLabel: "Note",
      color: "text-amber-300",
      lines: modifiedItems.misc,
      fallback: "No general request line submitted.",
      getTitle: (line) => line.optionLabel || line.label || "General request",
      getDetail: (line) => line.note || line.detail || "Submitted general request line",
    },
  ];
  const renderItemSection = (section) => (
    <div key={section.key} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className={`text-[10px] uppercase tracking-widest font-semibold ${section.color}`}>{section.label}</div>
        <div className="text-[11px] text-zinc-500">
          Subtotal <span className="text-white font-semibold tabular">{fmtCurrency(sumLineItems(section.lines), { compact: false })}</span>
        </div>
      </div>
      {section.lines.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">{section.lineLabel || (section.label.endsWith("s") ? section.label.slice(0, -1) : section.label)} line</th>
                <th className="text-left py-2 px-3">{section.detailLabel || "Detail"}</th>
                {section.key === "subs" && <th className="text-right py-2 px-3">Count</th>}
                <th className="text-right py-2 px-3">Cost ($)</th>
              </tr>
            </thead>
            <tbody>
              {section.lines.map((line, index) => (
                <tr key={line.id || `${section.key}-${index + 1}`} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 px-3">
                    {canEdit ? (
                      section.key === "misc" ? (
                        <input
                          type="text"
                          value={getEditableTitleValue(section.key, line)}
                          onChange={(e) => updateItemTitle(section.key, line.id, e.target.value)}
                          data-testid={`modify-${section.key}-title-${line.id || index}`}
                          className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                        />
                      ) : (
                        <select
                          value={getEditableTitleValue(section.key, line)}
                          onChange={(e) => updateItemTitle(section.key, line.id, e.target.value)}
                          data-testid={`modify-${section.key}-title-${line.id || index}`}
                          className="w-full h-9 px-3 rounded-md bg-[#191921] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                        >
                          {!getTitleOptions(section.key).includes(getEditableTitleValue(section.key, line)) && <option value={getEditableTitleValue(section.key, line)}>{getEditableTitleValue(section.key, line)}</option>}
                          {getTitleOptions(section.key).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      )
                    ) : (
                      <div className="text-white font-medium">{section.getTitle(line)}</div>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {canEdit && section.key === "subs" ? (
                      <SubscriptionMemberPicker
                        lineId={line.id}
                        testId={`modify-subs-members-${line.id || index}`}
                        selectedMembers={getSelectedMemberNames(line)}
                        memberOptions={projectMemberOptions}
                        onToggle={(memberName) => toggleSubscriptionMember(line.id, getSelectedMemberNames(line), memberName)}
                      />
                    ) : canEdit && section.key !== "subs" ? (
                      section.key === "misc" ? (
                        <input
                          type="text"
                          value={getEditableDetailValue(section.key, line)}
                          onChange={(e) => updateItemDetail(section.key, line.id, e.target.value)}
                          data-testid={`modify-${section.key}-detail-${line.id || index}`}
                          className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                        />
                      ) : (
                        <select
                          value={getEditableDetailValue(section.key, line)}
                          onChange={(e) => updateItemDetail(section.key, line.id, e.target.value)}
                          data-testid={`modify-${section.key}-detail-${line.id || index}`}
                          className="w-full h-9 px-3 rounded-md bg-[#191921] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                        >
                          {!getDetailOptions(section.key, line).includes(getEditableDetailValue(section.key, line)) && <option value={getEditableDetailValue(section.key, line)}>{getEditableDetailValue(section.key, line)}</option>}
                          {getDetailOptions(section.key, line).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      )
                    ) : (
                      <div className="text-xs text-zinc-500">{section.getDetail(line)}</div>
                    )}
                  </td>
                  {section.key === "subs" && (
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={Number(line.seats || 0)}
                        onChange={(e) => updateSubscriptionSeats(line.id, e.target.value)}
                        disabled={!canEdit}
                        data-testid={`modify-subs-seats-${line.id || index}`}
                        className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                      />
                    </td>
                  )}
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={Number(line.estCost || line.amount || 0)}
                      onChange={(e) => updateItemCost(section.key, line.id, e.target.value)}
                      disabled={!canEdit}
                      data-testid={`modify-${section.key}-${line.id || index}`}
                      className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-3 py-4 text-xs text-zinc-500">{section.fallback}</div>
      )}
    </div>
  );

  const approveAndForward = () => {
    const ctoModified = !areBudgetPhasesEqual(modifiedPhases, buildInitialPhases())
      || !areBudgetItemsEqual(modifiedItems, buildInitialItems());
    ctoModifyBudgetReview({
      reviewId: review.id,
      projectId: project.id,
      projectName: review.projectName,
      tpm: review.tpm,
      requestedBudget,
      modifiedPhases: modifiedPhasePayload,
      modifiedItems: cloneReviewItems(modifiedItems),
      ctoComment: comment,
      itemBased: true,
      ctoModified,
    });
    toast.success("Approved & forwarded to CFO", {
      description: `${review.projectName} · ${fmtCurrency(modifiedTotal, { compact: false })}${savings > 0 ? ` · ${fmtCurrency(savings, { compact: false })} saved vs request` : ""}`,
    });
    nav("/budget-reviews");
  };

  const rejectBudget = () => {
    if (!comment.trim()) { toast.error("Add a comment to reject"); return; }
    ctoRejectBudgetReview({
      reviewId: review.id,
      projectId: project.id,
      projectName: review.projectName,
      tpm: review.tpm,
      requestedBudget,
      ctoComment: comment,
    });
    toast.error("Budget rejected", {
      description: `${review.projectName} · TPM notified · "${comment}"`,
    });
    nav("/budget-reviews");
  };

  const returnToTpm = () => {
    if (!comment.trim()) { toast.error(`Add a comment to return to ${returnTarget}`); return; }
    ctoReturnBudgetReview({
      reviewId: review.id,
      projectId: project.id,
      projectName: review.projectName,
      tpm: review.tpm,
      requestedBudget,
      ctoComment: comment,
      returnTo: returnTarget,
    });
    toast.warning(`Returned to ${returnTarget}`, {
      description: `${review.projectName} · ${returnTarget} can edit & resubmit`,
    });
    nav("/budget-reviews");
  };

  const overviewFields = [
    { label: "Team type", value: review.teamType || "—" },
    ...(!isTestingBudget(review?.budgetType) ? [{ label: "Tasks", value: String(review.tasks) }] : []),
    { label: "Phases", value: String(review.phases) },
  ];
  const coreOverviewPanels = (
    <>
      <Panel testid="overview-project" title="Project overview">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {overviewFields.map((field) => (
            <InfoField key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
      </Panel>
      <Panel
        testid="approval-phase-plan"
        title="Phase plan"
        subtitle={modifiedPhases.length > 1
          ? `${modifiedPhases.find((phase) => phase.id === review.activePhaseId)?.name || modifiedPhases[0]?.name || "Phase 1"} is being raised now. Remaining phases are not raised yet.`
          : "Phase included in this budget request."}
      >
        {modifiedPhases.length > 1 && (
          <div className="mb-3 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] px-3 py-2.5 text-xs text-zinc-300">
            <span className="font-semibold text-fuchsia-200">Multiphase request:</span>{" "}
            budget approval applies only to {modifiedPhases.find((phase) => phase.id === review.activePhaseId)?.name || modifiedPhases[0]?.name || "Phase 1"}. Draft phases retain their schedule and task plan but have no estimate yet.
          </div>
        )}
        <div className="space-y-2">
          {modifiedPhases.map((phase, index) => {
            const raised = (review.activePhaseId && phase.id === review.activePhaseId) || (!review.activePhaseId && index === 0);
            const delivered = (batchDeliveries || []).find((entry) => entry.projectId === project.id && entry.phaseId === phase.id);
            return (
              <div key={phase.id} className={`rounded-xl border p-3 ${delivered ? "border-emerald-500/25 bg-emerald-500/[0.05]" : raised ? "border-fuchsia-500/25 bg-fuchsia-500/[0.05]" : "border-white/5 bg-white/[0.02]"}`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {delivered ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : raised ? <ClipboardCheck className="w-4 h-4 text-fuchsia-300" /> : <Lock className="w-4 h-4 text-zinc-500" />}
                    <span className="text-sm font-semibold text-white">{phase.name || `Phase ${index + 1}`}</span>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${delivered ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : raised ? "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 bg-white/[0.03] text-zinc-500"}`}>
                    {delivered ? "Delivered" : raised ? "Budget raised" : "Not raised yet"}
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <PhaseInput label="Start date" type="date" value={phase.start || ""} editable={canEdit && raised && !delivered} onChange={(value) => updatePhase(phase.id, "start", value)} />
                  <PhaseInput label="End date" type="date" value={phase.end || ""} editable={canEdit && raised && !delivered} onChange={(value) => updatePhase(phase.id, "end", value)} />
                  <PhaseInput label="Tasks" type="number" value={phase.tasks || 0} editable={canEdit && raised && !delivered} onChange={(value) => updatePhase(phase.id, "tasks", value)} />
                  <PhaseInput label="Trajectories / task" type="number" value={phase.trajectories || 0} editable={canEdit && raised && !delivered} onChange={(value) => updatePhase(phase.id, "trajectories", value)} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-zinc-500">Budget</span>
                  <span className={raised || delivered ? "text-white font-semibold tabular" : "text-zinc-500 font-semibold"}>
                    {raised || delivered ? fmtCurrency(phase.budget || delivered?.proposedAmount || 0, { compact: false }) : "Not estimated"}
                  </span>
                </div>
                {delivered && (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Delivered output</div>
                    <div className="mt-1 text-xs text-zinc-300">
                      {Number(delivered.tasks || 0).toLocaleString()} tasks · {Number(delivered.trajectories || 0).toLocaleString()} trajectories · recoverable {fmtCurrency(delivered.proposedAmount || 0, { compact: false })}
                    </div>
                    {(delivered.deliverableUrls || []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {delivered.deliverableUrls.map((url, urlIndex) => <a key={`${url}-${urlIndex}`} href={url} target="_blank" rel="noreferrer" className="text-[11px] text-fuchsia-300 hover:text-fuchsia-200 underline">Deliverable {urlIndex + 1}</a>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {(batchDeliveries || []).filter((entry) => entry.projectId === project.id && !modifiedPhases.some((phase) => phase.id === entry.phaseId)).length > 0 && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Previously delivered phases</div>
            <div className="space-y-2">
              {(batchDeliveries || []).filter((entry) => entry.projectId === project.id && !modifiedPhases.some((phase) => phase.id === entry.phaseId)).map((delivery) => (
                <div key={delivery.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-white">{delivery.phaseName || "Delivered phase"}</span><span className="text-[10px] font-semibold text-emerald-300">Delivered</span></div>
                  <div className="mt-1 text-xs text-zinc-400">Budget / recoverable {fmtCurrency(delivery.proposedAmount || delivery.finalCost || 0, { compact: false })} · {Number(delivery.tasks || 0).toLocaleString()} tasks · {Number(delivery.trajectories || 0).toLocaleString()} trajectories</div>
                  {(delivery.deliverableUrls || []).length > 0 && <div className="mt-1 flex gap-2 flex-wrap">{delivery.deliverableUrls.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="text-[11px] text-fuchsia-300 underline">Deliverable {index + 1}</a>)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
      <Panel testid="overview-justification" title="Justification">
        <div className="text-sm text-zinc-200 leading-relaxed">{review.justification}</div>
      </Panel>
      <Panel testid="overview-breakdown" title="Budget breakdown">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <BreakdownCell icon={Cpu} label="AI Models" value={isEditing ? modifiedModel : review.aiCost} color="#E619B8" />
              <BreakdownCell icon={Server} label="Infrastructure" value={isEditing ? modifiedInfra : review.infraCost} color="#3B82F6" />
              <BreakdownCell icon={Layers} label="Subscriptions" value={isEditing ? modifiedSubs : review.subsCost} color="#10B981" />
              <BreakdownCell icon={FileText} label="General" value={isEditing ? modifiedGeneral : review.miscCost} color="#F59E0B" />
            </div>
            <div className="mt-4">
              <GeneralBudgetTableCard
                lines={modifiedItems.misc}
                title="General budget table"
                subtitle={canEdit ? "This table updates live as CTO edits the general budget line costs." : "Submitted phase-wise general budget rows."}
                testid="cto-general-budget-table"
              />
            </div>
            {isEditing && (
              <div className="mt-4 space-y-4">
                {itemSections.map(renderItemSection)}
                <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                  <div className="text-zinc-500 tabular">
                    {isRndReview ? "R&D" : "TPM"} requested <span className="text-white">{fmtCurrency(requestedBudget, { compact: false })}</span> · your modified ask is{" "}
                    <span className={modifiedDeltaVsRequested <= 0 ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"}>
                  {modifiedDeltaVsRequested >= 0 ? "+" : ""}{fmtCurrency(modifiedDeltaVsRequested, { compact: false })}
                </span> vs request
              </div>
              {canEdit && (
                <button onClick={resetToOriginal} data-testid="btn-reset-modify" className="text-[11px] text-fuchsia-300 hover:text-fuchsia-200">
                  Reset to original breakdown
                </button>
              )}
            </div>
          </div>
        )}
      </Panel>
      {priorModification && (
        <Panel testid="overview-prior-mod" title="Your previous action" subtitle={`Status: ${priorModification.status?.replace(/-/g, " ")} · Total ${fmtCurrency(priorModification.modifiedTotal, { compact: false })}`}>
          <div className="text-xs text-zinc-300 leading-relaxed">
            Last updated <span className="text-white font-semibold tabular">{new Date(priorModification.ctoAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>.
            {priorModification.ctoComment && <div className="mt-1 text-zinc-400"><span className="text-fuchsia-300 font-semibold">Comment:</span> {priorModification.ctoComment}</div>}
          </div>
        </Panel>
      )}
    </>
  );

  return (
    <div className="space-y-6" data-testid="page-budget-review-workspace">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link to="/budget-reviews" className="hover:text-zinc-300 inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Budget reviews
            </Link>
            <span>/</span>
            <span>Workspace</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ClipboardCheck className="w-3 h-3" /> {review.type} · {review.urgency} urgency
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">{review.projectName}</h1>
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300" data-testid="review-project-type-tag">
              {review.projectType || project.projectType || "Generalist"}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {isRndReview ? "R&D" : "TPM"}: {review.tpm}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {review.client}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {review.timeline}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit ? (
            <>
              <Button variant="outline" className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 gap-2" onClick={returnToTpm} data-testid="btn-return-tpm">
                <Undo2 className="w-3.5 h-3.5" /> Return to {isRndReview ? "R&D" : "TPM"}
              </Button>
              <Button variant="outline" className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-2" onClick={rejectBudget} data-testid="btn-reject">
                <X className="w-3.5 h-3.5" /> Reject
              </Button>
              <Button className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]" onClick={approveAndForward} data-testid="btn-approve-forward">
                <Send className="w-3.5 h-3.5" /> Approve &amp; Forward to CFO
              </Button>
            </>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-zinc-300">
              <FileText className="w-3.5 h-3.5" /> Read-only request detail
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {coreOverviewPanels}
          {canEdit && isEditing && (
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 text-xs text-zinc-300 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">Note: </span>
              When you click <span className="text-white font-semibold">Approve &amp; Forward to CFO</span>, your modified breakdown is saved and forwarded. Use <span className="text-amber-300 font-semibold">Return to {isRndReview ? "R&D" : "TPM"}</span> to send it back with comments so they can edit and resubmit.
            </div>
          )}
        </div>

        {/* Sidebar decision panel */}
        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.03] p-5 sticky top-4" data-testid="decision-panel">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-2">
            {isEditing ? "Modified total (live)" : "Approval amount"}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold text-white tabular">{fmtCurrency(effectiveAmount, { compact: false })}</span>
          </div>

          {isEditing ? (
              <>
                <div className="mt-3 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-2 text-[11px] text-zinc-300">
                  Edit the line items in the overview below to change this figure.
                </div>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="w-full mt-3 h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2"
                  data-testid="btn-stop-modify-budget"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Back to overview
                </Button>
              </>
            ) : canEdit ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="w-full mt-3 h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2"
                data-testid="btn-modify-budget"
              >
                <Edit3 className="w-3.5 h-3.5" /> {isRndReview ? "Modify line-item pricing" : "Modify budget inline"}
              </Button>
            ) : canReviseReturnedReview ? (
              <Button
                onClick={() => nav(resubmitHref)}
                variant="outline"
                className="w-full mt-3 h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 gap-2"
                data-testid="btn-resubmit-returned-review"
              >
                <Undo2 className="w-3.5 h-3.5" /> Revise &amp; Resubmit
              </Button>
            ) : null}

            <div className="mt-4 space-y-1.5 text-xs">
              <Row label={`${isRndReview ? "R&D" : "TPM"} requested`} value={fmtCurrency(requestedBudget, { compact: false })} />
              {isEditing && <Row label="CTO modified total" value={fmtCurrency(modifiedTotal, { compact: false })} valueColor="text-fuchsia-300" />}
              <Row label="Previous approved" value={fmtCurrency(currentBudget, { compact: false })} />
            </div>

            {canEdit ? (
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Comment {`(required for reject / return)`}</div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder={`Explain what to change so ${returnTarget} can revise and resubmit`}
                  data-testid="input-comment"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Review status</div>
                <div className="text-xs text-zinc-300 leading-relaxed">
                  {canReviseReturnedReview
                    ? `CTO returned this request to ${review.returnedTo || role} for revision. Review the notes here, then use Revise & Resubmit to update the ask and send it back through the same approval flow.`
                    : "This request is visible for tracking only. Approval, return, and rejection actions are restricted to CTO in this workspace."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Panel = ({ title, subtitle, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="mb-3">
      <div className="font-display font-semibold text-[15px] text-white">{title}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const InfoField = ({ label, value }) => (
  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="text-sm text-white font-medium mt-0.5">{value}</div>
  </div>
);

const SubscriptionMemberPicker = ({ testId, selectedMembers = [], memberOptions = [], onToggle }) => (
  <div className="space-y-2">
    <div className="flex flex-wrap gap-1.5 min-h-6">
      {selectedMembers.map((name) => (
        <span key={name} className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.08] px-2 py-1 text-[10px] font-medium text-emerald-200">
          {name}
        </span>
      ))}
      {selectedMembers.length === 0 && <span className="text-[11px] text-zinc-500">No members selected</span>}
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-testid={testId} className="w-full h-9 rounded-md border border-white/10 bg-[#191921] px-3 text-left text-xs text-fuchsia-300 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40">
          {selectedMembers.length ? `Edit members (${selectedMembers.length})` : "Add members"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-h-72 overflow-y-auto border-white/10 bg-[#191921] text-zinc-100">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-zinc-500">Allocated project members</DropdownMenuLabel>
        {memberOptions.map((member) => (
          <DropdownMenuCheckboxItem
            key={member.id || member.email || member.name}
            checked={selectedMembers.includes(member.name)}
            onCheckedChange={() => onToggle(member.name)}
            onSelect={(event) => event.preventDefault()}
            className="text-xs focus:bg-fuchsia-500/10 focus:text-fuchsia-200"
          >
            <span className="min-w-0">
              <span className="block truncate text-zinc-100">{member.name}</span>
              <span className="block truncate text-[10px] text-zinc-500">{member.role || "Member"}{member.email ? ` · ${member.email}` : ""}</span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        {memberOptions.length === 0 && <div className="px-2 py-3 text-xs text-zinc-500">No members are allocated to this project.</div>}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

const PhaseInput = ({ label, value, type = "text", editable, onChange }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.025] p-2.5">
    <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">{label}</div>
    {editable ? (
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-white tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 [color-scheme:dark]"
      />
    ) : (
      <div className="text-xs font-medium text-white tabular">{value || "—"}</div>
    )}
  </div>
);

const BreakdownCell = ({ icon: Icon, label, value, color }) => (
  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}22` }}>
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    </div>
    <div className="text-lg font-display font-semibold text-white tabular mt-1">{fmtCurrency(value, { compact: false })}</div>
  </div>
);

const Row = ({ label, value, valueColor = "text-white" }) => (
  <div className="flex justify-between">
    <span className="text-zinc-400">{label}</span>
    <span className={`font-semibold tabular ${valueColor}`}>{value}</span>
  </div>
);

const isEditableCtoReview = (review = {}) => {
  const status = String(review?.status || "").trim().toLowerCase();
  if (["forwarded-cfo", "pending-cfo", "approved", "partial", "rejected", "rejected-by-cto", "returned-to-tpm"].includes(status)) {
    return false;
  }
  return true;
};

const isTestingBudget = (budgetType = "") => String(budgetType || "").trim().toLowerCase() === "testing";

export default BudgetReviewWorkspace;
