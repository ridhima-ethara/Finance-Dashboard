import { useState, useMemo } from "react";
import { BUDGET_REVIEWS } from "../../data/mockTpm";
import { BUFFER } from "../../data/mockCfo";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  ClipboardCheck,
  Clock3,
  User,
  Filter,
  Search,
  AlertTriangle,
  Sparkles,
  Check,
  X,
  Send,
  MessageSquare,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Building2,
  Percent,
  Wallet,
  Lock,
} from "lucide-react";

const priorityColor = {
  High: { bg: "bg-red-500/10", text: "text-red-300", border: "border-red-500/30" },
  Normal: { bg: "bg-sky-500/10", text: "text-sky-300", border: "border-sky-500/30" },
  Low: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/30" },
};

const ApprovalQueue = () => {
  // Persist partial approvals & buffer allocations locally (frontend demo)
  const [queue, setQueue] = useState(() =>
    BUDGET_REVIEWS.map((r) => ({
      ...r,
      status: "pending", // pending, approved, partial, rejected, returned
      cfoApprovedAmount: null,
      cfoBufferAllocation: 0, // hidden buffer — CFO only
      cfoComment: "",
    }))
  );
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Per-row modal state
  const [partialAmt, setPartialAmt] = useState({});
  const [comment, setComment] = useState({});
  const [buffer, setBuffer] = useState({});

  const filtered = useMemo(() => {
    return queue.filter((r) => {
      if (priorityFilter !== "all" && r.urgency !== priorityFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.projectName.toLowerCase().includes(s) && !r.tpm.toLowerCase().includes(s) && !r.client.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [queue, search, priorityFilter]);

  const stats = useMemo(() => {
    return {
      pending: queue.filter((q) => q.status === "pending").length,
      approved: queue.filter((q) => q.status === "approved" || q.status === "partial").length,
      partial: queue.filter((q) => q.status === "partial").length,
      rejected: queue.filter((q) => q.status === "rejected").length,
      totalRequested: queue.filter((q) => q.status === "pending").reduce((s, q) => s + q.requestedBudget, 0),
    };
  }, [queue]);

  const updateStatus = (id, patch) => setQueue((q) => q.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const doApproveFull = (r) => {
    updateStatus(r.id, { status: "approved", cfoApprovedAmount: r.requestedBudget });
    toast.success("Budget approved in full", {
      description: `${r.projectName} · ${fmtCurrency(r.requestedBudget, { compact: false })} · Forwarded for payment`,
    });
  };
  const doPartialApprove = (r) => {
    const amt = Number(partialAmt[r.id]);
    if (!amt || amt <= 0 || amt >= r.requestedBudget) {
      toast.error("Enter a valid partial amount (0 < amt < requested)");
      return;
    }
    updateStatus(r.id, { status: "partial", cfoApprovedAmount: amt, cfoComment: comment[r.id] || "" });
    toast.success("Budget partially approved", {
      description: `${r.projectName} · Approved ${fmtCurrency(amt, { compact: false })} of ${fmtCurrency(r.requestedBudget, { compact: false })} · TPM sees ${fmtCurrency(amt, { compact: false })} as new baseline for future top-ups`,
    });
  };
  const doReject = (r) => {
    if (!(comment[r.id] || "").trim()) {
      toast.error("Comment is required to reject");
      return;
    }
    updateStatus(r.id, { status: "rejected", cfoComment: comment[r.id] });
    toast.error("Budget rejected", { description: `${r.projectName} · TPM notified · comment: "${comment[r.id]}"` });
  };
  const doReturn = (r) => {
    if (!(comment[r.id] || "").trim()) {
      toast.error("Comment is required to return");
      return;
    }
    updateStatus(r.id, { status: "returned", cfoComment: comment[r.id] });
    toast.info("Returned with comments to CTO", { description: `${r.projectName} · comment: "${comment[r.id]}"` });
  };
  const doAllocateBuffer = (r) => {
    const b = Number(buffer[r.id]);
    if (!b || b <= 0 || b > 50) {
      toast.error("Enter a buffer between 0% and 50%");
      return;
    }
    updateStatus(r.id, { cfoBufferAllocation: b });
    toast.success("Contingency buffer allocated (hidden)", {
      description: `${r.projectName} · ${b}% (${fmtCurrency(Math.round((r.requestedBudget * b) / 100), { compact: false })}) reserved · not visible to TPM/CTO`,
    });
  };
  const doForwardPayment = (r) => {
    if (r.status !== "approved" && r.status !== "partial") {
      toast.error("Approve or partially approve before forwarding for payment");
      return;
    }
    toast.success("Forwarded for payment", { description: `${r.projectName} · ${fmtCurrency(r.cfoApprovedAmount, { compact: false })} · Finance queue` });
  };

  return (
    <div className="space-y-6" data-testid="page-approval-queue">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
            <ClipboardCheck className="w-3 h-3" />
            CFO Portal
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Approval queue</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Financial review of budgets forwarded by CTO · approve / partially approve / reject / return / allocate buffer
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Pending" value={String(stats.pending)} icon={Clock3} tone="warning" testid="stat-pending" />
        <Stat label="Approved" value={String(stats.approved)} icon={Check} tone="positive" testid="stat-approved" />
        <Stat label="Partial approvals" value={String(stats.partial)} icon={Percent} tone="magenta" testid="stat-partial" />
        <Stat label="Rejected" value={String(stats.rejected)} icon={X} tone="negative" testid="stat-rejected" />
        <Stat label="Total requested (pending)" value={fmtCurrency(stats.totalRequested)} testid="stat-total-req" />
      </div>

      {/* Buffer pool banner (CFO only) */}
      <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.05] p-4 flex items-center gap-3" data-testid="buffer-banner">
        <Lock className="w-4 h-4 text-fuchsia-300 flex-shrink-0" />
        <div className="text-xs text-zinc-200 flex-1">
          <span className="text-fuchsia-200 font-semibold">Hidden contingency buffer pool: </span>
          {fmtCurrency(BUFFER.available)} available of {fmtCurrency(BUFFER.total)} · {BUFFER.consumed > 0 && (
            <span className="text-amber-200">{fmtCurrency(BUFFER.consumed)} already allocated this month</span>
          )}. Allocations here are <span className="text-fuchsia-200 font-semibold">invisible</span> to TPM/CTO.
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project / TPM / client..."
            data-testid="queue-search"
            className="w-full h-10 pl-10 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          {["all", "High", "Normal", "Low"].map((u) => (
            <button
              key={u}
              onClick={() => setPriorityFilter(u)}
              data-testid={`filter-priority-${u}`}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize ${
                priorityFilter === u
                  ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {u === "all" ? "All" : u}
            </button>
          ))}
        </div>
      </div>

      {/* Queue */}
      <div className="space-y-3">
        {filtered.map((r) => {
          const pc = priorityColor[r.urgency] || priorityColor.Normal;
          const isOpen = expanded === r.id;
          const isPending = r.status === "pending";
          const statusChip =
            r.status === "approved"
              ? { text: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
              : r.status === "partial"
              ? { text: `Partial · ${fmtCurrency(r.cfoApprovedAmount, { compact: false })}`, cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" }
              : r.status === "rejected"
              ? { text: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30" }
              : r.status === "returned"
              ? { text: "Returned", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
              : { text: "Pending", cls: "bg-white/[0.04] text-zinc-300 border-white/10" };

          return (
            <div
              key={r.id}
              data-testid={`review-${r.id}`}
              className="bg-[#12121A] rounded-2xl border border-white/5 hover:border-fuchsia-500/20 transition-colors"
            >
              <div className="p-5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : r.id)}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${pc.bg} ${pc.text} ${pc.border}`}>
                        <AlertTriangle className="w-3 h-3" /> {r.urgency}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
                        {r.type}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusChip.cls}`}>
                        {statusChip.text}
                      </span>
                      {r.cfoBufferAllocation > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300">
                          <Lock className="w-3 h-3" /> Buffer +{r.cfoBufferAllocation}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2 font-display font-semibold text-lg text-white">{r.projectName}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> TPM {r.tpm}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {r.client}</span>
                      <span>·</span>
                      <span>{r.recoveryType}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Requested</div>
                    <div className="font-display text-2xl font-semibold text-white tabular">{fmtCurrency(r.requestedBudget, { compact: false })}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 tabular">
                      CTO recommends {fmtCurrency(r.recommendedBudget, { compact: false })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1 text-[11px] text-zinc-500">
                  {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isOpen ? "Collapse" : "Expand for review & actions"}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-white/5 p-5 space-y-4 animate-fade-up">
                  {/* Financial context */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MiniStat label="Current spend" value={fmtCurrency(Math.round(r.currentBudget * 0.7))} />
                    <MiniStat label="Buffer required" value={`${r.bufferPct}%`} icon={Percent} />
                    <MiniStat label="AI cost" value={fmtCurrency(r.aiCost, { compact: false })} />
                    <MiniStat label="Infra cost" value={fmtCurrency(r.infraCost, { compact: false })} />
                  </div>

                  {/* Justification */}
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">TPM justification</div>
                    <div className="text-sm text-zinc-100 leading-relaxed">{r.justification}</div>
                  </div>

                  {/* AI recommendation */}
                  <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-zinc-300 leading-relaxed">
                      <span className="text-fuchsia-200 font-semibold">AI recommendation: </span>
                      Approve at <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(r.recommendedBudget, { compact: false })}</span> (CTO-optimized).
                      Consider allocating <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(Math.round(r.requestedBudget * 0.08), { compact: false })}</span> from buffer for downside protection.
                    </div>
                  </div>

                  {isPending && (
                    <>
                      {/* Comment */}
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Comment (required for reject / return)</div>
                        <textarea
                          value={comment[r.id] || ""}
                          onChange={(e) => setComment({ ...comment, [r.id]: e.target.value })}
                          rows={2}
                          placeholder="Explain your decision..."
                          data-testid={`comment-${r.id}`}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                        />
                      </div>

                      {/* Partial approval + buffer inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.03] p-3">
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-1.5">
                            <Percent className="w-3 h-3" /> Partial approval
                          </div>
                          <div className="text-[11px] text-zinc-400 mb-2">
                            Enter amount to approve. This becomes the new baseline visible to TPM — future top-ups will reference this amount, not the original request.
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                            <input
                              type="number"
                              value={partialAmt[r.id] || ""}
                              onChange={(e) => setPartialAmt({ ...partialAmt, [r.id]: e.target.value })}
                              placeholder={`e.g. ${r.recommendedBudget}`}
                              data-testid={`partial-input-${r.id}`}
                              className="w-full h-9 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                            />
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[10px]">
                            <button onClick={(e) => { e.stopPropagation(); setPartialAmt({ ...partialAmt, [r.id]: r.recommendedBudget }); }} className="text-fuchsia-300 hover:text-fuchsia-200">
                              Use CTO recommendation
                            </button>
                            <span className="text-zinc-700">·</span>
                            <button onClick={(e) => { e.stopPropagation(); setPartialAmt({ ...partialAmt, [r.id]: Math.round(r.requestedBudget * 0.8) }); }} className="text-zinc-400 hover:text-zinc-200">
                              80% of request
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-1.5">
                            <Lock className="w-3 h-3" /> Allocate hidden buffer % (CFO only)
                          </div>
                          <div className="text-[11px] text-zinc-400 mb-2">
                            Reserve % of requested budget from the pool for downside protection. Not visible to TPM/CTO. Currently allocated: <span className="text-fuchsia-300 font-semibold tabular">{r.cfoBufferAllocation}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                min="0"
                                max="50"
                                value={buffer[r.id] || ""}
                                onChange={(e) => setBuffer({ ...buffer, [r.id]: e.target.value })}
                                placeholder="Buffer %"
                                data-testid={`buffer-input-${r.id}`}
                                className="w-full h-9 pl-3 pr-8 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                            </div>
                            <Button
                              onClick={(e) => { e.stopPropagation(); doAllocateBuffer(r); }}
                              variant="outline"
                              className="h-9 rounded-lg border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 gap-1 flex-shrink-0"
                              data-testid={`btn-alloc-buffer-${r.id}`}
                            >
                              <ShieldCheck className="w-3 h-3" /> Allocate
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Primary actions */}
                      <div className="flex items-center gap-2 flex-wrap pt-2">
                        <Button
                          onClick={(e) => { e.stopPropagation(); doApproveFull(r); }}
                          className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
                          data-testid={`btn-approve-full-${r.id}`}
                        >
                          <Check className="w-3.5 h-3.5" /> Approve full
                        </Button>
                        <Button
                          onClick={(e) => { e.stopPropagation(); doPartialApprove(r); }}
                          className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                          data-testid={`btn-partial-${r.id}`}
                        >
                          <Percent className="w-3.5 h-3.5" /> Partial approve
                        </Button>
                        <Button
                          onClick={(e) => { e.stopPropagation(); doReturn(r); }}
                          variant="outline"
                          className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 gap-2"
                          data-testid={`btn-return-${r.id}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Return with comments
                        </Button>
                        <Button
                          onClick={(e) => { e.stopPropagation(); doReject(r); }}
                          variant="outline"
                          className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-2"
                          data-testid={`btn-reject-${r.id}`}
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </>
                  )}

                  {!isPending && (
                    <div className="flex items-center gap-2 flex-wrap pt-2">
                      {(r.status === "approved" || r.status === "partial") && (
                        <Button
                          onClick={(e) => { e.stopPropagation(); doForwardPayment(r); }}
                          className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2"
                          data-testid={`btn-forward-payment-${r.id}`}
                        >
                          <Send className="w-3.5 h-3.5" /> Forward for payment
                        </Button>
                      )}
                      <div className="text-xs text-zinc-400">
                        <span className="text-zinc-500">Comment: </span>
                        {r.cfoComment || <em className="text-zinc-600">none</em>}
                      </div>
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

const MiniStat = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
    <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500 flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </div>
    <div className="text-sm font-semibold text-white tabular mt-0.5">{value}</div>
  </div>
);

export default ApprovalQueue;
