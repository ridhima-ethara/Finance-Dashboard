import { Link } from "react-router-dom";
import { useMemo } from "react";
import { KeyRound, FolderKanban, ShieldCheck, Users, ChevronRight } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";

const ItDashboard = () => {
  const { itProvisioningRequests, modelKeyRecords, projects } = useApp();

  const pending = useMemo(
    () => itProvisioningRequests.filter((request) => request.status === "pending-it"),
    [itProvisioningRequests]
  );
  const completed = useMemo(
    () => itProvisioningRequests.filter((request) => request.status === "completed"),
    [itProvisioningRequests]
  );

  return (
    <div className="space-y-6" data-testid="page-it-dashboard">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-cyan-300">
          <span className="w-6 h-px bg-cyan-400" />
          IT Portal · Access Provisioning
        </div>
        <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">Approved budget access queue</h1>
        <p className="text-sm text-zinc-400 mt-1">
          CFO-approved budgets land here so IT can add model keys and allocate them to project members.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Pending provisioning" value={String(pending.length)} icon={ShieldCheck} />
        <Stat label="Provisioned requests" value={String(completed.length)} icon={KeyRound} />
        <Stat label="Active keys" value={String(modelKeyRecords.filter((entry) => entry.status === "active").length)} icon={KeyRound} />
        <Stat label="Projects covered" value={String(new Set(itProvisioningRequests.map((entry) => entry.projectId)).size || projects.length)} icon={FolderKanban} />
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Pending IT actions</div>
            <div className="text-xs text-zinc-500 mt-0.5">Open a request in Model Keys to add the key values and assign them to members.</div>
          </div>
          <Link to="/keys" className="inline-flex items-center gap-1 text-xs text-fuchsia-300 hover:text-fuchsia-200 font-medium">
            Open Model Keys <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-zinc-500">
              No pending CFO-approved provisioning requests right now.
            </div>
          )}
          {pending.map((request) => (
            <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-white">{request.projectName}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {request.budgetType} · approved by {request.approvedBy} · {new Date(request.approvedAt || Date.now()).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
                <div className="text-sm font-semibold text-fuchsia-300 tabular">{fmtCurrency(request.approvedAmount, { compact: false })}</div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <Mini label="Models" value={String(request.requestedModels?.length || 0)} />
                <Mini label="Infra lines" value={String(request.requestedInfra?.length || 0)} />
                <Mini label="Members" value={String(request.members?.length || 0)} icon={Users} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, icon: Icon }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4">
    <div className="flex items-center justify-between">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-zinc-400" />
      </div>
    </div>
    <div className="mt-2 font-display font-semibold text-2xl tabular text-white">{value}</div>
  </div>
);

const Mini = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </div>
    <div className="mt-1 text-sm font-semibold text-white tabular">{value}</div>
  </div>
);

export default ItDashboard;
