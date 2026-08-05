import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { Button } from "../../components/ui/button";
import Recovery from "./Recovery";
import { toast } from "sonner";
import {
  PackageCheck, DollarSign, MessageSquare, User as UserIcon, Receipt, Send,
  CheckCircle2, Clock3, AlertTriangle, Building2, Layers, Save, TrendingUp, TrendingDown,
  Server, CreditCard, ListChecks, Wallet, ChevronDown, Lock,
} from "lucide-react";

const statusMap = {
  "pending-cfo": { label: "Pending", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  recovered: { label: "Received · full", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  "partial-recovered": { label: "Received · partial", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: AlertTriangle },
  "no-payment": { label: "No payment received", cls: "bg-red-500/10 text-red-300 border-red-500/25", Icon: AlertTriangle },
  "non-recoverable": { label: "Non-recoverable", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", Icon: AlertTriangle },
};

const CfoBatchDeliveries = () => {
  const { batchDeliveries, recordActualRecovery, role, projects, budgetReviews } = useApp();
  const [searchParams] = useSearchParams();
  const [drafts, setDrafts] = useState({}); // { [id]: { amount, note } }
  const [filter, setFilter] = useState("all");
  const [activeView, setActiveView] = useState(searchParams.get("view") === "deliveries" || searchParams.get("filter") ? "deliveries" : "recovery");
  const financeDeliveries = useMemo(
    () => batchDeliveries.filter((delivery) => delivery.stage !== "rnd-review"),
    [batchDeliveries]
  );

  const stats = useMemo(() => {
    const proposed = financeDeliveries.reduce((s, d) => s + Number(d.proposedAmount || 0), 0);
    const recovered = financeDeliveries.reduce((s, d) => s + (d.actualRecovered || 0), 0);
    const pending = financeDeliveries.filter((d) => ["pending-cfo", "partial-recovered", "no-payment"].includes(d.status)).length;
    return { total: financeDeliveries.length, pending, proposed, recovered };
  }, [financeDeliveries]);

  const filtered = useMemo(() => {
    if (filter === "all") return financeDeliveries;
    if (filter === "pending") return financeDeliveries.filter((d) => ["pending-cfo", "partial-recovered", "no-payment"].includes(d.status));
    if (filter === "recovered") return financeDeliveries.filter((d) => d.status === "recovered");
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
    const paymentStatus = draft.paymentStatus || d.paymentStatus || (d.actualRecovered == null ? "full" : d.actualRecovered >= d.proposedAmount ? "full" : d.actualRecovered > 0 ? "partial" : "none");
    const amt = paymentStatus === "full" ? Number(d.proposedAmount || 0) : paymentStatus === "none" ? 0 : Number(draft.amount != null ? draft.amount : d.actualRecovered || 0);
    if (!amt && amt !== 0) { toast.error("Enter the actual recovered amount"); return; }
    if (amt < 0) { toast.error("Actual amount cannot be negative"); return; }
    if (paymentStatus === "partial" && (amt <= 0 || amt >= Number(d.proposedAmount || 0))) { toast.error("Partial payment must be greater than zero and less than the estimated recovery"); return; }
    recordActualRecovery(d.id, { actualRecovered: amt, cfoNote: draft.note ?? d.cfoNote, paymentStatus });
    toast.success("Actual recovery recorded", {
      description: `${d.projectName} · ${d.phaseName} · $${amt.toLocaleString()} (estimated $${d.proposedAmount.toLocaleString()})`,
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
          Review delivered batches, approved versus logged usage, and record the client recovery in one place.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.025] p-1" data-testid="batch-recovery-tabs">
        {[
          { id: "recovery", label: "Client recovery dashboard" },
          { id: "deliveries", label: "Batch deliveries" },
        ].map((tab) => <button
          key={tab.id}
          type="button"
          onClick={() => setActiveView(tab.id)}
          className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${activeView === tab.id ? "bg-fuchsia-500 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
          data-testid={`batch-recovery-tab-${tab.id}`}
        >{tab.label}</button>)}
      </div>

      {activeView === "recovery" ? <Recovery embedded /> : <>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total deliveries" value={String(stats.total)} icon={PackageCheck} tone="magenta" testid="bd-total" />
        <Stat label="Awaiting CFO" value={String(stats.pending)} icon={Clock3} tone="warning" testid="bd-pending" />
        <Stat label="Estimated recoverable" value={fmtCurrency(stats.proposed)} icon={DollarSign} testid="bd-proposed" />
        <Stat label="Received" value={fmtCurrency(stats.recovered)} icon={TrendingUp} tone="positive" testid="bd-recovered" />
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
            {f === "recovered" ? "received in full" : f === "pending" ? "pending payment" : f}
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
          const project = projects.find((entry) => entry.id === d.projectId);
          const phase = (project?.phases || []).find((entry) => entry.id === d.phaseId || entry.name === d.phaseName);
          const matchingReviews = budgetReviews
            .filter((review) => review.projectId === d.projectId && (
              review.activePhaseId === d.phaseId
              || (review.requestedPhases || []).some((entry) => entry.id === d.phaseId || entry.name === d.phaseName)
            ))
            .sort((left, right) => new Date(right.cfoDecision?.at || right.submittedAt || 0) - new Date(left.cfoDecision?.at || left.submittedAt || 0));
          const phaseReview = matchingReviews[0];
          const resourceItems = phaseReview?.items || project?.budgetItems || {};
          const approvedAmount = Number(
            phase?.estimated
            || phase?.budget
            || phaseReview?.cfoDecision?.amount
            || phaseReview?.approvedAmount
            || phaseReview?.recommendedBudget
            || 0
          );
          const loggedAmount = Number(d.finalCost ?? d.amount ?? 0);
          const loggedTasks = Number(d.tasks || d.rnd?.taskCount || 0);
          const totalTasks = Number(phase?.totalTasks || phase?.tasks || phaseReview?.tasks || loggedTasks || 0);
          const infraItems = resourceItems.infra || [];
          const subscriptionItems = resourceItems.subs || [];
          const stCfg = statusMap[d.status] || statusMap["pending-cfo"];
          const draft = drafts[d.id] || {};
          const paymentStatus = draft.paymentStatus || d.paymentStatus || (d.actualRecovered == null ? "full" : d.actualRecovered >= d.proposedAmount ? "full" : d.actualRecovered > 0 ? "partial" : "none");
          const recoveryAmount = paymentStatus === "full" ? Number(d.proposedAmount || 0) : paymentStatus === "none" ? 0 : (draft.amount != null ? Number(draft.amount) : Number(d.actualRecovered || 0));
          const isPending = d.status === "pending-cfo";
          const isNonRecoverable = d.isRecoverable === false;
          const isPaymentLocked = d.status === "recovered" || d.status === "no-payment";
          const canEditPayment = canEdit && !isPaymentLocked;
          const delta = recoveryAmount - d.proposedAmount;
          return (
            <div key={d.id} data-testid={`bd-card-${d.id}`} className="bg-[#12121A] rounded-2xl border border-white/5 p-4">
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
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{isNonRecoverable ? "Recovery" : "Estimated recoverable"}</div>
                  <div className="font-display text-2xl font-semibold text-white tabular">{isNonRecoverable ? "N/A" : fmtCurrency(d.proposedAmount, { compact: false })}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06] rounded-xl border border-white/5 bg-white/[0.02]" data-testid={`bd-usage-${d.id}`}>
                <ComparisonCard icon={Wallet} label="Approved amount" value={fmtCurrency(approvedAmount, { compact: false })} />
                <ComparisonCard icon={TrendingUp} label="Logged amount" value={fmtCurrency(loggedAmount, { compact: false })} detail={approvedAmount > 0 ? `${Math.round((loggedAmount / approvedAmount) * 100)}% of approved` : "No approved amount recorded"} tone={approvedAmount > 0 && loggedAmount > approvedAmount ? "warning" : "positive"} />
                <ComparisonCard icon={ListChecks} label="Total tasks" value={totalTasks.toLocaleString()} />
                <ComparisonCard icon={CheckCircle2} label="Logged tasks" value={loggedTasks.toLocaleString()} detail={totalTasks > 0 ? `${Math.round((loggedTasks / totalTasks) * 100)}% completed` : "No task target recorded"} tone="positive" />
              </div>

              <details className="group mt-3 rounded-xl border border-white/5 bg-white/[0.015]" data-testid={`bd-details-${d.id}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs text-zinc-300 hover:bg-white/[0.02]">
                  <span className="font-medium">Cost and resource details</span>
                  <span className="flex items-center gap-3 text-[10px] text-zinc-500">
                    {infraItems.length} infra · {subscriptionItems.length} subscriptions · {(d.modelTaskSummary || d.rnd?.modelTaskSummary || []).length} models
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="grid grid-cols-1 gap-2 border-t border-white/5 p-3 lg:grid-cols-2" data-testid={`bd-resources-${d.id}`}>
                  <ResourceList title="Infrastructure" icon={Server} entries={infraItems} empty="No infrastructure approved for this phase." />
                  <ResourceList title="Subscriptions" icon={CreditCard} entries={subscriptionItems} empty="No subscriptions approved for this phase." />
                </div>

              {/* Submitted model-wise costing */}
              <div className="mx-3 mb-3 overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02]" data-testid={`bd-model-cost-${d.id}`}>
                <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Submitted task costing</div>
                  <div className="text-xs text-zinc-400"><span className="text-white font-semibold tabular">{Number(d.tasks || d.rnd?.taskCount || 0).toLocaleString()}</span> tasks · Final cost <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(Number(d.finalCost ?? d.proposedAmount ?? 0), { compact: false })}</span></div>
                </div>
                {(d.modelTaskSummary || d.rnd?.modelTaskSummary || []).length ? <div className="min-w-[680px]">
                  <div className="grid grid-cols-[1.5fr_.6fr_.8fr_.8fr_.8fr] gap-3 px-3 py-2 text-[9px] uppercase tracking-widest text-zinc-500"><span>Model</span><span className="text-right">Tasks</span><span className="text-right">Trajectories</span><span className="text-right">Cost / task</span><span className="text-right">Model cost</span></div>
                  {(d.modelTaskSummary || d.rnd?.modelTaskSummary || []).map((model) => <div key={model.model} className="grid grid-cols-[1.5fr_.6fr_.8fr_.8fr_.8fr] gap-3 border-t border-white/[0.04] px-3 py-2.5 text-xs"><span className="truncate text-zinc-200">{model.model}</span><span className="text-right tabular text-zinc-300">{Number(model.tasks || 0).toLocaleString()}</span><span className="text-right tabular text-zinc-400">{Number(model.trajectories || 0).toLocaleString()}</span><span className="text-right tabular text-zinc-300">{fmtCurrency(Number(model.tasks || 0) > 0 ? Number(model.cost || 0) / Number(model.tasks) : 0, { compact: false })}</span><span className="text-right font-semibold tabular text-fuchsia-300">{fmtCurrency(Number(model.cost || 0), { compact: false })}</span></div>)}
                </div> : <div className="px-3 py-5 text-center text-xs text-zinc-500">No model-wise task costing was submitted with this batch.</div>}
              </div>
              </details>

              {(d.deliverableUrls || []).length > 0 && <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <div className="flex-shrink-0 text-[10px] uppercase tracking-widest font-semibold text-sky-300">Deliverables</div>
                <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">{d.deliverableUrls.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="max-w-[420px] truncate text-xs text-sky-300 hover:text-sky-200">Link {index + 1}</a>)}</div>
              </div>}

              {/* Client feedback is captured after delivery */}
              {d.clientComment && <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Client feedback captured by TPM
                </div>
                <div className="text-sm text-zinc-200 leading-relaxed">{d.clientComment}</div>
                {d.clientRepresentative && (
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Client representative: <span className="text-zinc-300">{d.clientRepresentative}</span>
                  </div>
                )}
              </div>}

              {/* CFO action row */}
              <div className="mt-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.03] p-3">
                {isNonRecoverable ? (
                  <div className="text-sm text-zinc-300">
                    TPM marked this delivery as non-recoverable, so no Finance recovery entry is required.
                  </div>
                ) : (
                  <>
                    {!isPaymentLocked && <>
                    <div className="mb-3">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Payment received</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid={`bd-payment-options-${d.id}`}>
                        {[
                          { id: "full", label: "Full payment", detail: fmtCurrency(d.proposedAmount, { compact: false }) },
                          { id: "partial", label: "Partial payment", detail: "Enter amount received" },
                          { id: "none", label: "No payment received", detail: fmtCurrency(0, { compact: false }) },
                        ].map((option) => <button
                          key={option.id}
                          type="button"
                          disabled={!canEditPayment}
                          onClick={() => {
                            setDraft(d.id, "paymentStatus", option.id);
                            setDraft(d.id, "amount", option.id === "full" ? Number(d.proposedAmount || 0) : option.id === "none" ? 0 : (d.actualRecovered > 0 && d.actualRecovered < d.proposedAmount ? d.actualRecovered : ""));
                          }}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default ${paymentStatus === option.id ? "border-fuchsia-500/40 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.025] hover:border-white/20"}`}
                          data-testid={`bd-payment-${option.id}-${d.id}`}
                        >
                          <div className={`text-xs font-semibold ${paymentStatus === option.id ? "text-fuchsia-300" : "text-zinc-300"}`}>{option.label}</div>
                          <div className="mt-0.5 text-[10px] text-zinc-500">{option.detail}</div>
                        </button>)}
                      </div>
                      {paymentStatus === "partial" && <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200">
                        Enter the cumulative amount received so far. You can return to this batch and update the amount when another payment is received.
                      </div>}
                    </div>
                    <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(220px,.7fr)_minmax(300px,1.5fr)_auto]">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Amount received</div>
                        <div className="relative">
                          <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={recoveryAmount}
                            onChange={(e) => setDraft(d.id, "amount", e.target.value)}
                            disabled={!canEditPayment || paymentStatus !== "partial"}
                            data-testid={`bd-actual-${d.id}`}
                            placeholder={isPending ? "Enter amount received" : ""}
                            className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 disabled:opacity-60"
                          />
                        </div>
                        {(paymentStatus !== "partial" || draft.amount != null || d.actualRecovered != null) && (
                          <div className="mt-1 text-[10px] tabular flex items-center gap-1">
                            {delta >= 0 ? (
                              <><TrendingUp className="w-3 h-3 text-emerald-300" /><span className="text-emerald-300">+{fmtCurrency(delta, { compact: false })} vs estimated</span></>
                            ) : (
                              <><TrendingDown className="w-3 h-3 text-red-300" /><span className="text-red-300">{fmtCurrency(delta, { compact: false })} vs estimated</span></>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">CFO note (optional)</div>
                        <input
                          value={draft.note != null ? draft.note : d.cfoNote || ""}
                          onChange={(e) => setDraft(d.id, "note", e.target.value)}
                          disabled={!canEditPayment}
                          data-testid={`bd-note-${d.id}`}
                          placeholder="Payment terms, invoice ref, etc."
                          className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 disabled:opacity-60"
                        />
                      </div>
                      {canEditPayment && (
                        <Button
                          onClick={() => save(d)}
                          data-testid={`bd-save-${d.id}`}
                          className="h-10 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                        >
                          <Save className="w-3.5 h-3.5" /> {d.actualRecovered != null ? "Update" : "Record recovery"}
                        </Button>
                      )}
                    </div>
                    </>}
                    {isPaymentLocked && (
                      <div className={`mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${d.status === "recovered" ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300" : "border-zinc-500/20 bg-white/[0.025] text-zinc-400"}`} data-testid={`bd-payment-locked-${d.id}`}>
                        <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                        {d.status === "recovered" ? "Full payment has been completed. This recovery record is locked." : "No payment will be received for this batch. This recovery record is locked."}
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
      </>}
    </div>
  );
};

const ComparisonCard = ({ icon: Icon, label, value, detail, tone = "neutral" }) => {
  const toneClass = tone === "positive" ? "text-emerald-300" : tone === "warning" ? "text-amber-300" : "text-white";
  return <div className="min-w-0 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-zinc-500"><Icon className="w-3.5 h-3.5" />{label}</div>
    <div className={`mt-1 text-base font-display font-semibold tabular ${toneClass}`}>{value}</div>
    {detail && <div className="mt-0.5 text-[10px] text-zinc-500">{detail}</div>}
  </div>;
};

const ResourceList = ({ title, icon: Icon, entries, empty }) => <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-zinc-400"><Icon className="w-3.5 h-3.5 text-fuchsia-300" />{title}</div>
  {entries.length ? <div className="mt-2 space-y-1.5">{entries.map((entry, index) => {
    const name = entry.optionLabel || entry.subscription || entry.model || entry.name || [entry.provider, entry.instance].filter(Boolean).join(" · ") || `${title} item ${index + 1}`;
    const amount = Number(entry.amount || entry.estCost || entry.cost || 0);
    const detail = [entry.days ? `${entry.days} days` : "", entry.seats ? `${entry.seats} seats` : ""].filter(Boolean).join(" · ");
    return <div key={entry.id || `${name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.025] px-2.5 py-2 text-xs">
      <div className="min-w-0"><div className="truncate text-zinc-200">{name}</div>{detail && <div className="text-[10px] text-zinc-500">{detail}</div>}</div>
      <div className="flex-shrink-0 font-semibold tabular text-zinc-300">{fmtCurrency(amount, { compact: false })}</div>
    </div>;
  })}</div> : <div className="mt-3 text-xs text-zinc-500">{empty}</div>}
</div>;

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
