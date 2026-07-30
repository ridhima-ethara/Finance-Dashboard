import { PROJECTS } from "../data/mockData";
import { fmtCurrency, fmtDate } from "../lib/format";
import { Link } from "react-router-dom";
import { ArrowUpRightSquare } from "lucide-react";

const TopUps = () => {
  const all = PROJECTS.flatMap((p) =>
    p.topupHistory.map((t) => ({ ...t, project: p.name, projectId: p.id }))
  ).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-6" data-testid="page-topups">
      <div>
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">Top-up requests</h1>
        <p className="text-sm text-zinc-500 mt-1">Every top-up across projects · version history preserved</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total top-up amount" value={fmtCurrency(all.reduce((s, t) => s + t.amount, 0), { compact: false })} />
        <Stat label="Pending approvals" value={String(all.filter((t) => t.status === "pending").length)} />
        <Stat label="Approved top-ups" value={String(all.filter((t) => t.status === "approved").length)} />
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/5">
              <th className="text-left py-3 px-5">Project</th>
              <th className="text-right py-3 px-2">Amount</th>
              <th className="text-left py-3 px-2">Reason</th>
              <th className="text-left py-3 px-2">Requester</th>
              <th className="text-left py-3 px-2">Approver</th>
              <th className="text-left py-3 px-2">Date</th>
              <th className="text-left py-3 px-5">Status</th>
            </tr>
          </thead>
          <tbody>
            {all.map((t) => (
              <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/5" data-testid={`topup-${t.id}`}>
                <td className="py-3 px-5">
                  <Link to={`/projects/${t.projectId}`} className="text-sm font-semibold text-white hover:text-fuchsia-400 inline-flex items-center gap-1">
                    <ArrowUpRightSquare className="w-3.5 h-3.5 text-fuchsia-500" />
                    {t.project}
                  </Link>
                </td>
                <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(t.amount, { compact: false })}</td>
                <td className="py-3 px-2 text-xs text-zinc-400 max-w-xs truncate">{t.reason}</td>
                <td className="py-3 px-2 text-sm text-zinc-200">{t.requester}</td>
                <td className="py-3 px-2 text-sm text-zinc-200">{t.approver}</td>
                <td className="py-3 px-2 text-xs text-zinc-500 tabular">{fmtDate(t.date)}</td>
                <td className="py-3 px-5">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    t.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  }`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-2 font-display font-semibold text-2xl tabular text-white">{value}</div>
  </div>
);

export default TopUps;
