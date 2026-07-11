import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BUDGET_REVIEWS } from "../../data/mockTpm";
import { PROJECTS } from "../../data/mockProjects";
import { BUFFER } from "../../data/mockCfo";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { useApp } from "../../context/AppContext";
import {
  ArrowLeft,
  Check,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  Lock,
  Cpu,
  Server,
  CreditCard,
  Package,
  Flag,
  CheckCircle2,
  XCircle,
  Percent,
} from "lucide-react";

const ApprovalDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { projects, budgetReviews, cfoDecideBudgetReview, itProvisioningRequests } = useApp();
  const review = useMemo(() => budgetReviews.find((r) => r.id === id) || BUDGET_REVIEWS.find((r) => r.id === id) || BUDGET_REVIEWS[0], [budgetReviews, id]);
  const project = useMemo(() => projects.find((p) => p.id === review?.projectId) || PROJECTS.find((p) => p.id === review?.projectId) || PROJECTS[0], [projects, review]);

  const [decision, setDecision] = useState(review?.status === "approved" ? "approved" : review?.status === "partial" ? "partial" : review?.status === "rejected" ? "rejected" : review?.status === "returned" ? "returned" : "pending");
  const [approvedAmt, setApprovedAmt] = useState(review.cfoDecision?.amount || review.modifiedTotal || review.recommendedBudget);
  const [comment, setComment] = useState("");
  const [bufferPct, setBufferPct] = useState(0);

  useEffect(() => {
    setDecision(review?.status === "approved" ? "approved" : review?.status === "partial" ? "partial" : review?.status === "rejected" ? "rejected" : review?.status === "returned" ? "returned" : "pending");
    setApprovedAmt(review?.cfoDecision?.amount || review?.modifiedTotal || review?.recommendedBudget || 0);
    setComment(review?.cfoDecision?.comment || "");
  }, [review]);

  const requested = review.requestedBudget;
  const variance = approvedAmt - requested;
  const itRequest = itProvisioningRequests.find((entry) => entry.sourceReviewId === review.id);

  const doApprove = () => {
    cfoDecideBudgetReview(review.id, {
      decision: "approve",
      amount: requested,
      comment,
      reviewSeed: review,
    });
    setDecision("approved");
    toast.success("Request approved", { description: `${review.projectName} · ${fmtCurrency(requested, { compact: false })} routed to IT for model-key provisioning` });
  };
  const doPartial = () => {
    if (!approvedAmt || approvedAmt <= 0 || approvedAmt >= requested) {
      toast.error("Enter partial amount less than requested");
      return;
    }
    cfoDecideBudgetReview(review.id, {
      decision: "partial",
      amount: approvedAmt,
      comment,
      reviewSeed: review,
    });
    setDecision("partial");
    toast.success("Partially approved", { description: `${fmtCurrency(approvedAmt, { compact: false })} · routed to IT with partial-approved amount` });
  };
  const doReturn = () => {
    if (!comment.trim()) { toast.error("Comment required to return"); return; }
    cfoDecideBudgetReview(review.id, {
      decision: "return",
      amount: approvedAmt,
      comment,
      reviewSeed: review,
    });
    setDecision("returned");
    toast.info("Returned with comments to PL/CTO");
  };
  const doReject = () => {
    if (!comment.trim()) { toast.error("Comment required to reject"); return; }
    cfoDecideBudgetReview(review.id, {
      decision: "reject",
      amount: 0,
      comment,
      reviewSeed: review,
    });
    setDecision("rejected");
    toast.error("Rejected", { description: comment });
  };
  const doBuffer = () => {
    if (!bufferPct || bufferPct <= 0 || bufferPct > 50) { toast.error("Buffer between 0% and 50%"); return; }
    toast.success("Hidden buffer allocated", { description: `${bufferPct}% reserved · not visible to TPM/CTO` });
  };

  // Cost breakdown lines
  const models = [{ name: "Claude Opus 4.7 (Amazon Bedrock Edition)", vendor: "AWS", detail: "Trajectory · $10.00 × 150", subtotal: 1500 }];
  const infra = [{ name: "Amazon EC2 Container Registry (ECR)", tag: "Infrastructure", detail: "$8.89/day", subtotal: 267 }];
  const subs = [{ name: "Claude", tag: "1 seat", detail: "1 × $200.00 / mo", subtotal: 200 }];
  const total = models.reduce((s, x) => s + x.subtotal, 0) + infra.reduce((s, x) => s + x.subtotal, 0) + subs.reduce((s, x) => s + x.subtotal, 0);

  // Journey stages
  const journey = [
    { label: "PL", status: "done" },
    { label: "CTO", status: "done" },
    { label: "CFO", status: decision === "rejected" ? "reject" : decision === "returned" ? "reject" : (decision === "approved" || decision === "partial") ? "done" : "current" },
    { label: "Approved", status: (decision === "approved" || decision === "partial") ? "done" : "pending", num: 4 },
  ];

  return (
    <div className="space-y-4" data-testid="page-approval-detail">
      {/* Back */}
      <button onClick={() => nav("/approval-queue")} className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white" data-testid="btn-back">
        <ArrowLeft className="w-3.5 h-3.5" /> Approve and Reject
      </button>

      {/* Title */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">{review.projectName}</h1>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30">Phase budget</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/15 text-sky-200 border border-sky-500/30">{review.type}</span>
        {decision === "rejected" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30">Rejected by CFO</span>
        )}
        {decision === "partial" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Partially Approved</span>
        )}
        {decision === "approved" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Approved</span>
        )}
      </div>
      <div className="text-xs text-zinc-500">BBR/2026/00116 · Submitted by {review.tpm} · CTO · {new Date(review.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>

      {/* Journey */}
      <div className="flex items-center gap-2 py-4" data-testid="journey">
        {journey.map((j, i) => {
          const isDone = j.status === "done";
          const isCurrent = j.status === "current";
          const isReject = j.status === "reject";
          return (
            <div key={j.label} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                isDone ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                : isReject ? "bg-red-500/20 border-red-500 text-red-300"
                : isCurrent ? "bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300"
                : "bg-white/[0.03] border-white/10 text-zinc-500"
              }`}>
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : isReject ? <XCircle className="w-4 h-4" /> : <span className="text-xs font-semibold">{j.num || ""}</span>}
              </div>
              <span className={`text-xs font-medium ${isDone ? "text-emerald-300" : isReject ? "text-red-300" : isCurrent ? "text-fuchsia-300" : "text-zinc-500"}`}>{j.label}</span>
              {i < journey.length - 1 && (
                <div className={`flex-1 h-px ${isDone ? "bg-emerald-500/40" : isReject ? "bg-red-500/40" : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Meta card */}
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="meta-card">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Request ID" value="BBR/2026/00116" />
              <Field label="Batch / Phase" value="Sprint 1" />
              <Field label="Window" value="8 Jul 2026 – 10 Jul 2026" />
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Priority</div>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.04] border border-white/10 text-zinc-200">Normal</span>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Remaining tasks</div>
                <div className="mt-1 text-white font-display font-semibold text-lg">15</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full bg-fuchsia-500" style={{ width: "0%" }} />
                </div>
                <div className="mt-1 text-[10px] text-zinc-500">0 of 15 done · 15 remaining</div>
              </div>
              <Field label="Raised by" value={`${review.tpm} · CTO`} />
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Business justification</div>
              <div className="text-sm text-zinc-200">{review.justification}</div>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="cost-breakdown">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Cost breakdown</div>
            <Section title="Models" icon={Cpu} color="fuchsia" total={models.reduce((s, x) => s + x.subtotal, 0)} suffix="">
              {models.map((m, i) => (
                <LineItem key={i} name={m.name} sub={m.vendor} detail={m.detail} value={`$${m.subtotal.toLocaleString()}`} />
              ))}
            </Section>
            <Section title="Infrastructure" icon={Server} color="sky" total={infra.reduce((s, x) => s + x.subtotal, 0)} suffix="/mo">
              {infra.map((m, i) => (
                <LineItem key={i} name={m.name} sub={m.tag} detail={m.detail} value={`$${m.subtotal.toLocaleString()}`} />
              ))}
            </Section>
            <Section title="Subscriptions" icon={CreditCard} color="amber" total={subs.reduce((s, x) => s + x.subtotal, 0)} suffix="/mo">
              {subs.map((m, i) => (
                <LineItem key={i} name={m.name} sub={m.tag} detail={m.detail} value={`$${m.subtotal}/mo`} />
              ))}
            </Section>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Total requested</span>
              <span className="text-fuchsia-300 font-display font-semibold text-2xl tabular">${total.toLocaleString()}</span>
            </div>
          </div>

          {/* AI recommendation + Buffer */}
          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-200 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">AI recommendation: </span>
              Approve at <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(review.recommendedBudget, { compact: false })}</span> based on CTO-optimized cost mix.
              Consider allocating <span className="text-fuchsia-300 font-semibold tabular">8-12% hidden buffer</span> ({fmtCurrency(Math.round(requested * 0.10), { compact: false })}) for downside protection.
            </div>
          </div>

          {/* Hidden buffer allocation */}
          {decision === "pending" && (
            <div className="bg-[#12121A] rounded-2xl border border-white/10 p-4" data-testid="buffer-allocation">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-3.5 h-3.5 text-fuchsia-300" />
                <div className="text-sm font-semibold text-white">Hidden buffer allocation (CFO only)</div>
              </div>
              <div className="text-xs text-zinc-400 mb-3">Reserve % from confidential buffer pool ({fmtCurrency(BUFFER.available)} available). Not visible to TPM/CTO.</div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-[200px]">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={bufferPct}
                    onChange={(e) => setBufferPct(Number(e.target.value))}
                    data-testid="buffer-pct-input"
                    className="w-full h-9 pl-3 pr-8 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                </div>
                <Button onClick={doBuffer} variant="outline" className="h-9 rounded-lg border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 gap-1" data-testid="btn-allocate-buffer">
                  <ShieldCheck className="w-3 h-3" /> Allocate
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Decision */}
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="decision-card">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Decision</div>
            {decision === "pending" ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Approved amount (for partial)</div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                    <input
                      type="number"
                      value={approvedAmt}
                      onChange={(e) => setApprovedAmt(Number(e.target.value) || 0)}
                      data-testid="input-approved-amt"
                      className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    Variance: <span className={variance >= 0 ? "text-emerald-300" : "text-red-300"}>{variance >= 0 ? "+" : ""}${variance.toLocaleString()}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Comment (required for reject/return)</div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    data-testid="input-comment"
                    placeholder="Explain your decision..."
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={doApprove} className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5" data-testid="btn-approve"><Check className="w-3.5 h-3.5" /> Approve</Button>
                  <Button onClick={doPartial} className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5" data-testid="btn-partial"><Percent className="w-3.5 h-3.5" /> Partial</Button>
                  <Button onClick={doReturn} variant="outline" className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 gap-1.5" data-testid="btn-return"><Flag className="w-3.5 h-3.5" /> Return</Button>
                  <Button onClick={doReject} variant="outline" className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-1.5" data-testid="btn-reject"><X className="w-3.5 h-3.5" /> Reject</Button>
                </div>
              </div>
            ) : (
              <div className={`rounded-lg border p-3 ${decision === "rejected" || decision === "returned" ? "bg-red-500/[0.05] border-red-500/30" : "bg-emerald-500/[0.05] border-emerald-500/30"}`}>
                <div className={`flex items-center gap-2 mb-1 ${decision === "rejected" || decision === "returned" ? "text-red-300" : "text-emerald-300"}`}>
                  {decision === "rejected" || decision === "returned" ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span className="text-sm font-semibold">
                    {decision === "rejected" ? "Rejected by CFO · sent back to the PL" : decision === "returned" ? "Returned with comments" : decision === "partial" ? "Partially Approved" : "Approved · sent for payment"}
                  </span>
                </div>
                {comment && <div className="text-xs text-zinc-300 mt-2">{comment}</div>}
              </div>
            )}
          </div>

          {/* Financial overview */}
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="financial-overview">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Financial overview</div>
            <div className="space-y-2 text-sm">
              <Row label="Requested Amount" value={`$${requested.toLocaleString()}`} />
              <Row label="Approved Amount" value={`$${(decision === "approved" ? requested : decision === "partial" ? approvedAmt : 0).toLocaleString()}`} />
              <Row label="Variance" value={`${variance >= 0 ? "" : "-"}$${Math.abs(variance).toLocaleString()}`} color={variance >= 0 ? "text-emerald-300" : "text-red-300"} />
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
                IT provisioning is created only after CFO approve / partial approve.
              </div>
            )}
          </div>

          {/* Activity log */}
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="activity-log">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Activity log</div>
            <div className="space-y-3 text-xs">
              <ActivityRow label="Update" author={`${review.tpm} · CTO · Jul 7, 2026 · 09:45`} />
              <ActivityRow label="Budget notification cross-posted" author={`Servex · CTO · Jul 7, 2026 · 09:45`} success />
              <ActivityRow label="Update" author={`${review.tpm} · CTO · Jul 7, 2026 · 09:45`} />
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

const Section = ({ title, icon: Icon, color, total, suffix, children }) => {
  const bg = color === "fuchsia" ? "bg-fuchsia-500/[0.06] border-fuchsia-500/20" : color === "sky" ? "bg-sky-500/[0.06] border-sky-500/20" : "bg-amber-500/[0.06] border-amber-500/20";
  const tx = color === "fuchsia" ? "text-fuchsia-200" : color === "sky" ? "text-sky-200" : "text-amber-200";
  return (
    <div className="mb-3">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${bg}`}>
        <div className={`flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold ${tx}`}>
          <Icon className="w-3 h-3" /> {title}
        </div>
        <div className="text-xs text-zinc-400">Subtotal <span className="text-white font-semibold tabular">${total.toLocaleString()}{suffix}</span></div>
      </div>
      <div className="border border-t-0 border-white/5 rounded-b-lg">{children}</div>
    </div>
  );
};

const LineItem = ({ name, sub, detail, value }) => (
  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 last:border-b-0">
    <div className="flex-1 min-w-0">
      <div className="text-sm text-white truncate">{name}</div>
      <div className="text-[11px] text-zinc-500 truncate">{sub}</div>
    </div>
    <div className="text-right flex-shrink-0 ml-4">
      <div className="text-[11px] text-zinc-500 tabular">{detail}</div>
      <div className="text-sm font-semibold text-white tabular">{value}</div>
    </div>
  </div>
);

const Row = ({ label, value, color = "text-white" }) => (
  <div className="flex items-center justify-between">
    <span className="text-zinc-400">{label}</span>
    <span className={`font-semibold tabular ${color}`}>{value}</span>
  </div>
);

const ActivityRow = ({ label, author, success }) => (
  <div className="flex items-start gap-2">
    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${success ? "bg-emerald-500" : "bg-zinc-600"}`}>
      {success ? <Check className="w-2.5 h-2.5 text-white" /> : <Flag className="w-2 h-2 text-white" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-zinc-200">{label}</div>
      <div className="text-[10px] text-zinc-500">{author}</div>
    </div>
  </div>
);

export default ApprovalDetail;
