import { useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { fmtCurrency, fmtPct } from "../lib/format";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  ArrowLeft, ArrowUpRightSquare, Check, X, Percent, CheckCircle2, XCircle, Sparkles,
  User as UserIcon, Building2, Layers, Wallet, AlertTriangle, ShieldCheck,
} from "lucide-react";

const stageChip = {
  "pending-cto": { label: "Pending · CTO", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  "pending-cfo": { label: "Pending · CFO", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  partial: { label: "Partially Approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const TopupRequestDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { topupRequests, projects, role, ctoDecideTopup, cfoDecideTopup } = useApp();

  const req = useMemo(() => topupRequests.find((r) => r.id === id), [topupRequests, id]);
  const project = useMemo(() => req && projects.find((p) => p.id === req.projectId), [projects, req]);

  const initialAmount = req?.ctoDecision?.amount ?? req?.amount ?? 0;
  const [approvedAmt, setApprovedAmt] = useState(initialAmount);
  const [comment, setComment] = useState("");

  if (!req) {
    return (
      <div className="text-sm text-zinc-400">
        Top-up request not found. <button onClick={() => nav("/approval-queue")} className="text-fuchsia-300 underline">Back to queue</button>
      </div>
    );
  }

  const requestedByCto = req.ctoDecision?.amount ?? req.amount;
  const isCTOStage = req.status === "pending-cto";
  const isCFOStage = req.status === "pending-cfo";
  const canCtoAct = role === "CTO" && isCTOStage;
  const canCfoAct = role === "CFO" && isCFOStage;
  const finalized = ["approved", "partial", "rejected"].includes(req.status);

  const currentPhase = project?.phases.find((ph) => ph.id === req.phaseId);
  const stage = stageChip[req.status] || stageChip["pending-cto"];

  const doCtoApprove = () => {
    ctoDecideTopup(req.id, { amount: req.amount, comment, decision: "approve" });
    toast.success("CTO approved · forwarded to CFO", { description: `${req.projectName} · ${fmtCurrency(req.amount, { compact: false })}` });
  };
  const doCtoPartial = () => {
    if (!approvedAmt || approvedAmt <= 0 || approvedAmt >= req.amount) {
      toast.error("Partial amount must be between $0 and requested");
      return;
    }
    ctoDecideTopup(req.id, { amount: approvedAmt, comment, decision: "partial" });
    toast.success("CTO partial approval · forwarded to CFO", { description: `${fmtCurrency(approvedAmt, { compact: false })} of ${fmtCurrency(req.amount, { compact: false })}` });
  };
  const doCtoReject = () => {
    if (!comment.trim()) { toast.error("Comment required to reject"); return; }
    ctoDecideTopup(req.id, { comment, decision: "reject" });
    toast.error("Top-up rejected by CTO");
  };
  const doCfoApprove = () => {
    cfoDecideTopup(req.id, { amount: requestedByCto, comment, decision: "approve" });
    toast.success("CFO approved · added to project baseline", { description: `${req.projectName} · ${fmtCurrency(requestedByCto, { compact: false })}` });
  };
  const doCfoPartial = () => {
    if (!approvedAmt || approvedAmt <= 0 || approvedAmt > requestedByCto) {
      toast.error(`Partial amount must be between $0 and $${requestedByCto.toLocaleString()}`);
      return;
    }
    cfoDecideTopup(req.id, { amount: approvedAmt, comment, decision: "partial" });
    toast.success("CFO partial approval · baseline updated", { description: `${fmtCurrency(approvedAmt, { compact: false })} added to ${req.projectName}` });
  };
  const doCfoReject = () => {
    if (!comment.trim()) { toast.error("Comment required to reject"); return; }
    cfoDecideTopup(req.id, { comment, decision: "reject" });
    toast.error("Top-up rejected by CFO");
  };

  // Journey stages
  const ctoDone = !!req.ctoDecision;
  const ctoRej = req.ctoDecision?.decision === "reject";
  const cfoDone = !!req.cfoDecision;
  const cfoRej = req.cfoDecision?.decision === "reject";
  const journey = [
    { label: "TPM", status: "done" },
    { label: "CTO", status: ctoRej ? "reject" : ctoDone ? "done" : role === "CTO" ? "current" : "pending" },
    { label: "CFO", status: cfoRej ? "reject" : cfoDone ? "done" : isCFOStage ? "current" : "pending" },
    { label: "Approved", status: (req.status === "approved" || req.status === "partial") ? "done" : "pending", num: 4 },
  ];

  return (
    <div className="space-y-4" data-testid="page-topup-detail">
      <button onClick={() => nav("/approval-queue")} className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white" data-testid="btn-back">
        <ArrowLeft className="w-3.5 h-3.5" /> Approval Queue
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">{req.projectName}</h1>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30">Top-up · {req.phaseName}</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${stage.cls}`}>
          {stage.label}
        </span>
        {req.urgency === "High" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/10 border border-red-500/30 text-red-300">
            <AlertTriangle className="w-3 h-3" /> High
          </span>
        )}
      </div>
      <div className="text-xs text-zinc-500 tabular">
        {req.id} · Raised by <span className="text-zinc-300">{req.requester}</span> · {req.requesterRole} · {new Date(req.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </div>

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
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : isReject ? <XCircle className="w-4 h-4" /> : <span className="text-xs font-semibold">{j.num || i + 1}</span>}
              </div>
              <span className={`text-xs font-medium ${isDone ? "text-emerald-300" : isReject ? "text-red-300" : isCurrent ? "text-fuchsia-300" : "text-zinc-500"}`}>{j.label}</span>
              {i < journey.length - 1 && (
                <div className={`flex-1 h-px ${isDone ? "bg-emerald-500/40" : isReject ? "bg-red-500/40" : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Project meta */}
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="meta-card">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Project" value={<Link to={`/projects/${req.projectId}`} className="text-fuchsia-300 hover:text-fuchsia-200">{req.projectName}</Link>} />
              <Field label="Client" value={project?.client || "—"} icon={Building2} />
              <Field label="TPM" value={project?.tpm || "—"} icon={UserIcon} />
              <Field label="Phase" value={req.phaseName} icon={Layers} />
              <Field label="Requested" value={<span className="text-white tabular">{fmtCurrency(req.amount, { compact: false })}</span>} icon={ArrowUpRightSquare} />
              <Field label="Urgency" value={req.urgency} />
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Business justification</div>
              <div className="text-sm text-zinc-200 leading-relaxed">{req.reason}</div>
            </div>
          </div>

          {/* Phase snapshot */}
          {currentPhase && (
            <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="phase-snapshot">
              <div className="font-display font-semibold text-[15px] text-white mb-3">Phase snapshot</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat label="Estimated" value={fmtCurrency(currentPhase.estimated)} />
                <MiniStat label="Actual" value={fmtCurrency(currentPhase.actual)} tone="magenta" />
                <MiniStat label="Variance" value={fmtCurrency(currentPhase.estimated - currentPhase.actual)} tone={currentPhase.estimated - currentPhase.actual >= 0 ? "positive" : "negative"} />
                <MiniStat label="After top-up" value={fmtCurrency(currentPhase.estimated + (req.cfoDecision?.amount || req.ctoDecision?.amount || req.amount))} tone="emerald" />
              </div>
            </div>
          )}

          {/* Project totals */}
          {project && (
            <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="project-totals">
              <div className="font-display font-semibold text-[15px] text-white mb-3">Project financials</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat label="Approved budget" value={fmtCurrency(project.approvedBudget)} icon={Wallet} />
                <MiniStat label="Actual spend" value={fmtCurrency(project.actualSpend)} />
                <MiniStat label="Utilization" value={fmtPct(project.utilization)} />
                <MiniStat label="Remaining" value={fmtCurrency(project.remaining)} tone="emerald" />
              </div>
            </div>
          )}

          {/* AI recommendation */}
          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-200 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">AI recommendation: </span>
              Approve at <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(Math.round(req.amount * 0.85), { compact: false })}</span> (85%) — projected model routing changes will reduce actual need next sprint.
            </div>
          </div>

          {/* Activity log */}
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="activity-log">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Activity log</div>
            <div className="space-y-3">
              {req.history.map((h, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-fuchsia-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-100 font-medium">{h.action}</div>
                    <div className="text-[11px] text-zinc-500">{h.detail}</div>
                    <div className="text-[10px] text-zinc-600 tabular mt-0.5">
                      {h.actor} · {new Date(h.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar — decision */}
        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="decision-card">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-fuchsia-300" />
              <div className="font-display font-semibold text-[15px] text-white">
                {canCtoAct ? "CTO Decision · Stage 1" : canCfoAct ? "CFO Decision · Stage 2 (Final)" : "Decision"}
              </div>
            </div>

            {finalized ? (
              <div className={`rounded-lg border p-3 ${req.status === "rejected" ? "bg-red-500/[0.05] border-red-500/30" : "bg-emerald-500/[0.05] border-emerald-500/30"}`}>
                <div className={`flex items-center gap-2 mb-1 ${req.status === "rejected" ? "text-red-300" : "text-emerald-300"}`}>
                  {req.status === "rejected" ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span className="text-sm font-semibold">
                    {req.status === "approved" ? "Approved · baseline updated" : req.status === "partial" ? "Partially approved" : "Rejected"}
                  </span>
                </div>
                {req.cfoDecision?.amount ? (
                  <div className="text-xs text-zinc-300 mt-2 tabular">Final amount: <span className="text-emerald-300 font-semibold">{fmtCurrency(req.cfoDecision.amount, { compact: false })}</span></div>
                ) : null}
                {req.cfoDecision?.comment || req.ctoDecision?.comment ? (
                  <div className="text-xs text-zinc-300 mt-2">{req.cfoDecision?.comment || req.ctoDecision?.comment}</div>
                ) : null}
              </div>
            ) : canCtoAct || canCfoAct ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
                    Approved amount {canCfoAct ? `(≤ ${fmtCurrency(requestedByCto, { compact: false })} from CTO)` : ""}
                  </div>
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
                  <input
                    type="range"
                    min="0"
                    max={canCfoAct ? requestedByCto : req.amount}
                    step="100"
                    value={approvedAmt}
                    onChange={(e) => setApprovedAmt(Number(e.target.value))}
                    data-testid="input-approved-slider"
                    className="w-full mt-2 accent-fuchsia-500"
                  />
                  <div className="text-[10px] text-zinc-500 tabular mt-1">
                    {canCfoAct ? "Requested by TPM" : "Requested by TPM"}: {fmtCurrency(req.amount, { compact: false })}
                    {canCfoAct ? ` · CTO forwarded ${fmtCurrency(requestedByCto, { compact: false })}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Comment</div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Explain your decision (required for reject)"
                    data-testid="input-comment"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={canCtoAct ? doCtoApprove : doCfoApprove}
                    className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
                    data-testid="btn-approve"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve full
                  </Button>
                  <Button
                    onClick={canCtoAct ? doCtoPartial : doCfoPartial}
                    className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5"
                    data-testid="btn-partial"
                  >
                    <Percent className="w-3.5 h-3.5" /> Partial
                  </Button>
                  <Button
                    onClick={canCtoAct ? doCtoReject : doCfoReject}
                    variant="outline"
                    className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-1.5 col-span-2"
                    data-testid="btn-reject"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
                {canCfoAct && (
                  <div className="text-[10px] text-zinc-500 leading-relaxed">
                    CFO sign-off is final — approved amount will be added to <span className="text-white font-semibold">{req.projectName}</span> baseline immediately.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-400">
                {isCTOStage ? "Awaiting CTO review. Only CTO can act at this stage." : isCFOStage ? "Awaiting CFO sign-off. Only CFO can act at this stage." : "Read-only."}
              </div>
            )}
          </div>

          {/* Financial summary */}
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="financial-summary">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Financial summary</div>
            <div className="space-y-2 text-sm">
              <Row label="Requested" value={fmtCurrency(req.amount, { compact: false })} />
              <Row label="CTO approved" value={req.ctoDecision ? fmtCurrency(req.ctoDecision.amount, { compact: false }) : "—"} color={req.ctoDecision?.decision === "reject" ? "text-red-300" : "text-zinc-100"} />
              <Row label="CFO approved" value={req.cfoDecision ? fmtCurrency(req.cfoDecision.amount, { compact: false }) : "—"} color={req.cfoDecision?.decision === "reject" ? "text-red-300" : req.cfoDecision ? "text-emerald-300" : "text-zinc-100"} />
              <div className="border-t border-white/5 my-2" />
              <Row label="Final baseline addition" value={req.cfoDecision && req.cfoDecision.decision !== "reject" ? fmtCurrency(req.cfoDecision.amount, { compact: false }) : "$0"} color="text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, icon: Icon }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1 flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </div>
    <div className="text-sm text-white font-medium">{value}</div>
  </div>
);

const MiniStat = ({ label, value, tone = "neutral", icon: Icon }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", neutral: "text-white", magenta: "text-fuchsia-300", emerald: "text-emerald-300" };
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </div>
      <div className={`text-base font-semibold tabular mt-0.5 ${tones[tone]}`}>{value}</div>
    </div>
  );
};

const Row = ({ label, value, color = "text-white" }) => (
  <div className="flex items-center justify-between">
    <span className="text-zinc-400">{label}</span>
    <span className={`font-semibold tabular ${color}`}>{value}</span>
  </div>
);

export default TopupRequestDetail;
