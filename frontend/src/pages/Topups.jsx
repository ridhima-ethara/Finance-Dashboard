import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PROJECTS } from "../data/mockProjects";
import { useApp } from "../context/AppContext";
import { fmtCurrency, fmtPct } from "../lib/format";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  ArrowUpRightSquare,
  Clock3,
  User,
  Building2,
  CheckCircle2,
  XCircle,
  Send,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sparkles,
  FileText,
  Wallet,
  Percent,
  Cpu,
  Layers,
  Info,
} from "lucide-react";

// Seed top-up requests based on projects that have topupHistory
const seedTopups = () =>
  PROJECTS.slice(0, 5).flatMap((p, i) => [
    {
      id: `tu-${p.id}-1`,
      projectId: p.id,
      projectName: p.name,
      client: p.client,
      tpm: p.tpm,
      requestedBy: p.tpm,
      requestedAt: "2026-06-22T11:03:00Z",
      amount: [2500, 4000, 5000, 3500, 6000][i],
      reason: [
        "Opus 4.8 inference volumes 18% above plan; extra sweep needed",
        "EC2 spike from client workload up 34% W/W",
        "Client contract locked in; needs immediate cover",
        "Extended Claude context testing",
        "Additional GPU hours for eval sweep",
      ][i],
      currentBudget: p.approvedBudget,
      status: i === 0 ? "pending" : i === 1 ? "pending" : i === 2 ? "approved" : i === 3 ? "rejected" : "pending",
      urgency: i % 2 === 0 ? "High" : "Normal",
    },
  ]);

const statusChip = {
  pending: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30", label: "Pending" },
  approved: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", label: "Approved" },
  rejected: { bg: "bg-red-500/15", text: "text-red-300", border: "border-red-500/30", label: "Rejected" },
};

const Topups = () => {
  const { role } = useApp();
  const isCFO = role === "CFO";
  const [topups, setTopups] = useState(() => seedTopups());
  const [expanded, setExpanded] = useState(null);
  const [comment, setComment] = useState({});
  const [approvedAmt, setApprovedAmt] = useState({});

  const stats = useMemo(() => {
    return {
      pending: topups.filter((t) => t.status === "pending").length,
      approved: topups.filter((t) => t.status === "approved").length,
      rejected: topups.filter((t) => t.status === "rejected").length,
      total: topups.reduce((s, t) => s + (t.status === "pending" ? t.amount : 0), 0),
    };
  }, [topups]);

  const updateT = (id, patch) => setTopups((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const approve = (t) => {
    const amt = Number(approvedAmt[t.id]) || t.amount;
    updateT(t.id, { status: "approved", approvedAmount: amt });
    toast.success("Top-up approved", { description: `${t.projectName} · ${fmtCurrency(amt, { compact: false })} added to project baseline` });
  };
  const reject = (t) => {
    if (!(comment[t.id] || "").trim()) {
      toast.error("Comment is required to reject");
      return;
    }
    updateT(t.id, { status: "rejected", comment: comment[t.id] });
    toast.error("Top-up rejected", { description: `${t.projectName} · TPM notified` });
  };

  return (
    <div className="space-y-6" data-testid="page-topups">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ArrowUpRightSquare className="w-3 h-3" />
            {isCFO ? "CFO · Budget management" : "Top-ups"}
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Top-up requests</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {isCFO ? "Review, modify or approve top-ups. Once approved, project baseline is updated." : "Request additional funding for your projects"}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pending" value={String(stats.pending)} icon={Clock3} tone="warning" testid="tu-pending" />
        <Stat label="Approved" value={String(stats.approved)} icon={CheckCircle2} tone="positive" testid="tu-approved" />
        <Stat label="Rejected" value={String(stats.rejected)} icon={XCircle} tone="negative" testid="tu-rejected" />
        <Stat label="Total pending value" value={fmtCurrency(stats.total)} icon={Wallet} tone="magenta" testid="tu-total" />
      </div>

      {/* Requests */}
      <div className="space-y-3">
        {topups.map((t) => {
          const sc = statusChip[t.status];
          const isOpen = expanded === t.id;
          const isPending = t.status === "pending";
          const proj = PROJECTS.find((p) => p.id === t.projectId);
          return (
            <div key={t.id} data-testid={`tu-${t.id}`} className="bg-[#12121A] rounded-2xl border border-white/5 hover:border-fuchsia-500/20 transition-colors">
              <div className="p-5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : t.id)}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                        {sc.label}
                      </span>
                      {t.urgency === "High" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/10 border border-red-500/30 text-red-300">
                          <AlertTriangle className="w-3 h-3" /> High
                        </span>
                      )}
                    </div>
                    <div className="mt-2 font-display font-semibold text-lg text-white">{t.projectName}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {t.tpm}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {t.client}</span>
                      <span>·</span>
                      <span>{new Date(t.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Requested</div>
                    <div className="font-display text-2xl font-semibold text-white tabular">+{fmtCurrency(t.amount, { compact: false })}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 tabular">
                      Current {fmtCurrency(t.currentBudget)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-zinc-300 leading-relaxed line-clamp-2">
                  <span className="text-fuchsia-200 font-semibold">Reason: </span>{t.reason}
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] text-zinc-500">
                  {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isOpen ? "Collapse" : isCFO ? "Expand for full project detail & approve" : "Expand for details"}
                </div>
              </div>

              {isOpen && proj && (
                <div className="border-t border-white/5 p-5 space-y-4 animate-fade-up">
                  {/* Full project detail — shown to CFO */}
                  {isCFO && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <MiniStat label="Approved budget" value={fmtCurrency(proj.approvedBudget)} icon={Wallet} />
                        <MiniStat label="Actual spend" value={fmtCurrency(proj.actualSpend)} icon={Cpu} />
                        <MiniStat label="Utilization" value={fmtPct(proj.utilization)} icon={Percent} />
                        <MiniStat label="Burn rate" value={`$${(proj.burnRate * 1000).toLocaleString()}/d`} icon={AlertTriangle} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <MiniStat label="AI cost" value={fmtCurrency(proj.aiModelCost)} icon={Cpu} />
                        <MiniStat label="Infra cost" value={fmtCurrency(proj.infrastructureCost)} />
                        <MiniStat label="Employee" value={fmtCurrency(proj.employeeCost)} />
                        <MiniStat label="Recoverable" value={proj.recoverableFromClient ? "Yes" : "No"} icon={FileText} />
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5 flex items-center gap-1">
                          <Layers className="w-3 h-3" /> Phases
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {proj.phases.map((ph) => (
                            <div key={ph.id} className="rounded-md bg-white/[0.03] border border-white/5 p-2">
                              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{ph.name}</div>
                              <div className="text-xs text-white font-semibold tabular mt-0.5">{fmtCurrency(ph.actual, { compact: false })} / {fmtCurrency(ph.estimated, { compact: false })}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Link to={`/projects/${proj.id}`} className="inline-flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-fuchsia-200 font-medium">
                        View full project detail <ArrowUpRightSquare className="w-3 h-3" />
                      </Link>
                    </>
                  )}

                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Full reason from TPM</div>
                    <div className="text-sm text-zinc-100 leading-relaxed">{t.reason}</div>
                  </div>

                  <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-zinc-300 leading-relaxed">
                      <span className="text-fuchsia-200 font-semibold">AI: </span>
                      Approve at {fmtCurrency(Math.round(t.amount * 0.85), { compact: false })} (15% reduction) — projected model routing changes will reduce actual need by ~15% next sprint.
                    </div>
                  </div>

                  {isCFO && isPending && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Approved amount (modify if needed)</div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                            <input
                              type="number"
                              value={approvedAmt[t.id] !== undefined ? approvedAmt[t.id] : t.amount}
                              onChange={(e) => setApprovedAmt({ ...approvedAmt, [t.id]: e.target.value })}
                              data-testid={`tu-amt-${t.id}`}
                              className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Comment (required for reject)</div>
                          <input
                            type="text"
                            value={comment[t.id] || ""}
                            onChange={(e) => setComment({ ...comment, [t.id]: e.target.value })}
                            placeholder="Optional for approve"
                            data-testid={`tu-comment-${t.id}`}
                            className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          onClick={(e) => { e.stopPropagation(); approve(t); }}
                          className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                          data-testid={`btn-approve-${t.id}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve top-up
                        </Button>
                        <Button
                          onClick={(e) => { e.stopPropagation(); reject(t); }}
                          variant="outline"
                          className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-2"
                          data-testid={`btn-reject-${t.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </>
                  )}

                  {!isCFO && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-start gap-2 text-xs text-zinc-400">
                      <Info className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
                      Only CFO can approve or reject this request.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Stat = ({ label, value, icon: Icon, tone = "neutral", testid }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
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

const MiniStat = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
    <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500 flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </div>
    <div className="text-sm font-semibold text-white tabular mt-0.5">{value}</div>
  </div>
);

export default Topups;
