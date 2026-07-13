import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  ArrowLeft,
  Check,
  X,
  Percent,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Server,
  CreditCard,
  Layers,
} from "lucide-react";

const stageChip = {
  "pending-cto": { label: "Pending · CTO", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  "pending-cfo": { label: "Pending · CFO", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  partial: { label: "Partially Approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const breakdownPalette = {
  fuchsia: {
    section: "border-fuchsia-500/25",
    header: "bg-fuchsia-500/[0.08] border-fuchsia-500/20",
    title: "text-fuchsia-200",
  },
  sky: {
    section: "border-sky-500/25",
    header: "bg-sky-500/[0.08] border-sky-500/20",
    title: "text-sky-200",
  },
  amber: {
    section: "border-amber-500/25",
    header: "bg-amber-500/[0.08] border-amber-500/20",
    title: "text-amber-200",
  },
};

const TopupRequestDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { topupRequests, projects, role, ctoDecideTopup, cfoDecideTopup, getPhaseLogs } = useApp();

  const req = useMemo(() => topupRequests.find((request) => request.id === id), [topupRequests, id]);
  const project = useMemo(() => req && projects.find((entry) => entry.id === req.projectId), [projects, req]);

  const initialAmount = req?.ctoDecision?.amount ?? req?.amount ?? 0;
  const [approvedAmt, setApprovedAmt] = useState(initialAmount);
  const [comment, setComment] = useState("");

  useEffect(() => {
    setApprovedAmt(initialAmount);
  }, [initialAmount]);

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
  const currentPhase = project?.phases.find((phase) => phase.id === req.phaseId) || null;
  const phaseLogs = project && currentPhase ? getPhaseLogs(project.id, currentPhase.id) : [];
  const plannedTasks = Number(currentPhase?.totalTasks || currentPhase?.tasks || 0);
  const completedTasks = phaseLogs.reduce((sum, log) => sum + (Number(log.successfulTasks ?? log.tasksDone) || 0), 0);
  const remainingTasks = plannedTasks > 0 ? Math.max(plannedTasks - completedTasks, 0) : 0;
  const completionPct = plannedTasks > 0 ? Math.min(100, Math.round((completedTasks / plannedTasks) * 100)) : 0;
  const stage = stageChip[req.status] || stageChip["pending-cto"];
  const decisionCap = canCfoAct ? requestedByCto : req.amount;
  const stageAmount = finalized ? (req.cfoDecision?.amount || 0) : canCfoAct ? approvedAmt : requestedByCto;
  const projectedBudget = finalized ? Number(project?.approvedBudget || 0) : Number(project?.approvedBudget || 0) + (stageAmount || 0);
  const projectedRemaining = finalized ? Number(project?.remaining || 0) : Number(project?.remaining || 0) + (stageAmount || 0);

  const breakdownSections = [
    {
      key: "models",
      title: "Models",
      icon: Cpu,
      color: "fuchsia",
      entry: req.breakdown?.models || null,
      helper: "AI model spend and routing-related uplift.",
    },
    {
      key: "infra",
      title: "Infrastructure",
      icon: Server,
      color: "sky",
      entry: req.breakdown?.infra || null,
      helper: "Compute, storage, and networking needed for the phase.",
    },
    {
      key: "subscriptions",
      title: "Subscriptions",
      icon: CreditCard,
      color: "amber",
      entry: req.breakdown?.subs || null,
      helper: "Recurring seats or tools billed monthly.",
    },
  ];
  const hasBreakdown = breakdownSections.some((section) => section.entry);

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
    toast.success("CTO partial approval · forwarded to CFO", {
      description: `${fmtCurrency(approvedAmt, { compact: false })} of ${fmtCurrency(req.amount, { compact: false })}`,
    });
  };

  const doCtoReject = () => {
    if (!comment.trim()) {
      toast.error("Comment required to reject");
      return;
    }
    ctoDecideTopup(req.id, { comment, decision: "reject" });
    toast.error("Top-up rejected by CTO");
  };

  const doCfoApprove = () => {
    cfoDecideTopup(req.id, { amount: requestedByCto, comment, decision: "approve" });
    toast.success("CFO approved · added to project baseline", {
      description: `${req.projectName} · ${fmtCurrency(requestedByCto, { compact: false })}`,
    });
  };

  const doCfoPartial = () => {
    if (!approvedAmt || approvedAmt <= 0 || approvedAmt > requestedByCto) {
      toast.error(`Partial amount must be between $0 and $${requestedByCto.toLocaleString()}`);
      return;
    }
    cfoDecideTopup(req.id, { amount: approvedAmt, comment, decision: "partial" });
    toast.success("CFO partial approval · baseline updated", {
      description: `${fmtCurrency(approvedAmt, { compact: false })} added to ${req.projectName}`,
    });
  };

  const doCfoReject = () => {
    if (!comment.trim()) {
      toast.error("Comment required to reject");
      return;
    }
    cfoDecideTopup(req.id, { comment, decision: "reject" });
    toast.error("Top-up rejected by CFO");
  };

  const ctoDone = !!req.ctoDecision;
  const ctoRejected = req.ctoDecision?.decision === "reject";
  const cfoDone = !!req.cfoDecision;
  const cfoRejected = req.cfoDecision?.decision === "reject";
  const journey = [
    { label: "TPM", status: "done" },
    { label: "CTO", status: ctoRejected ? "reject" : ctoDone ? "done" : role === "CTO" ? "current" : "pending" },
    { label: "CFO", status: cfoRejected ? "reject" : cfoDone ? "done" : isCFOStage ? "current" : "pending" },
    { label: "Approved", status: (req.status === "approved" || req.status === "partial") ? "done" : "pending", num: 4 },
  ];

  return (
    <div className="space-y-4" data-testid="page-topup-detail">
      <button onClick={() => nav("/approval-queue")} className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white" data-testid="btn-back">
        <ArrowLeft className="w-3.5 h-3.5" /> Approval Queue
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">{req.projectName}</h1>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30">
          Top-up request
        </span>
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
        {req.id} · {project?.client || "Client"} · TPM {project?.tpm || "—"} · Raised by <span className="text-zinc-300">{req.requester}</span> · {req.requesterRole} ·{" "}
        {new Date(req.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </div>

      <div className="flex items-center gap-2 py-4" data-testid="journey">
        {journey.map((item, index) => {
          const isDone = item.status === "done";
          const isCurrent = item.status === "current";
          const isReject = item.status === "reject";
          return (
            <div key={item.label} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                isDone ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                  : isReject ? "bg-red-500/20 border-red-500 text-red-300"
                    : isCurrent ? "bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300"
                      : "bg-white/[0.03] border-white/10 text-zinc-500"
              }`}>
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : isReject ? <XCircle className="w-4 h-4" /> : <span className="text-xs font-semibold">{item.num || index + 1}</span>}
              </div>
              <span className={`text-xs font-medium ${isDone ? "text-emerald-300" : isReject ? "text-red-300" : isCurrent ? "text-fuchsia-300" : "text-zinc-500"}`}>{item.label}</span>
              {index < journey.length - 1 && (
                <div className={`flex-1 h-px ${isDone ? "bg-emerald-500/40" : isReject ? "bg-red-500/40" : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="meta-card">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Request ID" value={req.id} />
              <Field label="Batch / Phase" value={req.phaseName} icon={Layers} />
              <Field label="Window" value={currentPhase?.dates || "Phase window unavailable"} />
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Priority</div>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                  req.urgency === "High"
                    ? "bg-red-500/10 border-red-500/30 text-red-300"
                    : req.urgency === "Low"
                      ? "bg-white/[0.04] border-white/10 text-zinc-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                }`}>
                  {req.urgency}
                </span>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Remaining tasks</div>
                <div className="mt-1 text-white font-display font-semibold text-lg">{plannedTasks > 0 ? remainingTasks : "—"}</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full bg-fuchsia-500" style={{ width: `${plannedTasks > 0 ? completionPct : 0}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-zinc-500">
                  {plannedTasks > 0 ? `${completedTasks} of ${plannedTasks} done · ${remainingTasks} remaining` : "No task target set for this phase"}
                </div>
              </div>
              <Field label="Raised by" value={`${req.requester} · ${req.requesterRole}`} />
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Business justification</div>
              <div className="text-sm text-zinc-200 leading-relaxed">{req.reason}</div>
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="cost-breakdown">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Cost breakdown</div>
            {breakdownSections.map((section) => (
              <BreakdownSection
                key={section.key}
                title={section.title}
                icon={section.icon}
                color={section.color}
                entry={section.entry}
                helper={section.helper}
              />
            ))}
            {!hasBreakdown && (
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200">
                This request predates line-item capture, so only the total top-up amount is available.
              </div>
            )}
            {(Number(req.baseAmount || 0) > 0 || Number(req.bufferAmount || 0) > 0) && (
              <div className="mt-4 space-y-1 text-xs text-zinc-400">
                {Number(req.baseAmount || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Base request</span>
                    <span className="text-zinc-200 font-semibold tabular">{fmtCurrency(req.baseAmount, { compact: false })}</span>
                  </div>
                )}
                {Number(req.bufferAmount || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Buffer ({Number(req.bufferPct || 0)}%)</span>
                    <span className="text-zinc-200 font-semibold tabular">{fmtCurrency(req.bufferAmount, { compact: false })}</span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Total requested</span>
              <span className="text-fuchsia-300 font-display font-semibold text-2xl tabular">{fmtCurrency(req.amount, { compact: false })}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="decision-card">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-fuchsia-300" />
              <div className="font-display font-semibold text-[15px] text-white">
                {canCtoAct ? "CTO decision" : canCfoAct ? "CFO decision" : "Decision"}
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
                  <div className="text-xs text-zinc-300 mt-2 tabular">
                    Final amount: <span className="text-emerald-300 font-semibold">{fmtCurrency(req.cfoDecision.amount, { compact: false })}</span>
                  </div>
                ) : null}
                {req.cfoDecision?.comment || req.ctoDecision?.comment ? (
                  <div className="text-xs text-zinc-300 mt-2">{req.cfoDecision?.comment || req.ctoDecision?.comment}</div>
                ) : null}
              </div>
            ) : canCtoAct || canCfoAct ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
                    Approved amount {canCfoAct ? `(up to ${fmtCurrency(requestedByCto, { compact: false })})` : ""}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                    <input
                      type="number"
                      value={approvedAmt}
                      onChange={(event) => setApprovedAmt(Number(event.target.value) || 0)}
                      data-testid="input-approved-amt"
                      className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={decisionCap}
                    step="100"
                    value={approvedAmt}
                    onChange={(event) => setApprovedAmt(Number(event.target.value))}
                    data-testid="input-approved-slider"
                    className="w-full mt-2 accent-fuchsia-500"
                  />
                  <div className="text-[10px] text-zinc-500 tabular mt-1">
                    Requested: {fmtCurrency(req.amount, { compact: false })}
                    {canCfoAct ? ` · CTO forwarded ${fmtCurrency(requestedByCto, { compact: false })}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Comment</div>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={3}
                    placeholder="Explain your decision (required for reject)"
                    data-testid="input-comment"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={canCtoAct ? doCtoApprove : doCfoApprove} className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5" data-testid="btn-approve">
                    <Check className="w-3.5 h-3.5" /> Approve full
                  </Button>
                  <Button onClick={canCtoAct ? doCtoPartial : doCfoPartial} className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5" data-testid="btn-partial">
                    <Percent className="w-3.5 h-3.5" /> Partial
                  </Button>
                  <Button onClick={canCtoAct ? doCtoReject : doCfoReject} variant="outline" className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-1.5 col-span-2" data-testid="btn-reject">
                    <X className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
                {canCfoAct && (
                  <div className="text-[10px] text-zinc-500 leading-relaxed">
                    Partial approval is available here too. The final CFO amount is what gets added to <span className="text-white font-semibold">{req.projectName}</span>.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-400">
                {isCTOStage ? "Awaiting CTO review. Only CTO can act at this stage." : isCFOStage ? "Awaiting CFO sign-off. Only CFO can act at this stage." : "Read-only."}
              </div>
            )}
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="financial-summary">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Financial overview</div>
            <div className="space-y-2 text-sm">
              <Row label="Requested" value={fmtCurrency(req.amount, { compact: false })} />
              {Number(req.baseAmount || 0) > 0 && <Row label="Base ask" value={fmtCurrency(req.baseAmount, { compact: false })} />}
              {Number(req.bufferAmount || 0) > 0 && <Row label={`Buffer (${Number(req.bufferPct || 0)}%)`} value={fmtCurrency(req.bufferAmount, { compact: false })} />}
              {breakdownSections.map((section) => (
                <Row
                  key={section.key}
                  label={section.title}
                  value={section.entry ? formatEntryAmount(section.entry) : "—"}
                  color={section.entry ? "text-zinc-100" : "text-zinc-500"}
                />
              ))}
              <Row label="CTO forwarded" value={req.ctoDecision ? fmtCurrency(req.ctoDecision.amount, { compact: false }) : "—"} color={req.ctoDecision?.decision === "reject" ? "text-red-300" : "text-zinc-100"} />
              <div className="border-t border-white/5 my-2" />
              <Row label="Project approved budget" value={fmtCurrency(project?.approvedBudget || 0, { compact: false })} />
              {role === "CFO" && (
                <Row label="Actual spend" value={fmtCurrency(project?.cfoActualSpend || project?.actualSpend || 0, { compact: false })} />
              )}
              <Row label="Current remaining" value={fmtCurrency(project?.remaining || 0, { compact: false })} color={Number(project?.remaining || 0) >= 0 ? "text-emerald-300" : "text-red-300"} />
              <Row label={finalized ? "Final baseline addition" : canCfoAct ? "After selected approval" : "Forward amount to CFO"} value={finalized ? fmtCurrency(req.cfoDecision?.amount || 0, { compact: false }) : fmtCurrency(stageAmount || 0, { compact: false })} color="text-white" />
              <Row label={finalized ? "Updated project budget" : "Projected budget"} value={fmtCurrency(projectedBudget, { compact: false })} />
              <Row label={finalized ? "Updated remaining" : "Projected remaining"} value={fmtCurrency(projectedRemaining, { compact: false })} color={projectedRemaining >= 0 ? "text-emerald-300" : "text-red-300"} />
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

const BreakdownSection = ({ title, icon: Icon, color, entry, helper }) => {
  const palette = breakdownPalette[color] || breakdownPalette.fuchsia;
  const lines = getBreakdownLines(entry);

  return (
    <div className={`mt-3 first:mt-0 rounded-xl border overflow-hidden ${palette.section}`}>
      <div className={`px-4 py-3 border-b ${palette.header}`}>
        <div className="flex items-center justify-between gap-3">
          <div className={`inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold ${palette.title}`}>
            <Icon className="w-3.5 h-3.5" /> {title}
          </div>
          <div className="text-sm text-zinc-300">
            Subtotal <span className="font-semibold text-white">{entry ? formatEntryAmount(entry) : "—"}</span>
          </div>
        </div>
      </div>
      <div className="px-4 py-4 bg-white/[0.02]">
        {entry ? (
          <div className="space-y-3">
            {lines.map((line, index) => (
              <LineItem
                key={line.id || `${title}-${index + 1}`}
                name={line.optionLabel || title}
                sub={line.billingUnit === "per month" ? "Recurring line item" : "Top-up line item"}
                detail={String(line.note || "").trim() || helper}
                value={formatEntryAmount(line)}
              />
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-zinc-500">{helper}</div>
        )}
      </div>
    </div>
  );
};

const LineItem = ({ name, sub, detail, value }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="text-sm text-white font-medium">{name}</div>
      <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>
      <div className="mt-2 text-[11px] text-zinc-400 leading-relaxed">{detail}</div>
    </div>
    <div className="text-right flex-shrink-0">
      <div className="text-[10px] text-zinc-500">Requested</div>
      <div className="text-lg font-display font-semibold text-white tabular">{value}</div>
    </div>
  </div>
);

const Row = ({ label, value, color = "text-white" }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-zinc-400">{label}</span>
    <span className={`font-semibold tabular text-right ${color}`}>{value}</span>
  </div>
);

const sumBreakdownEntryAmount = (entry) => {
  if (!entry) return 0;
  if (Array.isArray(entry.entries) && entry.entries.length) {
    return entry.entries.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  }
  return Number(entry.amount || 0);
};

const getBreakdownLines = (entry) => {
  if (!entry) return [];
  if (Array.isArray(entry.entries) && entry.entries.length) return entry.entries;
  return [entry];
};

const formatEntryAmount = (entry) => `${fmtCurrency(sumBreakdownEntryAmount(entry), { compact: false })}${entry?.billingUnit === "per month" ? "/mo" : ""}`;

export default TopupRequestDetail;
