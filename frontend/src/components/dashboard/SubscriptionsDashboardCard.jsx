import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, ArrowRight, Clock3, PackageCheck } from "lucide-react";
import { useApp } from "../../context/AppContext";

const sameUser = (requester, user) =>
  String(requester?.email || "").toLowerCase() === String(user?.email || "").toLowerCase() ||
  (requester?.name && requester.name === user?.name);

// Compact, role-aware subscription summary rendered on each dashboard so requests
// and approvals surface where the L1 requester and the L2/L3 approvers work.
const SubscriptionsDashboardCard = () => {
  const { subscriptionRequests, user, role } = useApp();
  const navigate = useNavigate();

  const { headline, stats } = useMemo(() => {
    const list = subscriptionRequests || [];
    const mine = list.filter((request) => sameUser(request.requester, user));
    if (role === "CTO") {
      return { headline: { count: list.filter((r) => r.status === "cto-review").length, label: "awaiting your technical review" }, stats: [
        { label: "In CFO review", value: list.filter((r) => r.status === "cfo-review").length },
        { label: "Active", value: list.filter((r) => r.status === "active").length },
      ] };
    }
    if (role === "CFO") {
      return { headline: { count: list.filter((r) => r.status === "cfo-review").length, label: "awaiting your financial approval" }, stats: [
        { label: "In CTO review", value: list.filter((r) => r.status === "cto-review").length },
        { label: "Active", value: list.filter((r) => r.status === "active").length },
      ] };
    }
    return { headline: { count: mine.filter((r) => ["cto-review", "cfo-review"].includes(r.status)).length, label: "of your requests in approval" }, stats: [
      { label: "Drafts", value: mine.filter((r) => r.status === "draft").length },
      { label: "Fulfilment pending", value: mine.filter((r) => r.status === "fulfilment-pending").length, icon: PackageCheck },
      { label: "Active", value: mine.filter((r) => r.status === "active").length },
    ] };
  }, [subscriptionRequests, user, role]);

  const isApprover = role === "CTO" || role === "CFO";

  return (
    <div className="rounded-2xl border border-white/5 bg-[#12121A] p-4" data-testid="dashboard-subscriptions-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-2"><CreditCard className="h-4 w-4 text-fuchsia-300" /></div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold tabular text-white">{headline.count}</span>
              <span className="text-xs text-zinc-400">{headline.label}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-zinc-500">
              {stats.map((stat) => (
                <span key={stat.label} className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3 opacity-60" />{stat.label}: <b className="text-zinc-300">{stat.value}</b></span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate("/subscriptions", { state: { tab: "requests" } })} className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/[0.08] px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/15" data-testid="dashboard-subscriptions-open">
            {isApprover ? "Review requests" : "Subscription requests"}<ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => navigate("/subscriptions", { state: { tab: "tracker" } })} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5">Tracker</button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionsDashboardCard;
