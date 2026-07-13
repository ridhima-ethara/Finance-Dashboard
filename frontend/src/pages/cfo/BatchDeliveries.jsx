import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import {
  PackageCheck, DollarSign, MessageSquare, User as UserIcon, Receipt, Send,
  CheckCircle2, Clock3, AlertTriangle, Building2, Layers, Save, TrendingUp, TrendingDown,
} from "lucide-react";

const statusMap = {
  "pending-cfo": { label: "Pending · CFO action", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  recovered: { label: "Recovered · full", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  "partial-recovered": { label: "Recovered · partial", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: AlertTriangle },
  "non-recoverable": { label: "Non-recoverable", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", Icon: AlertTriangle },
};

const CfoBatchDeliveries = () => {
  const { batchDeliveries, recordActualRecovery, role } = useApp();
  const [searchParams] = useSearchParams();
  const [drafts, setDrafts] = useState({}); // { [id]: { amount, note } }
  const [filter, setFilter] = useState("all");
  const financeDeliveries = useMemo(
    () => batchDeliveries.filter((delivery) => delivery.stage !== "rnd-review"),
    [batchDeliveries]
  );

  const stats = useMemo(() => {
    const proposed = financeDeliveries.reduce((s, d) => s + d.proposedAmount, 0);
    const recovered = financeDeliveries.reduce((s, d) => s + (d.actualRecovered || 0), 0);
    const pending = financeDeliveries.filter((d) => d.status === "pending-cfo").length;
    return { total: financeDeliveries.length, pending, proposed, recovered };
  }, [financeDeliveries]);

  const filtered = useMemo(() => {
    if (filter === "all") return financeDeliveries;
    if (filter === "pending") return financeDeliveries.filter((d) => d.status === "pending-cfo");
    if (filter === "recovered") return financeDeliveries.filter((d) => d.status === "recovered" || d.status === "partial-recovered");
    return financeDeliveries;
  }, [filter, financeDeliveries]);

  const setDraft = (id, key, val) => setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: val } }));
  useEffect(() => {
    const requestedFilter = searchParams.get("filter");
    if (requestedFilter && ["all", "pending", "recovered"].includes(requestedFilter)) {
      setFilter(requestedFilter);
    }
  }, [searchParams]);
  const save = (d) => {
    const draft = drafts[d.id] || {};
    const amt = draft.amount != null ? Number(draft.amount) : d.actualRecovered ?? d.proposedAmount;
    if (!amt && amt !== 0) { toast.error("Enter the actual recovered amount"); return; }
    if (amt < 0) { toast.error("Actual amount cannot be negative"); return; }
    recordActualRecovery(d.id, { actualRecovered: amt, cfoNote: draft.note ?? d.cfoNote });
    toast.success("Actual recovery recorded", {
      description: `${d.projectName} · ${d.phaseName} · $${amt.toLocaleString()} (proposed $${d.proposedAmount.toLocaleString()})`,
    });
    setDrafts((prev) => { const next = { ...prev }; delete next[d.id]; return next; });
  };

  const canEdit = role === "CFO";

  return (
    <div className="space-y-6" data-testid="page-batch-deliveries">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
          <Receipt className="w-3 h-3" /> CFO Portal · Projects
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Batch deliveries &amp; client recovery</h1>
        <p className="text-sm text-zinc-400 mt-1">
          TPMs deliver phase batches with a proposed recoverable amount and client feedback · CFO records the actual amount recovered.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total deliveries" value={String(stats.total)} icon={PackageCheck} tone="magenta" testid="bd-total" />
        <Stat label="Awaiting CFO" value={String(stats.pending)} icon={Clock3} tone="warning" testid="bd-pending" />
        <Stat label="Proposed" value={fmtCurrency(stats.proposed)} icon={DollarSign} testid="bd-proposed" />
        <Stat label="Recovered" value={fmtCurrency(stats.recovered)} icon={TrendingUp} tone="positive" testid="bd-recovered" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "pending", "recovered"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`bd-filter-${f}`}
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

      {/* Cards */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
          <PackageCheck className="w-8 h-8 mx-auto text-zinc-600 mb-3" />
          <div className="text-sm text-zinc-300 font-medium">No batch deliveries yet</div>
          <div className="text-xs text-zinc-500 mt-1">When a TPM delivers a phase batch, it will appear here for CFO recovery tracking.</div>
        </div>
      )}
      <div className="space-y-3">
        {filtered.map((d) => {
          const stCfg = statusMap[d.status] || statusMap["pending-cfo"];
          const draft = drafts[d.id] || {};
          const isPending = d.status === "pending-cfo";
          const isNonRecoverable = d.isRecoverable === false;
          const delta = (draft.amount != null ? Number(draft.amount) : d.actualRecovered) - d.proposedAmount;
          return (
            <div key={d.id} data-testid={`bd-card-${d.id}`} className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${stCfg.cls}`}>
                      <stCfg.Icon className="w-3 h-3" /> {stCfg.label}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/25">
                      <Layers className="w-3 h-3" /> {d.phaseName}
                    </span>
                  </div>
                  <div className="mt-2 font-display font-semibold text-lg text-white">{d.projectName}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {d.client}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" /> {d.deliveredBy}</span>
                    <span>·</span>
                    <span className="tabular">{new Date(d.deliveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{isNonRecoverable ? "Recovery" : "Proposed"}</div>
                  <div className="font-display text-2xl font-semibold text-white tabular">{isNonRecoverable ? "N/A" : fmtCurrency(d.proposedAmount, { compact: false })}</div>
                </div>
              </div>

              {/* Client info panel */}
              <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Client feedback captured by TPM
                </div>
                <div className="text-sm text-zinc-200 leading-relaxed">{d.clientComment}</div>
                {d.clientRepresentative && (
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Client representative: <span className="text-zinc-300">{d.clientRepresentative}</span>
                  </div>
                )}
              </div>

              {/* CFO action row */}
              <div className="mt-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.03] p-3">
                {isNonRecoverable ? (
                  <div className="text-sm text-zinc-300">
                    TPM marked this delivery as non-recoverable, so no Finance recovery entry is required.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Actual amount recovered</div>
                        <div className="relative">
                          <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={draft.amount != null ? draft.amount : (d.actualRecovered ?? "")}
                            onChange={(e) => setDraft(d.id, "amount", e.target.value)}
                            disabled={!canEdit}
                            data-testid={`bd-actual-${d.id}`}
                            placeholder={isPending ? "Enter recovered amount" : ""}
                            className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 disabled:opacity-60"
                          />
                        </div>
                        {(draft.amount != null || d.actualRecovered != null) && (
                          <div className="mt-1 text-[10px] tabular flex items-center gap-1">
                            {delta >= 0 ? (
                              <><TrendingUp className="w-3 h-3 text-emerald-300" /><span className="text-emerald-300">+{fmtCurrency(delta, { compact: false })} vs proposed</span></>
                            ) : (
                              <><TrendingDown className="w-3 h-3 text-red-300" /><span className="text-red-300">{fmtCurrency(delta, { compact: false })} vs proposed</span></>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">CFO note (optional)</div>
                        <input
                          value={draft.note != null ? draft.note : d.cfoNote || ""}
                          onChange={(e) => setDraft(d.id, "note", e.target.value)}
                          disabled={!canEdit}
                          data-testid={`bd-note-${d.id}`}
                          placeholder="Payment terms, invoice ref, etc."
                          className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 disabled:opacity-60"
                        />
                      </div>
                    </div>
                    {canEdit && (
                      <div className="mt-3 flex items-center justify-end">
                        <Button
                          onClick={() => save(d)}
                          data-testid={`bd-save-${d.id}`}
                          className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                        >
                          <Save className="w-3.5 h-3.5" /> {d.actualRecovered != null ? "Update recovery" : "Record recovery"}
                        </Button>
                      </div>
                    )}
                    {d.cfoAt && (
                      <div className="mt-2 text-[10px] text-zinc-500 tabular">
                        Last updated {new Date(d.cfoAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · by {d.cfoBy}
                      </div>
                    )}
                  </>
                )}
              </div>
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

export default CfoBatchDeliveries;
