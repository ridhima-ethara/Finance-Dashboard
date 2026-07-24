import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  ArrowLeft,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Percent,
  Cpu,
  Server,
  CreditCard,
  Sparkles,
  Undo2,
  Check,
  X,
} from "lucide-react";

const sectionTone = {
  fuchsia: "border-fuchsia-500/20 bg-fuchsia-500/[0.05] text-fuchsia-200",
  sky: "border-sky-500/20 bg-sky-500/[0.05] text-sky-200",
  amber: "border-amber-500/20 bg-amber-500/[0.05] text-amber-200",
};

const ChangeRequestDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { role, changeRequests, projects, cfoDecideChangeRequest, itProvisioningRequests } = useApp();
  const request = useMemo(() => changeRequests.find((entry) => entry.id === id), [changeRequests, id]);
  const project = useMemo(() => projects.find((entry) => entry.id === request?.projectId), [projects, request]);
  const itRequest = useMemo(
    () => itProvisioningRequests.find((entry) => entry.sourceReviewId === request?.id),
    [itProvisioningRequests, request]
  );

  const [approvedAmt, setApprovedAmt] = useState(request?.cfoDecision?.amount || request?.ctoDecision?.amount || request?.amount || 0);
  const [comment, setComment] = useState(request?.cfoDecision?.comment || "");

  useEffect(() => {
    setApprovedAmt(request?.cfoDecision?.amount || request?.ctoDecision?.amount || request?.amount || 0);
    setComment(request?.cfoDecision?.comment || "");
  }, [request]);

  if (!request) {
    return (
      <div className="text-sm text-zinc-400">
        Additional request not found.{" "}
        <button onClick={() => nav("/approval-queue")} className="text-fuchsia-300 underline">
          Back to approval queue
        </button>
      </div>
    );
  }

  const canAct = role === "CFO" && request.stage === "CFO Review";
  const finalAmount = request.finalDecision?.amount || request.cfoDecision?.amount || request.ctoDecision?.amount || request.amount;
  const decisionStatus = request.status === "partial"
    ? "Approved"
    : request.status === "approved" || request.stage === "Approved"
      ? "Approved"
      : request.status === "rejected" || request.stage === "Rejected"
        ? "Rejected"
        : request.status === "returned"
          ? "Returned"
          : "Pending";

  const breakdown = [
    {
      key: "models",
      title: "Models",
      icon: Cpu,
      tone: "fuchsia",
      amount: Number(request.breakdown?.models?.amount || 0),
      detail: request.breakdown?.models?.optionLabel || "No model change captured",
      note: request.breakdown?.models?.note || "",
    },
    {
      key: "infra",
      title: "Infrastructure",
      icon: Server,
      tone: "sky",
      amount: Number(request.breakdown?.infra?.amount || 0),
      detail: request.breakdown?.infra?.optionLabel || "No infra change captured",
      note: request.breakdown?.infra?.note || "",
    },
    {
      key: "subs",
      title: "Subscriptions",
      icon: CreditCard,
      tone: "amber",
      amount: Number(request.breakdown?.subs?.amount || 0),
      detail: request.breakdown?.subs?.optionLabel || "No subscription change captured",
      note: request.breakdown?.subs?.note || "",
    },
  ];

  const approve = () => {
    cfoDecideChangeRequest(request.id, { decision: "approve", amount: request.amount, comment });
    toast.success("Additional request approved", { description: `${request.projectName} routed to IT for follow-up where required.` });
  };

  const partial = () => {
    if (!approvedAmt || approvedAmt <= 0 || approvedAmt >= request.amount) {
      toast.error("Enter a partial amount below the requested delta");
      return;
    }
    cfoDecideChangeRequest(request.id, { decision: "partial", amount: approvedAmt, comment });
    toast.success("Additional request partially approved", { description: `${fmtCurrency(approvedAmt, { compact: false })} approved for ${request.projectName}.` });
  };

  const reject = () => {
    if (!comment.trim()) {
      toast.error("Comment required to reject");
      return;
    }
    cfoDecideChangeRequest(request.id, { decision: "reject", amount: 0, comment });
    toast.error("Additional request rejected");
  };

  const sendBack = () => {
    if (!comment.trim()) {
      toast.error("Comment required to return");
      return;
    }
    cfoDecideChangeRequest(request.id, { decision: "return", amount: approvedAmt, comment });
    toast.info("Returned to CTO with comments");
  };

  return (
    <div className="space-y-4" data-testid="page-cfo-change-request-detail">
      <button onClick={() => nav("/approval-queue")} className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white" data-testid="btn-back">
        <ArrowLeft className="w-3.5 h-3.5" /> Approval Queue
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">{request.projectName}</h1>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-200">
          <GitPullRequest className="w-3 h-3" /> Additional request
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
          {decisionStatus}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Info label="Project" value={request.projectName} />
              <Info label="Request type" value={request.type} />
              <Info label="Raised by" value={request.requester} />
              <Info label="Budget delta" value={fmtCurrency(request.amount, { compact: false })} />
              <Info label="Expected tasks" value={request.expectedTasks || "Not specified"} />
              <Info label="Timeline delta" value={request.timelineDelta || "No timeline change"} />
              <Info label="Affected scope" value={request.affectedPhase || "Scope / budget update"} />
              <Info label="Current budget" value={fmtCurrency(request.currentBudget, { compact: false })} />
              <Info label="Requested total" value={fmtCurrency(request.requestedBudget, { compact: false })} />
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Reason</div>
              <div className="text-sm text-zinc-200 leading-relaxed">{request.reason}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {breakdown.map((section) => (
              <div key={section.key} className={`rounded-2xl border p-4 ${sectionTone[section.tone]}`}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold">
                  <section.icon className="w-3.5 h-3.5" /> {section.title}
                </div>
                <div className="mt-2 text-xl font-display font-semibold text-white tabular">{fmtCurrency(section.amount, { compact: false })}</div>
                <div className="mt-2 text-xs text-zinc-300">{section.detail}</div>
                {section.note && <div className="mt-2 text-[11px] text-zinc-400 leading-relaxed">{section.note}</div>}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-200 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">L3 insight: </span>
              Review the requested delta against the line-item change scope, then decide whether the full amount, a reduced amount, or a return to CTO is the right path before IT provisioning follows.
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Audit trail</div>
            <div className="space-y-3">
              {(request.history || []).map((entry, index) => (
                <div key={`${entry.at}-${index}`} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                  <div className="text-sm text-white">{entry.action}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{entry.actor} · {new Date(entry.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
                  {entry.detail && <div className="text-[11px] text-zinc-300 mt-1">{entry.detail}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="change-request-decision-card">
            <div className="font-display font-semibold text-[15px] text-white mb-3">L3 decision</div>
            {canAct ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Approved amount (partial if edited)</div>
                  <input
                    type="number"
                    min="0"
                    value={approvedAmt}
                    onChange={(event) => setApprovedAmt(Number(event.target.value) || 0)}
                    data-testid="cr-approved-amount"
                    className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Comment</div>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={4}
                    data-testid="cr-comment"
                    placeholder="Add L3 guidance, conditions, or return notes"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={approve} className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5" data-testid="cr-approve">
                    <Check className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button onClick={partial} className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5" data-testid="cr-partial">
                    <Percent className="w-3.5 h-3.5" /> Partial
                  </Button>
                  <Button onClick={sendBack} variant="outline" className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 gap-1.5" data-testid="cr-return">
                    <Undo2 className="w-3.5 h-3.5" /> Return
                  </Button>
                  <Button onClick={reject} variant="outline" className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-1.5" data-testid="cr-reject">
                    <X className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`rounded-xl border p-3 ${request.status === "rejected" ? "bg-red-500/[0.05] border-red-500/30" : "bg-emerald-500/[0.05] border-emerald-500/30"}`}>
                <div className={`flex items-center gap-2 ${request.status === "rejected" ? "text-red-300" : "text-emerald-300"}`}>
                  {request.status === "rejected" ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span className="text-sm font-semibold">{decisionStatus}</span>
                </div>
                <div className="mt-2 text-xs text-zinc-300">
                  Final amount: <span className="font-semibold text-white tabular">{fmtCurrency(finalAmount, { compact: false })}</span>
                </div>
                {request.cfoDecision?.comment && <div className="mt-2 text-xs text-zinc-400">{request.cfoDecision.comment}</div>}
              </div>
            )}
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Project impact</div>
            <div className="space-y-2 text-sm">
              <ImpactRow label="Current approved" value={fmtCurrency(project?.approvedBudget || request.currentBudget, { compact: false })} />
              <ImpactRow label="Requested delta" value={fmtCurrency(request.amount, { compact: false })} />
              <ImpactRow label="L3 amount" value={fmtCurrency(canAct ? approvedAmt : finalAmount, { compact: false })} />
              <ImpactRow label="Projected total" value={fmtCurrency((project?.approvedBudget || request.currentBudget) + (canAct ? approvedAmt : finalAmount), { compact: false })} />
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="font-display font-semibold text-[15px] text-white mb-3">IT handoff</div>
            {itRequest ? (
              <div className="space-y-2 text-sm">
                <ImpactRow label="Status" value={itRequest.status === "completed" ? "Provisioned" : "Pending IT"} />
                <ImpactRow label="Approved amount" value={fmtCurrency(itRequest.approvedAmount, { compact: false })} />
                <ImpactRow label="Members" value={String(itRequest.members?.length || 0)} />
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                IT provisioning is created once L3 approves or partially approves this additional request.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-1 text-sm text-white">{value}</div>
  </div>
);

const ImpactRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-zinc-400">{label}</span>
    <span className="text-white font-semibold tabular">{value}</span>
  </div>
);

export default ChangeRequestDetail;
