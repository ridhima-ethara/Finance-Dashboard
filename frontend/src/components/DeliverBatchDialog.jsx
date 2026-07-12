import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { PackageCheck, DollarSign, MessageSquare, Send, X, ListChecks, Cpu, ThumbsUp, ThumbsDown, RefreshCw, Receipt, Ban } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";

// Deliver batch dialog.
//   TPM view : proposed recoverable amount + client comment (no Client representative field).
//   R&D view : task count submitted, estimated $ per task, trajectories, models used, client
//              comments, plus Reject / Accept / Changes-requested mark. Once R&D marks
//              "Accept", the TPM is notified that this is the correct estimate.
const DeliverBatchDialog = ({ open, onOpenChange, project, phase }) => {
  const { deliverBatch, role, user, getPhaseLogs } = useApp();
  const isRnd = role === "R&D";
  const phaseLoggedAmount = useMemo(
    () => (project?.id && phase?.id ? getPhaseLogs(project.id, phase.id).reduce((sum, log) => sum + Number(log.cost || 0), 0) : 0),
    [getPhaseLogs, phase?.id, project?.id]
  );

  // TPM state
  const [recoveryType, setRecoveryType] = useState("recoverable");
  const [amount, setAmount] = useState(phaseLoggedAmount);
  const [comment, setComment] = useState("");

  // R&D state
  const [taskCount, setTaskCount] = useState(phase?.totalTasks || 0);
  const [estPerTask, setEstPerTask] = useState(
    phase?.totalTasks && phase?.estimated ? Math.round((phase.estimated / phase.totalTasks) * 100) / 100 : 0
  );
  const [trajectories, setTrajectories] = useState(phase?.trajectoriesPerTask ? phase.totalTasks * phase.trajectoriesPerTask : 0);
  const [models, setModels] = useState("Opus 4.8, Sonnet 4.6");
  const [rndClientComment, setRndClientComment] = useState("");
  const [rndDecision, setRndDecision] = useState("accept"); // accept | reject | changes

  const rndTotal = Number(taskCount || 0) * Number(estPerTask || 0);

  useEffect(() => {
    if (!open) return;
    setRecoveryType("recoverable");
    setAmount(phaseLoggedAmount);
    setComment("");
    setTaskCount(phase?.totalTasks || 0);
    setEstPerTask(
      phase?.totalTasks && phase?.estimated ? Math.round((phase.estimated / phase.totalTasks) * 100) / 100 : 0
    );
    setTrajectories(phase?.trajectoriesPerTask ? phase.totalTasks * phase.trajectoriesPerTask : 0);
    setModels("Opus 4.8, Sonnet 4.6");
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
    if (Number(taskCount) <= 0) { toast.error("Enter task count submitted"); return; }
    if (Number(estPerTask) <= 0) { toast.error("Enter estimated cost per task"); return; }

    deliverBatch({
      projectId: project.id,
      phaseId: phase.id,
      phaseName: phase.name,
      proposedAmount: rndTotal,
      clientComment: rndClientComment,
      rnd: {
        taskCount: Number(taskCount),
        estPerTask: Number(estPerTask),
        trajectories: Number(trajectories),
        models,
        decision: rndDecision,
        reviewer: user?.name || "R&D",
      },
    });

    const decisionLabel = rndDecision === "accept" ? "Accepted" : rndDecision === "reject" ? "Rejected" : "Changes requested";
    if (rndDecision === "accept") {
      toast.success(`Batch ${decisionLabel} · TPM notified`, {
        description: `${project.name} · ${phase.name} · confirmed as the correct estimate`,
      });
    } else if (rndDecision === "reject") {
      toast.error(`Batch ${decisionLabel} · TPM notified`, { description: `${project.name} · ${phase.name}` });
    } else {
      toast.warning(`Batch · ${decisionLabel} · TPM notified`, { description: `${project.name} · ${phase.name}` });
    }
    onOpenChange(false);
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
                {isRnd ? "R&D · Review batch" : "Deliver batch"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {project?.name} · {phase?.name} · {isRnd ? "confirm the estimate before it goes forward" : "notifies CFO to record actual recovery"}
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

        {isRnd && (
          <div className="space-y-3 py-2" data-testid="deliver-rnd-form">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Task count submitted *">
                <div className="relative">
                  <ListChecks className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number" min="0" value={taskCount}
                    onChange={(e) => setTaskCount(Number(e.target.value) || 0)}
                    data-testid="deliver-rnd-task-count"
                    className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                </div>
              </Field>

              <Field label="Estimated $ / task *">
                <div className="relative">
                  <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number" min="0" step="0.01" value={estPerTask}
                    onChange={(e) => setEstPerTask(Number(e.target.value) || 0)}
                    data-testid="deliver-rnd-est-per-task"
                    className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                </div>
              </Field>

              <Field label="Trajectories">
                <input
                  type="number" min="0" value={trajectories}
                  onChange={(e) => setTrajectories(Number(e.target.value) || 0)}
                  data-testid="deliver-rnd-trajectories"
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </Field>

              <Field label="Models used">
                <div className="relative">
                  <Cpu className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={models}
                    onChange={(e) => setModels(e.target.value)}
                    placeholder="Opus 4.8, Sonnet 4.6"
                    data-testid="deliver-rnd-models"
                    className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                  />
                </div>
              </Field>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Batch total</span>
              <span className="text-fuchsia-300 font-display text-xl font-semibold tabular" data-testid="deliver-rnd-total">{fmtCurrency(rndTotal, { compact: false })}</span>
            </div>

            <Field label="Client comments">
              <textarea
                value={rndClientComment} onChange={(e) => setRndClientComment(e.target.value)} rows={2}
                placeholder="Client feedback on this batch"
                data-testid="deliver-rnd-client-comment"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
            </Field>

            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Mark this batch as</div>
              <div className="grid grid-cols-3 gap-2" data-testid="deliver-rnd-decision">
                {[
                  { k: "accept", label: "Accept", icon: ThumbsUp, on: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
                  { k: "changes", label: "Changes requested", icon: RefreshCw, on: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
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

            <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-300 leading-relaxed">
                When you mark this as <span className="text-emerald-300 font-semibold">Accept</span>, the TPM is notified that this is the correct estimate and the batch moves forward.
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
            onClick={isRnd ? submitRnd : submitTpm}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="deliver-submit"
          >
            <Send className="w-3.5 h-3.5" /> {isRnd ? "Submit review" : recoveryType === "recoverable" ? "Deliver & notify CFO" : "Submit non-recoverable delivery"}
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
