import { useParams, Link } from "react-router-dom";
import { PROJECTS } from "../data/mockData";
import { fmtCurrency, fmtPct, fmtDate, healthColor, utilColor, varianceColor } from "../lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import {
  ArrowLeft,
  Sparkles,
  Download,
  FileText,
  MessageSquare,
  Plus,
  History,
} from "lucide-react";
import { useApp } from "../context/AppContext";

const StatBlock = ({ label, value, hint, tone }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5">
    <div className="text-[10px] uppercase font-semibold tracking-widest text-zinc-500">{label}</div>
    <div className={`mt-2 font-display font-semibold text-2xl tabular ${tone || "text-white"}`}>{value}</div>
    {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
  </div>
);

const ProjectDetail = () => {
  const { id } = useParams();
  const p = PROJECTS.find((x) => x.id === id);
  const { setAiOpen } = useApp();

  if (!p) {
    return (
      <div className="p-6" data-testid="project-not-found">
        Project not found.
        <Link className="ml-2 text-fuchsia-400" to="/projects">Back</Link>
      </div>
    );
  }
  const c = healthColor(p.health);

  return (
    <div className="space-y-6" data-testid={`page-project-${p.id}`}>
      {/* Breadcrumb + header */}
      <div>
        <Link to="/projects" className="text-xs text-zinc-500 inline-flex items-center gap-1 hover:text-zinc-200" data-testid="breadcrumb-back">
          <ArrowLeft className="w-3.5 h-3.5" />
          Projects
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-zinc-500">{p.client} · PL {p.pl}</div>
            <h1 className="font-display font-semibold text-3xl tracking-tight text-white mt-1">{p.name}</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.text} ${c.bg} ${c.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {c.label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-zinc-200 font-medium">
                {p.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiOpen(true)}
              className="h-9 rounded-lg border-white/10 gap-2"
              data-testid="btn-ask-ai"
            >
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
              Ask AI about this project
            </Button>
            <Button size="sm" className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2" data-testid="btn-request-topup">
              <Plus className="w-3.5 h-3.5" />
              Request top-up
            </Button>
          </div>
        </div>
      </div>

      {/* KPI blocks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Approved" value={fmtCurrency(p.approvedBudget)} hint="Locked v1.1" />
        <StatBlock label="Actual" value={fmtCurrency(p.actualSpend)} hint={`Est. ${fmtCurrency(p.estimatedBudget)}`} />
        <StatBlock label="Variance" value={`${p.variance > 0 ? "+" : ""}${fmtCurrency(p.variance)}`} tone={varianceColor(p.variance)} hint="vs estimate" />
        <StatBlock label="Utilization" value={fmtPct(p.utilization)} tone={utilColor(p.utilization)} hint={`Forecast ${fmtCurrency(p.forecast)}`} />
      </div>

      {/* Cost breakdown */}
      <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5">
        <div className="font-display font-semibold text-[15px] text-white mb-4">Cost breakdown</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: "Infrastructure", v: p.infrastructureCost, c: "#7C3AED" },
            { l: "AI Models", v: p.aiModelCost, c: "#3B82F6" },
            { l: "Employee", v: p.employeeCost, c: "#10B981" },
            { l: "Purchase", v: p.purchaseCost, c: "#F59E0B" },
            { l: "Reimbursements", v: p.reimbursements, c: "#EC4899" },
            { l: "Dinner", v: p.dinnerExpenses, c: "#F97316" },
            { l: "Misc", v: p.miscExpenses, c: "#94A3B8" },
            { l: "Top-ups", v: p.topupsTotal, c: "#EF4444" },
          ].map((x) => (
            <div key={x.l} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
              <div className="w-1 h-8 rounded-full" style={{ background: x.c }} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{x.l}</div>
                <div className="text-sm font-semibold text-white tabular">{fmtCurrency(x.v)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="phases" className="w-full">
        <TabsList className="bg-[#12121A] border border-white/10 rounded-lg p-1 h-auto" data-testid="project-tabs">
          <TabsTrigger value="phases" data-testid="tab-phases" className="text-xs">Phases</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses" className="text-xs">Expenses</TabsTrigger>
          <TabsTrigger value="topups" data-testid="tab-topups" className="text-xs">Top-ups</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history" className="text-xs">Budget history</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit" className="text-xs">Audit log</TabsTrigger>
          <TabsTrigger value="comments" data-testid="tab-comments" className="text-xs">Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="phases" className="mt-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/5">
                  <th className="text-left py-2.5 px-5">Phase</th>
                  <th className="text-left py-2.5 px-2">Dates</th>
                  <th className="text-right py-2.5 px-2">Estimated</th>
                  <th className="text-right py-2.5 px-2">Actual</th>
                  <th className="text-right py-2.5 px-2">Variance</th>
                  <th className="text-left py-2.5 px-5">Health</th>
                </tr>
              </thead>
              <tbody>
                {p.phases.map((ph) => {
                  const variance = ph.estimated - ph.actual;
                  const hc = healthColor(ph.health);
                  return (
                    <tr key={ph.id} className="border-b border-white/5 last:border-0">
                      <td className="py-3 px-5 text-sm font-medium text-zinc-100">{ph.name}</td>
                      <td className="py-3 px-2 text-xs text-zinc-400 tabular">{ph.dates}</td>
                      <td className="py-3 px-2 text-right tabular text-sm text-zinc-100">{fmtCurrency(ph.estimated)}</td>
                      <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(ph.actual)}</td>
                      <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${varianceColor(variance)}`}>
                        {variance > 0 ? "+" : ""}{fmtCurrency(variance)}
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${hc.text} ${hc.bg} ${hc.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hc.dot}`} />
                          {hc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="text-sm font-semibold text-white">Expenses ({p.expenses.length})</div>
              <Button size="sm" className="h-8 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-1.5" data-testid="btn-add-expense">
                <Plus className="w-3.5 h-3.5" />
                Add expense
              </Button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/5">
                  <th className="text-left py-2.5 px-5">Date</th>
                  <th className="text-left py-2.5 px-2">Category</th>
                  <th className="text-left py-2.5 px-2">Vendor / Employee</th>
                  <th className="text-right py-2.5 px-2">Amount</th>
                  <th className="text-left py-2.5 px-2">Status</th>
                  <th className="text-left py-2.5 px-5">Type</th>
                </tr>
              </thead>
              <tbody>
                {p.expenses.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="py-3 px-5 text-xs text-zinc-400 tabular">{fmtDate(e.date)}</td>
                    <td className="py-3 px-2 text-sm text-zinc-100">{e.category}</td>
                    <td className="py-3 px-2 text-xs">
                      <div className="text-zinc-100 font-medium">{e.vendor}</div>
                      <div className="text-zinc-500">{e.employee}</div>
                    </td>
                    <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(e.amount, { compact: false })}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        e.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                        e.extra ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-white/5 text-zinc-400 border-white/10"
                      }`}>
                        {e.extra ? "Extra expense" : "Included"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="topups" className="mt-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5 space-y-3">
            {p.topupHistory.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5">
                <div>
                  <div className="text-sm font-semibold text-white">Top-up · {fmtCurrency(t.amount, { compact: false })}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{t.reason}</div>
                  <div className="text-[11px] text-zinc-500 mt-1 tabular">
                    Requested by {t.requester} · {fmtDate(t.date)} · Approver: {t.approver}
                  </div>
                </div>
                <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                  t.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5">
            <ol className="relative border-l border-white/10 ml-2">
              {p.budgetHistory.map((b) => (
                <li key={b.id} className="ml-4 pb-5 last:pb-0">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-fuchsia-500/100 border-2 border-white" />
                  <div className="text-sm font-semibold text-white">
                    {b.version} · {fmtCurrency(b.amount)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">{b.action} · approved by {b.approver}</div>
                  <div className="text-[11px] text-zinc-500 tabular mt-1">{fmtDate(b.date)}</div>
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5">
            <ol className="space-y-4">
              {p.auditLog.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <History className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{a.action}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{a.detail}</div>
                    <div className="text-[11px] text-zinc-500 tabular mt-1">{a.actor} · {fmtDate(a.ts)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5 space-y-4">
            {p.comments.map((cm) => (
              <div key={cm.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-pink-500/30 flex items-center justify-center text-[11px] font-semibold text-fuchsia-400">
                  {cm.author.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1">
                  <div className="text-xs">
                    <span className="font-semibold text-white">{cm.author}</span>
                    <span className="text-zinc-500 ml-2 tabular">{fmtDate(cm.ts)}</span>
                  </div>
                  <div className="text-sm text-zinc-200 mt-1 leading-relaxed">{cm.body}</div>
                </div>
              </div>
            ))}
            <div className="flex gap-2 items-center pt-2 border-t border-white/5">
              <input placeholder="Add a comment…" className="flex-1 h-10 px-3 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" data-testid="comment-input" />
              <Button size="sm" className="h-10 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2" data-testid="btn-post-comment">
                <MessageSquare className="w-3.5 h-3.5" />
                Post
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectDetail;
