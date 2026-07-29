import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, CreditCard, ExternalLink, FileCheck2, FolderKanban, Loader2, Search, Users } from "lucide-react";
import { fmtCurrency } from "../lib/format";

export const L3_SUBSCRIPTION_SOURCE = "/data/l3-subscription-details.csv";
const selectCls = "h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-100 outline-none focus:ring-2 focus:ring-fuchsia-500/30";

export const parseSubscriptionCsv = (text) => {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = (rows.shift() || []).map((value) => value.trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()])))
    .filter((record) => record.Name || record.Email || record.Project);
};

export const subscriptionMoney = (value) => Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
export const cleanSubscriptionValue = (value, fallback = "—") => String(value || "").trim() || fallback;
export const normalizeSubscriptionProject = (value) => {
  const project = cleanSubscriptionValue(value, "Unassigned");
  const key = project.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key === "kensei" || key === "kensie") return "Kensei";
  if (key === "kaiju") return "Kaiju";
  return project;
};
const money = subscriptionMoney;
const clean = cleanSubscriptionValue;
const normalizeProject = normalizeSubscriptionProject;
const parseDate = (value) => {
  const source = String(value || "").trim();
  if (!source) return null;
  const parts = source.replace(/\//g, "-").split("-");
  if (parts.length !== 3) return null;
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = /^\d+$/.test(parts[1]) ? Number(parts[1]) - 1 : monthNames.indexOf(parts[1].slice(0, 3).toLowerCase());
  const date = new Date(Number(parts[2]), month, Number(parts[0]));
  return Number.isNaN(date.getTime()) ? null : date;
};
export const formatSubscriptionDate = (value) => parseDate(value)?.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) || "Not recorded";
export const getSubscriptionExpiryMeta = (row) => {
  const end = parseDate(row.Ended);
  if (!end) return { key: "missing", label: "Expiry missing", cls: "text-zinc-300 bg-white/5 border-white/10" };
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { key: "expired", label: `Expired ${Math.abs(days)}d ago`, cls: "text-red-300 bg-red-500/10 border-red-500/25" };
  if (days <= 30) return { key: "expiring", label: `${days}d remaining`, cls: "text-amber-300 bg-amber-500/10 border-amber-500/25" };
  return { key: "active", label: `${days}d remaining`, cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" };
};
export const getSubscriptionProofs = (row) => [
  ["Invoice", row.Invoice], ["Receipt", row.Receiept], ["Payment proof", row["Payment Screenshot"]],
].filter(([, value]) => value);
export const isSubscriptionUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());
const formatDate = formatSubscriptionDate;
const expiryMeta = getSubscriptionExpiryMeta;
const proofItems = getSubscriptionProofs;
const isUrl = isSubscriptionUrl;

const Stat = ({ icon: Icon, label, value, sub, tone = "text-white" }) => (
  <div className="rounded-2xl border border-white/5 bg-[#12121A] p-4">
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500"><Icon className="h-3.5 w-3.5" />{label}</div>
    <div className={`mt-2 font-display text-2xl font-semibold tabular ${tone}`}>{value}</div>
    <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>
  </div>
);

export const PhaseDetailsTable = ({ phaseName, rows, onClose }) => (
  <div className="border-t border-fuchsia-500/20 bg-fuchsia-500/[0.025]">
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div><div className="text-sm font-semibold text-white">{phaseName} details</div><div className="mt-0.5 text-[10px] text-zinc-500">Member allocations, expiry, verification, and supporting documents</div></div>
      {onClose && <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-zinc-300 hover:bg-white/5">Close details</button>}
    </div>
    <div className="overflow-x-auto border-t border-white/5">
      <table className="w-full min-w-[1180px] text-xs">
        <thead><tr className="text-[9px] uppercase tracking-widest text-zinc-500"><th className="px-4 py-2 text-left">Member</th><th className="px-3 py-2 text-left">Subscription</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-left">Coverage</th><th className="px-3 py-2 text-left">Expiry</th><th className="px-3 py-2 text-left">Verification</th><th className="px-4 py-2 text-left">Proofs &amp; documents</th></tr></thead>
        <tbody>{rows.map((row, index) => {
          const meta = expiryMeta(row);
          const proofs = proofItems(row);
          const verified = String(row["Reimbursement (Verified / Not Verified)"]).toLowerCase() === "verified";
          return <tr key={`${row.Email}-${row.Date}-${index}`} className="border-t border-white/[0.04] align-top">
            <td className="px-4 py-3"><div className="font-medium text-zinc-100">{clean(row.Name)}</div><div className="mt-0.5 text-[10px] text-zinc-500">{clean(row["Employee Code"])} · {clean(row.Email)}</div></td>
            <td className="px-3 py-3 text-zinc-300">{clean(row["Subscription Type"], clean(row["Subscription Tracker"]))}</td>
            <td className="px-3 py-3 text-right"><div className="font-semibold tabular text-white">{fmtCurrency(money(row["Amount in USD"]), { compact: false })}</div><div className="mt-0.5 text-[10px] tabular text-zinc-500">₹{money(row["Amount Paid"] || row["Amount in INR"]).toLocaleString("en-IN")}</div></td>
            <td className="px-3 py-3 text-zinc-400"><div>{formatDate(row.Started)}</div><div className="mt-0.5 text-[10px] text-zinc-600">to {formatDate(row.Ended)}</div></td>
            <td className="px-3 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span></td>
            <td className="px-3 py-3"><div className={`flex items-center gap-1.5 ${verified ? "text-emerald-300" : "text-amber-300"}`}>{verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{clean(row["Reimbursement (Verified / Not Verified)"], "Not recorded")}</div><div className="mt-1 text-[10px] text-zinc-500">{clean(row["Reimbursment Status"], clean(row.Status))}</div></td>
            <td className="px-4 py-3"><div className="flex max-w-[330px] flex-wrap gap-1.5">{proofs.length ? proofs.map(([label, value]) => isUrl(value) ? <a key={label} href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/[0.07] px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-500/15">{label}<ExternalLink className="h-2.5 w-2.5" /></a> : <span key={label} title={value} className="inline-flex max-w-[145px] items-center gap-1 truncate rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-300"><FileCheck2 className="h-2.5 w-2.5 shrink-0" />{label}</span>) : <span className="text-[10px] text-zinc-600">No proof recorded</span>}</div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </div>
);

const L3Subscriptions = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState("all");
  const [phase, setPhase] = useState("all");
  const [expiry, setExpiry] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(L3_SUBSCRIPTION_SOURCE).then((response) => {
      if (!response.ok) throw new Error("The subscription source file could not be loaded.");
      return response.text();
    }).then((text) => setRows(parseSubscriptionCsv(text))).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  const projects = useMemo(() => [...new Set(rows.map((row) => normalizeProject(row.Project)))].sort(), [rows]);
  const phases = useMemo(() => [...new Set(rows.map((row) => clean(row.Phase, "Unassigned")))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [rows]);
  const filtered = useMemo(() => rows.filter((row) => {
    const q = query.trim().toLowerCase();
    return (project === "all" || normalizeProject(row.Project) === project)
      && (phase === "all" || clean(row.Phase, "Unassigned") === phase)
      && (expiry === "all" || expiryMeta(row).key === expiry)
      && (!q || `${row.Name} ${row.Email} ${row["Employee Code"]} ${row["Subscription Type"]}`.toLowerCase().includes(q));
  }), [rows, project, phase, expiry, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const projectName = normalizeProject(row.Project);
      const phaseName = clean(row.Phase, "Unassigned");
      if (!map.has(projectName)) map.set(projectName, new Map());
      const phaseMap = map.get(projectName);
      if (!phaseMap.has(phaseName)) phaseMap.set(phaseName, []);
      phaseMap.get(phaseName).push(row);
    });
    return [...map.entries()].map(([projectName, phaseMap]) => ({ projectName, phases: [...phaseMap.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })) }));
  }, [filtered]);

  const usd = filtered.reduce((sum, row) => sum + money(row["Amount in USD"]), 0);
  const paidInr = filtered.reduce((sum, row) => sum + money(row["Amount Paid"]), 0);
  const expiring = filtered.filter((row) => ["expired", "expiring"].includes(expiryMeta(row).key)).length;
  const documented = filtered.filter((row) => proofItems(row).length === 3).length;

  if (loading) return <div className="flex min-h-[420px] items-center justify-center text-sm text-zinc-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading subscription records…</div>;
  if (error) return <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 text-sm text-red-200">{error}</div>;

  return <div className="space-y-5" data-testid="page-l3-subscriptions">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-fuchsia-400"><CreditCard className="h-3.5 w-3.5" />L3 subscription oversight</div><h1 className="mt-1 font-display text-3xl font-semibold text-white">Project subscriptions</h1><p className="mt-1 text-sm text-zinc-400">Phase-wise costing, expiry tracking, reimbursement verification, and supporting proofs.</p></div>
      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-right"><div className="text-[10px] uppercase tracking-widest text-zinc-500">Source coverage</div><div className="mt-0.5 text-xs text-zinc-300">{rows.length} valid allocation records</div></div>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <Stat icon={CreditCard} label="Filtered allocations" value={filtered.length.toLocaleString()} sub={`${new Set(filtered.map((row) => row.Email)).size} unique members`} />
      <Stat icon={FolderKanban} label="Projects" value={new Set(filtered.map((row) => normalizeProject(row.Project))).size} sub={`${new Set(filtered.map((row) => clean(row.Phase, "Unassigned"))).size} phases`} />
      <Stat icon={Users} label="Subscription cost" value={fmtCurrency(usd, { compact: false })} sub="USD allocation value" tone="text-fuchsia-300" />
      <Stat icon={CalendarClock} label="Expiry attention" value={expiring} sub="expired or within 30 days" tone={expiring ? "text-amber-300" : "text-emerald-300"} />
      <Stat icon={FileCheck2} label="Proof complete" value={`${filtered.length ? Math.round((documented / filtered.length) * 100) : 0}%`} sub={`₹${paidInr.toLocaleString("en-IN")} payment recorded`} />
    </div>

    <div className="rounded-2xl border border-white/5 bg-[#12121A] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[250px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search member, email, employee code or subscription" className={`${selectCls} w-full pl-9`} /></div>
        <select value={project} onChange={(event) => setProject(event.target.value)} className={`${selectCls} min-w-[190px]`}><option value="all">All projects</option>{projects.map((name) => <option key={name}>{name}</option>)}</select>
        <select value={phase} onChange={(event) => setPhase(event.target.value)} className={`${selectCls} min-w-[145px]`}><option value="all">All phases</option>{phases.map((name) => <option key={name}>{name}</option>)}</select>
        <select value={expiry} onChange={(event) => setExpiry(event.target.value)} className={`${selectCls} min-w-[165px]`}><option value="all">All expiry states</option><option value="active">Active</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option><option value="missing">Expiry missing</option></select>
      </div>
    </div>

    {grouped.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-zinc-500">No subscription records match these filters.</div> : <div className="space-y-3">
      {grouped.map(({ projectName, phases: projectPhases }) => {
        const projectRows = projectPhases.flatMap(([, phaseRows]) => phaseRows);
        return <details key={projectName} open={project !== "all"} className="group overflow-hidden rounded-2xl border border-white/5 bg-[#12121A]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 hover:bg-white/[0.02] [&::-webkit-details-marker]:hidden"><div className="flex min-w-0 items-center gap-3"><div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-2"><FolderKanban className="h-4 w-4 text-fuchsia-300" /></div><div><div className="font-display text-[15px] font-semibold text-white">{projectName}</div><div className="mt-0.5 text-[11px] text-zinc-500">{projectPhases.length} phases · {projectRows.length} seats · {new Set(projectRows.map((row) => row.Email)).size} members</div></div></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><div className="text-[9px] uppercase tracking-widest text-zinc-500">Project cost</div><div className="text-sm font-semibold tabular text-fuchsia-300">{fmtCurrency(projectRows.reduce((sum, row) => sum + money(row["Amount in USD"]), 0), { compact: false })}</div></div><button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); navigate(`/l3-subscriptions/${encodeURIComponent(projectName)}`); }} className="whitespace-nowrap rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/[0.08] px-3 py-1.5 text-[10px] font-semibold text-fuchsia-200 hover:bg-fuchsia-500/15">View details</button><ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180" /></div></summary>
          <div className="border-t border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-xs">
                <thead><tr className="border-b border-white/5 text-[9px] uppercase tracking-widest text-zinc-500"><th className="px-4 py-2.5 text-left">Phase</th><th className="px-3 py-2.5 text-right">Seats</th><th className="px-3 py-2.5 text-right">Members</th><th className="px-3 py-2.5 text-right">Allocated cost</th><th className="px-3 py-2.5 text-center">Expiry attention</th><th className="px-3 py-2.5 text-center">Proof complete</th><th className="px-4 py-2.5 text-right">Action</th></tr></thead>
                <tbody>{projectPhases.map(([phaseName, phaseRows]) => {
                  const phaseCost = phaseRows.reduce((sum, row) => sum + money(row["Amount in USD"]), 0);
                  const attention = phaseRows.filter((row) => ["expired", "expiring"].includes(expiryMeta(row).key)).length;
                  const complete = phaseRows.filter((row) => proofItems(row).length === 3).length;
                  return <tr key={phaseName} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3"><div className="font-semibold text-zinc-100">{phaseName}</div><div className="mt-0.5 text-[10px] text-zinc-500">{[...new Set(phaseRows.map((row) => clean(row["Subscription Type"], clean(row["Subscription Tracker"], "Subscription"))))].join(", ")}</div></td>
                    <td className="px-3 py-3 text-right tabular text-zinc-300">{phaseRows.length}</td>
                    <td className="px-3 py-3 text-right tabular text-zinc-300">{new Set(phaseRows.map((row) => row.Email)).size}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular text-white">{fmtCurrency(phaseCost, { compact: false })}</td>
                    <td className="px-3 py-3 text-center"><span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${attention ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"}`}>{attention ? `${attention} need attention` : "Up to date"}</span></td>
                    <td className="px-3 py-3 text-center text-zinc-300 tabular">{complete}/{phaseRows.length}</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => navigate(`/l3-subscriptions/${encodeURIComponent(projectName)}`, { state: { phase: phaseName } })} className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/[0.08] px-3 py-1.5 text-[10px] font-semibold text-fuchsia-200 hover:bg-fuchsia-500/15">View details</button></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>
        </details>;
      })}
    </div>}
  </div>;
};

export default L3Subscriptions;
