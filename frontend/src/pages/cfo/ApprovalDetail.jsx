import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import GeneralBudgetTableCard from "../../components/budget/GeneralBudgetTableCard";
import { useApp } from "../../context/AppContext";
import { areBudgetItemsEqual } from "../../lib/budgetReview";
import {
  buildDeliverableCostMetrics,
  buildLoggedDailyRows,
  summarizeItProjectActuals,
} from "../../lib/projectMetrics";
import {
  ArrowLeft,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Lock,
  Cpu,
  Server,
  CreditCard,
  Flag,
  CheckCircle2,
  XCircle,
  Percent,
  Clock3,
  FileText,
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
    itMonthlyActuals,
    applyBufferAction,
    bufferOverview,
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

  const initialItems = useMemo(() => buildEditableItems(review), [review]);
  const [editedItems, setEditedItems] = useState(initialItems);

  useEffect(() => {
    setDecision(buildStatus(review));
    setComment(review?.cfoDecision?.comment || "");
    setBufferPct("");
    setEditedItems(initialItems);
  }, [initialItems, review]);

  const originalRequested = Number(review?.requestedBudget || 0);
  const ctoForwardAmount = Number(
    review?.modifiedTotal || review?.recommendedBudget || review?.requestedBudget || 0
  );
  const reviewPhases = review?.requestedPhases || [];
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
  const bufferPctValue = parseNumericInput(bufferPct);
  const pendingDecision = decision === "pending";
  const cfoEditedBreakdown = useMemo(
    () => !areBudgetItemsEqual(editedItems, initialItems),
    [editedItems, initialItems]
  );

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

  const itActualSummary = useMemo(
    () => summarizeItProjectActuals(project ? (itMonthlyActuals[project.id] || {}) : {}),
    [itMonthlyActuals, project]
  );
  const loggedDailyRows = useMemo(
    () => (project ? buildLoggedDailyRows([project], taskLogs) : []),
    [project, taskLogs]
  );
  const dailyComparisonRows = useMemo(() => {
    const byDate = new Map();

    loggedDailyRows.forEach((row) => {
      byDate.set(row.date, {
        date: row.date,
        loggedTasks: Number(row.tasks || 0),
        loggedSpend: Number(row.spent || 0),
        itModelActual: 0,
        itInfraActual: 0,
        itSubsActual: 0,
        itTotalActual: 0,
      });
    });

    (itActualSummary.dailyActuals || []).forEach((row) => {
      const current = byDate.get(row.date) || {
        date: row.date,
        loggedTasks: 0,
        loggedSpend: 0,
        itModelActual: 0,
        itInfraActual: 0,
        itSubsActual: 0,
        itTotalActual: 0,
      };
      current.itModelActual = Number(row.modelActual || 0);
      current.itInfraActual = Number(row.infraActual || 0);
      current.itSubsActual = Number(row.subsActual || 0);
      current.itTotalActual = Number(row.total || 0);
      byDate.set(row.date, current);
    });

    return Array.from(byDate.values())
      .map((row) => ({
        ...row,
        variance: Number(row.itTotalActual || 0) - Number(row.loggedSpend || 0),
      }))
      .sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());
  }, [itActualSummary.dailyActuals, loggedDailyRows]);
  const costAuditMetrics = useMemo(
    () => buildDeliverableCostMetrics({
      totalBudgetRequested: approvedAmountValue || ctoForwardAmount,
      totalTaskCount: Number(review?.tasks || 0),
      completedDeliverables: loggedTasks,
      totalAmountConsumed: Number(itActualSummary.totalActual || 0),
    }),
    [approvedAmountValue, ctoForwardAmount, review?.tasks, loggedTasks, itActualSummary.totalActual]
  );
  const latestItFiledAt = itActualSummary.updatedAt
    ? new Date(itActualSummary.updatedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not filed yet";

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
    if (!approvedAmountValue || approvedAmountValue <= 0 || approvedAmountValue >= ctoForwardAmount) {
      toast.error("Lower the edited breakdown below the CTO forwarded amount to submit a partial approval");
      return;
    }
    if (!requireComment("partially approve")) return;
    cfoDecideBudgetReview(review.id, {
      decision: "partial",
      amount: approvedAmountValue,
      comment,
      reviewSeed: review,
      modifiedItems: cloneReviewItems(editedItems),
    });
    setDecision("partial");
    toast.success("Budget partially approved", {
      description: `${fmtCurrency(approvedAmountValue, { compact: false })} routed to IT`,
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
                    {pendingDecision ? (
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
                    {pendingDecision && section.key !== "subs" ? (
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
                      {pendingDecision ? (
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
                    {pendingDecision ? (
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

  return (
    <div className="space-y-4" data-testid="page-approval-detail">
      <button
        onClick={() => nav("/approval-queue")}
        className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white"
        data-testid="btn-back"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Approval queue
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Request ID" value={buildRequestId(review.id)} />
              <Field label="Budget type" value={review.type} />
              <Field label="Window" value={requestedWindow} />
              <Field label="Priority" value={review.urgency} />
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

          <div
            className="bg-[#12121A] rounded-2xl border border-white/5 p-5"
            data-testid="cost-breakdown"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <div className="font-display font-semibold text-[15px] text-white">
                  Budget breakdown
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {pendingDecision
                    ? "CFO can edit model, infrastructure, subscription, and general line items before approval."
                    : "Final CFO-reviewed breakdown routed to IT and reflected in requester views."}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 min-w-[240px]">
                <BreakdownCell icon={Cpu} label="Models" value={itemTotals.models} color="#E619B8" />
                <BreakdownCell icon={Server} label="Infrastructure" value={itemTotals.infra} color="#3B82F6" />
                <BreakdownCell icon={CreditCard} label="Subscriptions" value={itemTotals.subs} color="#10B981" />
                <BreakdownCell icon={FileText} label="General" value={itemTotals.misc} color="#F59E0B" />
              </div>
            </div>

            {pendingDecision && (
              <div className="mb-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 text-xs text-zinc-200 leading-relaxed">
                <span className="text-fuchsia-200 font-semibold">Edit mode: </span>
                the total approval amount now follows the line items below. Reduce the breakdown for partial approval, or keep / increase it for full approval.
              </div>
            )}

            <div className="space-y-4">
              {itemSections.map(renderBudgetSection)}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-zinc-500">
                CTO forwarded{" "}
                <span className="text-white font-semibold tabular">
                  {fmtCurrency(ctoForwardAmount, { compact: false })}
                </span>
                {" "}· current CFO breakdown{" "}
                <span className="text-fuchsia-300 font-semibold tabular">
                  {fmtCurrency(approvedAmountValue, { compact: false })}
                </span>
              </div>
              <div
                className={`text-xs font-semibold ${
                  variance < 0
                    ? "text-amber-300"
                    : variance > 0
                      ? "text-emerald-300"
                      : "text-zinc-400"
                }`}
              >
                {variance === 0
                  ? "No variance vs CTO forwarded total"
                  : `${variance > 0 ? "+" : ""}${fmtCurrency(variance, { compact: false })} vs CTO forwarded`}
              </div>
            </div>
          </div>

          <div
            className="bg-[#12121A] rounded-2xl border border-white/5 p-5"
            data-testid="daily-log-audit"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <div className="font-display font-semibold text-[15px] text-white">
                  Daily logs vs IT actuals
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Daily execution logs are compared against the IT team&apos;s filed actuals for CFO review.
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                Latest IT file: <span className="text-white font-medium">{latestItFiledAt}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
              <AuditMetric label="Delivered tasks" value={loggedTasks.toLocaleString()} tone="text-emerald-300" />
              <AuditMetric label="Claimed cost" value={fmtCurrency(costAuditMetrics.claimedCost, { compact: false })} tone="text-fuchsia-300" />
              <AuditMetric label="IT actual" value={fmtCurrency(itActualSummary.totalActual, { compact: false })} tone="text-cyan-300" />
              <AuditMetric
                label="Variance"
                value={fmtCurrency(costAuditMetrics.variance, { compact: false })}
                tone={costAuditMetrics.variance > 0 ? "text-red-300" : costAuditMetrics.variance < 0 ? "text-emerald-300" : "text-white"}
              />
            </div>

            {dailyComparisonRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-xs text-zinc-500">
                No daily execution logs or IT actual rows have been filed for this project yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.03]">
                      <th className="text-left py-2.5 px-3">Date</th>
                      <th className="text-right py-2.5 px-3">Logged tasks</th>
                      <th className="text-right py-2.5 px-3">Logged spend</th>
                      <th className="text-right py-2.5 px-3">IT model</th>
                      <th className="text-right py-2.5 px-3">IT infra</th>
                      <th className="text-right py-2.5 px-3">IT subs</th>
                      <th className="text-right py-2.5 px-3">IT total</th>
                      <th className="text-right py-2.5 px-3">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyComparisonRows.slice(0, 10).map((row) => (
                      <tr key={row.date} className="border-b border-white/5 last:border-b-0">
                        <td className="py-2.5 px-3 text-zinc-200">{row.date || "—"}</td>
                        <td className="py-2.5 px-3 text-right tabular text-white">{row.loggedTasks.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right tabular text-zinc-200">{fmtCurrency(row.loggedSpend, { compact: false })}</td>
                        <td className="py-2.5 px-3 text-right tabular text-zinc-300">{fmtCurrency(row.itModelActual, { compact: false })}</td>
                        <td className="py-2.5 px-3 text-right tabular text-zinc-300">{fmtCurrency(row.itInfraActual, { compact: false })}</td>
                        <td className="py-2.5 px-3 text-right tabular text-zinc-300">{fmtCurrency(row.itSubsActual, { compact: false })}</td>
                        <td className="py-2.5 px-3 text-right tabular text-white font-semibold">{fmtCurrency(row.itTotalActual, { compact: false })}</td>
                        <td className={`py-2.5 px-3 text-right tabular font-semibold ${row.variance > 0 ? "text-red-300" : row.variance < 0 ? "text-emerald-300" : "text-zinc-400"}`}>
                          {row.variance > 0 ? "+" : ""}
                          {fmtCurrency(row.variance, { compact: false })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <GeneralBudgetTableCard
            lines={editedItems.misc}
            title="General budget table"
            subtitle={pendingDecision
              ? "General budget rows stay visible while CFO edits the section totals above."
              : "Final general budget rows included in the approved handoff."}
            testid="approval-general-budget-table"
          />

          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-200 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">Review note: </span>
              CFO approval writes the final edited breakdown into the project baseline, IT handoff, and requester-side activity log so TPM/R&amp;D can see what changed.
            </div>
          </div>

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
                  {cfoEditedBreakdown && (
                    <div className="mt-2 text-[11px] text-cyan-200">
                      Line-item edits detected. The requester log will capture these changes after you act.
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
                    Comment
                  </div>
                  <div className="text-[11px] text-zinc-500 mb-2">
                    Required for approve, partial approve, return, and reject.
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
                    <Percent className="w-3.5 h-3.5" /> Partial
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
                      ? "Rejected by CFO"
                      : decision === "returned"
                        ? "Returned to CTO"
                        : decision === "partial"
                          ? "Partially approved"
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
              <SummaryRow
                label="Claimed cost"
                value={fmtCurrency(costAuditMetrics.claimedCost, { compact: false })}
                valueClassName="text-fuchsia-300"
              />
              <SummaryRow
                label="IT actual filed"
                value={fmtCurrency(itActualSummary.totalActual, { compact: false })}
                valueClassName="text-white"
              />
              <SummaryRow
                label="Claimed vs IT actual"
                value={fmtCurrency(costAuditMetrics.variance, { compact: false })}
                valueClassName={
                  costAuditMetrics.variance > 0
                    ? "text-red-300"
                    : costAuditMetrics.variance < 0
                      ? "text-emerald-300"
                      : "text-zinc-400"
                }
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

const BreakdownCell = ({ icon: Icon, label, value, color }) => (
  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center"
        style={{ background: `${color}22` }}
      >
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
        {label}
      </div>
    </div>
    <div className="text-lg font-display font-semibold text-white tabular mt-1">
      {fmtCurrency(value, { compact: false })}
    </div>
  </div>
);

const AuditMetric = ({ label, value, tone = "text-white" }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className={`mt-1 text-base font-semibold tabular ${tone}`}>{value}</div>
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
