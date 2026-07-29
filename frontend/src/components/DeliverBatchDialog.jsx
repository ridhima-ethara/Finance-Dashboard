import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { PackageCheck, DollarSign, MessageSquare, Send, X, ThumbsUp, ThumbsDown, RefreshCw, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { getTaskLogRecordedCost, normalizeBudgetType } from "../lib/projectMetrics";
import { buildProjectBudgetBuilderHref } from "../lib/projectBudgetRoute";

// Deliver batch dialog.
//   TPM view : proposed recoverable amount + client comment (no Client representative field).
//   R&D view : task count submitted, estimated $ per task, trajectories, models used, client
//              comments, plus Reject / Accept / Changes-requested mark. Once R&D marks
//              "Accept", the TPM is notified that this is the correct estimate.
const DeliverBatchDialog = ({ open, onOpenChange, project, phase, delivery = null }) => {
  const nav = useNavigate();
  const { deliverBatch, recordRndBatchFeedback, recordBatchClientFeedback, role, user, getPhaseLogs } = useApp();
  const isRnd = role === "R&D";
  const isFeedbackMode = isRnd && delivery?.status === "feedback-pending";
  const isTpmFeedbackMode = !isRnd && Boolean(delivery);
  const activeBudgetType = normalizeBudgetType(project?.lastBudgetSubmission?.budgetType || project?.type || "");
  const isTestingBudget = isRnd && activeBudgetType === "Testing";
  const nextSampleIteration = Math.max(Number(project?.lastBudgetSubmission?.sampleIteration || 1), 1);
  const phaseLogs = useMemo(
    () => (project?.id && phase?.id ? getPhaseLogs(project.id, phase.id) : []),
    [getPhaseLogs, phase?.id, project?.id]
  );
  const phaseLoggedAmount = useMemo(() => phaseLogs.reduce((sum, log) => sum + getTaskLogRecordedCost(log), 0), [phaseLogs]);
  const modelTaskSummary = useMemo(() => {
    const grouped = new Map();
    phaseLogs.forEach((log) => {
      const rows = Array.isArray(log.successfulRows) && log.successfulRows.length
        ? log.successfulRows.map((row) => ({
            model: row.modelName || "Unspecified model",
            tasks: Number(row.tasksDone || row.taskCount || 0) || 1,
            trajectories: Number(row.trajectories || row.trajectoryCount || 0),
            cost: Number(row.cost || 0),
          }))
        : (Array.isArray(log.modelUsage) && log.modelUsage.length
          ? log.modelUsage.map((row) => ({
              model: row.modelName || "Unspecified model",
              tasks: Number(row.tasksDone || 0),
              trajectories: Number(row.trajectories || 0),
              cost: Number(row.cost || 0),
            }))
          : [{
              model: log.modelName || "Unspecified model",
              tasks: Number(log.successfulTasks ?? log.tasksDone ?? 0),
              trajectories: Number(log.successTrajectories ?? log.trajectories ?? 0),
              cost: getTaskLogRecordedCost(log),
            }]);
      rows.forEach((row) => {
        const current = grouped.get(row.model) || { model: row.model, tasks: 0, trajectories: 0, cost: 0 };
        current.tasks += row.tasks;
        current.trajectories += row.trajectories;
        current.cost += row.cost;
        grouped.set(row.model, current);
      });
    });
    const summary = Array.from(grouped.values()).filter((row) => row.tasks > 0 || row.trajectories > 0 || row.cost > 0);
    const summarizedCost = summary.reduce((sum, row) => sum + row.cost, 0);
    const summarizedTasks = summary.reduce((sum, row) => sum + row.tasks, 0);
    if (summary.length && summarizedCost === 0 && phaseLoggedAmount > 0) {
      return summary.map((row) => ({
        ...row,
        cost: summarizedTasks > 0 ? phaseLoggedAmount * (row.tasks / summarizedTasks) : phaseLoggedAmount / summary.length,
      }));
    }
    return summary;
  }, [phaseLogs, phaseLoggedAmount]);
  const submittedTaskTotal = modelTaskSummary.reduce((sum, row) => sum + row.tasks, 0);
  const submittedTrajectoryTotal = modelTaskSummary.reduce((sum, row) => sum + row.trajectories, 0);
  const finalBatchCost = modelTaskSummary.reduce((sum, row) => sum + row.cost, 0) || phaseLoggedAmount;
  const finalCostPerTask = submittedTaskTotal > 0 ? finalBatchCost / submittedTaskTotal : 0;

  // TPM state
  const [amount, setAmount] = useState(phaseLoggedAmount);
  const [deliverableUrls, setDeliverableUrls] = useState("");
  const [tpmClientFeedback, setTpmClientFeedback] = useState("");

  // R&D state
  const [rndClientComment, setRndClientComment] = useState("");
  const [rndDecision, setRndDecision] = useState("accept"); // accept | reject | changes

  const rndTotal = phaseLoggedAmount || Number(phase?.estimated || 0);

  useEffect(() => {
    if (!open) return;
    setAmount(phaseLoggedAmount);
    setDeliverableUrls("");
    setTpmClientFeedback(delivery?.clientComment || "");
    setRndClientComment("");
    setRndDecision("accept");
  }, [open, phase?.estimated, phase?.totalTasks, phase?.trajectoriesPerTask, phaseLoggedAmount, delivery?.clientComment]);

  const submitTpm = () => {
    if (!project || !phase) { toast.error("Missing phase context"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Enter a valid recoverable amount"); return; }
    const urls = deliverableUrls.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
    if (!urls.length) { toast.error("Add at least one deliverable URL"); return; }
    if (urls.some((value) => !/^https?:\/\//i.test(value))) { toast.error("Enter valid deliverable URLs beginning with http:// or https://"); return; }
    deliverBatch({
      projectId: project.id,
      phaseId: phase.id,
      phaseName: phase.name,
      proposedAmount: amount,
      clientComment: "",
      isRecoverable: true,
      deliverableUrls: urls,
      tasks: submittedTaskTotal,
      trajectories: submittedTrajectoryTotal,
      modelTaskSummary,
      finalCost: finalBatchCost,
      costPerTask: finalCostPerTask,
    });
    toast.success("Batch delivered to CFO", {
      description: `${project.name} · ${phase.name} · proposed ${fmtCurrency(amount, { compact: false })}`,
    });
    onOpenChange(false);
  };

  const submitTpmFeedback = () => {
    if (!tpmClientFeedback.trim()) { toast.error("Enter the feedback received from the client"); return; }
    recordBatchClientFeedback(delivery.id, { comment: tpmClientFeedback.trim() });
    toast.success("Client feedback recorded", { description: `${project.name} · ${phase.name}` });
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
      tasks: submittedTaskTotal,
      trajectories: submittedTrajectoryTotal,
      modelTaskSummary,
      finalCost: finalBatchCost,
      costPerTask: finalCostPerTask,
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
                {isFeedbackMode || isTpmFeedbackMode ? "Record client feedback" : isRnd ? (isTestingBudget ? "R&D · Submit testing batch" : "R&D · Submit batch") : "Deliver batch"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {project?.name} · {phase?.name} · {isRnd
                  ? (isTestingBudget ? "testing is complete; submit it and move to the next Sample budget step" : "confirm the estimate before it goes forward")
                  : "notifies CFO to record actual recovery"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!isRnd && !isTpmFeedbackMode && (
          <div className="space-y-3 py-2" data-testid="deliver-tpm-form">
            <MiniField label="Phase logged amount" value={fmtCurrency(phaseLoggedAmount, { compact: false })} />
            <ModelCostBreakdown rows={modelTaskSummary} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <MiniField label="Total tasks" value={submittedTaskTotal.toLocaleString()} />
              <MiniField label="Final cost / task" value={fmtCurrency(finalCostPerTask, { compact: false })} />
              <MiniField label="Final batch cost" value={fmtCurrency(finalBatchCost, { compact: false })} tone="magenta" />
            </div>

            <Field label="Proposed recoverable amount for CFO (USD)">
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

            <Field label="Deliverable URLs">
              <textarea
                value={deliverableUrls} onChange={(e) => setDeliverableUrls(e.target.value)} rows={3}
                placeholder={"https://example.com/deliverable\nhttps://drive.google.com/..."}
                data-testid="deliver-urls"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
              <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500"><Link2 className="h-3 w-3" />Add one URL per line. Client feedback can be recorded after delivery.</div>
            </Field>

            <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-300 leading-relaxed">
                CFO will be notified and can enter the <span className="text-emerald-300 font-semibold">actual amount recovered</span>. A separate feedback action will remain available for feedback received from the client later.
              </div>
            </div>
          </div>
        )}

        {isTpmFeedbackMode && (
          <div className="space-y-3 py-2" data-testid="deliver-tpm-feedback-form">
            <Field label="Client feedback received">
              <textarea value={tpmClientFeedback} onChange={(event) => setTpmClientFeedback(event.target.value)} rows={4} placeholder="Enter the feedback received from the client after delivery" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none" />
            </Field>
          </div>
        )}

        {isRnd && !isFeedbackMode && (
          <div className="space-y-3 py-2" data-testid="deliver-rnd-form">
            <ModelCostBreakdown rows={modelTaskSummary} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <MiniField label="Total tasks submitted" value={submittedTaskTotal.toLocaleString()} />
              <MiniField label="Final cost / task" value={fmtCurrency(finalCostPerTask, { compact: false })} />
              <MiniField label="Final batch cost" value={fmtCurrency(finalBatchCost, { compact: false })} tone="magenta" />
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
            onClick={isTpmFeedbackMode ? submitTpmFeedback : isFeedbackMode ? submitFeedback : isRnd ? submitRnd : submitTpm}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="deliver-submit"
          >
            <Send className="w-3.5 h-3.5" /> {isTpmFeedbackMode || isFeedbackMode ? "Save feedback" : isRnd
              ? (isTestingBudget ? "Submit testing batch" : "Submit review")
              : "Deliver & notify CFO"}
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

const ModelCostBreakdown = ({ rows = [] }) => (
  <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-x-auto" data-testid="deliver-model-cost-breakdown">
    <div className="grid min-w-[540px] grid-cols-[1.5fr_.6fr_.8fr_.8fr_.8fr] gap-3 px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
      <span>Model</span><span className="text-right">Tasks</span><span className="text-right">Trajectories</span><span className="text-right">Cost / task</span><span className="text-right">Model cost</span>
    </div>
    {rows.map((row) => (
      <div key={row.model} className="grid min-w-[540px] grid-cols-[1.5fr_.6fr_.8fr_.8fr_.8fr] gap-3 px-3 py-2.5 text-xs border-b border-white/5 last:border-0">
        <span className="text-zinc-100 truncate">{row.model}</span><span className="text-right tabular">{row.tasks.toLocaleString()}</span><span className="text-right tabular text-zinc-300">{row.trajectories.toLocaleString()}</span><span className="text-right tabular text-zinc-300">{fmtCurrency(row.tasks > 0 ? row.cost / row.tasks : 0, { compact: false })}</span><span className="text-right font-semibold tabular text-fuchsia-300">{fmtCurrency(row.cost, { compact: false })}</span>
      </div>
    ))}
    {!rows.length && <div className="px-3 py-5 text-center text-xs text-zinc-500">No logged model tasks are available for this batch.</div>}
  </div>
);

export default DeliverBatchDialog;
