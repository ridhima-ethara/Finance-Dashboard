import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { PackageCheck, DollarSign, MessageSquare, Send, X, ThumbsUp, ThumbsDown, RefreshCw, Receipt, Ban } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { normalizeBudgetType } from "../lib/projectMetrics";
import { buildProjectBudgetBuilderHref } from "../lib/projectBudgetRoute";

// Deliver batch dialog.
//   TPM view : proposed recoverable amount + client comment (no Client representative field).
//   R&D view : task count submitted, estimated $ per task, trajectories, models used, client
//              comments, plus Reject / Accept / Changes-requested mark. Once R&D marks
//              "Accept", the TPM is notified that this is the correct estimate.
const DeliverBatchDialog = ({ open, onOpenChange, project, phase, delivery = null }) => {
  const nav = useNavigate();
  const { deliverBatch, recordRndBatchFeedback, role, user, getPhaseLogs } = useApp();
  const isRnd = role === "R&D";
  const isFeedbackMode = isRnd && delivery?.status === "feedback-pending";
  const activeBudgetType = normalizeBudgetType(project?.lastBudgetSubmission?.budgetType || project?.type || "");
  const isTestingBudget = isRnd && activeBudgetType === "Testing";
  const nextSampleIteration = Math.max(Number(project?.lastBudgetSubmission?.sampleIteration || 1), 1);
  const phaseLogs = useMemo(
    () => (project?.id && phase?.id ? getPhaseLogs(project.id, phase.id) : []),
    [getPhaseLogs, phase?.id, project?.id]
  );
  const phaseLoggedAmount = useMemo(() => phaseLogs.reduce((sum, log) => sum + Number(log.cost || 0), 0), [phaseLogs]);
  const modelTaskSummary = useMemo(() => {
    const grouped = new Map();
    phaseLogs.forEach((log) => {
      const rows = Array.isArray(log.successfulRows) && log.successfulRows.length
        ? log.successfulRows.map((row) => ({
            model: row.modelName || "Unspecified model",
            tasks: Number(row.task || 0) || 1,
            trajectories: Number(row.stage || 0),
          }))
        : (Array.isArray(log.modelUsage) && log.modelUsage.length
          ? log.modelUsage.map((row) => ({
              model: row.modelName || "Unspecified model",
              tasks: Number(row.tasksDone || 0),
              trajectories: Number(row.trajectories || 0),
            }))
          : [{
              model: log.modelName || "Unspecified model",
              tasks: Number(log.successfulTasks ?? log.tasksDone ?? 0),
              trajectories: Number(log.successTrajectories ?? log.trajectories ?? 0),
            }]);
      rows.forEach((row) => {
        const current = grouped.get(row.model) || { model: row.model, tasks: 0, trajectories: 0 };
        current.tasks += row.tasks;
        current.trajectories += row.trajectories;
        grouped.set(row.model, current);
      });
    });
    return Array.from(grouped.values()).filter((row) => row.tasks > 0 || row.trajectories > 0);
  }, [phaseLogs]);
  const submittedTaskTotal = modelTaskSummary.reduce((sum, row) => sum + row.tasks, 0);
  const submittedTrajectoryTotal = modelTaskSummary.reduce((sum, row) => sum + row.trajectories, 0);

  // TPM state
  const [recoveryType, setRecoveryType] = useState("recoverable");
  const [amount, setAmount] = useState(phaseLoggedAmount);
  const [comment, setComment] = useState("");

  // R&D state
  const [rndClientComment, setRndClientComment] = useState("");
  const [rndDecision, setRndDecision] = useState("accept"); // accept | reject | changes

  const rndTotal = phaseLoggedAmount || Number(phase?.estimated || 0);

  useEffect(() => {
    if (!open) return;
    setRecoveryType("recoverable");
    setAmount(phaseLoggedAmount);
    setComment("");
    setRndClientComment("");
    setRndDecision("accept");
  }, [open, phase?.estimated, phase?.totalTasks, phase?.trajectoriesPerTask, phaseLoggedAmount]);

  const submitTpm = () => {
    if (!project || !phase) { toast.error("Missing phase context"); return; }
    const isRecoverable = recoveryType === "recoverable";
    if (isRecoverable && (!amount || Number(amount) <= 0)) { toast.error("Enter a valid recoverable amount"); return; }
    if (!comment.trim()) { toast.error("Add the client's comment / reason"); return; }
    deliverBatch({
      projectId: project.id,
      phaseId: phase.id,
      phaseName: phase.name,
      proposedAmount: isRecoverable ? amount : 0,
      clientComment: comment,
      isRecoverable,
    });
    toast.success(isRecoverable ? "Batch delivered to CFO" : "Batch marked non-recoverable", {
      description: isRecoverable
        ? `${project.name} · ${phase.name} · proposed ${fmtCurrency(amount, { compact: false })}`
        : `${project.name} · ${phase.name} · closed as non-recoverable`,
    });
    onOpenChange(false);
  };

  const submitRnd = () => {
    if (!project || !phase) { toast.error("Missing phase context"); return; }
    if (submittedTaskTotal <= 0) { toast.error("Log at least one task before submitting this batch"); return; }

    const delivery = deliverBatch({
      projectId: project.id,
      phaseId: phase.id,
      phaseName: phase.name,
      proposedAmount: rndTotal,
      clientComment: "",
      sampleIteration: nextSampleIteration,
      rnd: {
        taskCount: submittedTaskTotal,
        trajectories: submittedTrajectoryTotal,
        modelTaskSummary,
        submissionOnly: !isTestingBudget,
        decision: isTestingBudget ? "accept" : null,
        reviewer: user?.name || "R&D",
      },
    });

    if (isTestingBudget) {
      toast.success("Testing batch submitted", {
        description: `${project.name} · ${phase.name} · testing is complete and the Sample budget step is next`,
      });
      onOpenChange(false);
      nav(buildProjectBudgetBuilderHref(project.id, {
        budgetType: "RnD",
        phaseId: phase.id,
        sampleIteration: 1,
        sourceDeliveryId: delivery.id,
      }));
      return;
    }

    toast.success("Batch submitted", { description: `${submittedTaskTotal.toLocaleString()} tasks submitted · awaiting client feedback` });
    onOpenChange(false);
  };

  const submitFeedback = () => {
    if (!rndClientComment.trim()) { toast.error("Enter the feedback received from the client"); return; }
    recordRndBatchFeedback(delivery.id, { decision: rndDecision, comment: rndClientComment.trim() });
    toast.success("Client feedback recorded", { description: `${project.name} · ${phase.name}` });
    onOpenChange(false);
    if (rndDecision === "changes") {
      nav(buildProjectBudgetBuilderHref(project.id, {
        budgetType: "Rework",
        phaseId: phase.id,
        sampleIteration: nextSampleIteration + 1,
        sourceDeliveryId: delivery.id,
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="deliver-batch-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30">
              <PackageCheck className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">
                {isFeedbackMode ? "Record client feedback" : isRnd ? (isTestingBudget ? "R&D · Submit testing batch" : "R&D · Submit batch") : "Deliver batch"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {project?.name} · {phase?.name} · {isRnd
                  ? (isTestingBudget ? "testing is complete; submit it and move to the next Sample budget step" : "confirm the estimate before it goes forward")
                  : "notifies CFO to record actual recovery"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!isRnd && (
          <div className="space-y-3 py-2" data-testid="deliver-tpm-form">
            <MiniField label="Phase logged amount" value={fmtCurrency(phaseLoggedAmount, { compact: false })} />

            <Field label="Recovery type">
              <div className="grid grid-cols-2 gap-2" data-testid="deliver-recovery-type">
                {[
                  { key: "recoverable", label: "Recoverable", icon: Receipt },
                  { key: "non-recoverable", label: "Non-recoverable", icon: Ban },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setRecoveryType(option.key)}
                    data-testid={`deliver-recovery-${option.key}`}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      recoveryType === option.key
                        ? option.key === "recoverable"
                          ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                          : "border-amber-500/35 bg-amber-500/15 text-amber-300"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    <option.icon className="w-3.5 h-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>
            </Field>

            {recoveryType === "recoverable" && (
              <Field label="Recoverable amount (USD)">
                <div className="relative">
                  <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number" min="0" step="50" value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    data-testid="deliver-amount"
                    className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                </div>
              </Field>
            )}

            <Field label="Client comment / reason received">
              <textarea
                value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                placeholder={recoveryType === "recoverable" ? "What did the client say about this batch? Any negotiation or scope note?" : "Why is this batch non-recoverable? Capture the client note or internal reason."}
                data-testid="deliver-comment"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
            </Field>

            <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-300 leading-relaxed">
                {recoveryType === "recoverable"
                  ? <>CFO will be notified and can enter the <span className="text-emerald-300 font-semibold">actual amount recovered</span>. Both proposed and recovered are surfaced under the CFO Projects section.</>
                  : <>This delivery is closed as <span className="text-amber-300 font-semibold">non-recoverable</span>. It stays in the delivery log, but no recovery amount is expected from Finance.</>}
              </div>
            </div>
          </div>
        )}

        {isRnd && !isFeedbackMode && (
          <div className="space-y-3 py-2" data-testid="deliver-rnd-form">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <span>Model</span><span className="text-right">Tasks</span><span className="text-right">Trajectories</span>
              </div>
              {modelTaskSummary.map((row) => (
                <div key={row.model} className="grid grid-cols-[1fr_auto_auto] gap-4 px-3 py-2.5 text-sm border-b border-white/5 last:border-0">
                  <span className="text-zinc-100">{row.model}</span><span className="min-w-16 text-right tabular">{row.tasks.toLocaleString()}</span><span className="min-w-20 text-right tabular text-zinc-300">{row.trajectories.toLocaleString()}</span>
                </div>
              ))}
              {!modelTaskSummary.length && <div className="px-3 py-5 text-center text-xs text-zinc-500">No logged tasks are available for this batch.</div>}
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Total tasks submitted</span>
              <span className="text-fuchsia-300 font-display text-xl font-semibold tabular" data-testid="deliver-rnd-task-total">{submittedTaskTotal.toLocaleString()}</span>
            </div>
          </div>
        )}

        {isFeedbackMode && (
          <div className="space-y-4 py-2" data-testid="deliver-rnd-feedback-form">
            <Field label="Client feedback">
              <textarea
                value={rndClientComment} onChange={(e) => setRndClientComment(e.target.value)} rows={2}
                placeholder="Enter the feedback received from the client"
                data-testid="deliver-rnd-client-comment"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
            </Field>

            <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Mark this batch as</div>
                <div className="grid grid-cols-3 gap-2" data-testid="deliver-rnd-decision">
                  {[
                    { k: "accept", label: "Accept", icon: ThumbsUp, on: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
                    { k: "changes", label: "Returned", icon: RefreshCw, on: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
                    { k: "reject", label: "Reject", icon: ThumbsDown, on: "bg-red-500/15 text-red-300 border-red-500/30" },
                  ].map((d) => (
                    <button
                      key={d.k}
                      onClick={() => setRndDecision(d.k)}
                      data-testid={`deliver-rnd-decision-${d.k}`}
                      className={`inline-flex items-center gap-1.5 justify-center px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        rndDecision === d.k ? d.on : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      <d.icon className="w-3.5 h-3.5" />
                      {d.label}
                    </button>
                  ))}
                </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline" onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            data-testid="deliver-cancel"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            onClick={isFeedbackMode ? submitFeedback : isRnd ? submitRnd : submitTpm}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="deliver-submit"
          >
            <Send className="w-3.5 h-3.5" /> {isFeedbackMode ? "Save feedback" : isRnd
              ? (isTestingBudget ? "Submit testing batch" : "Submit review")
              : recoveryType === "recoverable" ? "Deliver & notify CFO" : "Submit non-recoverable delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

const MiniField = ({ label, value, tone = "neutral" }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return (
    <div className="rounded-md bg-white/[0.03] border border-white/5 p-2">
      <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`text-sm font-semibold tabular mt-0.5 ${tones[tone]}`}>{value}</div>
    </div>
  );
};

export default DeliverBatchDialog;
