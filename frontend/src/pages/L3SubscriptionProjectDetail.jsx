import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, CreditCard, FileCheck2, FolderKanban, Loader2, Users } from "lucide-react";
import { fmtCurrency } from "../lib/format";
import {
  cleanSubscriptionValue,
  getSubscriptionExpiryMeta,
  getSubscriptionProofs,
  L3_SUBSCRIPTION_SOURCE,
  normalizeSubscriptionProject,
  parseSubscriptionCsv,
  PhaseDetailsTable,
  subscriptionMoney,
} from "./L3Subscriptions";

const Kpi = ({ icon: Icon, label, value, sub, tone = "text-white" }) => (
  <div className="rounded-2xl border border-white/5 bg-[#12121A] p-4">
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500"><Icon className="h-3.5 w-3.5" />{label}</div>
    <div className={`mt-2 font-display text-2xl font-semibold tabular ${tone}`}>{value}</div>
    <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>
  </div>
);

const L3SubscriptionProjectDetail = () => {
  const { projectName: encodedProject } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const projectName = decodeURIComponent(encodedProject || "");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(L3_SUBSCRIPTION_SOURCE).then((response) => {
      if (!response.ok) throw new Error("The subscription source file could not be loaded.");
      return response.text();
    }).then((text) => setRows(parseSubscriptionCsv(text))).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  const projectRows = useMemo(() => rows.filter((row) => normalizeSubscriptionProject(row.Project) === projectName), [rows, projectName]);
  const phases = useMemo(() => {
    const map = new Map();
    projectRows.forEach((row) => {
      const phase = cleanSubscriptionValue(row.Phase, "Unassigned");
      if (!map.has(phase)) map.set(phase, []);
      map.get(phase).push(row);
    });
    const ordered = [...map.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
    const preferred = location.state?.phase;
    return preferred ? ordered.sort(([left]) => left === preferred ? -1 : 0) : ordered;
  }, [projectRows, location.state]);

  if (loading) return <div className="flex min-h-[420px] items-center justify-center text-sm text-zinc-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading project subscriptions…</div>;
  if (error) return <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 text-sm text-red-200">{error}</div>;

  const totalCost = projectRows.reduce((sum, row) => sum + subscriptionMoney(row["Amount in USD"]), 0);
  const paidInr = projectRows.reduce((sum, row) => sum + subscriptionMoney(row["Amount Paid"]), 0);
  const expiryAttention = projectRows.filter((row) => ["expired", "expiring"].includes(getSubscriptionExpiryMeta(row).key)).length;
  const completeProofs = projectRows.filter((row) => getSubscriptionProofs(row).length === 3).length;

  return <div className="space-y-5" data-testid="page-l3-subscription-project-detail">
    <button type="button" onClick={() => navigate("/l3-subscriptions")} className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Subscription Oversight</button>

    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-fuchsia-400"><FolderKanban className="h-3.5 w-3.5" />Project subscription details</div><h1 className="mt-1 font-display text-3xl font-semibold text-white">{projectName}</h1><p className="mt-1 text-sm text-zinc-400">Complete phase-wise allocation, costing, expiry, reimbursement, and documentary evidence.</p></div>
      <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-4 py-2 text-right"><div className="text-[9px] uppercase tracking-widest text-zinc-500">Total subscription allocation</div><div className="mt-1 text-lg font-semibold tabular text-fuchsia-300">{fmtCurrency(totalCost, { compact: false })}</div></div>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <Kpi icon={CreditCard} label="Allocations" value={projectRows.length} sub="subscription seats" />
      <Kpi icon={Users} label="Members" value={new Set(projectRows.map((row) => row.Email)).size} sub="unique allocated members" />
      <Kpi icon={FolderKanban} label="Phases" value={phases.length} sub="with subscription records" />
      <Kpi icon={CalendarClock} label="Expiry attention" value={expiryAttention} sub="expired or within 30 days" tone={expiryAttention ? "text-amber-300" : "text-emerald-300"} />
      <Kpi icon={FileCheck2} label="Proof complete" value={`${projectRows.length ? Math.round((completeProofs / projectRows.length) * 100) : 0}%`} sub={`₹${paidInr.toLocaleString("en-IN")} paid`} />
    </div>

    {projectRows.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-zinc-500">No subscription records were found for this project.</div> : <div className="space-y-4">
      {phases.map(([phaseName, phaseRows], index) => <details key={phaseName} open={index === 0} className="group overflow-hidden rounded-2xl border border-white/5 bg-[#12121A]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 [&::-webkit-details-marker]:hidden"><div><div className="text-sm font-semibold text-white">{phaseName}</div><div className="mt-0.5 text-[10px] text-zinc-500">{phaseRows.length} seats · {new Set(phaseRows.map((row) => row.Email)).size} members</div></div><div className="text-right"><div className="text-[9px] uppercase tracking-widest text-zinc-500">Phase cost</div><div className="mt-0.5 text-sm font-semibold tabular text-fuchsia-300">{fmtCurrency(phaseRows.reduce((sum, row) => sum + subscriptionMoney(row["Amount in USD"]), 0), { compact: false })}</div></div></summary>
        <PhaseDetailsTable phaseName={phaseName} rows={phaseRows} />
      </details>)}
    </div>}
  </div>;
};

export default L3SubscriptionProjectDetail;
