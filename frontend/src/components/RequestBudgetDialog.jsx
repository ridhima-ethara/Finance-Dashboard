import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Sparkles, Send, X } from "lucide-react";
import { PROJECTS } from "../data/mockData";
import { toast } from "sonner";

const RequestBudgetDialog = ({ open, onOpenChange }) => {
  const [project, setProject] = useState(PROJECTS[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [category, setCategory] = useState("Initial budget");

  const submit = () => {
    if (!amount || !justification) {
      toast.error("Please fill amount and justification");
      return;
    }
    toast.success("Budget request submitted · routed to CTO for review", {
      description: `${category} · $${Number(amount).toLocaleString()} · project ${
        PROJECTS.find((p) => p.id === project)?.name
      }`,
    });
    setAmount("");
    setJustification("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] bg-[#12121A] border border-white/10 text-zinc-100"
        data-testid="request-budget-dialog"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <Sparkles className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">
                Request budget · Project Lead
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Submit a new budget request. Routes CTO → COO for approval.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Field label="Project">
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              data-testid="rb-project"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            >
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.client}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Request type">
            <div className="grid grid-cols-3 gap-2">
              {["Initial budget", "Budget increase", "Top-up"].map((t) => (
                <button
                  key={t}
                  onClick={() => setCategory(t)}
                  data-testid={`rb-type-${t.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`h-9 rounded-lg text-xs font-medium border transition-colors ${
                    category === t
                      ? "bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300"
                      : "bg-white/[0.04] border-white/10 text-zinc-400 hover:bg-white/[0.08]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Amount (USD)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="12000"
                data-testid="rb-amount"
                className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
          </Field>

          <Field label="Justification">
            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Additional GPU hours needed for eval sweep, Q3 inference volume up 32% vs plan…"
              data-testid="rb-justification"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </Field>

          <div className="text-[11px] text-zinc-500 flex items-start gap-2 bg-white/[0.02] p-3 rounded-lg border border-white/5">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-400 mt-0.5 flex-shrink-0" />
            <span>
              AI suggestion: based on Crowley Generation's Phase 2 variance, a top-up of
              <span className="text-fuchsia-300 font-semibold"> $2,500</span> would restore forecast to under-budget.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            data-testid="rb-cancel"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={submit}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="rb-submit"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Submit for review
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

export default RequestBudgetDialog;
