import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BUDGET_REVIEWS } from "../../data/mockTpm";
import { PROJECTS } from "../../data/mockProjects";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { useApp } from "../../context/AppContext";
import {
  ArrowLeft,
  X,
  Send,
  Sparkles,
  User,
  Building2,
  Calendar,
  ClipboardCheck,
  Cpu,
  Server,
  Layers,
  Save,
  Edit3,
  FileText,
  Wallet,
  CreditCard,
  Undo2,
} from "lucide-react";

const BudgetReviewWorkspace = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { ctoModifyBudgetReview, ctoRejectBudgetReview, ctoReturnBudgetReview, budgetReviews } = useApp();
  const review = useMemo(() => BUDGET_REVIEWS.find((r) => r.id === id) || BUDGET_REVIEWS[0], [id]);
  const project = useMemo(() => PROJECTS.find((p) => p.id === review.projectId), [review]);
  const priorModification = useMemo(() => budgetReviews.find((r) => r.id === review.id), [budgetReviews, review]);

  const [tab, setTab] = useState("overview");
  const [amount, setAmount] = useState(review.recommendedBudget);
  const [comment, setComment] = useState("");
  const [returnTarget, setReturnTarget] = useState("TPM");

  const phases = project?.phases || [];
  const buildInitialPhases = () => {
    if (priorModification?.modifiedPhases?.length) return priorModification.modifiedPhases;
    const denom = phases.reduce((s, p) => s + p.estimated, 0) || 1;
    return phases.map((p) => {
      const weight = p.estimated / denom;
      return {
        id: p.id,
        name: p.name,
        infra: Math.round(review.infraCost * weight),
        model: Math.round(review.aiCost * weight),
        subs: Math.round(review.subsCost * weight),
      };
    });
  };
  const [modifiedPhases, setModifiedPhases] = useState(buildInitialPhases);
  useEffect(() => {
    if (priorModification?.modifiedPhases?.length) setModifiedPhases(priorModification.modifiedPhases);
  }, [priorModification?.id, priorModification?.modifiedPhases]);

  if (!review || !project) {
    return (
      <div className="text-sm text-zinc-400">
        Review not found.{" "}
        <button onClick={() => nav(-1)} className="text-fuchsia-300 underline">Go back</button>
      </div>
    );
  }

  const requestedBudget = review.requestedBudget;
  const currentBudget = review.currentBudget;
  const recommended = review.recommendedBudget;
  const isRndReview = (review.recoveryType || "").toLowerCase().includes("r&d") || (review.type || "").toLowerCase().includes("r&d");

  const phaseTotals = modifiedPhases.map((p) => ({
    ...p,
    total: Number(p.infra || 0) + Number(p.model || 0) + Number(p.subs || 0),
  }));
  const modifiedTotal = phaseTotals.reduce((s, p) => s + p.total, 0);
  const modifiedInfra = phaseTotals.reduce((s, p) => s + Number(p.infra || 0), 0);
  const modifiedModel = phaseTotals.reduce((s, p) => s + Number(p.model || 0), 0);
  const modifiedSubs = phaseTotals.reduce((s, p) => s + Number(p.subs || 0), 0);
  const modifiedDeltaVsRequested = modifiedTotal - requestedBudget;

  const updateCell = (phaseId, key, val) => {
    setModifiedPhases((rows) => rows.map((r) => (r.id === phaseId ? { ...r, [key]: Number(val) || 0 } : r)));
  };
  const resetToOriginal = () => setModifiedPhases(buildInitialPhases());

  const effectiveAmount = tab === "modify" ? modifiedTotal : amount;
  const delta = effectiveAmount - currentBudget;
  const savings = requestedBudget - effectiveAmount;

  const approveAndForward = () => {
    ctoModifyBudgetReview({
      reviewId: review.id,
      projectId: project.id,
      projectName: review.projectName,
      tpm: review.tpm,
      requestedBudget,
      modifiedPhases: phaseTotals.map((p) => ({ id: p.id, name: p.name, infra: p.infra, model: p.model, subs: p.subs })),
      ctoComment: comment,
    });
    toast.success("Approved & forwarded to CFO", {
      description: `${review.projectName} · ${fmtCurrency(modifiedTotal, { compact: false })}${savings > 0 ? ` · ${fmtCurrency(savings, { compact: false })} saved vs request` : ""}`,
    });
    nav("/budget-reviews");
  };

  const rejectBudget = () => {
    if (!comment.trim()) { toast.error("Add a comment to reject"); return; }
    ctoRejectBudgetReview({
      reviewId: review.id,
      projectId: project.id,
      projectName: review.projectName,
      tpm: review.tpm,
      requestedBudget,
      ctoComment: comment,
    });
    toast.error("Budget rejected", {
      description: `${review.projectName} · TPM notified · "${comment}"`,
    });
    nav("/budget-reviews");
  };

  const returnToTpm = () => {
    if (!comment.trim()) { toast.error(`Add a comment to return to ${returnTarget}`); return; }
    ctoReturnBudgetReview({
      reviewId: review.id,
      projectId: project.id,
      projectName: review.projectName,
      tpm: review.tpm,
      requestedBudget,
      ctoComment: comment,
      returnTo: returnTarget,
    });
    toast.warning(`Returned to ${returnTarget}`, {
      description: `${review.projectName} · ${returnTarget} can edit & resubmit`,
    });
    nav("/budget-reviews");
  };

  const saveDraft = () => toast("Draft saved", { description: "Your modifications will be preserved" });

  return (
    <div className="space-y-6" data-testid="page-budget-review-workspace">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link to="/budget-reviews" className="hover:text-zinc-300 inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Budget reviews
            </Link>
            <span>/</span>
            <span>Workspace</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ClipboardCheck className="w-3 h-3" /> {review.type} · {review.urgency} urgency
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">{review.projectName}</h1>
          <p className="text-sm text-zinc-400 mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {isRndReview ? "R&D" : "TPM"}: {review.tpm}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {review.client}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {review.timeline}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2" onClick={saveDraft} data-testid="btn-save-draft">
            <Save className="w-3.5 h-3.5" /> Save draft
          </Button>
          <Button variant="outline" className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 gap-2" onClick={returnToTpm} data-testid="btn-return-tpm">
            <Undo2 className="w-3.5 h-3.5" /> Return to {isRndReview ? "R&D" : "TPM"}
          </Button>
          <Button variant="outline" className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-2" onClick={rejectBudget} data-testid="btn-reject">
            <X className="w-3.5 h-3.5" /> Reject
          </Button>
          <Button className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]" onClick={approveAndForward} data-testid="btn-approve-forward">
            <Send className="w-3.5 h-3.5" /> Approve &amp; Forward to CFO
          </Button>
        </div>
      </div>

      {/* Tabs — simplified to Overview + Modify Budget only */}
      <div className="flex items-center gap-1 border-b border-white/5 overflow-x-auto">
        {[
          { id: "overview", label: "Overview" },
          { id: "modify", label: "Modify Budget" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id ? "border-fuchsia-400 text-fuchsia-300" : "border-transparent text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {tab === "overview" && (
            <>
              <Panel testid="overview-project" title="Project overview">
                <div className="grid grid-cols-2 gap-3">
                  <InfoField label="Client" value={review.client} />
                  <InfoField label="Recovery type" value={review.recoveryType} />
                  <InfoField label="Requester" value={`${isRndReview ? "R&D" : "TPM"} · ${review.tpm}`} />
                  <InfoField label="Timeline" value={review.timeline} />
                  <InfoField label="Tasks" value={String(review.tasks)} />
                  <InfoField label="Phases" value={String(review.phases)} />
                </div>
              </Panel>
              <Panel testid="overview-justification" title={`Justification from ${isRndReview ? "R&D" : "TPM"}`}>
                <div className="text-sm text-zinc-200 leading-relaxed">{review.justification}</div>
              </Panel>
              <Panel testid="overview-breakdown" title="Budget breakdown">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <BreakdownCell icon={Cpu} label="AI Models" value={review.aiCost} color="#E619B8" />
                  <BreakdownCell icon={Server} label="Infrastructure" value={review.infraCost} color="#3B82F6" />
                  <BreakdownCell icon={Layers} label="Subscriptions" value={review.subsCost} color="#10B981" />
                  <BreakdownCell icon={FileText} label="Miscellaneous" value={review.miscCost} color="#F59E0B" />
                </div>
              </Panel>
              <Panel testid="overview-comparison" title="Estimated vs business requirement" subtitle="Prior baseline vs current ask">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <CompareBox label="Previous approved" value={currentBudget} />
                  <CompareBox label={`${isRndReview ? "R&D" : "TPM"} requested`} value={requestedBudget} highlight="warning" />
                  <CompareBox label="AI recommended" value={recommended} highlight="magenta" />
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-300 leading-relaxed">
                  <span className="text-fuchsia-200 font-semibold">Difference: </span>
                  Requested budget is <span className="text-white font-semibold tabular">{fmtCurrency(requestedBudget - currentBudget, { compact: false })}</span>{" "}
                  above the previously approved amount ({fmtPct(Math.round(((requestedBudget - currentBudget) / (currentBudget || 1)) * 100))} increase).
                  AI recommends <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(recommended, { compact: false })}</span> — saving <span className="text-emerald-300 font-semibold tabular">{fmtCurrency(requestedBudget - recommended, { compact: false })}</span> via optimized model routing.
                </div>
              </Panel>
              {priorModification && (
                <Panel testid="overview-prior-mod" title="Your previous action" subtitle={`Status: ${priorModification.status?.replace(/-/g, " ")} · Total ${fmtCurrency(priorModification.modifiedTotal, { compact: false })}`}>
                  <div className="text-xs text-zinc-300 leading-relaxed">
                    Last updated <span className="text-white font-semibold tabular">{new Date(priorModification.ctoAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>.
                    {priorModification.ctoComment && <div className="mt-1 text-zinc-400"><span className="text-fuchsia-300 font-semibold">Comment:</span> {priorModification.ctoComment}</div>}
                  </div>
                </Panel>
              )}
            </>
          )}

          {tab === "modify" && (
            <>
              <Panel
                testid="modify-summary"
                title="Modify budget · phase-wise breakdown"
                subtitle="Edit Infra, Model &amp; Subscription per phase — overall budget recalculates automatically"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <BreakdownCell icon={Server} label="Infra (new)" value={modifiedInfra} color="#3B82F6" />
                  <BreakdownCell icon={Cpu} label="Models (new)" value={modifiedModel} color="#E619B8" />
                  <BreakdownCell icon={CreditCard} label="Subs (new)" value={modifiedSubs} color="#10B981" />
                  <BreakdownCell icon={Wallet} label="Modified total" value={modifiedTotal} color="#F59E0B" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                        <th className="text-left py-2 px-3">Phase</th>
                        <th className="text-right py-2 px-3">Infra ($)</th>
                        <th className="text-right py-2 px-3">Model ($)</th>
                        <th className="text-right py-2 px-3">Subs ($)</th>
                        <th className="text-right py-2 px-3">Phase total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phaseTotals.map((p) => (
                        <tr key={p.id} data-testid={`modify-phase-${p.id}`} className="border-b border-white/5">
                          <td className="py-2 px-3 text-white font-medium">{p.name}</td>
                          <td className="py-2 px-3">
                            <input type="number" min="0" step="100" value={p.infra} onChange={(e) => updateCell(p.id, "infra", e.target.value)} data-testid={`modify-infra-${p.id}`} className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                          </td>
                          <td className="py-2 px-3">
                            <input type="number" min="0" step="100" value={p.model} onChange={(e) => updateCell(p.id, "model", e.target.value)} data-testid={`modify-model-${p.id}`} className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                          </td>
                          <td className="py-2 px-3">
                            <input type="number" min="0" step="100" value={p.subs} onChange={(e) => updateCell(p.id, "subs", e.target.value)} data-testid={`modify-subs-${p.id}`} className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                          </td>
                          <td className="py-2 px-3 text-right text-white font-semibold tabular">{fmtCurrency(p.total, { compact: false })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-fuchsia-500/30">
                        <td className="py-3 px-3 text-fuchsia-300 uppercase text-[10px] tracking-widest font-semibold">Modified total</td>
                        <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtCurrency(modifiedInfra, { compact: false })}</td>
                        <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtCurrency(modifiedModel, { compact: false })}</td>
                        <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtCurrency(modifiedSubs, { compact: false })}</td>
                        <td className="py-3 px-3 text-right text-fuchsia-300 font-bold text-lg tabular">{fmtCurrency(modifiedTotal, { compact: false })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] flex-wrap gap-2">
                  <div className="text-zinc-500 tabular">
                    {isRndReview ? "R&D" : "TPM"} requested <span className="text-white">{fmtCurrency(requestedBudget, { compact: false })}</span> · your modified ask is
                    {" "}<span className={modifiedDeltaVsRequested <= 0 ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"}>
                      {modifiedDeltaVsRequested >= 0 ? "+" : ""}{fmtCurrency(modifiedDeltaVsRequested, { compact: false })}
                    </span> vs request
                  </div>
                  <button onClick={resetToOriginal} data-testid="btn-reset-modify" className="text-[11px] text-fuchsia-300 hover:text-fuchsia-200">
                    Reset to original breakdown
                  </button>
                </div>
              </Panel>
              <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <span className="text-fuchsia-200 font-semibold">Note: </span>
                  When you click <span className="text-white font-semibold">Approve &amp; Forward to CFO</span>, your modified breakdown is saved and forwarded. Use <span className="text-amber-300 font-semibold">Return to {isRndReview ? "R&D" : "TPM"}</span> to send it back with comments so they can edit and resubmit.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar decision panel */}
        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.03] p-5 sticky top-4" data-testid="decision-panel">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-2">
              {tab === "modify" ? "Modified total (live)" : "Approval amount"}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold text-white tabular">{fmtCurrency(effectiveAmount, { compact: false })}</span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 tabular">
              {delta >= 0 ? "+" : ""}{fmtCurrency(delta, { compact: false })} vs current · {savings > 0 ? `${fmtCurrency(savings, { compact: false })} below request` : savings < 0 ? `${fmtCurrency(-savings, { compact: false })} above request` : "at request"}
            </div>

            {tab === "modify" ? (
              <div className="mt-3 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-2 text-[11px] text-zinc-300">
                Edit values in <span className="text-fuchsia-300 font-semibold">Modify Budget</span> to change this figure.
              </div>
            ) : (
              <Button
                onClick={() => setTab("modify")}
                variant="outline"
                className="w-full mt-3 h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2"
                data-testid="btn-modify-budget"
              >
                <Edit3 className="w-3.5 h-3.5" /> Modify phase-wise breakdown
              </Button>
            )}

            <div className="mt-4 space-y-1.5 text-xs">
              <Row label={`${isRndReview ? "R&D" : "TPM"} requested`} value={fmtCurrency(requestedBudget, { compact: false })} />
              <Row label="AI recommended" value={fmtCurrency(recommended, { compact: false })} valueColor="text-fuchsia-300" />
              <Row label="Previous approved" value={fmtCurrency(currentBudget, { compact: false })} />
              <Row label="Buffer" value={`${review.bufferPct}%`} />
              <Row label="Recovery" value={review.recoveryType} />
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Return to</div>
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full mb-3" data-testid="return-target-toggle">
                {["TPM", "R&D"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setReturnTarget(r)}
                    data-testid={`return-target-${r.replace(/&/g, "and")}`}
                    className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium ${returnTarget === r ? "bg-fuchsia-500/15 text-fuchsia-200" : "text-zinc-400 hover:text-zinc-100"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Comment {`(required for reject / return)`}</div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={`Explain what to change so ${returnTarget} can revise and resubmit`}
                data-testid="input-comment"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-zinc-300">
              <span className="text-fuchsia-200 font-semibold">AI suggestion: </span>
              Moving ~40% of Opus 4.8 volume to Gemini 2.5 Pro could reduce AI cost by <span className="text-emerald-300 font-semibold">{fmtCurrency(requestedBudget - recommended, { compact: false })}</span> without measurable accuracy loss.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Panel = ({ title, subtitle, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="mb-3">
      <div className="font-display font-semibold text-[15px] text-white">{title}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const InfoField = ({ label, value }) => (
  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="text-sm text-white font-medium mt-0.5">{value}</div>
  </div>
);

const BreakdownCell = ({ icon: Icon, label, value, color }) => (
  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}22` }}>
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    </div>
    <div className="text-lg font-display font-semibold text-white tabular mt-1">{fmtCurrency(value, { compact: false })}</div>
  </div>
);

const CompareBox = ({ label, value, highlight }) => {
  const cls = highlight === "warning" ? "border-amber-500/30" : highlight === "magenta" ? "border-fuchsia-500/30 bg-fuchsia-500/[0.03]" : "border-white/5";
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className="font-display text-xl font-semibold text-white tabular mt-1">{fmtCurrency(value, { compact: false })}</div>
    </div>
  );
};

const Row = ({ label, value, valueColor = "text-white" }) => (
  <div className="flex justify-between">
    <span className="text-zinc-400">{label}</span>
    <span className={`font-semibold tabular ${valueColor}`}>{value}</span>
  </div>
);

export default BudgetReviewWorkspace;
