import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { isTpmView } from "../lib/roles";
import { fmtCurrency, fmtDate } from "../lib/format";
import GeneralBudgetTableCard from "../components/budget/GeneralBudgetTableCard";
import { buildBudgetReviewLineSections, getCtoForwardLabel, hasCtoModifiedBudgetReview } from "../lib/budgetReview";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Cpu,
  CreditCard,
  FileText,
  Layers,
  MessageSquare,
  Percent,
  Server,
  ShieldCheck,
  Undo2,
  XCircle,
} from "lucide-react";

const statusMeta = {
  pending: { label: "Pending", Icon: Clock3, cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  "pending-cto": { label: "Pending · CTO Review", Icon: Clock3, cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  "pending-cfo": { label: "Pending · CFO Sign-off", Icon: Clock3, cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  "forwarded-cfo": { label: "Pending · CFO Sign-off", Icon: Clock3, cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  approved: { label: "Approved", Icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  partial: { label: "Partially Approved", Icon: Percent, cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" },
  rejected: { label: "Rejected", Icon: XCircle, cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  "rejected-by-cto": { label: "Rejected · CTO", Icon: XCircle, cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  returned: { label: "Returned", Icon: Undo2, cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  "returned-to-tpm": { label: "Returned", Icon: Undo2, cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

const sectionIcons = {
  models: Cpu,
  infra: Server,
  subs: CreditCard,
  misc: FileText,
};

const sectionTones = {
  models: "text-fuchsia-300",
  infra: "text-sky-300",
  subs: "text-emerald-300",
  misc: "text-amber-300",
};

const buildCfoLabel = (decision = "") => {
  if (decision === "approve") return "Approved";
  if (decision === "partial") return "Partially approved";
  if (decision === "reject") return "Rejected";
  if (decision === "return") return "Returned for changes";
  return "Pending";
};

const SummaryRow = ({ label, value, valueClassName = "text-white" }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-zinc-500">{label}</span>
    <span className={`font-semibold tabular ${valueClassName}`}>{value}</span>
  </div>
);

const MetaField = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-1 text-sm text-white">{value || "—"}</div>
  </div>
);

const MyRequestDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { budgetReviews, role, user } = useApp();

  const review = useMemo(() => budgetReviews.find((entry) => entry.id === id) || null, [budgetReviews, id]);
  const canView = isTpmView(role) && review && review.tpm === user?.name;
  const ctoModified = hasCtoModifiedBudgetReview(review);
  const sections = useMemo(
    () => buildBudgetReviewLineSections(review).filter((section) => section.lines.length > 0),
    [review]
  );
  const status = statusMeta[review?.status] || statusMeta.pending;
  const ctoForwardAmount = Number(review?.modifiedTotal || review?.requestedBudget || 0);
  const cfoFinalAmount = Number(review?.cfoDecision?.amount || 0);
  const actionTrail = [
    review?.ctoAt
      ? {
          actor: "CTO",
          action: review.status === "rejected-by-cto"
            ? "Rejected"
            : review.status === "returned-to-tpm"
              ? "Returned for changes"
              : getCtoForwardLabel(review),
          comment: review.ctoComment,
          amount: review.status === "rejected-by-cto" ? 0 : ctoForwardAmount,
          at: review.ctoAt,
        }
      : null,
    review?.cfoDecision
      ? {
          actor: "CFO",
          action: buildCfoLabel(review.cfoDecision.decision),
          comment: review.cfoDecision.comment,
          amount: review.cfoDecision.decision === "reject" ? 0 : cfoFinalAmount,
          at: review.cfoDecision.at,
        }
      : null,
  ].filter(Boolean);

  if (!canView) {
    return (
      <div className="text-sm text-zinc-400">
        Request not found in your dashboard.{" "}
        <button onClick={() => nav("/approvals")} className="text-fuchsia-300 underline">
          Back to My Requests
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="page-my-request-detail">
      <button
        onClick={() => nav("/approvals")}
        className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white"
        data-testid="btn-back-my-requests"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> My Requests
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">{review.projectName}</h1>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30">
          {review.type || "Budget request"}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${status.cls}`}>
          <status.Icon className="w-3 h-3" /> {status.label}
        </span>
      </div>

      <div className="text-xs text-zinc-500">
        {review.id} · Submitted by <span className="text-zinc-300">{review.tpm}</span> · {review.requesterRole || role} · {fmtDate(review.submittedAt)}
      </div>

      {ctoModified && review.status !== "rejected-by-cto" && review.status !== "returned-to-tpm" && (
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.06] p-4 text-sm text-sky-100">
          CTO forwarded <span className="font-semibold tabular">{fmtCurrency(ctoForwardAmount, { compact: false })}</span> to CFO.
          The requested model, infra, and subscription lines below remain your original ask.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="font-display font-semibold text-[15px] text-white mb-4">Request details</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetaField label="Budget type" value={review.type || "Budget"} />
              <MetaField label="Team type" value={review.teamType || "—"} />
              <MetaField label="Timeline" value={review.timeline || "Not scheduled"} />
              <MetaField label="Tasks" value={review.tasks != null ? Number(review.tasks).toLocaleString() : "—"} />
              <MetaField label="Phases" value={review.phases != null ? String(review.phases) : "—"} />
              <MetaField label="Raised from" value={review.requesterRole || role} />
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Justification</div>
              <div className="text-sm text-zinc-200 leading-relaxed">{review.justification || "—"}</div>
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Requested cost breakdown</div>
            <div className="space-y-3">
              {sections.map((section) => {
                const Icon = sectionIcons[section.key] || Layers;
                const subtotal = section.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
                return (
                  <div key={section.key} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
                      <div className={`inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold ${sectionTones[section.key] || "text-zinc-300"}`}>
                        <Icon className="w-3.5 h-3.5" /> {section.title}
                      </div>
                      <div className="text-sm font-semibold text-white tabular">{fmtCurrency(subtotal, { compact: false })}</div>
                    </div>
                    <div className="divide-y divide-white/5">
                      {section.lines.map((line) => (
                        <div key={line.id} className="flex items-start justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white">{line.title}</div>
                            <div className="text-xs text-zinc-500 mt-1">{line.detail}</div>
                          </div>
                          <div className="text-sm font-semibold text-white tabular">{fmtCurrency(line.amount, { compact: false })}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <GeneralBudgetTableCard
            lines={review.items?.misc || []}
            title="General budget table"
            subtitle="Phase-wise general budget rows included in your request."
            testid="my-request-general-budget-table"
          />
        </div>

        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-fuchsia-300" />
              <div className="font-display font-semibold text-[15px] text-white">Summary</div>
            </div>
            <div className="space-y-3">
              <SummaryRow label="Requested total" value={fmtCurrency(review.requestedBudget, { compact: false })} />
              {review.ctoAt && review.status !== "rejected-by-cto" && review.status !== "returned-to-tpm" && (
                <SummaryRow
                  label="CTO forwarded"
                  value={fmtCurrency(ctoForwardAmount, { compact: false })}
                  valueClassName={ctoModified ? "text-sky-300" : "text-emerald-300"}
                />
              )}
              {review.cfoDecision && (
                <SummaryRow
                  label="CFO final"
                  value={fmtCurrency(review.cfoDecision.decision === "reject" ? 0 : cfoFinalAmount, { compact: false })}
                  valueClassName={review.cfoDecision.decision === "reject" ? "text-red-300" : "text-emerald-300"}
                />
              )}
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-fuchsia-300" />
              <div className="font-display font-semibold text-[15px] text-white">Approval trail</div>
            </div>
            {actionTrail.length === 0 ? (
              <div className="text-sm text-zinc-500">No approver action yet.</div>
            ) : (
              <div className="space-y-3">
                {actionTrail.map((entry) => (
                  <div key={`${entry.actor}-${entry.at}`} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-white">{entry.actor}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-300">{entry.action}</span>
                      {entry.amount != null && (
                        <>
                          <span className="text-zinc-500">·</span>
                          <span className="font-semibold text-white tabular">{fmtCurrency(entry.amount, { compact: false })}</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1">{fmtDate(entry.at)}</div>
                    {entry.comment && <div className="text-sm text-zinc-200 mt-2 leading-relaxed">{entry.comment}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyRequestDetail;
