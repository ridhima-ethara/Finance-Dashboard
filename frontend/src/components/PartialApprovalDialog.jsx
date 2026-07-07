import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Split, X } from "lucide-react";
import { fmtCurrency } from "../lib/format";
import { toast } from "sonner";

const PartialApprovalDialog = ({ open, onOpenChange, approval }) => {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [defer, setDefer] = useState("park");

  useEffect(() => {
    if (approval) setAmount(Math.round((approval.amount || 0) * 0.5));
  }, [approval]);

  if (!approval) return null;
  const remaining = (approval.amount || 0) - amount;
  const pct = approval.amount ? Math.round((amount / approval.amount) * 100) : 0;

  const submit = () => {
    if (amount <= 0 || amount >= approval.amount) {
      toast.error("Approved amount must be between 1 and requested amount");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide a reason for the partial approval");
      return;
    }
    toast.success(`Partially approved · ${fmtCurrency(amount, { compact: false })}`, {
      description: `${approval.project} · ${pct}% released · remaining ${fmtCurrency(remaining, { compact: false })} ${defer}`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-[#12121A] border border-white/10 text-zinc-100" data-testid="partial-approval-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
              <Split className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Partial approval</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Release a portion of the requested amount now. Remaining stays governed.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Request</div>
            <div className="mt-1 flex items-baseline justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{approval.project}</div>
                <div className="text-[11px] text-zinc-500">{approval.type} · by {approval.requester}</div>
              </div>
              <div className="font-display text-2xl font-semibold text-white tabular">{fmtCurrency(approval.amount, { compact: false })}</div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Approve amount</div>
              <div className="text-[11px] font-semibold text-fuchsia-300 tabular">{pct}% · remaining {fmtCurrency(remaining, { compact: false })}</div>
            </div>
            <input
              type="range"
              min="0"
              max={approval.amount}
              step={Math.max(50, Math.round(approval.amount / 100))}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              data-testid="pa-slider"
              className="w-full accent-fuchsia-500"
            />
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                data-testid="pa-amount"
                className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Remaining handling</div>
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
              {["park", "defer", "close"].map((o) => (
                <button
                  key={o}
                  onClick={() => setDefer(o)}
                  data-testid={`pa-defer-${o}`}
                  className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${
                    defer === o ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {o === "park" ? "Park for later" : o === "defer" ? "Defer to next cycle" : "Close remaining"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Reason</div>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Approving Phase 1 only; re-review after milestone"
              data-testid="pa-reason"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]" data-testid="pa-cancel">
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
          <Button onClick={submit} className="bg-amber-500 hover:bg-amber-600 text-black shadow-[0_0_20px_rgba(245,158,11,0.35)]" data-testid="pa-submit">
            Release {fmtCurrency(amount, { compact: false })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PartialApprovalDialog;
