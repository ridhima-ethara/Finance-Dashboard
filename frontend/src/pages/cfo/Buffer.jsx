import { useState } from "react";
import { BUFFER } from "../../data/mockCfo";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  ShieldCheck,
  Lock,
  Plus,
  Minus,
  Send,
  RotateCcw,
  AlertTriangle,
  History,
  Wallet,
  TrendingUp,
} from "lucide-react";

const Buffer = () => {
  const [total, setTotal] = useState(BUFFER.total);
  const [available, setAvailable] = useState(BUFFER.available);
  const [amt, setAmt] = useState("");
  const [selectedProject, setSelectedProject] = useState(BUFFER.perProject[0]?.id || "");

  const consumed = total - available;
  const pct = total ? Math.round((consumed / total) * 100) : 0;

  const increase = () => {
    const v = Number(amt);
    if (!v || v <= 0) { toast.error("Enter a valid amount"); return; }
    setTotal((t) => t + v);
    setAvailable((a) => a + v);
    setAmt("");
    toast.success("Buffer pool increased", { description: `+${fmtCurrency(v, { compact: false })} · new total ${fmtCurrency(total + v)}` });
  };
  const reduce = () => {
    const v = Number(amt);
    if (!v || v <= 0 || v > available) { toast.error("Amount must be ≤ available buffer"); return; }
    setTotal((t) => t - v);
    setAvailable((a) => a - v);
    setAmt("");
    toast.success("Buffer pool reduced", { description: `−${fmtCurrency(v, { compact: false })}` });
  };
  const allocate = () => {
    const v = Number(amt);
    if (!v || v <= 0 || v > available) { toast.error("Amount must be ≤ available"); return; }
    setAvailable((a) => a - v);
    setAmt("");
    const proj = BUFFER.perProject.find((p) => p.id === selectedProject);
    toast.success("Buffer allocated to project (hidden)", {
      description: `${proj?.name || "Project"} · +${fmtCurrency(v, { compact: false })} · not visible to TPM/CTO`,
    });
  };
  const release = () => {
    const v = Number(amt);
    if (!v || v <= 0) { toast.error("Enter valid amount"); return; }
    setAvailable((a) => a + v);
    setAmt("");
    toast.success("Buffer released back to pool", { description: `+${fmtCurrency(v, { compact: false })} freed` });
  };

  return (
    <div className="space-y-6" data-testid="page-buffer">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
          <ShieldCheck className="w-3 h-3" />
          CFO Portal · Confidential
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white flex items-center gap-2">
          Contingency buffer <Lock className="w-5 h-5 text-fuchsia-300" />
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Hidden safety cushion. Not visible to TPM, PL, or CTO. Used for over-runs and emergency top-ups.
        </p>
      </div>

      {/* Buffer overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-fuchsia-500/20 via-fuchsia-500/[0.05] to-transparent rounded-2xl border border-fuchsia-500/25 p-5" data-testid="buffer-overview">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-2">
            <Wallet className="w-3 h-3" /> Total pool
          </div>
          <div className="font-display text-4xl font-semibold text-white tabular">{fmtCurrency(total)}</div>
          <div className="mt-4 h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[11px]">
            <span className="text-zinc-400">Consumed <span className="text-white font-semibold tabular">{fmtCurrency(consumed)}</span></span>
            <span className="text-zinc-400">Available <span className="text-emerald-300 font-semibold tabular">{fmtCurrency(available)}</span></span>
          </div>
        </div>

        <Stat label="Utilization" value={fmtPct(pct)} sub={`${fmtCurrency(consumed)} used`} icon={TrendingUp} tone={pct > 75 ? "warning" : "positive"} testid="buffer-util" />
        <Stat label="Policy" value={`${BUFFER.policyPct}%`} sub="Auto-reserved per project" icon={ShieldCheck} testid="buffer-policy" />
      </div>

      {/* Alerts */}
      {BUFFER.alerts.length > 0 && (
        <div className="space-y-2" data-testid="buffer-alerts">
          {BUFFER.alerts.map((a) => (
            <div
              key={a.id}
              data-testid={`alert-${a.id}`}
              className={`rounded-xl border p-3 flex items-center gap-3 ${
                a.severity === "critical" ? "border-red-500/30 bg-red-500/[0.05]" : "border-amber-500/30 bg-amber-500/[0.05]"
              }`}
            >
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.severity === "critical" ? "text-red-300" : "text-amber-300"}`} />
              <div className="text-sm text-zinc-100">{a.message}</div>
              <span className={`ml-auto text-[10px] uppercase tracking-widest font-semibold ${a.severity === "critical" ? "text-red-300" : "text-amber-300"}`}>
                {a.severity}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="buffer-actions">
        <div className="font-display font-semibold text-[15px] text-white mb-3">Buffer actions</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Amount</div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                placeholder="0"
                data-testid="buffer-amt"
                className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Project (for allocate/release)</div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              data-testid="buffer-project"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            >
              {BUFFER.perProject.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={increase} className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-2" data-testid="btn-increase">
            <Plus className="w-3.5 h-3.5" /> Increase pool
          </Button>
          <Button onClick={reduce} variant="outline" className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2" data-testid="btn-reduce">
            <Minus className="w-3.5 h-3.5" /> Reduce pool
          </Button>
          <Button onClick={allocate} className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]" data-testid="btn-allocate">
            <Send className="w-3.5 h-3.5" /> Allocate to project
          </Button>
          <Button onClick={release} variant="outline" className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 gap-2" data-testid="btn-release">
            <RotateCcw className="w-3.5 h-3.5" /> Release back
          </Button>
        </div>
      </div>

      {/* Projects using buffer */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="buffer-projects">
        <div className="font-display font-semibold text-[15px] text-white mb-3">Projects using buffer</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Project</th>
                <th className="text-right py-2 px-3">Approved</th>
                <th className="text-right py-2 px-3">Allocated</th>
                <th className="text-right py-2 px-3">Consumed</th>
                <th className="text-right py-2 px-3">Available</th>
                <th className="text-left py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {BUFFER.perProject.map((p) => (
                <tr key={p.id} data-testid={`buffer-project-${p.id}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="py-3 px-3 text-white font-medium">{p.name}</td>
                  <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtCurrency(p.approved)}</td>
                  <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(p.allocated, { compact: false })}</td>
                  <td className="py-3 px-3 text-right text-fuchsia-300 tabular">{fmtCurrency(p.consumed, { compact: false })}</td>
                  <td className="py-3 px-3 text-right text-emerald-300 tabular">{fmtCurrency(p.allocated - p.consumed, { compact: false })}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      p.status === "critical" ? "bg-red-500/15 text-red-300" : p.status === "using" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation history */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="buffer-history">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-fuchsia-300" />
          <div className="font-display font-semibold text-[15px] text-white">Buffer allocation history</div>
        </div>
        <div className="space-y-2">
          {BUFFER.history.map((h) => (
            <div key={h.id} data-testid={`history-${h.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                h.action === "Allocated" ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30" : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              }`}>
                {h.action}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{h.project}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{h.reason}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white tabular">
                  {h.action === "Allocated" ? "−" : "+"}{fmtCurrency(h.amount, { compact: false })}
                </div>
                <div className="text-[11px] text-zinc-500 tabular">{h.date} · {h.by}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, sub, icon: Icon, tone = "neutral", testid }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${tones[tone]}`} />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display font-semibold text-3xl tabular ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-zinc-500 tabular">{sub}</div>}
    </div>
  );
};

export default Buffer;
