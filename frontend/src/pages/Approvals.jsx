import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { isTpmView } from "../lib/roles";
import { fmtCurrency, fmtDate } from "../lib/format";
import { getCtoForwardLabel, hasCtoModifiedBudgetReview } from "../lib/budgetReview";
import { buildProjectBudgetBuilderHref } from "../lib/projectBudgetRoute";
import { APPROVALS } from "../data/mockData";
import { Button } from "../components/ui/button";
import PartialApprovalDialog from "../components/PartialApprovalDialog";
import { toast } from "sonner";
import {
  Check, X, Clock3, Split, CheckCircle2, XCircle, AlertTriangle, Undo2, Percent,
  ArrowUpRightSquare, PackageCheck, Wallet, User as UserIcon, Layers, ChevronRight, Info, MessageSquare, Lock,
} from "lucide-react";

const stageColor = (s) =>
  s.includes("CTO")
    ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
    : s.includes("COO") || s.includes("CFO")
    ? "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30"
    : "bg-white/5 text-zinc-300 border-white/10";

// Map raw statuses to a unified display status + tone.
const STATUS_MAP = {
  pending: { label: "Pending", tone: "amber", Icon: Clock3 },
  "pending-cto": { label: "Pending", tone: "amber", Icon: Clock3 },
  "pending-cfo": { label: "Pending", tone: "sky", Icon: Clock3 },
  "forwarded-cfo": { label: "Pending", tone: "sky", Icon: Clock3 },
  approved: { label: "Approved", tone: "emerald", Icon: CheckCircle2 },
  partial: { label: "Approved", tone: "emerald-soft", Icon: Percent },
  "partial-recovered": { label: "Partially Recovered", tone: "emerald-soft", Icon: Percent },
  recovered: { label: "Approved · Recovered", tone: "emerald", Icon: CheckCircle2 },
  rejected: { label: "Rejected", tone: "red", Icon: XCircle },
  returned: { label: "Returned", tone: "amber", Icon: Undo2 },
};

const toneClasses = {
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "emerald-soft": "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
};

const typeConfig = {
  Topup: { label: "Additional Request", Icon: ArrowUpRightSquare, tone: "text-fuchsia-300" },
  Budget: { label: "Budget", Icon: Wallet, tone: "text-sky-300" },
  Batch: { label: "Batch Delivery", Icon: PackageCheck, tone: "text-emerald-300" },
};

const buildBudgetResubmitHref = (review) => {
  return buildProjectBudgetBuilderHref(review.projectId, {
    edit: review.id,
    budgetType: review.budgetType,
    sampleIteration: review.sampleIteration,
  });
};

// Build TPM's request rows from context (budget changes + batches + budget reviews) + any mock budget requests they own.
const buildMyRequests = ({ userName, topupRequests, batchDeliveries, budgetReviews }) => {
  const rows = [];

  // Budget reviews modified/rejected by CTO (context state)
  budgetReviews
    .filter((r) => r.tpm === userName)
    .forEach((r) => {
      const ctoModified = hasCtoModifiedBudgetReview(r);
      const decisions = [];
      if (r.ctoAt) {
        decisions.push({
          actor: "L2",
          decision: r.status === "rejected-by-cto" ? "reject" : r.status === "returned-to-tpm" ? "return" : ctoModified ? "modify" : "approve",
          label: r.status === "rejected-by-cto"
            ? "Rejected"
            : r.status === "returned-to-tpm"
              ? "Returned"
              : getCtoForwardLabel(r),
          amount: r.status === "rejected-by-cto" ? 0 : (r.modifiedTotal ?? r.requestedBudget),
          comment: [r.ctoChangeSummary, r.ctoComment].filter(Boolean).join(" · "),
          at: r.ctoAt,
        });
      }
      if (r.cfoDecision) {
        decisions.push({
          actor: "L3",
          decision: r.cfoDecision.decision,
          amount: r.cfoDecision.amount,
          comment: [r.cfoDecision.changeSummary, r.cfoDecision.comment].filter(Boolean).join(" · "),
          at: r.cfoDecision.at,
        });
      }
      const displayStatus = r.status === "forwarded-cfo"
        ? "forwarded-cfo"
        : r.status === "pending-cto"
          ? "pending-cto"
        : r.status === "pending-cfo"
          ? "pending-cfo"
        : r.status === "returned-to-tpm"
          ? "returned"
        : r.status === "rejected-by-cto"
          ? "rejected"
          : r.cfoDecision
            ? (r.cfoDecision.decision === "approve" ? "approved" : r.cfoDecision.decision === "partial" ? "partial" : r.cfoDecision.decision === "return" ? "returned" : "rejected")
            : "pending";
      const canRevise = r.status === "returned-to-tpm";
      rows.push({
        id: r.id,
        type: "Budget",
        title: "Budget review",
        subtitle: r.projectName,
        requestedAmount: r.requestedBudget,
        approvedAmount: r.status === "rejected-by-cto"
          ? 0
          : r.status === "returned-to-tpm"
            ? null
            : (r.cfoDecision?.amount ?? r.modifiedTotal),
        reason: r.status === "forwarded-cfo"
          ? ctoModified
            ? `L2 modified to ${r.modifiedTotal ? "$" + Number(r.modifiedTotal).toLocaleString() : "—"} — awaiting L3 sign-off`
            : `Approved by CTO and forwarded to CFO${r.ctoComment ? ` — ${r.ctoComment}` : ""}`
          : (r.ctoComment || r.justification || ""),
        submittedAt: r.submittedAt || r.ctoAt,
        status: displayStatus,
        decisions,
        href: canRevise ? buildBudgetResubmitHref(r) : `/approvals/${r.id}`,
        ctaLabel: canRevise ? "Revise & Resubmit" : "View full details",
      });
    });

  topupRequests
    .filter((r) => r.requester === userName || r.deliveredBy === userName)
    .forEach((r) => {
      const decisions = [];
      if (r.ctoDecision) {
        decisions.push({
          actor: "L2",
          decision: r.ctoDecision.decision,
          amount: r.ctoDecision.amount,
          comment: r.ctoDecision.comment,
          at: r.ctoDecision.at,
        });
      }
      if (r.cfoDecision) {
        decisions.push({
          actor: "L3",
          decision: r.cfoDecision.decision,
          amount: r.cfoDecision.amount,
          comment: r.cfoDecision.comment,
          at: r.cfoDecision.at,
        });
      }
      const approvedAmount = r.cfoDecision?.amount ?? r.ctoDecision?.amount ?? null;
      rows.push({
        id: r.id,
        type: "Topup",
        title: `${r.phaseName} additional request`,
        subtitle: r.projectName,
        requestedAmount: r.amount,
        approvedAmount: r.status === "rejected" ? 0 : approvedAmount,
        reason: r.reason,
        submittedAt: r.requestedAt,
        status: r.status,
        decisions,
        href: `/topup-requests/${r.id}`,
        ctaLabel: "View full details",
      });
    });

  batchDeliveries
    .filter((d) => d.deliveredBy === userName)
    .forEach((d) => {
      const decisions = [];
      if (d.actualRecovered != null) {
        decisions.push({
          actor: "L3",
          decision: d.status === "recovered" ? "approve" : d.actualRecovered === 0 ? "reject" : "partial",
          amount: d.actualRecovered,
          comment: d.cfoNote,
          at: d.cfoAt,
        });
      }
      rows.push({
        id: d.id,
        type: "Batch",
        title: `${d.phaseName} · batch delivery`,
        subtitle: `${d.projectName} · ${d.client}`,
        requestedAmount: d.proposedAmount,
        approvedAmount: d.actualRecovered,
        reason: d.clientComment,
        clientRepresentative: d.clientRepresentative,
        submittedAt: d.deliveredAt,
        status: d.status,
        decisions,
        href: "/batch-deliveries",
        ctaLabel: "View full details",
      });
    });

  // Mock APPROVALS entries where TPM was the requester
  APPROVALS.filter((a) => a.requester === userName).forEach((a) => {
    rows.push({
      id: a.id,
      type: "Budget",
      title: a.type,
      subtitle: a.project,
      requestedAmount: a.amount,
      approvedAmount: null,
      reason: a.notes || "",
      submittedAt: a.ts,
      status: "pending",
      decisions: [{ actor: a.stage, decision: "pending", amount: null, comment: `Currently at ${a.stage} stage.`, at: a.ts }],
      href: null,
      ctaLabel: null,
    });
  });

  return rows.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
};

const StatusChip = ({ status }) => {
  const cfg = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${toneClasses[cfg.tone]}`} data-testid={`status-${status}`}>
      <cfg.Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
};

// -------------------- TPM view (read-only status tracking) --------------------
const TpmMyRequests = () => {
  const { user, topupRequests, batchDeliveries, budgetReviews } = useApp();
  const [filter, setFilter] = useState("all");
  const rows = useMemo(
    () => buildMyRequests({ userName: user?.name, topupRequests, batchDeliveries, budgetReviews }),
    [user, topupRequests, batchDeliveries, budgetReviews]
  );

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => ["pending", "pending-cto", "pending-cfo", "forwarded-cfo"].includes(r.status)).length,
    approved: rows.filter((r) => r.status === "approved" || r.status === "recovered").length,
    partial: rows.filter((r) => r.status === "partial" || r.status === "partial-recovered").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    returned: rows.filter((r) => r.status === "returned").length,
  }), [rows]);

  const filtered = filter === "all" ? rows : rows.filter((r) => {
    if (filter === "pending") return ["pending", "pending-cto", "pending-cfo", "forwarded-cfo"].includes(r.status);
    if (filter === "approved") return r.status === "approved" || r.status === "recovered";
    if (filter === "partial") return r.status === "partial" || r.status === "partial-recovered";
    if (filter === "rejected") return r.status === "rejected";
    if (filter === "returned") return r.status === "returned";
    return true;
  });

  return (
    <div className="space-y-6" data-testid="page-approvals">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
          <MessageSquare className="w-3 h-3" /> TPM Portal
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <h1 className="font-display font-semibold text-3xl tracking-tight text-white">My requests &amp; status</h1>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300" data-testid="tpm-readonly-badge">
            <Lock className="w-3 h-3" /> Read-only · approvers act from their portals
          </span>
        </div>
        <p className="text-sm text-zinc-400 mt-1">
          Live status of every request you submitted · CTO/CFO comments visible here as soon as they decide.
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MiniStat label="Total" value={String(stats.total)} tone="magenta" testid="my-req-total" />
        <MiniStat label="Pending" value={String(stats.pending)} tone="amber" testid="my-req-pending" />
        <MiniStat label="Approved" value={String(stats.approved)} tone="emerald" testid="my-req-approved" />
        <MiniStat label="Partial" value={String(stats.partial)} tone="emerald-soft" testid="my-req-partial" />
        <MiniStat label="Rejected" value={String(stats.rejected)} tone="red" testid="my-req-rejected" />
        <MiniStat label="Returned" value={String(stats.returned)} tone="amber" testid="my-req-returned" />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { k: "all", l: "All" },
          { k: "pending", l: "Pending" },
          { k: "approved", l: "Approved" },
          { k: "partial", l: "Partial" },
          { k: "rejected", l: "Rejected" },
          { k: "returned", l: "Returned" },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            data-testid={`filter-${f.k}`}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.k
                ? "bg-fuchsia-500 text-white border-fuchsia-500"
                : "bg-transparent text-zinc-400 border-white/15 hover:text-zinc-100 hover:border-white/25"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* Request cards */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center" data-testid="my-req-empty">
          <Info className="w-8 h-8 mx-auto text-zinc-600 mb-3" />
          <div className="text-sm text-zinc-300 font-medium">Nothing to show here yet</div>
          <div className="text-xs text-zinc-500 mt-1">Raise an additional request or deliver a batch to see it tracked here.</div>
        </div>
      )}
      <div className="space-y-3">
        {filtered.map((r) => {
          const t = typeConfig[r.type];
          const delta = r.approvedAmount != null ? r.approvedAmount - r.requestedAmount : null;
          return (
            <div key={r.id} data-testid={`my-req-${r.id}`} className="bg-[#12121A] rounded-2xl border border-white/5 hover:border-fuchsia-500/25 transition-colors p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 ${t.tone}`}>
                      <t.Icon className="w-3 h-3" /> {t.label}
                    </span>
                    <StatusChip status={r.status} />
                  </div>
                  <div className="mt-2 font-display font-semibold text-lg text-white">{r.title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" /> {r.subtitle}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" /> {user?.name}</span>
                    <span>·</span>
                    <span className="tabular">{fmtDate(r.submittedAt)}</span>
                  </div>
                  {r.reason && (
                    <div className="mt-2 text-xs text-zinc-300 leading-relaxed line-clamp-2">
                      <span className="text-fuchsia-200 font-semibold">{r.type === "Batch" ? "Client feedback: " : "Reason: "}</span>{r.reason}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Requested</div>
                  <div className="font-display text-xl font-semibold text-white tabular">{fmtCurrency(r.requestedAmount, { compact: false })}</div>
                  {r.approvedAmount != null && (
                    <>
                      <div className="mt-1 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Approved</div>
                      <div className={`text-sm font-semibold tabular ${r.approvedAmount === 0 ? "text-red-300" : "text-emerald-300"}`}>
                        {fmtCurrency(r.approvedAmount, { compact: false })}
                      </div>
                      {delta !== 0 && r.approvedAmount > 0 && (
                        <div className={`text-[10px] tabular ${delta > 0 ? "text-emerald-300" : "text-amber-300"}`}>
                          {delta > 0 ? "+" : ""}{fmtCurrency(delta, { compact: false })} vs requested
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Comments timeline */}
              {r.decisions.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/5 space-y-2" data-testid={`my-req-comments-${r.id}`}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Approver comments
                  </div>
                  {r.decisions.map((d, i) => {
                    const dIcon = d.decision === "reject"
                      ? { Icon: XCircle, cls: "text-red-300 bg-red-500/15 border-red-500/30" }
                      : d.decision === "partial"
                        ? { Icon: Percent, cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" }
                        : d.decision === "approve"
                          ? { Icon: CheckCircle2, cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" }
                          : d.decision === "modify"
                            ? { Icon: Undo2, cls: "text-sky-300 bg-sky-500/15 border-sky-500/30" }
                            : { Icon: Clock3, cls: "text-amber-300 bg-amber-500/15 border-amber-500/30" };
                    return (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border flex-shrink-0 mt-0.5 ${dIcon.cls}`}>
                          <dIcon.Icon className="w-3 h-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap text-[11px]">
                            <span className="text-white font-semibold">{d.actor}</span>
                            <span className="text-zinc-500">·</span>
                            <span className="text-zinc-300 capitalize">
                              {d.label || (d.decision === "approve" ? "Approved" : d.decision === "partial" ? "Approved" : d.decision === "reject" ? "Rejected" : d.decision === "modify" ? "Modified & forwarded to CFO" : d.decision === "return" ? "Returned" : d.decision)}
                            </span>
                            {d.amount != null && d.decision !== "pending" && d.decision !== "reject" && (
                              <>
                                <span className="text-zinc-500">·</span>
                                <span className="text-emerald-300 tabular font-semibold">{fmtCurrency(d.amount, { compact: false })}</span>
                              </>
                            )}
                            {d.at && (
                              <>
                                <span className="text-zinc-500">·</span>
                                <span className="text-zinc-500 tabular">{fmtDate(d.at)}</span>
                              </>
                            )}
                          </div>
                          {d.comment && <div className="text-xs text-zinc-300 mt-1 leading-relaxed">{d.comment}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {r.href && (
                <div className="mt-3 flex items-center justify-end">
                  <Link to={r.href} data-testid={`open-${r.id}`} className="inline-flex items-center gap-1 text-xs text-fuchsia-300 hover:text-fuchsia-200">
                    {r.ctaLabel || "View full details"} <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, tone, testid }) => {
  const tones = {
    magenta: "text-fuchsia-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    "emerald-soft": "text-emerald-300",
    red: "text-red-300",
  };
  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4" data-testid={testid}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`mt-2 font-display font-semibold text-2xl tabular ${tones[tone] || "text-white"}`}>{value}</div>
    </div>
  );
};

// -------------------- Legacy view (CTO / CFO / Admin / PL keep decision UI) --------------------
const LegacyApprovals = () => {
  const [partial, setPartial] = useState(null);
  const approve = (a) => toast.success(`Approved · ${a.project}`, { description: `${a.type} · ${fmtCurrency(a.amount, { compact: false })}` });
  const reject = (a) => toast.warning(`Rejected · ${a.project}`, { description: `${a.type} · ${fmtCurrency(a.amount, { compact: false })}` });

  return (
    <div className="space-y-6" data-testid="page-approvals-legacy">
      <div>
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">Approvals</h1>
        <p className="text-sm text-zinc-400 mt-1">Budget and additional requests pending decision · full / partial / reject supported</p>
      </div>
      <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/[0.02]">
              <th className="text-left py-3 px-5">Project</th>
              <th className="text-left py-3 px-2">Type</th>
              <th className="text-left py-3 px-2">Requester</th>
              <th className="text-right py-3 px-2">Amount</th>
              <th className="text-left py-3 px-2">Stage</th>
              <th className="text-left py-3 px-2">Requested</th>
              <th className="text-right py-3 px-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {APPROVALS.map((a) => (
              <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]" data-testid={`approval-row-${a.id}`}>
                <td className="py-3 px-5 text-sm font-semibold text-white">{a.project}</td>
                <td className="py-3 px-2 text-sm text-zinc-200">{a.type}</td>
                <td className="py-3 px-2 text-sm text-zinc-300">{a.requester}</td>
                <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(a.amount, { compact: false })}</td>
                <td className="py-3 px-2">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${stageColor(a.stage)}`}>
                    <Clock3 className="w-3 h-3" />
                    {a.stage}
                  </span>
                </td>
                <td className="py-3 px-2 text-xs text-zinc-500 tabular">{fmtDate(a.ts)}</td>
                <td className="py-3 px-5 text-right space-x-1.5 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => reject(a)} className="h-8 rounded-lg gap-1 border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300" data-testid={`btn-reject-${a.id}`}>
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPartial(a)} className="h-8 rounded-lg gap-1 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300" data-testid={`btn-partial-${a.id}`}>
                    <Split className="w-3.5 h-3.5" />
                    Partial
                  </Button>
                  <Button size="sm" onClick={() => approve(a)} className="h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 gap-1 text-white" data-testid={`btn-approve-${a.id}`}>
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PartialApprovalDialog open={!!partial} onOpenChange={(o) => !o && setPartial(null)} approval={partial} />
    </div>
  );
};

const Approvals = () => {
  const { role } = useApp();
  // TPMs (and R&D team, which shares the TPM view) never see the decision UI on this route.
  return isTpmView(role) ? <TpmMyRequests /> : <LegacyApprovals />;
};

export default Approvals;
