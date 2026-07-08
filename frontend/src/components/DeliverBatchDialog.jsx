import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { PackageCheck, DollarSign, MessageSquare, User as UserIcon, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";

// TPM "Deliver batch" dialog — batch = phase. TPM proposes recoverable amount + client comment.
const DeliverBatchDialog = ({ open, onOpenChange, project, phase }) => {
  const { deliverBatch } = useApp();
  const suggested = phase?.actual ? Math.round(phase.actual * 1.1) : 0;
  const [amount, setAmount] = useState(suggested);
  const [rep, setRep] = useState("");
  const [comment, setComment] = useState("");

  const submit = () => {
    if (!project || !phase) { toast.error("Missing phase context"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Enter a valid recoverable amount"); return; }
    if (!comment.trim()) { toast.error("Add the client's comment / reason"); return; }
    deliverBatch({
      projectId: project.id,
      phaseId: phase.id,
      phaseName: phase.name,
      proposedAmount: amount,
      clientComment: comment,
      clientRepresentative: rep,
    });
    toast.success("Batch delivered to CFO", {
      description: `${project.name} · ${phase.name} · proposed $${Number(amount).toLocaleString()}`,
    });
    setAmount(suggested); setRep(""); setComment("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-[#12121A] border border-white/10 text-zinc-100" data-testid="deliver-batch-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30">
              <PackageCheck className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Deliver batch</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {project?.name} · {phase?.name} · notifies CFO to record actual recovery
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <MiniField label="Phase actual" value={`$${(phase?.actual || 0).toLocaleString()}`} />
            <MiniField label="Suggested recovery" value={`$${suggested.toLocaleString()}`} tone="magenta" />
          </div>

          <Field label="Proposed recoverable amount (USD)">
            <div className="relative">
              <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0"
                step="50"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                data-testid="deliver-amount"
                className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
          </Field>

          <Field label="Client representative (optional)">
            <div className="relative">
              <UserIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={rep}
                onChange={(e) => setRep(e.target.value)}
                placeholder="Name of the client contact"
                data-testid="deliver-rep"
                className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
          </Field>

          <Field label="Client comment / reason received">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="What did the client say about this batch? Any negotiation or scope note?"
              data-testid="deliver-comment"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </Field>

          <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300 leading-relaxed">
              CFO will be notified and can enter the <span className="text-emerald-300 font-semibold">actual amount recovered</span>. Both proposed and recovered are surfaced under the CFO Projects section.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            data-testid="deliver-cancel"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            onClick={submit}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="deliver-submit"
          >
            <Send className="w-3.5 h-3.5" /> Deliver &amp; notify CFO
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
