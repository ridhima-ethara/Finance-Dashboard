import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import GeneralBudgetTableCard from "../../components/budget/GeneralBudgetTableCard";
import { useApp } from "../../context/AppContext";
import { areBudgetItemsEqual, areBudgetPhasesEqual } from "../../lib/budgetReview";
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
} from "lucide-react";

const cloneLines = (lines = []) => lines.map((line) => ({
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

const sumLineItems = (lines = []) => (Array.isArray(lines) ? lines : []).reduce(
  (sum, line) => sum + Number(line?.estCost || line?.amount || 0),
  0
);

const BudgetReviewWorkspace = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { ctoModifyBudgetReview, ctoRejectBudgetReview, ctoReturnBudgetReview, budgetReviews, projects, role, user } = useApp();
  const review = useMemo(() => budgetReviews.find((r) => r.id === id) || null, [budgetReviews, id]);
  const project = useMemo(() => projects.find((p) => p.id === review?.projectId) || null, [projects, review]);
  const priorModification = useMemo(
    () => (review ? budgetReviews.find((r) => r.id === review.id) : null),
    [budgetReviews, review]
  );

  const [isEditing, setIsEditing] = useState(false);
  const amount = review?.recommendedBudget || review?.requestedBudget || 0;
  const [comment, setComment] = useState("");

  const phases = project?.phases || [];
  const buildInitialPhases = () => {
    if (!review) return [];
    if (priorModification?.modifiedPhases?.length) return priorModification.modifiedPhases;
    const denom = phases.reduce((s, p) => s + p.estimated, 0) || 1;
    return phases.map((p) => {
      const weight = p.estimated / denom;
      return {
        id: p.id,
        name: p.name,
        infra: Math.round(Number(review.infraCost || 0) * weight),
        model: Math.round(Number(review.aiCost || 0) * weight),
        subs: Math.round(Number(review.subsCost || 0) * weight),
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
    const next = new URLSearchParams({ edit: review.id, projectId: review.projectId });
    if (review.budgetType) next.set("budgetType", review.budgetType);
    if (review.sampleIteration) next.set("sampleIteration", String(review.sampleIteration));
    return `/budget-builder?${next.toString()}`;
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
  const phaseBasedTotals = {
    total: phaseTotals.reduce((s, p) => s + p.total, 0),
    infra: phaseTotals.reduce((s, p) => s + Number(p.infra || 0), 0),
    model: phaseTotals.reduce((s, p) => s + Number(p.model || 0), 0),
    subs: phaseTotals.reduce((s, p) => s + Number(p.subs || 0), 0),
  };
  const itemBasedTotals = {
    total: sumLineItems(modifiedItems.models) + sumLineItems(modifiedItems.infra) + sumLineItems(modifiedItems.subs) + sumLineItems(modifiedItems.misc),
    model: sumLineItems(modifiedItems.models),
    infra: sumLineItems(modifiedItems.infra),
    subs: sumLineItems(modifiedItems.subs),
    misc: sumLineItems(modifiedItems.misc),
  };
  const modifiedTotal = isRndReview ? itemBasedTotals.total : phaseBasedTotals.total + itemBasedTotals.misc;
  const modifiedInfra = isRndReview ? itemBasedTotals.infra : phaseBasedTotals.infra;
  const modifiedModel = isRndReview ? itemBasedTotals.model : phaseBasedTotals.model;
  const modifiedSubs = isRndReview ? itemBasedTotals.subs : phaseBasedTotals.subs;
  const modifiedGeneral = itemBasedTotals.misc;
  const modifiedDeltaVsRequested = modifiedTotal - requestedBudget;

  const updateCell = (phaseId, key, val) => {
    setModifiedPhases((rows) => rows.map((r) => (r.id === phaseId ? { ...r, [key]: Number(val) || 0 } : r)));
  };
  const updateItemCost = (bucket, itemId, val) => {
    setModifiedItems((items) => ({
      ...items,
      [bucket]: (items[bucket] || []).map((line) => (
        line.id === itemId
          ? {
              ...line,
              estCost: Number(val) || 0,
              amount: Number(val) || 0,
            }
          : line
      )),
    }));
  };
  const resetToOriginal = () => {
    setModifiedPhases(buildInitialPhases());
    setModifiedItems(buildInitialItems());
  };

  const effectiveAmount = isEditing ? modifiedTotal : amount;
  const delta = effectiveAmount - currentBudget;
  const savings = requestedBudget - effectiveAmount;
  const modifiedPhasePayload = isRndReview
    ? [{
        id: review.requestedPhases?.[0]?.id || phases[0]?.id || "p1",
        name: review.requestedPhases?.[0]?.name || phases[0]?.name || `${review.budgetType || "Budget"} estimate`,
        infra: modifiedInfra,
        model: modifiedModel,
        subs: modifiedSubs,
      }]
    : phaseTotals.map((p) => ({ id: p.id, name: p.name, infra: p.infra, model: p.model, subs: p.subs }));
  const itemSections = [
    {
      key: "models",
      label: "Models",
      lineLabel: "Model",
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
      color: "text-emerald-300",
      lines: modifiedItems.subs,
      fallback: "No subscription line submitted.",
      getTitle: (line) => line.subscription || line.optionLabel || line.label || "Subscription allocation",
      getDetail: (line) => Array.isArray(line.members) && line.members.length ? line.members.join(", ") : "Submitted subscription line",
    },
    {
      key: "misc",
      label: "General",
      lineLabel: "General request",
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
                <th className="text-left py-2 px-3">Detail</th>
                <th className="text-right py-2 px-3">Cost ($)</th>
              </tr>
            </thead>
            <tbody>
              {section.lines.map((line, index) => (
                <tr key={line.id || `${section.key}-${index + 1}`} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 px-3 text-white font-medium">{section.getTitle(line)}</td>
                  <td className="py-2 px-3 text-xs text-zinc-500">{section.getDetail(line)}</td>
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
      itemBased: isRndReview,
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
    { label: "Client", value: review.client },
    { label: "Requester", value: `${isRndReview ? "R&D" : "TPM"} · ${review.tpm}` },
    { label: "Raised from", value: isRndReview ? "R&D" : "TPM" },
    { label: "Team type", value: review.teamType || "—" },
    { label: "Timeline", value: review.timeline },
    ...(!isTestingBudget(review?.budgetType) ? [{ label: "Tasks", value: String(review.tasks) }] : []),
    { label: "Phases", value: String(review.phases) },
  ];
  const coreOverviewPanels = (
    <>
      <Panel testid="overview-project" title="Project overview">
        <div className="grid grid-cols-2 gap-3">
          {overviewFields.map((field) => (
            <InfoField key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
      </Panel>
      <Panel testid="overview-justification" title={`Justification from ${isRndReview ? "R&D" : "TPM"}`}>
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
                {isRndReview ? (
                  itemSections.map(renderItemSection)
                ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                        <th className="text-left py-2 px-3">Phase</th>
                        <th className="text-right py-2 px-3">Infra ($)</th>
                        <th className="text-right py-2 px-3">Model ($)</th>
                        <th className="text-right py-2 px-3">Subs ($)</th>
                        <th className="text-right py-2 px-3">Phase total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phaseTotals.map((p) => (
                        <tr key={p.id} data-testid={`modify-phase-${p.id}`} className="border-b border-white/5">
                          <td className="py-2 px-3 text-white font-medium">{p.name}</td>
                          <td className="py-2 px-3">
                            <input type="number" min="0" step="100" value={p.infra} onChange={(e) => updateCell(p.id, "infra", e.target.value)} disabled={!canEdit} data-testid={`modify-infra-${p.id}`} className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                          </td>
                          <td className="py-2 px-3">
                            <input type="number" min="0" step="100" value={p.model} onChange={(e) => updateCell(p.id, "model", e.target.value)} disabled={!canEdit} data-testid={`modify-model-${p.id}`} className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                          </td>
                          <td className="py-2 px-3">
                            <input type="number" min="0" step="100" value={p.subs} onChange={(e) => updateCell(p.id, "subs", e.target.value)} disabled={!canEdit} data-testid={`modify-subs-${p.id}`} className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                          </td>
                          <td className="py-2 px-3 text-right text-white font-semibold tabular">{fmtCurrency(p.total, { compact: false })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-fuchsia-500/30">
                        <td className="py-3 px-3 text-fuchsia-300 uppercase text-[10px] tracking-widest font-semibold">Modified total</td>
                        <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtCurrency(modifiedInfra, { compact: false })}</td>
                        <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtCurrency(modifiedModel, { compact: false })}</td>
                        <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtCurrency(modifiedSubs, { compact: false })}</td>
                        <td className="py-3 px-3 text-right text-fuchsia-300 font-bold text-lg tabular">{fmtCurrency(phaseBasedTotals.total, { compact: false })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {(modifiedItems.misc.length > 0 || Number(review.miscCost || 0) > 0) && renderItemSection(itemSections.find((section) => section.key === "misc"))}
              </>
            )}
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
      <Panel testid="overview-comparison" title="Estimated vs business requirement" subtitle="Prior baseline vs current ask">
        <div className={`grid gap-3 mb-4 ${isEditing ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2"}`}>
          <CompareBox label="Previous approved" value={currentBudget} />
          <CompareBox label={`${isRndReview ? "R&D" : "TPM"} requested`} value={requestedBudget} highlight="warning" />
          {isEditing && <CompareBox label="CTO modified total" value={modifiedTotal} highlight="magenta" />}
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-300 leading-relaxed">
          {isEditing ? (
            <>
              <span className="text-fuchsia-200 font-semibold">Updated budget: </span>
              CFO will receive <span className="text-white font-semibold tabular">{fmtCurrency(modifiedTotal, { compact: false })}</span>,
              {" "}which is{" "}
              <span className={delta >= 0 ? "text-amber-300 font-semibold tabular" : "text-emerald-300 font-semibold tabular"}>
                {delta >= 0 ? "+" : ""}{fmtCurrency(delta, { compact: false })}
              </span>{" "}
              vs the current approved baseline and{" "}
              <span className={modifiedDeltaVsRequested <= 0 ? "text-emerald-300 font-semibold tabular" : "text-amber-300 font-semibold tabular"}>
                {modifiedDeltaVsRequested >= 0 ? "+" : ""}{fmtCurrency(modifiedDeltaVsRequested, { compact: false })}
              </span>{" "}
              vs the submitted request.
            </>
          ) : (
            <>
              <span className="text-fuchsia-200 font-semibold">Difference: </span>
              Requested budget is <span className="text-white font-semibold tabular">{fmtCurrency(requestedBudget - currentBudget, { compact: false })}</span>{" "}
              above the previously approved amount ({fmtPct(Math.round(((requestedBudget - currentBudget) / (currentBudget || 1)) * 100))} increase).
            </>
          )}
        </div>
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
            <div className="mt-1 text-[11px] text-zinc-500 tabular">
              {delta >= 0 ? "+" : ""}{fmtCurrency(delta, { compact: false })} vs current · {savings > 0 ? `${fmtCurrency(savings, { compact: false })} below request` : savings < 0 ? `${fmtCurrency(-savings, { compact: false })} above request` : "at request"}
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

const CompareBox = ({ label, value, highlight }) => {
  const cls = highlight === "warning" ? "border-amber-500/30" : highlight === "magenta" ? "border-fuchsia-500/30 bg-fuchsia-500/[0.03]" : "border-white/5";
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className="font-display text-xl font-semibold text-white tabular mt-1">{fmtCurrency(value, { compact: false })}</div>
    </div>
  );
};

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
