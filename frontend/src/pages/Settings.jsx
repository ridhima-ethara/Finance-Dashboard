import { TEAM } from "../data/mockData";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";

const Settings = () => (
  <div className="space-y-6" data-testid="page-settings">
    <div>
      <h1 className="font-display font-semibold text-3xl tracking-tight text-white">Settings</h1>
      <p className="text-sm text-zinc-500 mt-1">Workspace preferences, roles &amp; workflow configuration</p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5">
        <div className="font-display font-semibold text-[15px] text-white">Currency</div>
        <p className="text-xs text-zinc-500 mt-1">Primary display currency across the portfolio</p>
        <div className="mt-4 inline-flex rounded-lg border border-white/10 p-1">
          <button className="px-3 py-1.5 rounded-md bg-fuchsia-500 text-white text-xs font-medium" data-testid="cur-usd">USD $</button>
          <button className="px-3 py-1.5 rounded-md text-zinc-500 text-xs font-medium" data-testid="cur-inr">INR ₹</button>
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5">
        <div className="font-display font-semibold text-[15px] text-white">Notifications</div>
        <div className="mt-4 space-y-3">
          {[
            "Budget crosses 80%",
            "Budget exceeded",
            "Top-up requests",
            "Reimbursement filed",
            "Infra cost spike >20%",
            "AI model cost spike",
          ].map((l) => (
            <div key={l} className="flex items-center justify-between">
              <div className="text-sm text-zinc-200">{l}</div>
              <Switch defaultChecked data-testid={`toggle-${l.slice(0, 6).replace(/\s+/g, "-").toLowerCase()}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5 lg:col-span-2">
        <div className="font-display font-semibold text-[15px] text-white">Role management</div>
        <p className="text-xs text-zinc-500 mt-1">Team members and their assigned roles</p>
        <div className="mt-4 divide-y divide-white/5">
          {TEAM.map((m) => (
            <div key={m.id} className="py-3 flex items-center justify-between" data-testid={`team-${m.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-pink-500/30 flex items-center justify-center text-[11px] font-semibold text-fuchsia-400">
                  {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{m.name}</div>
                  <div className="text-xs text-zinc-500">{m.email}</div>
                </div>
              </div>
              <div className="text-xs font-medium text-zinc-200 px-2.5 py-1 rounded-full bg-white/10">
                {m.role}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5 lg:col-span-2">
        <div className="font-display font-semibold text-[15px] text-white">Exports</div>
        <p className="text-xs text-zinc-500 mt-1">Download portfolio snapshots</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-lg border-white/10" data-testid="export-pdf">Export PDF</Button>
          <Button variant="outline" className="rounded-lg border-white/10" data-testid="export-excel">Export Excel</Button>
          <Button variant="outline" className="rounded-lg border-white/10" data-testid="export-csv">Export CSV</Button>
        </div>
      </div>
    </div>
  </div>
);

export default Settings;
