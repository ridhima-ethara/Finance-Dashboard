import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import {
  ArrowUpRightSquare,
  Building2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock3,
  CreditCard,
  Cpu,
  Layers,
  Percent,
  Server,
  User,
} from "lucide-react";

const statusMeta = {
  "pending-cto": { label: "Pending · CTO", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  "pending-cfo": { label: "Pending · CFO", tone: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  approved: { label: "Approved", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  partial: { label: "Partially Approved", tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" },
  rejected: { label: "Rejected", tone: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const getBreakdownAmounts = (request) => ({
  models: Number(request.breakdown?.models?.amount || 0),
  infra: Number(request.breakdown?.infra?.amount || 0),
  subs: Number(request.breakdown?.subs?.amount || 0),
});

const Topups = () => {
  const { role, topupRequests, projects, visibleProjects } = useApp();
  const [expanded, setExpanded] = useState(null);
  const isCFO = role === "CFO";
  const canSeeAll = role === "CFO" || role === "CTO" || role === "IT";

  const requests = useMemo(() => {
    const visibleIds = new Set(visibleProjects.map((project) => project.id));
    return topupRequests
      .filter((request) => canSeeAll || visibleIds.has(request.projectId))
      .sort((left, right) => new Date(right.requestedAt || 0).getTime() - new Date(left.requestedAt || 0).getTime());
  }, [canSeeAll, topupRequests, visibleProjects]);

  const stats = useMemo(() => ({
    pending: requests.filter((request) => ["pending-cto", "pending-cfo"].includes(request.status)).length,
    approved: requests.filter((request) => request.status === "approved").length,
    partial: requests.filter((request) => request.status === "partial").length,
    total: requests.reduce((sum, request) => sum + Number(request.amount || 0), 0),
  }), [requests]);

  return (
    <div className="space-y-6" data-testid="page-topups">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
          <ArrowUpRightSquare className="w-3 h-3" />
          {isCFO ? "CFO · Change request approvals" : "Change requests"}
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Change requests</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Live request list with model, infra, and subscription asks. Open a request to review the full approval view.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pending" value={String(stats.pending)} icon={Clock3} tone="warning" testid="tu-pending" />
        <Stat label="Approved" value={String(stats.approved)} icon={CheckCircle2} tone="positive" testid="tu-approved" />
        <Stat label="Partial" value={String(stats.partial)} icon={Percent} tone="magenta" testid="tu-partial" />
        <Stat label="Total requested" value={fmtCurrency(stats.total)} icon={Layers} tone="neutral" testid="tu-total" />
      </div>

      <div className="space-y-3">
        {requests.length === 0 && (
          <div className="bg-[#12121A] rounded-2xl border border-dashed border-white/10 p-10 text-center text-xs text-zinc-500">
            No change requests available in this view yet.
          </div>
        )}

        {requests.map((request) => {
          const meta = statusMeta[request.status] || statusMeta["pending-cto"];
          const isOpen = expanded === request.id;
          const project = projects.find((entry) => entry.id === request.projectId);
          const breakdown = getBreakdownAmounts(request);
          const forwardedAmount = reqForwardedAmount(request);

          return (
            <div key={request.id} className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden" data-testid={`tu-${request.id}`}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : request.id)}
                className="w-full p-5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${meta.tone}`}>
                        {meta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
                        {request.phaseName}
                      </span>
                    </div>
                    <div className="mt-2 font-display font-semibold text-lg text-white">{request.projectName}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {request.requester}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {project?.client || "Client"}</span>
                      <span>·</span>
                      <span>{new Date(request.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Requested</div>
                    <div className="font-display text-2xl font-semibold text-white tabular">{fmtCurrency(request.amount, { compact: false })}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 tabular">
                      {request.ctoDecision ? `CTO forwarded ${fmtCurrency(forwardedAmount, { compact: false })}` : "Awaiting first review"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                  <BreakdownChip label="Models" value={breakdown.models} />
                  <BreakdownChip label="Infra" value={breakdown.infra} />
                  <BreakdownChip label="Subscriptions" value={breakdown.subs} />
                </div>

                <div className="mt-3 flex items-center gap-1 text-[11px] text-zinc-500">
                  {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isOpen ? "Collapse" : isCFO ? "Expand for breakdown and approval link" : "Expand for breakdown"}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-white/5 p-5 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <DetailCard
                      title="Models"
                      icon={Cpu}
                      amount={breakdown.models}
                      detail={request.breakdown?.models?.optionLabel || "No model line captured."}
                      note={request.breakdown?.models?.note || "Model ask follows the same approval chain and stays tied to the project."}
                    />
                    <DetailCard
                      title="Infrastructure"
                      icon={Server}
                      amount={breakdown.infra}
                      detail={request.breakdown?.infra?.optionLabel || "No infra line captured."}
                      note={request.breakdown?.infra?.note || "Infra uplift remains attached to the same project request."}
                    />
                    <DetailCard
                      title="Subscriptions"
                      icon={CreditCard}
                      amount={breakdown.subs}
                      detail={request.breakdown?.subs?.optionLabel || "No subscription line captured."}
                      note={request.breakdown?.subs?.note || "Subscription lines are recorded as monthly asks when selected."}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <MiniStat label="Current budget" value={fmtCurrency(project?.approvedBudget || 0, { compact: false })} />
                    <MiniStat label="Current remaining" value={fmtCurrency(project?.remaining || 0, { compact: false })} />
                    <MiniStat label="Requested total" value={fmtCurrency(request.amount, { compact: false })} />
                    <MiniStat label="Final decision" value={request.cfoDecision?.amount ? fmtCurrency(request.cfoDecision.amount, { compact: false }) : "Pending"} />
                  </div>

                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Justification</div>
                    <div className="text-sm text-zinc-100 leading-relaxed">{request.reason}</div>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs text-zinc-500">
                      Partial approval is handled in the detailed request view and updates the same live project record.
                    </div>
                    <Link
                      to={`/topup-requests/${request.id}`}
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-sm font-medium shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                    >
                      {isCFO ? "Open approval" : "Open request"} <ArrowUpRightSquare className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const reqForwardedAmount = (request) => Number(request?.ctoDecision?.amount || request?.amount || 0);

const BreakdownChip = ({ label, value }) => (
  <div className="inline-flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
    <span className="text-zinc-400">{label}</span>
    <span className="font-semibold tabular text-white">{value > 0 ? fmtCurrency(value, { compact: false }) : "—"}</span>
  </div>
);

const DetailCard = ({ title, icon: Icon, amount, detail, note }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-fuchsia-300">
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      <div className="text-sm font-semibold text-white tabular">{amount > 0 ? fmtCurrency(amount, { compact: false }) : "—"}</div>
    </div>
    <div className="mt-3 text-sm text-white">{detail}</div>
    <div className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{note}</div>
  </div>
);

const Stat = ({ label, value, icon: Icon, tone = "neutral", testid }) => {
  const tones = {
    positive: "text-emerald-300",
    warning: "text-amber-300",
    neutral: "text-white",
    magenta: "text-fuchsia-300",
  };

  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
          <Icon className={`w-3.5 h-3.5 ${tones[tone] || tones.neutral}`} />
        </div>
      </div>
      <div className={`mt-2 font-display font-semibold text-xl tabular ${tones[tone] || tones.neutral}`}>{value}</div>
    </div>
  );
};

const MiniStat = ({ label, value }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-white tabular">{value}</div>
  </div>
);

export default Topups;
