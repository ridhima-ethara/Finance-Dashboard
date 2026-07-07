import { useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BUDGET_REVIEWS, CTO_AUDIT, getPhaseTasks } from "../../data/mockTpm";
import { PROJECTS } from "../../data/mockProjects";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  ArrowLeft,
  Check,
  X,
  Send,
  MessageSquare,
  Sparkles,
  User,
  Building2,
  Calendar,
  ClipboardCheck,
  Cpu,
  Server,
  Layers,
  ListChecks,
  History,
  Save,
  Edit3,
  FileText,
} from "lucide-react";

const BudgetReviewWorkspace = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const review = useMemo(() => BUDGET_REVIEWS.find((r) => r.id === id) || BUDGET_REVIEWS[0], [id]);
  const project = useMemo(() => PROJECTS.find((p) => p.id === review.projectId), [review]);

  const [tab, setTab] = useState("overview");
  const [modifyMode, setModifyMode] = useState(false);
  const [amount, setAmount] = useState(review.recommendedBudget);
  const [comment, setComment] = useState("");

  if (!review || !project) {
    return (
      <div className="text-sm text-zinc-400">
        Review not found.{" "}
        <button onClick={() => nav(-1)} className="text-fuchsia-300 underline">
          Go back
        </button>
      </div>
    );
  }

  const requestedBudget = review.requestedBudget;
  const currentBudget = review.currentBudget;
  const recommended = review.recommendedBudget;
  const delta = amount - currentBudget;
  const savings = requestedBudget - amount;

  const approveAndForward = () => {
    toast.success("Budget approved and forwarded to CFO", {
      description: `${review.projectName} · ${fmtCurrency(amount, { compact: false })} · ${savings > 0 ? `${fmtCurrency(savings, { compact: false })} saved vs request` : "at requested amount"}`,
    });
    nav("/budget-reviews");
  };
  const rejectBudget = () => {
    toast.error("Budget rejected", {
      description: `${review.projectName} · TPM notified · comment: "${comment || "No comment provided"}"`,
    });
    nav("/budget-reviews");
  };
  const saveDraft = () => {
    toast("Draft saved", { description: "Your modifications will be preserved when you return" });
  };

  const phases = project.phases;
  const tasks = getPhaseTasks(project.id, "p2");

  return (
    <div className="space-y-6" data-testid="page-budget-review-workspace">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link to="/budget-reviews" className="hover:text-zinc-300 inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Budget reviews
            </Link>
            <span>/</span>
            <span>Workspace</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ClipboardCheck className="w-3 h-3" />
            {review.type} · {review.urgency} urgency
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">{review.projectName}</h1>
          <p className="text-sm text-zinc-400 mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> TPM: {review.tpm}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {review.client}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {review.timeline}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2" onClick={saveDraft} data-testid="btn-save-draft">
            <Save className="w-3.5 h-3.5" /> Save draft
          </Button>
          <Button variant="outline" className="h-9 rounded-lg border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 gap-2" onClick={rejectBudget} data-testid="btn-reject">
            <X className="w-3.5 h-3.5" /> Reject
          </Button>
          <Button className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]" onClick={approveAndForward} data-testid="btn-approve-forward">
            <Send className="w-3.5 h-3.5" />
            Approve &amp; Forward to CFO
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/5 overflow-x-auto">
        {[
          { id: "overview", label: "Overview" },
          { id: "phases", label: "Phase-wise" },
          { id: "tasks", label: "Task-wise" },
          { id: "resources", label: "Model / Infra / Subs" },
          { id: "compare", label: "Comparison" },
          { id: "audit", label: "Audit" },
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

      {/* Main content by tab */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left/main pane */}
        <div className="lg:col-span-2 space-y-4">
          {tab === "overview" && (
            <>
              <Panel testid="overview-project" title="Project overview">
                <div className="grid grid-cols-2 gap-3">
                  <InfoField label="Client" value={review.client} />
                  <InfoField label="Recovery type" value={review.recoveryType} />
                  <InfoField label="TPM" value={review.tpm} />
                  <InfoField label="Timeline" value={review.timeline} />
                  <InfoField label="Tasks" value={String(review.tasks)} />
                  <InfoField label="Phases" value={String(review.phases)} />
                </div>
              </Panel>
              <Panel testid="overview-justification" title="Justification from TPM">
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
            </>
          )}

          {tab === "phases" && (
            <Panel testid="phases-table" title="Phase-wise budget" subtitle="Estimated vs Actual per phase">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                      <th className="text-left py-2 px-3">Phase</th>
                      <th className="text-left py-2 px-3">Dates</th>
                      <th className="text-right py-2 px-3">Estimated</th>
                      <th className="text-right py-2 px-3">Actual</th>
                      <th className="text-right py-2 px-3">Variance</th>
                      <th className="text-left py-2 px-3">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phases.map((p) => {
                      const variance = p.estimated - p.actual;
                      return (
                        <tr key={p.id} data-testid={`phase-${p.id}`} className="border-b border-white/5">
                          <td className="py-3 px-3 font-medium text-white">{p.name}</td>
                          <td className="py-3 px-3 text-xs text-zinc-400">{p.dates}</td>
                          <td className="py-3 px-3 text-right text-zinc-200 tabular">{fmtCurrency(p.estimated, { compact: false })}</td>
                          <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(p.actual, { compact: false })}</td>
                          <td className="py-3 px-3 text-right tabular">
                            <span className={variance >= 0 ? "text-emerald-300" : "text-red-300"}>
                              {variance >= 0 ? "+" : ""}
                              {fmtCurrency(variance, { compact: false })}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                p.health === "healthy"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : p.health === "watch"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-red-500/15 text-red-300"
                              }`}
                            >
                              {p.health}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {tab === "tasks" && (
            <Panel testid="tasks-table" title="Task-wise costing" subtitle={`Phase 2 · Model tuning (${tasks.length} tasks)`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                      <th className="text-left py-2 px-3">Task</th>
                      <th className="text-left py-2 px-3">Owner</th>
                      <th className="text-left py-2 px-3">Model</th>
                      <th className="text-right py-2 px-3">Est.</th>
                      <th className="text-right py-2 px-3">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id} className="border-b border-white/5">
                        <td className="py-3 px-3 font-medium text-white">{t.name}</td>
                        <td className="py-3 px-3 text-xs text-zinc-300">{t.owner}</td>
                        <td className="py-3 px-3 text-xs text-fuchsia-300">{t.model}</td>
                        <td className="py-3 px-3 text-right text-zinc-200 tabular">{fmtCurrency(t.estCost, { compact: false })}</td>
                        <td className="py-3 px-3 text-right text-white font-semibold tabular">
                          {t.actualCost > 0 ? fmtCurrency(t.actualCost, { compact: false }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {tab === "resources" && (
            <>
              <Panel testid="resources-model" title="AI model allocation">
                <div className="space-y-2">
                  {[
                    { name: "Opus 4.8", value: Math.round(review.aiCost * 0.6), share: 60 },
                    { name: "Gemini 2.5 Pro", value: Math.round(review.aiCost * 0.25), share: 25 },
                    { name: "GPT-4o", value: Math.round(review.aiCost * 0.15), share: 15 },
                  ].map((m) => (
                    <ResourceRow key={m.name} name={m.name} value={m.value} share={m.share} color="#E619B8" />
                  ))}
                </div>
              </Panel>
              <Panel testid="resources-infra" title="Infrastructure allocation">
                <div className="space-y-2">
                  {[
                    { name: "AWS EC2 · g5.4xlarge", value: Math.round(review.infraCost * 0.62), share: 62 },
                    { name: "AWS S3", value: Math.round(review.infraCost * 0.09), share: 9 },
                    { name: "AWS RDS", value: Math.round(review.infraCost * 0.18), share: 18 },
                    { name: "AWS CloudWatch", value: Math.round(review.infraCost * 0.11), share: 11 },
                  ].map((i) => (
                    <ResourceRow key={i.name} name={i.name} value={i.value} share={i.share} color="#3B82F6" />
                  ))}
                </div>
              </Panel>
              <Panel testid="resources-subs" title="Subscription allocation">
                <div className="space-y-2">
                  {[
                    { name: "Claude Max (8 seats)", value: Math.round(review.subsCost * 0.55), share: 55 },
                    { name: "Cursor Pro (6 seats)", value: Math.round(review.subsCost * 0.25), share: 25 },
                    { name: "GitHub Copilot (9 seats)", value: Math.round(review.subsCost * 0.20), share: 20 },
                  ].map((s) => (
                    <ResourceRow key={s.name} name={s.name} value={s.value} share={s.share} color="#10B981" />
                  ))}
                </div>
              </Panel>
            </>
          )}

          {tab === "compare" && (
            <Panel testid="compare" title="Estimated cost vs business requirement" subtitle="Previous version vs current request">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <CompareBox label="Previous approved" value={currentBudget} />
                <CompareBox label="TPM requested" value={requestedBudget} highlight="warning" />
                <CompareBox label="AI recommended" value={recommended} highlight="magenta" />
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-300 leading-relaxed">
                <span className="text-fuchsia-200 font-semibold">Difference: </span>
                Requested budget is <span className="text-white font-semibold tabular">{fmtCurrency(requestedBudget - currentBudget, { compact: false })}</span>{" "}
                above the previously approved amount ({fmtPct(Math.round(((requestedBudget - currentBudget) / currentBudget) * 100))} increase).
                AI recommends approving <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(recommended - currentBudget, { compact: false })}</span> increase instead —
                a saving of <span className="text-emerald-300 font-semibold tabular">{fmtCurrency(requestedBudget - recommended, { compact: false })}</span> based on optimized model routing.
              </div>
            </Panel>
          )}

          {tab === "audit" && (
            <Panel testid="audit-log" title="CTO modification audit trail" subtitle="All changes are recorded permanently">
              <div className="space-y-2">
                {CTO_AUDIT.map((a) => (
                  <div key={a.id} data-testid={`audit-${a.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30 flex-shrink-0">
                      <Edit3 className="w-3.5 h-3.5 text-fuchsia-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{a.action}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{a.detail}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-zinc-300">{a.who}</div>
                      <div className="text-[11px] text-zinc-500 tabular">
                        {new Date(a.when).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* Sidebar: Decision panel */}
        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.03] p-5 sticky top-4" data-testid="decision-panel">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-2">Approval amount</div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold text-white tabular">{fmtCurrency(amount, { compact: false })}</span>
              {modifyMode && (
                <button onClick={() => setModifyMode(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
                  cancel edit
                </button>
              )}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 tabular">
              {delta >= 0 ? "+" : ""}{fmtCurrency(delta, { compact: false })} vs current · {savings > 0 ? `${fmtCurrency(savings, { compact: false })} below request` : "at request"}
            </div>

            {modifyMode ? (
              <div className="mt-3">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  data-testid="input-modified-amount"
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => setAmount(currentBudget)} className="text-[11px] text-zinc-500 hover:text-zinc-200">
                    Reset to current
                  </button>
                  <span className="text-zinc-700">·</span>
                  <button onClick={() => setAmount(recommended)} className="text-[11px] text-fuchsia-300 hover:text-fuchsia-200">
                    Use AI recommendation
                  </button>
                  <span className="text-zinc-700">·</span>
                  <button onClick={() => setAmount(requestedBudget)} className="text-[11px] text-zinc-500 hover:text-zinc-200">
                    As requested
                  </button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setModifyMode(true)}
                variant="outline"
                className="w-full mt-3 h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2"
                data-testid="btn-modify-budget"
              >
                <Edit3 className="w-3.5 h-3.5" /> Modify budget
              </Button>
            )}

            <div className="mt-4 space-y-1.5 text-xs">
              <Row label="TPM requested" value={fmtCurrency(requestedBudget, { compact: false })} />
              <Row label="AI recommended" value={fmtCurrency(recommended, { compact: false })} valueColor="text-fuchsia-300" />
              <Row label="Previous approved" value={fmtCurrency(currentBudget, { compact: false })} />
              <Row label="Buffer" value={`${review.bufferPct}%`} />
              <Row label="Recovery" value={review.recoveryType} />
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Add comment</div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Explain your decision (optional)"
                data-testid="input-comment"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-zinc-300">
              <span className="text-fuchsia-200 font-semibold">AI suggestion: </span>
              Moving ~40% of Opus 4.8 classification volume to Gemini 2.5 Pro could reduce AI cost by <span className="text-emerald-300 font-semibold">{fmtCurrency(requestedBudget - recommended, { compact: false })}</span> without measurable accuracy loss.
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

const ResourceRow = ({ name, value, share, color }) => (
  <div className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
    <span className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: color }} />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-white truncate">{name}</div>
      <div className="w-full h-1 rounded-full bg-white/[0.05] overflow-hidden mt-1">
        <div className="h-full" style={{ width: `${share}%`, background: color }} />
      </div>
    </div>
    <div className="text-right">
      <div className="text-sm font-semibold text-white tabular">{fmtCurrency(value, { compact: false })}</div>
      <div className="text-[10px] text-zinc-500 tabular">{share}%</div>
    </div>
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
