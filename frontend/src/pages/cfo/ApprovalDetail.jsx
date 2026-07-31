import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import GeneralBudgetTableCard from "../../components/budget/GeneralBudgetTableCard";
import { useApp } from "../../context/AppContext";
import {
  ArrowLeft,
  Check,
  X,
  ShieldCheck,
  Lock,
  Cpu,
  Server,
  CreditCard,
  Flag,
  CheckCircle2,
  XCircle,
  Clock3,
  FileText,
  Percent,
} from "lucide-react";

const buildStatus = (review) => {
  if (!review) return "pending";
  if (review.status === "approved") return "approved";
  if (review.status === "partial") return "partial";
  if (review.status === "rejected") return "rejected";
  if (review.status === "returned") return "returned";
  return "pending";
};

const buildRequestId = (reviewId = "") =>
  `BBR/${String(reviewId || "pending").replace(/[^a-z0-9]/gi, "").toUpperCase()}`;

const cloneLines = (lines = []) =>
  lines.map((line) => ({
    ...line,
    meta: line?.meta ? { ...line.meta } : line?.meta,
    members: Array.isArray(line?.members) ? [...line.members] : line?.members,
  }));

const cloneReviewItems = (items = {}) => ({
  models: cloneLines(items.models || []),
  infra: cloneLines(items.infra || []),
  subs: cloneLines(items.subs || []),
  misc: cloneLines(items.misc || []),
});

const sumLineItems = (lines = []) =>
  (Array.isArray(lines) ? lines : []).reduce(
    (sum, line) => sum + Number(line?.estCost || line?.amount || 0),
    0
  );

const buildEditableItems = (review) => {
  if (!review) return { models: [], infra: [], subs: [], misc: [] };
  const submittedItems = cloneReviewItems(review.items || {});
  if (
    submittedItems.models.length
    || submittedItems.infra.length
    || submittedItems.subs.length
    || submittedItems.misc.length
  ) {
    return submittedItems;
  }
  return {
    models: Number(review.aiCost || 0) > 0
      ? [{
          id: "models-summary",
          label: "Models",
          modelName: "Models",
          estCost: Number(review.aiCost || 0),
          amount: Number(review.aiCost || 0),
          meta: { name: "Models", provider: "Submitted model allocation" },
        }]
      : [],
    infra: Number(review.infraCost || 0) > 0
      ? [{
          id: "infra-summary",
          label: "Infrastructure",
          optionLabel: "Infrastructure",
          estCost: Number(review.infraCost || 0),
          amount: Number(review.infraCost || 0),
          meta: { code: "Infrastructure", family: "Submitted infra allocation" },
        }]
      : [],
    subs: Number(review.subsCost || 0) > 0
      ? [{
          id: "subs-summary",
          label: "Subscriptions",
          subscription: "Subscriptions",
          seats: 1,
          estCost: Number(review.subsCost || 0),
          amount: Number(review.subsCost || 0),
          members: [],
        }]
      : [],
    misc: Number(review.miscCost || 0) > 0
      ? [{
          id: "general-summary",
          label: "General request",
          optionLabel: "General request",
          estCost: Number(review.miscCost || 0),
          amount: Number(review.miscCost || 0),
          note: "Submitted general request",
        }]
      : [],
  };
};

const getLineTitleValue = (bucket, line) => {
  if (bucket === "models") return line.meta?.name || line.modelName || line.label || "";
  if (bucket === "infra") return line.meta?.code || line.instance || line.optionLabel || line.label || "";
  if (bucket === "subs") return line.subscription || line.optionLabel || line.label || "";
  return line.optionLabel || line.label || "";
};

const getLineDetailValue = (bucket, line) => {
  if (bucket === "models") return line.meta?.provider || line.provider || "";
  if (bucket === "infra") return line.meta?.family || line.provider || "";
  return line.note || line.detail || "";
};

const parseNumericInput = (value) => Number(value || 0);

const ApprovalDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const {
    projects,
    budgetReviews,
    taskLogs,
    cfoDecideBudgetReview,
    itProvisioningRequests,
    applyBufferAction,
    bufferOverview,
    batchDeliveries,
  } = useApp();

  const review = useMemo(
    () => budgetReviews.find((entry) => entry.id === id) || null,
    [budgetReviews, id]
  );
  const project = useMemo(
    () => projects.find((entry) => entry.id === review?.projectId) || null,
    [projects, review]
  );
  const itRequest = useMemo(
    () => itProvisioningRequests.find((entry) => entry.sourceReviewId === review?.id),
    [itProvisioningRequests, review]
  );

  const [decision, setDecision] = useState(buildStatus(review));
  const [comment, setComment] = useState(review?.cfoDecision?.comment || "");
  const [bufferPct, setBufferPct] = useState("");
  const [partialAmount, setPartialAmount] = useState("");

  const initialItems = useMemo(() => buildEditableItems(review), [review]);
  const [editedItems, setEditedItems] = useState(initialItems);

  useEffect(() => {
    setDecision(buildStatus(review));
    setComment(review?.cfoDecision?.comment || "");
    setBufferPct("");
    setPartialAmount("");
    setEditedItems(initialItems);
  }, [initialItems, review]);

  const originalRequested = Number(review?.requestedBudget || 0);
  const ctoForwardAmount = Number(
    review?.modifiedTotal || review?.recommendedBudget || review?.requestedBudget || 0
  );
  const reviewPhases = review?.requestedPhases || [];
  const approvalPhases = review?.modifiedPhases?.length ? review.modifiedPhases : reviewPhases;
  const phaseScopeLabel = reviewPhases.length === 1
    ? reviewPhases[0].name
    : `${reviewPhases.length || project?.phases?.length || 0} phases`;
  const requestedWindow = review?.timeline || "Not scheduled";

  const loggedTasks = useMemo(() => {
    if (!project) return 0;
    return (project.phases || []).reduce((sum, phase) => {
      const key = `${project.id}::${phase.id}`;
      return sum + (taskLogs[key] || []).reduce(
        (phaseTotal, log) => phaseTotal + Number(log.tasksDone || 0),
        0
      );
    }, 0);
  }, [project, taskLogs]);

  const remainingTasks = Math.max(0, Number(review?.tasks || 0) - loggedTasks);
  const itemTotals = useMemo(() => ({
    models: sumLineItems(editedItems.models),
    infra: sumLineItems(editedItems.infra),
    subs: sumLineItems(editedItems.subs),
    misc: sumLineItems(editedItems.misc),
    total:
      sumLineItems(editedItems.models)
      + sumLineItems(editedItems.infra)
      + sumLineItems(editedItems.subs)
      + sumLineItems(editedItems.misc),
  }), [editedItems]);
  const approvedAmountValue = itemTotals.total || ctoForwardAmount;
  const variance = approvedAmountValue - ctoForwardAmount;
  const partialAmountValue = parseNumericInput(partialAmount);
  const bufferPctValue = parseNumericInput(bufferPct);
  const pendingDecision = decision === "pending";
  const canEditBreakdown = false; // CFO reviews and decides; CTO owns all phase and line-item edits.

  const itemSections = useMemo(() => ([
    {
      key: "models",
      title: "Models",
      icon: Cpu,
      color: "text-fuchsia-300",
      detailLabel: "Provider",
      lines: editedItems.models,
      fallback: "No model line submitted.",
      getTitle: (line) => line.meta?.name || line.modelName || line.label || "Model allocation",
      getDetail: (line) => line.meta?.provider || line.provider || "Submitted model line",
    },
    {
      key: "infra",
      title: "Infrastructure",
      icon: Server,
      color: "text-sky-300",
      detailLabel: "Provider / Family",
      lines: editedItems.infra,
      fallback: "No infrastructure line submitted.",
      getTitle: (line) => line.meta?.code || line.instance || line.optionLabel || line.label || "Infrastructure allocation",
      getDetail: (line) => line.meta?.family || line.provider || "Submitted infrastructure line",
    },
    {
      key: "subs",
      title: "Subscriptions",
      icon: CreditCard,
      color: "text-emerald-300",
      detailLabel: "Members",
      lines: editedItems.subs,
      fallback: "No subscription line submitted.",
      getTitle: (line) => line.subscription || line.optionLabel || line.label || "Subscription allocation",
      getDetail: (line) =>
        Array.isArray(line.members) && line.members.length
          ? line.members.join(", ")
          : "Submitted subscription line",
    },
    {
      key: "misc",
      title: "General",
      icon: FileText,
      color: "text-amber-300",
      detailLabel: "Note",
      lines: editedItems.misc,
      fallback: "No general request line submitted.",
      getTitle: (line) => line.optionLabel || line.label || "General request",
      getDetail: (line) => line.note || line.detail || "Submitted general request line",
    },
  ]), [editedItems]);

  if (!review || !project) {
    return (
      <div className="text-sm text-zinc-400">
        Budget review not found.{" "}
        <button
          onClick={() => nav("/approval-queue")}
          className="text-fuchsia-300 underline"
        >
          Back to approval queue
        </button>
      </div>
    );
  }

  const updateItem = (bucket, itemId, updater) => {
    setEditedItems((current) => ({
      ...current,
      [bucket]: (current[bucket] || []).map((line) => (
        line.id === itemId ? updater(line) : line
      )),
    }));
  };

  const updateItemCost = (bucket, itemId, value) => {
    updateItem(bucket, itemId, (line) => ({
      ...line,
      estCost: Number(value) || 0,
      amount: Number(value) || 0,
    }));
  };

  const updateItemTitle = (bucket, itemId, value) => {
    const nextValue = String(value || "");
    updateItem(bucket, itemId, (line) => {
      if (bucket === "models") {
        return {
          ...line,
          label: nextValue,
          modelName: nextValue,
          meta: { ...(line.meta || {}), name: nextValue },
        };
      }
      if (bucket === "infra") {
        return {
          ...line,
          label: nextValue,
          optionLabel: nextValue,
          instance: nextValue,
          meta: { ...(line.meta || {}), code: nextValue },
        };
      }
      if (bucket === "subs") {
        return {
          ...line,
          label: nextValue,
          optionLabel: nextValue,
          subscription: nextValue,
        };
      }
      return {
        ...line,
        label: nextValue,
        optionLabel: nextValue,
      };
    });
  };

  const updateItemDetail = (bucket, itemId, value) => {
    const nextValue = String(value || "");
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
          provider: nextValue,
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

  const updateSubscriptionCount = (itemId, value) => {
    updateItem("subs", itemId, (line) => ({
      ...line,
      seats: Math.max(0, Number(value) || 0),
    }));
  };

  const requireComment = (actionLabel) => {
    if (comment.trim()) return true;
    toast.error(`Comment required to ${actionLabel}`);
    return false;
  };

  const approve = () => {
    if (approvedAmountValue <= 0) {
      toast.error("Enter or retain a valid approved budget");
      return;
    }
    if (approvedAmountValue < ctoForwardAmount) {
      toast.error("This edited breakdown is below the CTO forwarded amount. Use Partial approval.");
      return;
    }
    if (!requireComment("approve")) return;
    cfoDecideBudgetReview(review.id, {
      decision: "approve",
      amount: approvedAmountValue,
      comment,
      reviewSeed: review,
      modifiedItems: cloneReviewItems(editedItems),
    });
    setDecision("approved");
    toast.success("Budget approved", {
      description: `${review.projectName} · ${fmtCurrency(approvedAmountValue, { compact: false })} routed to IT`,
    });
  };

  const partial = () => {
    if (!partialAmountValue || partialAmountValue <= 0 || partialAmountValue >= ctoForwardAmount) {
      toast.error("Enter a partial amount greater than $0 and below the CTO-forwarded total");
      return;
    }
    if (!requireComment("partially approve")) return;
    cfoDecideBudgetReview(review.id, {
      decision: "partial",
      amount: partialAmountValue,
      comment,
      reviewSeed: review,
      modifiedItems: cloneReviewItems(editedItems),
    });
    setDecision("partial");
    toast.success("Budget partially approved", {
      description: `${fmtCurrency(partialAmountValue, { compact: false })} routed to IT`,
    });
  };

  const sendBack = () => {
    if (!requireComment("return")) return;
    cfoDecideBudgetReview(review.id, {
      decision: "return",
      amount: approvedAmountValue,
      comment,
      reviewSeed: review,
    });
    setDecision("returned");
    toast.info("Returned to CTO with comments");
  };

  const reject = () => {
    if (!requireComment("reject")) return;
    cfoDecideBudgetReview(review.id, {
      decision: "reject",
      amount: 0,
      comment,
      reviewSeed: review,
    });
    setDecision("rejected");
    toast.error("Budget rejected");
  };

  const allocateBuffer = () => {
    if (!bufferPctValue || bufferPctValue <= 0 || bufferPctValue > 50) {
      toast.error("Buffer must be between 1% and 50%");
      return;
    }
    applyBufferAction({
      projectId: review.projectId,
      pct: bufferPctValue,
      action: "allocate-project",
    });
    toast.success("Hidden buffer allocated", {
      description: `${bufferPctValue}% reserved for ${review.projectName}`,
    });
  };

  const renderBudgetSection = (section) => (
    <div
      key={section.key}
      className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold ${section.color}`}>
          <section.icon className="w-3.5 h-3.5" />
          {section.title}
        </div>
        <div className="text-[11px] text-zinc-500">
          Subtotal{" "}
          <span className="text-white font-semibold tabular">
            {fmtCurrency(sumLineItems(section.lines), { compact: false })}
          </span>
        </div>
      </div>

      {section.lines.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">{section.title} line</th>
                <th className="text-left py-2 px-3">{section.detailLabel}</th>
                {section.key === "subs" && <th className="text-right py-2 px-3">Count</th>}
                <th className="text-right py-2 px-3">Cost ($)</th>
              </tr>
            </thead>
            <tbody>
              {section.lines.map((line, index) => (
                <tr
                  key={line.id || `${section.key}-${index + 1}`}
                  className="border-b border-white/5 last:border-b-0"
                >
                  <td className="py-2 px-3">
                    {canEditBreakdown ? (
                      <input
                        type="text"
                        value={getLineTitleValue(section.key, line)}
                        onChange={(event) =>
                          updateItemTitle(section.key, line.id, event.target.value)
                        }
                        className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                      />
                    ) : (
                      <div className="text-white font-medium">{section.getTitle(line)}</div>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {canEditBreakdown && section.key !== "subs" ? (
                      <input
                        type="text"
                        value={getLineDetailValue(section.key, line)}
                        onChange={(event) =>
                          updateItemDetail(section.key, line.id, event.target.value)
                        }
                        className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                      />
                    ) : (
                      <div className="text-xs text-zinc-500">{section.getDetail(line)}</div>
                    )}
                  </td>
                  {section.key === "subs" && (
                    <td className="py-2 px-3">
                      {canEditBreakdown ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={Number(line.seats || 0)}
                          onChange={(event) =>
                            updateSubscriptionCount(line.id, event.target.value)
                          }
                          className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                        />
                      ) : (
                        <div className="text-right text-sm text-zinc-300 tabular">
                          {Number(line.seats || 0).toLocaleString()}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="py-2 px-3">
                    {canEditBreakdown ? (
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={Number(line.estCost || line.amount || 0)}
                        onChange={(event) =>
                          updateItemCost(section.key, line.id, event.target.value)
                        }
                        className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                      />
                    ) : (
                      <div className="text-right text-white font-semibold tabular">
                        {fmtCurrency(Number(line.estCost || line.amount || 0), {
                          compact: false,
                        })}
                      </div>
                    )}
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

  const budgetBreakdownPanel = (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="cost-breakdown">
      <div className="mb-4">
        <div className="font-display font-semibold text-[15px] text-white">Budget ask</div>
        <div className="text-xs text-zinc-500 mt-1">
          Models, infrastructure, and subscriptions approved by CTO for the active phase.
        </div>
      </div>
      <div className="space-y-4">
        {itemSections.filter((section) => section.key !== "misc" && section.lines.length > 0).map(renderBudgetSection)}
      </div>
      {itemSections.every((section) => section.key === "misc" || section.lines.length === 0) && (
        <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-zinc-500">No model, infrastructure, or subscription lines were submitted.</div>
      )}
    </div>
  );

  return (
    <div className="space-y-4" data-testid="page-approval-detail">
      <button
        onClick={() => nav("/approval-queue")}
        className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white"
        data-testid="btn-back"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Budget Review
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">
          {review.projectName}
        </h1>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30">
          {review.type}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
          {review.urgency}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border border-violet-500/25 bg-violet-500/10 text-violet-300" data-testid="cfo-project-type-tag">
          {review.projectType || project.projectType || "Generalist"}
        </span>
      </div>

      <div className="text-xs text-zinc-500">
        {buildRequestId(review.id)} · Submitted by {review.tpm} ·{" "}
        {new Date(review.submittedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div
            className="bg-[#12121A] rounded-2xl border border-white/5 p-5"
            data-testid="meta-card"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
              <Field label="Window" value={requestedWindow} />
              <Field label="Scope" value={phaseScopeLabel} />
              <Field
                label="Remaining tasks"
                value={`${remainingTasks.toLocaleString()} of ${Number(
                  review.tasks || 0
                ).toLocaleString()}`}
              />
              <Field label="Client" value={review.client || project.client || "—"} />
              <Field
                label="Raised by"
                value={`${review.tpm} · ${review.requesterRole || "TPM"}`}
              />
              <Field
                label="Current baseline"
                value={fmtCurrency(review.currentBudget || 0, { compact: false })}
              />
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
                Business justification
              </div>
              <div className="text-sm text-zinc-200">{review.justification}</div>
            </div>
          </div>

          {budgetBreakdownPanel}

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="cfo-phase-plan">
            <div className="mb-4">
              <div className="font-display font-semibold text-[15px] text-white">Phase plan</div>
              <div className="text-xs text-zinc-500 mt-1">
                Read-only phase scope approved by CTO. CFO can approve, return, or reject the active phase budget.
              </div>
            </div>
            {approvalPhases.length > 1 && (
              <div className="mb-3 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] px-3 py-2.5 text-xs text-zinc-300">
                <span className="font-semibold text-fuchsia-200">Multiphase request:</span>{" "}
                this approval raises the budget only for {approvalPhases.find((phase) => phase.id === review.activePhaseId)?.name || approvalPhases[0]?.name || "Phase 1"}. Remaining phases have not been raised yet.
              </div>
            )}
            <div className="space-y-2">
              {approvalPhases.map((phase, index) => {
                const raised = (review.activePhaseId && phase.id === review.activePhaseId) || (!review.activePhaseId && index === 0);
                const delivered = (batchDeliveries || []).find((entry) => entry.projectId === project.id && entry.phaseId === phase.id);
                return (
                  <div key={phase.id} className={`rounded-xl border p-3 ${delivered ? "border-emerald-500/25 bg-emerald-500/[0.05]" : raised ? "border-fuchsia-500/25 bg-fuchsia-500/[0.05]" : "border-white/5 bg-white/[0.02]"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        {delivered ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : raised ? <Clock3 className="w-4 h-4 text-fuchsia-300" /> : <Lock className="w-4 h-4 text-zinc-500" />}
                        {phase.name || `Phase ${index + 1}`}
                      </div>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${delivered ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : raised ? "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 bg-white/[0.03] text-zinc-500"}`}>
                        {delivered ? "Delivered" : raised ? "Budget raised" : "Not raised yet"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <ReadOnlyPhaseField label="Dates" value={phase.start && phase.end ? `${phase.start} → ${phase.end}` : "—"} />
                      <ReadOnlyPhaseField label="Tasks" value={Number(phase.tasks || 0).toLocaleString()} />
                      <ReadOnlyPhaseField label="Trajectories / task" value={Number(phase.trajectories || 0).toLocaleString()} />
                      <ReadOnlyPhaseField label="Budget" value={raised || delivered ? fmtCurrency(phase.budget || delivered?.proposedAmount || 0, { compact: false }) : "Not estimated"} />
                    </div>
                    {delivered && (
                      <div className="mt-3 border-t border-white/5 pt-3 text-xs text-zinc-300">
                        <div>{Number(delivered.tasks || 0).toLocaleString()} delivered tasks · {Number(delivered.trajectories || 0).toLocaleString()} trajectories · recoverable {fmtCurrency(delivered.proposedAmount || 0, { compact: false })}</div>
                        {(delivered.deliverableUrls || []).length > 0 && <div className="mt-1 flex flex-wrap gap-2">{delivered.deliverableUrls.map((url, urlIndex) => <a key={`${url}-${urlIndex}`} href={url} target="_blank" rel="noreferrer" className="text-fuchsia-300 underline">Deliverable {urlIndex + 1}</a>)}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {(batchDeliveries || []).filter((entry) => entry.projectId === project.id && !approvalPhases.some((phase) => phase.id === entry.phaseId)).length > 0 && (
              <div className="mt-4 border-t border-white/5 pt-4">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Previously delivered phases</div>
                <div className="space-y-2">
                  {(batchDeliveries || []).filter((entry) => entry.projectId === project.id && !approvalPhases.some((phase) => phase.id === entry.phaseId)).map((delivery) => (
                    <div key={delivery.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                      <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-white">{delivery.phaseName || "Delivered phase"}</span><span className="text-[10px] font-semibold text-emerald-300">Delivered</span></div>
                      <div className="mt-1 text-xs text-zinc-400">Budget / recoverable {fmtCurrency(delivery.proposedAmount || delivery.finalCost || 0, { compact: false })} · {Number(delivery.tasks || 0).toLocaleString()} tasks · {Number(delivery.trajectories || 0).toLocaleString()} trajectories</div>
                      {(delivery.deliverableUrls || []).length > 0 && <div className="mt-1 flex gap-2 flex-wrap">{delivery.deliverableUrls.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="text-fuchsia-300 underline">Deliverable {index + 1}</a>)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {editedItems.misc.length > 0 && <GeneralBudgetTableCard
            lines={editedItems.misc}
            title="General budget"
            subtitle="CTO-approved general rows shown read-only."
            testid="approval-general-budget-table"
          />}

          {pendingDecision && (
            <div
              className="bg-[#12121A] rounded-2xl border border-white/10 p-4"
              data-testid="buffer-allocation"
            >
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-3.5 h-3.5 text-fuchsia-300" />
                <div className="text-sm font-semibold text-white">
                  Hidden buffer allocation (CFO only)
                </div>
              </div>
              <div className="text-xs text-zinc-400 mb-3">
                Reserve from the confidential buffer pool (
                {fmtCurrency(bufferOverview.available, { compact: false })} available).
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-[200px]">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={bufferPct}
                    onChange={(event) => setBufferPct(event.target.value)}
                    data-testid="buffer-pct-input"
                    className="w-full h-9 pl-3 pr-8 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                    %
                  </span>
                </div>
                <Button
                  onClick={allocateBuffer}
                  variant="outline"
                  className="h-9 rounded-lg border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 gap-1"
                  data-testid="btn-allocate-buffer"
                >
                  <ShieldCheck className="w-3 h-3" /> Allocate
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div
            className="bg-[#12121A] rounded-2xl border border-white/5 p-5"
            data-testid="decision-card"
          >
            <div className="font-display font-semibold text-[15px] text-white mb-3">
              Decision
            </div>
            {pendingDecision ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
                    CFO approval total
                  </div>
                  <div className="text-3xl font-display font-semibold text-white tabular">
                    {fmtCurrency(approvedAmountValue, { compact: false })}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Delta vs CTO total:{" "}
                    <span className={variance >= 0 ? "text-emerald-300" : "text-amber-300"}>
                      {variance >= 0 ? "+" : ""}
                      {fmtCurrency(variance, { compact: false })}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Partial approval amount</div>
                  <input
                    type="number"
                    min="0"
                    max={ctoForwardAmount}
                    step="10"
                    value={partialAmount}
                    onChange={(event) => setPartialAmount(event.target.value)}
                    placeholder={`Less than ${fmtCurrency(ctoForwardAmount, { compact: false })}`}
                    data-testid="partial-approval-amount"
                    className="w-full h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white tabular placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
                    Comment
                  </div>
                  <div className="text-[11px] text-zinc-500 mb-2">
                    Required for approve, partial approval, return, and reject.
                  </div>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={4}
                    data-testid="input-comment"
                    placeholder="Add approval notes, rationale for cuts, or return guidance..."
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={approve}
                    className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
                    data-testid="btn-approve"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button
                    onClick={partial}
                    className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5"
                    data-testid="btn-partial"
                  >
                    <Percent className="w-3.5 h-3.5" /> Partial approval
                  </Button>
                  <Button
                    onClick={sendBack}
                    variant="outline"
                    className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 gap-1.5"
                    data-testid="btn-return"
                  >
                    <Flag className="w-3.5 h-3.5" /> Return
                  </Button>
                  <Button
                    onClick={reject}
                    variant="outline"
                    className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-1.5"
                    data-testid="btn-reject"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`rounded-lg border p-3 ${
                  decision === "rejected" || decision === "returned"
                    ? "bg-red-500/[0.05] border-red-500/30"
                    : "bg-emerald-500/[0.05] border-emerald-500/30"
                }`}
              >
                <div
                  className={`flex items-center gap-2 mb-1 ${
                    decision === "rejected" || decision === "returned"
                      ? "text-red-300"
                      : "text-emerald-300"
                  }`}
                >
                  {decision === "rejected" || decision === "returned" ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span className="text-sm font-semibold">
                    {decision === "rejected"
                      ? "Rejected"
                      : decision === "returned"
                        ? "Returned"
                        : decision === "partial"
                          ? "Approved"
                          : "Approved"}
                  </span>
                </div>
                <div className="text-xs text-zinc-300 mt-2">
                  Final amount:{" "}
                  <span className="font-semibold text-white tabular">
                    {fmtCurrency(review.cfoDecision?.amount || approvedAmountValue || 0, {
                      compact: false,
                    })}
                  </span>
                </div>
                {review.cfoDecision?.changeSummary && (
                  <div className="text-xs text-zinc-300 mt-2 leading-relaxed">
                    {review.cfoDecision.changeSummary}
                  </div>
                )}
                {comment && <div className="text-xs text-zinc-300 mt-2">{comment}</div>}
              </div>
            )}
          </div>

          <div
            className="bg-[#12121A] rounded-2xl border border-white/5 p-5"
            data-testid="financial-overview"
          >
            <div className="font-display font-semibold text-[15px] text-white mb-3">
              Financial overview
            </div>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Original request" value={fmtCurrency(originalRequested, { compact: false })} />
              <SummaryRow label="CTO forwarded" value={fmtCurrency(ctoForwardAmount, { compact: false })} />
              <SummaryRow
                label="CFO amount"
                value={fmtCurrency(
                  decision === "approve" || decision === "partial"
                    ? (review.cfoDecision?.amount || approvedAmountValue)
                    : 0,
                  { compact: false }
                )}
              />
            </div>
          </div>

          <div
            className="bg-[#12121A] rounded-2xl border border-white/5 p-5"
            data-testid="it-handoff"
          >
            <div className="font-display font-semibold text-[15px] text-white mb-3">
              IT handoff
            </div>
            {itRequest ? (
              <div className="space-y-2 text-sm">
                <SummaryRow
                  label="Status"
                  value={itRequest.status === "completed" ? "Provisioned" : "Pending IT"}
                  valueClassName={itRequest.status === "completed" ? "text-emerald-300" : "text-sky-300"}
                />
                <SummaryRow
                  label="Approved amount"
                  value={fmtCurrency(itRequest.approvedAmount, { compact: false })}
                />
                <SummaryRow
                  label="Models requested"
                  value={String(itRequest.requestedModels?.length || 0)}
                />
                <SummaryRow
                  label="Members to allocate"
                  value={String(itRequest.members?.length || 0)}
                />
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                IT provisioning is created after CFO approve or partial approve.
              </div>
            )}
          </div>

          <div
            className="bg-[#12121A] rounded-2xl border border-white/5 p-5"
            data-testid="activity-log"
          >
            <div className="font-display font-semibold text-[15px] text-white mb-3">
              Activity log
            </div>
            <div className="space-y-3 text-xs">
              {(review.history || []).length === 0 ? (
                <div className="text-zinc-500">No activity yet.</div>
              ) : (
                (review.history || []).map((entry, index) => (
                  <ActivityRow
                    key={`${entry.at}-${index}`}
                    label={entry.action}
                    author={`${entry.actor} · ${new Date(entry.at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}`}
                    detail={entry.detail}
                    success={entry.action.toLowerCase().includes("approved")}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
      {label}
    </div>
    <div className="text-sm text-white font-medium mt-0.5">{value}</div>
  </div>
);

const ReadOnlyPhaseField = ({ label, value }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.025] p-2.5">
    <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-1 text-xs font-medium text-white tabular">{value}</div>
  </div>
);

const SummaryRow = ({ label, value, valueClassName = "text-white" }) => (
  <div className="flex items-center justify-between">
    <span className="text-zinc-400">{label}</span>
    <span className={`font-semibold tabular ${valueClassName}`}>{value}</span>
  </div>
);

const ActivityRow = ({ label, author, detail, success }) => (
  <div className="flex items-start gap-2">
    <div
      className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        success ? "bg-emerald-500" : "bg-zinc-600"
      }`}
    >
      {success ? (
        <Check className="w-2.5 h-2.5 text-white" />
      ) : (
        <Clock3 className="w-2.5 h-2.5 text-white" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-zinc-200">{label}</div>
      <div className="text-[10px] text-zinc-500">{author}</div>
      {detail && <div className="text-[10px] text-zinc-400 mt-1">{detail}</div>}
    </div>
  </div>
);

export default ApprovalDetail;
