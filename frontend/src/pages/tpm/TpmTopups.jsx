import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { Button } from "../../components/ui/button";
import TopupRequestDialog from "../../components/TopupRequestDialog";
import {
  ArrowUpRightSquare, Plus, Clock3, CheckCircle2, XCircle, AlertTriangle,
  Wallet, User as UserIcon, Layers, Building2, ChevronRight, Percent,
} from "lucide-react";

const stageChip = {
  "pending-cto": { label: "Pending", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  "pending-cfo": { label: "Pending", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  partial: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: Percent },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
};

const TpmTopups = () => {
  const { user, topupRequests, projects } = useApp();
  const [openDialog, setOpenDialog] = useState(false);
  const [filter, setFilter] = useState("all");

  // Show only requests raised by the current TPM (fallback to their projects)
  const myRequests = useMemo(() => {
    return topupRequests.filter((r) => {
      if (r.requester === user?.name) return true;
      const proj = projects.find((p) => p.id === r.projectId);
      return proj?.tpm === user?.name;
    });
  }, [topupRequests, user, projects]);

  const filtered = filter === "all" ? myRequests : myRequests.filter((r) => {
    if (filter === "pending") return r.status === "pending-cto" || r.status === "pending-cfo";
    if (filter === "approved") return r.status === "approved" || r.status === "partial";
    if (filter === "rejected") return r.status === "rejected";
    return true;
  });

  const stats = useMemo(() => ({
    total: myRequests.length,
    pending: myRequests.filter((r) => r.status === "pending-cto" || r.status === "pending-cfo").length,
    approved: myRequests.filter((r) => r.status === "approved" || r.status === "partial").length,
    approvedAmount: myRequests
      .filter((r) => r.status === "approved" || r.status === "partial")
      .reduce((s, r) => s + (r.cfoDecision?.amount || 0), 0),
  }), [myRequests]);

  return (
    <div className="space-y-6" data-testid="page-tpm-topups">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ArrowUpRightSquare className="w-3 h-3" /> TPM Portal
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">My change requests</h1>
          <p className="text-sm text-zinc-400 mt-1">Phase-wise change requests with model, infra, subscription, or budget asks · L2 reviews first, L3 finalizes</p>
        </div>
        <Button
          onClick={() => setOpenDialog(true)}
          className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
          data-testid="btn-new-topup"
        >
          <Plus className="w-4 h-4" /> Raise additional request
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total requests" value={String(stats.total)} icon={ArrowUpRightSquare} tone="magenta" testid="tpm-tu-total" />
        <Stat label="Pending" value={String(stats.pending)} icon={Clock3} tone="warning" testid="tpm-tu-pending" />
        <Stat label="Approved" value={String(stats.approved)} icon={CheckCircle2} tone="positive" testid="tpm-tu-approved" />
        <Stat label="Value approved" value={fmtCurrency(stats.approvedAmount)} icon={Wallet} tone="positive" testid="tpm-tu-value" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "pending", "approved", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`tpm-filter-${f}`}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${
              filter === f
                ? "bg-fuchsia-500 text-white border-fuchsia-500"
                : "bg-transparent text-zinc-400 border-white/15 hover:text-zinc-100 hover:border-white/25"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
            <ArrowUpRightSquare className="w-8 h-8 mx-auto text-zinc-600 mb-3" />
            <div className="text-sm text-zinc-300 font-medium">No change requests yet</div>
            <div className="text-xs text-zinc-500 mt-1">Raise a change request when a phase needs a model, infra, subscription, or budget update.</div>
            <Button
              onClick={() => setOpenDialog(true)}
              className="mt-4 h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2"
            >
              <Plus className="w-3.5 h-3.5" /> Raise your first change request
            </Button>
          </div>
        )}
        {filtered.map((r) => {
          const project = projects.find((p) => p.id === r.projectId);
          const stage = stageChip[r.status] || stageChip["pending-cto"];
          return (
            <Link
              to={`/topup-requests/${r.id}`}
              key={r.id}
              data-testid={`tpm-tur-${r.id}`}
              className="block bg-[#12121A] rounded-2xl border border-white/5 hover:border-fuchsia-500/30 p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${stage.cls}`}>
                      <stage.Icon className="w-3 h-3" /> {stage.label}
                    </span>
                    {r.urgency === "High" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/10 border border-red-500/30 text-red-300">
                        <AlertTriangle className="w-3 h-3" /> High
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-display font-semibold text-lg text-white">{r.projectName}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" /> {r.phaseName}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {project?.client || "—"}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" /> {r.requester}</span>
                    <span>·</span>
                    <span className="tabular">{new Date(r.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-300 leading-relaxed line-clamp-2">
                    <span className="text-fuchsia-200 font-semibold">Reason: </span>{r.reason}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Requested</div>
                  <div className="font-display text-xl font-semibold text-white tabular">+{fmtCurrency(r.amount, { compact: false })}</div>
                  {r.cfoDecision?.amount ? (
                    <div className="text-[11px] text-emerald-300 tabular">Approved · {fmtCurrency(r.cfoDecision.amount, { compact: false })}</div>
                  ) : r.ctoDecision?.amount ? (
                    <div className="text-[11px] text-sky-300 tabular">CTO forwarded · {fmtCurrency(r.ctoDecision.amount, { compact: false })}</div>
                  ) : null}
                  <div className="mt-1 text-[10px] text-fuchsia-300 inline-flex items-center gap-0.5">View details <ChevronRight className="w-3 h-3" /></div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <TopupRequestDialog open={openDialog} onOpenChange={setOpenDialog} />
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

export default TpmTopups;
