import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { RETURNED_BUDGETS } from "../../data/mockTpm";
import { fmtCurrency } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  ArrowLeft,
  Undo2,
  MessageSquare,
  Check,
  X,
  Send,
  GitCompare,
  Sparkles,
  AlertTriangle,
  Clock3,
  User,
  FileText,
} from "lucide-react";

const CtoReview = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const budget = useMemo(() => RETURNED_BUDGETS.find((b) => b.id === id) || RETURNED_BUDGETS[0], [id]);

  // Accept/reject state per suggestion (flagged lines)
  const [decisions, setDecisions] = useState(() =>
    Object.fromEntries(budget.diff.filter((d) => d.flagged).map((d) => [d.line, "pending"]))
  );
  const [note, setNote] = useState("");

  const setDecision = (line, v) => setDecisions((d) => ({ ...d, [line]: v }));

  const resubmit = () => {
    const acceptedCount = Object.values(decisions).filter((v) => v === "accepted").length;
    toast.success("Budget resubmitted to CTO", {
      description: `${budget.projectName} · ${acceptedCount} suggestion${acceptedCount === 1 ? "" : "s"} accepted · new version ${bumpVersion(budget.version)}`,
    });
    nav("/");
  };

  return (
    <div className="space-y-6" data-testid="page-cto-review">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link to="/" className="hover:text-zinc-300 inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              TPM Dashboard
            </Link>
            <span>/</span>
            <span>Returned budgets</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-300">
            <Undo2 className="w-3 h-3" />
            Returned for edits
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">
            {budget.projectName} — {budget.version}
          </h1>
          <p className="text-sm text-zinc-400 mt-1 flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" /> Submitted by {budget.submittedBy}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="w-3 h-3" /> Reviewed by {budget.reviewedBy}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2" onClick={() => nav(-1)} data-testid="btn-back">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
          <Button
            onClick={resubmit}
            className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="btn-resubmit"
          >
            <Send className="w-3.5 h-3.5" />
            Resubmit to CTO
          </Button>
        </div>
      </div>

      {/* CTO note */}
      <div className="bg-amber-500/[0.06] rounded-2xl border border-amber-500/20 p-5" data-testid="cto-note">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-300 mb-1">CTO comment</div>
            <div className="text-sm text-zinc-100 leading-relaxed">{budget.ctoNote}</div>
            <div className="text-[11px] text-zinc-500 mt-2 tabular">
              {new Date(budget.reviewedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </div>
        </div>
      </div>

      {/* Version compare + total */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5 lg:col-span-2" data-testid="version-compare">
          <div className="flex items-center gap-2 mb-3">
            <GitCompare className="w-4 h-4 text-fuchsia-300" />
            <div className="font-display font-semibold text-[15px] text-white">Version comparison</div>
            <span className="ml-auto text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
              {budget.originalVersion} → {budget.version}
            </span>
          </div>

          <div className="space-y-2">
            {budget.diff.map((d) => {
              const decision = decisions[d.line];
              return (
                <div
                  key={d.line}
                  data-testid={`diff-${d.line.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  className={`rounded-xl border p-3 ${
                    d.flagged
                      ? decision === "accepted"
                        ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                        : decision === "rejected"
                        ? "border-white/10 bg-white/[0.02] opacity-70"
                        : "border-amber-500/30 bg-amber-500/[0.05]"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {d.flagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />}
                        <div className="text-sm font-medium text-white truncate">{d.line}</div>
                      </div>
                      {d.flagged && <div className="text-xs text-amber-200 mt-1">{d.note}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-white tabular">
                        {fmtCurrency(d.to, { compact: false })}
                      </div>
                      {d.from !== d.to && (
                        <div className="text-[11px] text-zinc-500 line-through tabular">
                          {fmtCurrency(d.from, { compact: false })}
                        </div>
                      )}
                    </div>
                  </div>

                  {d.flagged && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => setDecision(d.line, "accepted")}
                        data-testid={`accept-${d.line.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                          decision === "accepted"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        <Check className="w-3 h-3" /> Accept
                      </button>
                      <button
                        onClick={() => setDecision(d.line, "rejected")}
                        data-testid={`reject-${d.line.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                          decision === "rejected"
                            ? "border-red-500/40 bg-red-500/15 text-red-300"
                            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                      {decision === "pending" && (
                        <span className="text-[10px] text-amber-300 uppercase tracking-widest font-semibold">Pending decision</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.03] p-5" data-testid="review-summary">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-2">Budget total</div>
            <div className="font-display text-3xl font-semibold text-white tabular">{fmtCurrency(budget.total, { compact: false })}</div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Status</span>
                <span className="text-amber-300 font-semibold">Returned</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Flagged lines</span>
                <span className="text-white font-semibold tabular">{budget.diff.filter((d) => d.flagged).length}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Accepted</span>
                <span className="text-emerald-300 font-semibold tabular">
                  {Object.values(decisions).filter((v) => v === "accepted").length}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Rejected</span>
                <span className="text-red-300 font-semibold tabular">
                  {Object.values(decisions).filter((v) => v === "rejected").length}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Response to CTO</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Optional: explain your acceptance / rejection decisions"
              data-testid="review-note"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </div>

          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-zinc-300">
              <span className="text-fuchsia-200 font-semibold">Tip: </span>
              Accepting the Gemini 2.5 Pro swap could save ~$1,200 across this budget while keeping accuracy within 2% of Opus 4.8 for classification tasks.
            </div>
          </div>
        </div>
      </div>

      {/* All Returned Budgets List (nav) */}
      {RETURNED_BUDGETS.length > 1 && (
        <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="returned-list">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-3">Other returned budgets</div>
          <div className="space-y-2">
            {RETURNED_BUDGETS.filter((b) => b.id !== budget.id).map((b) => (
              <Link
                to={`/cto-review/${b.id}`}
                key={b.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:border-amber-500/30 bg-white/[0.02] hover:bg-white/[0.06] transition-all"
              >
                <FileText className="w-4 h-4 text-amber-300" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {b.projectName} — {b.version}
                  </div>
                  <div className="text-[11px] text-zinc-500">Reviewed by {b.reviewedBy}</div>
                </div>
                <div className="text-sm font-semibold text-white tabular">{fmtCurrency(b.total, { compact: false })}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const bumpVersion = (v) => {
  const parts = v.replace(/^v/i, "").split(".").map((x) => parseInt(x, 10));
  parts[parts.length - 1] += 1;
  return `v${parts.join(".")}`;
};

export default CtoReview;
