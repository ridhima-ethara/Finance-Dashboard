import { APPROVALS } from "../data/mockData";
import { fmtCurrency, fmtDate } from "../lib/format";
import { Button } from "../components/ui/button";
import { Check, X, Clock } from "lucide-react";

const stageColor = (s) =>
  s.includes("CTO")
    ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
    : s.includes("COO")
    ? "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30"
    : "bg-white/5 text-zinc-200 border-white/10";

const Approvals = () => (
  <div className="space-y-6" data-testid="page-approvals">
    <div>
      <h1 className="font-display font-semibold text-3xl tracking-tight text-white">Approvals</h1>
      <p className="text-sm text-zinc-500 mt-1">Budget requests, top-ups &amp; modifications pending decision</p>
    </div>

    <div className="bg-[#12121A] rounded-2xl border border-white/10 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/5">
            <th className="text-left py-3 px-5">Project</th>
            <th className="text-left py-3 px-2">Type</th>
            <th className="text-left py-3 px-2">Requester</th>
            <th className="text-right py-3 px-2">Amount</th>
            <th className="text-left py-3 px-2">Stage</th>
            <th className="text-left py-3 px-2">Requested</th>
            <th className="text-right py-3 px-5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {APPROVALS.map((a) => (
            <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/5" data-testid={`approval-row-${a.id}`}>
              <td className="py-3 px-5 text-sm font-semibold text-white">{a.project}</td>
              <td className="py-3 px-2 text-sm text-zinc-200">{a.type}</td>
              <td className="py-3 px-2 text-sm text-zinc-200">{a.requester}</td>
              <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(a.amount, { compact: false })}</td>
              <td className="py-3 px-2">
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${stageColor(a.stage)}`}>
                  <Clock className="w-3 h-3" />
                  {a.stage}
                </span>
              </td>
              <td className="py-3 px-2 text-xs text-zinc-500 tabular">{fmtDate(a.ts)}</td>
              <td className="py-3 px-5 text-right space-x-2">
                <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1 border-white/10" data-testid={`btn-reject-${a.id}`}>
                  <X className="w-3.5 h-3.5" />
                  Reject
                </Button>
                <Button size="sm" className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 gap-1" data-testid={`btn-approve-${a.id}`}>
                  <Check className="w-3.5 h-3.5" />
                  Approve
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default Approvals;
