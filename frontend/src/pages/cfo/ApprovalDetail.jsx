import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { useApp } from "../../context/AppContext";
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
} from "lucide-react";

const buildStatus = (review) => {
  if (!review) return "pending";
  if (review.status === "approved") return "approved";
  if (review.status === "partial") return "partial";
  if (review.status === "rejected") return "rejected";
  if (review.status === "returned") return "returned";
  return "pending";
};

const buildRequestId = (reviewId = "") => `BBR/${String(reviewId || "pending").replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
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
  } = useApp();
  const review = useMemo(() => budgetReviews.find((entry) => entry.id === id) || null, [budgetReviews, id]);
  const project = useMemo(() => projects.find((entry) => entry.id === review?.projectId) || null, [projects, review]);
  const itRequest = useMemo(() => itProvisioningRequests.find((entry) => entry.sourceReviewId === review?.id), [itProvisioningRequests, review]);

  const [decision, setDecision] = useState(buildStatus(review));
  const [comment, setComment] = useState(review?.cfoDecision?.comment || "");
  const [bufferPct, setBufferPct] = useState("");

  const originalRequested = Number(review?.requestedBudget || 0);
  const ctoForwardAmount = Number(review?.modifiedTotal || review?.recommendedBudget || review?.requestedBudget || 0);
  const [approvedAmt, setApprovedAmt] = useState(String(review?.cfoDecision?.amount ?? ctoForwardAmount ?? ""));

  useEffect(() => {
    setDecision(buildStatus(review));
    setApprovedAmt(String(review?.cfoDecision?.amount ?? ctoForwardAmount ?? ""));
    setComment(review?.cfoDecision?.comment || "");
    setBufferPct("");
  }, [review, ctoForwardAmount]);

  const reviewPhases = review?.requestedPhases || [];
  const phaseScopeLabel = reviewPhases.length === 1 ? reviewPhases[0].name : `${reviewPhases.length || project?.phases?.length || 0} phases`;
  const requestedWindow = review?.timeline || "Not scheduled";
  const loggedTasks = useMemo(() => {
    if (!project) return 0;
    return (project.phases || []).reduce((sum, phase) => {
      const key = `${project.id}::${phase.id}`;
      return sum + (taskLogs[key] || []).reduce((phaseTotal, log) => phaseTotal + Number(log.tasksDone || 0), 0);
    }, 0);
  }, [project, taskLogs]);
  const remainingTasks = Math.max(0, Number(review?.tasks || 0) - loggedTasks);
  const approvedAmountValue = parseNumericInput(approvedAmt);
  const bufferPctValue = parseNumericInput(bufferPct);
  const variance = approvedAmountValue - ctoForwardAmount;

  const breakdownItems = useMemo(() => {
    if (!review) return [];
    const items = review.items || project?.budgetItems || {};
    const buildLines = (lines = [], fallbackTitle, fallbackDetail) => {
      if (lines.length) {
        return lines.map((line, index) => ({
          id: line.id || `${fallbackTitle}-${index + 1}`,
          title: line.meta?.name || line.meta?.code || line.subscription || line.instance || line.optionLabel || fallbackTitle,
          subtitle: line.meta?.provider || line.meta?.family || line.members?.join(", ") || fallbackDetail,
          value: Number(line.estCost || line.amount || 0),
        }));
      }
      return [];
    };
    const sections = [
      { key: "models", title: "Models", icon: Cpu, color: "fuchsia", lines: buildLines(items.models || [], "Model allocation", "Submitted model allocation"), fallbackValue: Number(review.aiCost || 0) },
      { key: "infra", title: "Infrastructure", icon: Server, color: "sky", lines: buildLines(items.infra || [], "Infrastructure allocation", "Submitted infra allocation"), fallbackValue: Number(review.infraCost || 0) },
      { key: "subs", title: "Subscriptions", icon: CreditCard, color: "amber", lines: buildLines(items.subs || [], "Subscription allocation", "Submitted subscription allocation"), fallbackValue: Number(review.subsCost || 0) },
    ];
    return sections.map((section) => ({
      ...section,
      lines: section.lines.length
        ? section.lines
        : section.fallbackValue > 0
          ? [{
              id: `${section.key}-fallback`,
              title: section.title,
              subtitle: "Submitted summary",
              value: section.fallbackValue,
            }]
          : [],
    }));
  }, [project, review]);
  const requestedLineTotal = breakdownItems.reduce(
    (sum, section) => sum + section.lines.reduce((sectionTotal, line) => sectionTotal + Number(line.value || 0), 0),
    0
  );

  if (!review || !project) {
    return (
      <div className="text-sm text-zinc-400">
        Budget review not found.{" "}
        <button onClick={() => nav("/approval-queue")} className="text-fuchsia-300 underline">
          Back to approval queue
        </button>
      </div>
    );
  }

  const approve = () => {
    cfoDecideBudgetReview(review.id, {
      decision: "approve",
      amount: approvedAmountValue || ctoForwardAmount,
      comment,
      reviewSeed: review,
    });
    setDecision("approved");
    toast.success("Budget approved", {
      description: `${review.projectName} · ${fmtCurrency(approvedAmountValue || ctoForwardAmount, { compact: false })} routed to IT`,
    });
  };

  const partial = () => {
    if (!approvedAmountValue || approvedAmountValue <= 0 || approvedAmountValue >= ctoForwardAmount) {
      toast.error("Enter a partial amount below the CFO review amount");
      return;
    }
    cfoDecideBudgetReview(review.id, {
      decision: "partial",
      amount: approvedAmountValue,
      comment,
      reviewSeed: review,
    });
    setDecision("partial");
    toast.success("Budget partially approved", {
      description: `${fmtCurrency(approvedAmountValue, { compact: false })} routed to IT`,
    });
  };

  const sendBack = () => {
    if (!comment.trim()) {
      toast.error("Comment required to return");
      return;
    }
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
    if (!comment.trim()) {
      toast.error("Comment required to reject");
      return;
    }
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
    applyBufferAction({ projectId: review.projectId, pct: bufferPctValue, action: "allocate-project" });
    toast.success("Hidden buffer allocated", {
      description: `${bufferPctValue}% reserved for ${review.projectName}`,
    });
  };

  return (
    <div className="space-y-4" data-testid="page-approval-detail">
      <button onClick={() => nav("/approval-queue")} className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white" data-testid="btn-back">
        <ArrowLeft className="w-3.5 h-3.5" /> Approval queue
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">{review.projectName}</h1>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30">
          {review.type}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
          {review.urgency}
        </span>
      </div>
      <div className="text-xs text-zinc-500">
        {buildRequestId(review.id)} · Submitted by {review.tpm} · {new Date(review.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="meta-card">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Request ID" value={buildRequestId(review.id)} />
              <Field label="Budget type" value={review.type} />
              <Field label="Window" value={requestedWindow} />
              <Field label="Priority" value={review.urgency} />
              <Field label="Scope" value={phaseScopeLabel} />
              <Field label="Remaining tasks" value={`${remainingTasks.toLocaleString()} of ${Number(review.tasks || 0).toLocaleString()}`} />
              <Field label="Client" value={review.client || project.client || "—"} />
              <Field label="Raised by" value={`${review.tpm} · ${review.requesterRole || "TPM"}`} />
              <Field label="Current baseline" value={fmtCurrency(review.currentBudget || 0, { compact: false })} />
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Business justification</div>
              <div className="text-sm text-zinc-200">{review.justification}</div>
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="cost-breakdown">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Cost breakdown</div>
            {breakdownItems.map((section) => (
              <Section
                key={section.key}
                title={section.title}
                icon={section.icon}
                color={section.color}
                total={section.lines.reduce((sum, line) => sum + Number(line.value || 0), 0)}
              >
                {section.lines.length ? (
                  section.lines.map((line) => (
                    <LineItem
                      key={line.id}
                      name={line.title}
                      sub={line.subtitle}
                      value={fmtCurrency(line.value, { compact: false })}
                    />
                  ))
                ) : (
                  <EmptyRow label={`No ${section.title.toLowerCase()} requested`} />
                )}
              </Section>
            ))}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Total requested</span>
              <span className="text-fuchsia-300 font-display font-semibold text-2xl tabular">
                {fmtCurrency(requestedLineTotal || ctoForwardAmount, { compact: false })}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-200 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">Review note: </span>
              CFO approval writes the final amount back into the project baseline and phase allocations, then creates the IT handoff from the same approved breakdown.
            </div>
          </div>

          {decision === "pending" && (
            <div className="bg-[#12121A] rounded-2xl border border-white/10 p-4" data-testid="buffer-allocation">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-3.5 h-3.5 text-fuchsia-300" />
                <div className="text-sm font-semibold text-white">Hidden buffer allocation (CFO only)</div>
              </div>
              <div className="text-xs text-zinc-400 mb-3">
                Reserve from the confidential buffer pool ({fmtCurrency(bufferOverview.available, { compact: false })} available).
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
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                </div>
                <Button onClick={allocateBuffer} variant="outline" className="h-9 rounded-lg border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 gap-1" data-testid="btn-allocate-buffer">
                  <ShieldCheck className="w-3 h-3" /> Allocate
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="decision-card">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Decision</div>
            {decision === "pending" ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Approved amount</div>
                  <input
                    type="number"
                    value={approvedAmt}
                    onChange={(event) => setApprovedAmt(event.target.value)}
                    data-testid="input-approved-amt"
                    className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                  <div className="mt-1 text-[10px] text-zinc-500">
                    Delta vs CTO total: <span className={variance >= 0 ? "text-emerald-300" : "text-red-300"}>{variance >= 0 ? "+" : ""}{fmtCurrency(variance, { compact: false })}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Comment</div>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={4}
                    data-testid="input-comment"
                    placeholder="Add approval notes or return guidance..."
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={approve} className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5" data-testid="btn-approve">
                    <Check className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button onClick={partial} className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5" data-testid="btn-partial">
                    <Percent className="w-3.5 h-3.5" /> Partial
                  </Button>
                  <Button onClick={sendBack} variant="outline" className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 gap-1.5" data-testid="btn-return">
                    <Flag className="w-3.5 h-3.5" /> Return
                  </Button>
                  <Button onClick={reject} variant="outline" className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-1.5" data-testid="btn-reject">
                    <X className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`rounded-lg border p-3 ${decision === "rejected" || decision === "returned" ? "bg-red-500/[0.05] border-red-500/30" : "bg-emerald-500/[0.05] border-emerald-500/30"}`}>
                <div className={`flex items-center gap-2 mb-1 ${decision === "rejected" || decision === "returned" ? "text-red-300" : "text-emerald-300"}`}>
                  {decision === "rejected" || decision === "returned" ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span className="text-sm font-semibold">
                    {decision === "rejected" ? "Rejected by CFO" : decision === "returned" ? "Returned to CTO" : decision === "partial" ? "Partially approved" : "Approved"}
                  </span>
                </div>
                <div className="text-xs text-zinc-300 mt-2">
                  Final amount: <span className="font-semibold text-white tabular">{fmtCurrency(review.cfoDecision?.amount || approvedAmountValue || 0, { compact: false })}</span>
                </div>
                {comment && <div className="text-xs text-zinc-300 mt-2">{comment}</div>}
              </div>
            )}
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="financial-overview">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Financial overview</div>
            <div className="space-y-2 text-sm">
              <Row label="Original request" value={fmtCurrency(originalRequested, { compact: false })} />
              <Row label="CTO forwarded" value={fmtCurrency(ctoForwardAmount, { compact: false })} />
              <Row label="CFO amount" value={fmtCurrency((decision === "approve" || decision === "partial") ? approvedAmt : 0, { compact: false })} />
              <Row label="Variance vs CTO" value={fmtCurrency(variance, { compact: false })} color={variance >= 0 ? "text-emerald-300" : "text-red-300"} />
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="it-handoff">
            <div className="font-display font-semibold text-[15px] text-white mb-3">IT handoff</div>
            {itRequest ? (
              <div className="space-y-2 text-sm">
                <Row label="Status" value={itRequest.status === "completed" ? "Provisioned" : "Pending IT"} color={itRequest.status === "completed" ? "text-emerald-300" : "text-sky-300"} />
                <Row label="Approved amount" value={fmtCurrency(itRequest.approvedAmount, { compact: false })} />
                <Row label="Models requested" value={String(itRequest.requestedModels?.length || 0)} />
                <Row label="Members to allocate" value={String(itRequest.members?.length || 0)} />
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                IT provisioning is created after CFO approve or partial approve.
              </div>
            )}
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="activity-log">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Activity log</div>
            <div className="space-y-3 text-xs">
              {(review.history || []).length === 0 ? (
                <div className="text-zinc-500">No activity yet.</div>
              ) : (
                (review.history || []).map((entry, index) => (
                  <ActivityRow
                    key={`${entry.at}-${index}`}
                    label={entry.action}
                    author={`${entry.actor} · ${new Date(entry.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`}
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
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="text-sm text-white font-medium mt-0.5">{value}</div>
  </div>
);

const Section = ({ title, icon: Icon, color, total, children }) => {
  const bg = color === "fuchsia" ? "bg-fuchsia-500/[0.06] border-fuchsia-500/20" : color === "sky" ? "bg-sky-500/[0.06] border-sky-500/20" : "bg-amber-500/[0.06] border-amber-500/20";
  const tx = color === "fuchsia" ? "text-fuchsia-200" : color === "sky" ? "text-sky-200" : "text-amber-200";
  return (
    <div className="mb-3">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${bg}`}>
        <div className={`flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold ${tx}`}>
          <Icon className="w-3 h-3" /> {title}
        </div>
        <div className="text-xs text-zinc-400">Subtotal <span className="text-white font-semibold tabular">{fmtCurrency(total, { compact: false })}</span></div>
      </div>
      <div className="border border-t-0 border-white/5 rounded-b-lg">{children}</div>
    </div>
  );
};

const LineItem = ({ name, sub, value }) => (
  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 last:border-b-0">
    <div className="flex-1 min-w-0">
      <div className="text-sm text-white truncate">{name}</div>
      <div className="text-[11px] text-zinc-500 truncate">{sub}</div>
    </div>
    <div className="text-right flex-shrink-0 ml-4 text-sm font-semibold text-white tabular">{value}</div>
  </div>
);

const EmptyRow = ({ label }) => (
  <div className="px-3 py-3 text-xs text-zinc-500">{label}</div>
);

const Row = ({ label, value, color = "text-white" }) => (
  <div className="flex items-center justify-between">
    <span className="text-zinc-400">{label}</span>
    <span className={`font-semibold tabular ${color}`}>{value}</span>
  </div>
);

const ActivityRow = ({ label, author, detail, success }) => (
  <div className="flex items-start gap-2">
    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${success ? "bg-emerald-500" : "bg-zinc-600"}`}>
      {success ? <Check className="w-2.5 h-2.5 text-white" /> : <Clock3 className="w-2.5 h-2.5 text-white" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-zinc-200">{label}</div>
      <div className="text-[10px] text-zinc-500">{author}</div>
      {detail && <div className="text-[10px] text-zinc-400 mt-1">{detail}</div>}
    </div>
  </div>
);

export default ApprovalDetail;
