import { useState, useMemo } from "react";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { useApp } from "../../context/AppContext";
import {
  GitPullRequest,
  Clock3,
  User,
  Filter,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Edit3,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Cpu,
  Server,
  CreditCard,
} from "lucide-react";

const STAGES = ["CTO Review", "CFO Review", "Approved", "Rejected"];

const stageColor = {
  "CTO Review": { bg: "bg-fuchsia-500/10", text: "text-fuchsia-300", border: "border-fuchsia-500/30" },
  "CFO Review": { bg: "bg-sky-500/10", text: "text-sky-300", border: "border-sky-500/30" },
  Approved: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/30" },
  Rejected: { bg: "bg-red-500/10", text: "text-red-300", border: "border-red-500/30" },
};

const ChangeRequests = () => {
  const { changeRequests, ctoDecideChangeRequest } = useApp();
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() => {
    if (filter === "all") return changeRequests;
    return changeRequests.filter((c) => c.stage === filter);
  }, [filter, changeRequests]);

  const stats = useMemo(() => {
    return {
      pending: changeRequests.filter((c) => c.stage === "CTO Review").length,
      approved: changeRequests.filter((c) => c.stage === "Approved").length,
      rejected: changeRequests.filter((c) => c.stage === "Rejected").length,
      budgetImpact: changeRequests.filter((c) => c.stage === "CTO Review").reduce((s, c) => s + c.amount, 0),
    };
  }, [changeRequests]);

  const approveAndForward = (cr) => {
    ctoDecideChangeRequest(cr.id, { decision: "forward", amount: cr.amount });
    toast.success("Change request approved", {
      description: `${cr.projectName} · ${fmtCurrency(cr.amount)} · Forwarded to CFO`,
    });
  };
  const rejectCR = (cr) => {
    ctoDecideChangeRequest(cr.id, { decision: "reject", comment: "Rejected by CTO during change review." });
    toast.error("Change request rejected", {
      description: `${cr.projectName} · TPM notified`,
    });
  };
  const approveDirect = (cr) => {
    ctoDecideChangeRequest(cr.id, { decision: "approve", amount: cr.amount });
    toast.success("Change request approved", {
      description: `${cr.projectName} · No financial escalation needed`,
    });
  };

  return (
    <div className="space-y-6" data-testid="page-change-requests">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <GitPullRequest className="w-3 h-3" />
            CTO Portal
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Change requests</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review, modify, approve, reject, or forward to CFO with the full requested breakdown
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pending" value={String(stats.pending)} icon={Clock3} tone="warning" testid="stat-pending" />
        <Stat label="Approved" value={String(stats.approved)} icon={CheckCircle2} tone="positive" testid="stat-approved" />
        <Stat label="Rejected" value={String(stats.rejected)} icon={XCircle} tone="negative" testid="stat-rejected" />
        <Stat label="Budget impact (pending)" value={fmtCurrency(stats.budgetImpact)} tone="magenta" testid="stat-impact" />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mr-2">
          <Filter className="w-3 h-3 inline mr-1" /> Stage
        </span>
        {["all", ...STAGES].map((s) => {
          const count = s === "all" ? changeRequests.length : changeRequests.filter((c) => c.stage === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              data-testid={`filter-${s.toLowerCase().replace(/\s+/g, "-")}`}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                filter === s
                  ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {s === "all" ? `All (${count})` : `${s} (${count})`}
            </button>
          );
        })}
      </div>

      {/* CR List */}
      <div className="space-y-3">
        {filtered.map((cr) => {
          const sc = stageColor[cr.stage] || stageColor["CTO Review"];
          const isOpen = expanded === cr.id;
          const isPending = cr.stage === "CTO Review";
          const breakdownSections = getBreakdownSections(cr);
          return (
            <div
              key={cr.id}
              data-testid={`cr-${cr.id}`}
              className="bg-[#12121A] rounded-2xl border border-white/5 hover:border-fuchsia-500/20 transition-colors"
            >
              <div
                className="p-5 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : cr.id)}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                        {cr.stage}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
                        {cr.type}
                      </span>
                      {cr.urgency === "High" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/10 text-red-300 border border-red-500/30">
                          <AlertTriangle className="w-3 h-3" /> High urgency
                        </span>
                      )}
                    </div>
                    <div className="mt-2 font-display font-semibold text-lg text-white">{cr.projectName}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {cr.requester}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(cr.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span>·</span>
                    <span>{cr.expectedTasks || "Expected tasks not specified"}</span>
                      <span>·</span>
                      <span>Timeline delta {cr.timelineDelta}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Requested delta</div>
                    <div className="font-display text-2xl font-semibold text-white tabular">
                      +{fmtCurrency(cr.amount, { compact: false })}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 tabular">
                      {fmtCurrency(cr.currentBudget, { compact: false })} → {fmtCurrency(cr.requestedBudget, { compact: false })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-zinc-300 leading-relaxed line-clamp-2">
                  <span className="text-fuchsia-200 font-semibold">Reason: </span>{cr.reason}
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {breakdownSections.map((section) => (
                    <BreakdownPill key={section.key} label={section.label} amount={section.amount} />
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-1 text-[11px] text-zinc-500">
                  {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isOpen ? "Collapse" : "Expand for details & actions"}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-white/5 p-5 space-y-4 animate-fade-up">
                  {/* Impact assessment */}
                  <div className="grid grid-cols-3 gap-3">
                    <ImpactBox label="Budget impact" value={`+${fmtCurrency(cr.amount, { compact: false })}`} tone="warning" />
                    <ImpactBox label="Timeline impact" value={cr.timelineDelta} tone={cr.timelineDelta === "0 days" ? "neutral" : "warning"} />
                    <ImpactBox label="Expected tasks" value={cr.expectedTasks || "Not specified"} tone="neutral" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {breakdownSections.map((section) => (
                      <BreakdownCard
                        key={section.key}
                        title={section.label}
                        value={section.amount}
                        detail={section.detail}
                        note={section.note}
                        icon={section.icon}
                        tone={section.tone}
                      />
                    ))}
                  </div>

                  {/* Full reason */}
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Full reason</div>
                    <div className="text-sm text-zinc-100 leading-relaxed">{cr.reason}</div>
                  </div>

                  {/* Actions */}
                  {isPending && (
                    <div className="flex items-center gap-2 flex-wrap pt-2">
                      <Button
                        onClick={(e) => { e.stopPropagation(); approveDirect(cr); }}
                        className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
                        data-testid={`btn-approve-${cr.id}`}
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button
                        onClick={(e) => { e.stopPropagation(); approveAndForward(cr); }}
                        className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                        data-testid={`btn-forward-${cr.id}`}
                      >
                        <Send className="w-3.5 h-3.5" /> Approve &amp; forward to CFO
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); toast("Modify mode — edit amount inline (demo)"); }}
                        className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2"
                        data-testid={`btn-modify-${cr.id}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Modify
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); rejectCR(cr); }}
                        className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-2"
                        data-testid={`btn-reject-${cr.id}`}
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-sm text-zinc-400">No change requests in this stage</div>
          </div>
        )}
      </div>
    </div>
  );
};

const getBreakdownSections = (cr) => [
  {
    key: "models",
    label: "Models",
    amount: Number(cr.breakdown?.models?.amount || 0),
    detail: cr.breakdown?.models?.optionLabel || "No model change captured.",
    note: cr.breakdown?.models?.note || "No model note added.",
    icon: Cpu,
    tone: "fuchsia",
  },
  {
    key: "infra",
    label: "Infrastructure",
    amount: Number(cr.breakdown?.infra?.amount || 0),
    detail: cr.breakdown?.infra?.optionLabel || "No infra change captured.",
    note: cr.breakdown?.infra?.note || "No infra note added.",
    icon: Server,
    tone: "sky",
  },
  {
    key: "subs",
    label: "Subscriptions",
    amount: Number(cr.breakdown?.subs?.amount || 0),
    detail: cr.breakdown?.subs?.optionLabel || "No subscription change captured.",
    note: cr.breakdown?.subs?.note || "No subscription note added.",
    icon: CreditCard,
    tone: "amber",
  },
];

const BreakdownPill = ({ label, amount }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
    {label} {fmtCurrency(amount, { compact: false })}
  </span>
);

const BreakdownCard = ({ title, value, detail, note, icon: Icon, tone }) => {
  const tones = {
    fuchsia: "border-fuchsia-500/20 bg-fuchsia-500/[0.05] text-fuchsia-300",
    sky: "border-sky-500/20 bg-sky-500/[0.05] text-sky-300",
    amber: "border-amber-500/20 bg-amber-500/[0.05] text-amber-300",
  };
  const toneClass = tones[tone] || tones.fuchsia;

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-widest font-semibold">{title}</span>
        </div>
        <span className="text-sm font-semibold text-white tabular">{fmtCurrency(value, { compact: false })}</span>
      </div>
      <div className="mt-3 text-sm text-white font-medium">{detail}</div>
      <div className="mt-1 text-[11px] text-zinc-300 leading-relaxed">{note}</div>
    </div>
  );
};

const Stat = ({ label, value, icon: Icon, tone = "neutral", testid }) => {
  const tones = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-white",
    magenta: "text-fuchsia-300",
  };
  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${tones[tone]}`} />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display font-semibold text-xl tabular ${tones[tone]}`}>{value}</div>
    </div>
  );
};

const ImpactBox = ({ label, value, tone = "neutral" }) => {
  const cls =
    tone === "warning"
      ? "border-amber-500/30 bg-amber-500/[0.05] text-amber-200"
      : tone === "negative"
      ? "border-red-500/30 bg-red-500/[0.05] text-red-200"
      : "border-white/10 bg-white/[0.03] text-zinc-100";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-widest font-semibold opacity-70">{label}</div>
      <div className="text-sm font-semibold mt-1 tabular truncate">{value}</div>
    </div>
  );
};

export default ChangeRequests;
