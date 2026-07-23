import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import {
  Crown,
  Wallet,
  ClipboardCheck,
  FlaskConical,
  KeyRound,
  ArrowRight,
} from "lucide-react";

const ROLE_TABS = [
  {
    id: "CTO",
    label: "L2",
    icon: Crown,
    accent: "fuchsia",
    tagline: "Portfolio oversight & approvals",
    steps: [
      { title: "Create a new project", detail: "Click New project on the L2 dashboard, assign Projects and RL Environment leads, and set priority." },
      { title: "Review incoming budgets", detail: "Open Budget Reviews to approve, partially approve, or return Projects budget submissions." },
      { title: "Handle change requests & top-ups", detail: "Approve or return Projects change requests and top-up asks from the alert strip tiles." },
      { title: "Monitor portfolio health", detail: "Track utilization, high-risk projects, and delivery progress from the monitoring panels." },
    ],
  },
  {
    id: "CFO",
    label: "L3",
    icon: Wallet,
    accent: "emerald",
    tagline: "Financial gatekeeper & recovery",
    steps: [
      { title: "Work the Approval Queue", detail: "Review budgets, top-ups, and change requests already cleared by L2." },
      { title: "Sign off Batch Deliveries", detail: "Approve Projects-submitted delivery batches so invoices can be raised to clients." },
      { title: "Track Client Recovery", detail: "Monitor outstanding recovery and follow-ups from the Client Recovery page." },
      { title: "Watch the Contingency Buffer", detail: "Use Financial Monitoring & Early Warning to catch overruns before they hurt margin." },
    ],
  },
  {
    id: "TPM",
    label: "Projects",
    icon: ClipboardCheck,
    accent: "sky",
    tagline: "Delivery lead & daily execution",
    steps: [
      { title: "Open your assigned project", detail: "Once RL Environment finishes testing, the project is promoted to \"Ready for production budget\"." },
      { title: "Build the production budget", detail: "Use Budget Builder to plan tasks, models, tokens, and phase costs. Submit for L2 review." },
      { title: "Log daily consumption", detail: "Record model usage, tasks completed, and trajectories on the Consumption page every day." },
      { title: "Raise Change Requests / Top-ups", detail: "If scope or cost shifts, submit a CR or top-up to L2 → L3 for approval." },
      { title: "Deliver batches", detail: "When a milestone completes, submit a batch delivery so L3 can sign off and invoice." },
    ],
  },
  {
    id: "R&D",
    label: "RL Environment",
    icon: FlaskConical,
    accent: "violet",
    tagline: "Research, testing & sample delivery",
    steps: [
      { title: "Get invited to a project", detail: "Projects adds you as RL Environment Lead when a new engagement starts." },
      { title: "Request a testing budget", detail: "Submit a small RL Environment testing budget so you can spin up prototypes and sample runs." },
      { title: "Log testing runs & sample results", detail: "Track models tried, tokens used, and outcomes from the project workspace." },
      { title: "Mark testing complete", detail: "Once samples look good, submit \"Accept\" so Projects can start the production budget cycle." },
    ],
  },
  {
    id: "IT",
    label: "IT",
    icon: KeyRound,
    accent: "cyan",
    tagline: "Access, model keys & provisioning",
    steps: [
      { title: "Provision model keys", detail: "For every approved project, create scoped Bedrock/model API keys from the IT dashboard." },
      { title: "Rotate & revoke", detail: "Rotate keys periodically and revoke access instantly when a project closes." },
      { title: "Track provisioning steps", detail: "Mark provisioning tasks complete so Projects/RL Environment can start logging usage without blockers." },
      { title: "Own IT monthly actuals", detail: "Reconcile IT infra & subscription costs monthly so L3 numbers stay accurate." },
    ],
  },
];

const ACCENT_MAP = {
  fuchsia: { text: "text-fuchsia-300", bg: "bg-fuchsia-500/15", border: "border-fuchsia-500/40", dot: "bg-fuchsia-400", ring: "ring-fuchsia-500/30" },
  emerald: { text: "text-emerald-300", bg: "bg-emerald-500/15", border: "border-emerald-500/40", dot: "bg-emerald-400", ring: "ring-emerald-500/30" },
  sky: { text: "text-sky-300", bg: "bg-sky-500/15", border: "border-sky-500/40", dot: "bg-sky-400", ring: "ring-sky-500/30" },
  violet: { text: "text-violet-300", bg: "bg-violet-500/15", border: "border-violet-500/40", dot: "bg-violet-400", ring: "ring-violet-500/30" },
  cyan: { text: "text-cyan-300", bg: "bg-cyan-500/15", border: "border-cyan-500/40", dot: "bg-cyan-400", ring: "ring-cyan-500/30" },
};

export const WorkflowGuideDialog = ({ open, onOpenChange, defaultRole = "CTO" }) => {
  const [activeId, setActiveId] = useState(defaultRole);
  const active = ROLE_TABS.find((r) => r.id === activeId) || ROLE_TABS[0];
  const accent = ACCENT_MAP[active.accent];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="workflow-guide-dialog"
        className="max-w-3xl bg-[#0F0F17] border border-white/10 text-zinc-100 p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <span className="w-6 h-px bg-fuchsia-400" />
            Getting Started
          </div>
          <DialogTitle className="mt-2 text-2xl font-display font-semibold text-white tracking-tight">
            How to use Ethara.AI Command Center
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-400">
            Pick your role to see a short workflow. Every project moves through these steps in order — from RL Environment testing to L3 sign-off.
          </DialogDescription>
        </DialogHeader>

        {/* Role tabs */}
        <div className="px-6 pt-4 pb-3 flex flex-wrap gap-2" data-testid="workflow-guide-tabs">
          {ROLE_TABS.map((r) => {
            const ra = ACCENT_MAP[r.accent];
            const isActive = r.id === activeId;
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                onClick={() => setActiveId(r.id)}
                data-testid={`workflow-tab-${r.id.toLowerCase().replace(/&/g, "n").replace(/[^a-z0-9-]/g, "-")}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  isActive
                    ? `${ra.bg} ${ra.border} ${ra.text}`
                    : "bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Active role content */}
        <div className="px-6 pb-6" data-testid={`workflow-content-${active.id}`}>
          <div className={`flex items-center gap-2 mb-4 text-[11px] font-semibold uppercase tracking-widest ${accent.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
            {active.tagline}
          </div>

          <ol className="space-y-3">
            {active.steps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 hover:border-white/10 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-lg ${accent.bg} border ${accent.border} flex items-center justify-center flex-shrink-0 text-xs font-semibold ${accent.text} tabular`}
                >
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{step.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{step.detail}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex items-center gap-2 text-[11px] text-zinc-500">
            <ArrowRight className="w-3 h-3" />
            Every project follows this order: <span className="text-zinc-300">RL Environment testing → Projects production budget → L2 review → L3 sign-off → Delivery.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowGuideDialog;
