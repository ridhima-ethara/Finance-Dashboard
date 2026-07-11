import { useState } from "react";
import { USERS } from "../data/mockUsers";
import { useApp } from "../context/AppContext";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  Settings as SettingsIcon,
  Users,
  Shield,
  Bell,
  Plus,
  Save,
  Trash2,
  User as UserIcon,
  Mail,
  Building,
  Lock,
} from "lucide-react";

const ROLE_OPTIONS = ["CTO", "CFO", "TPM", "R&D", "PL", "IT"];

const Settings = () => {
  const { user } = useApp();
  const [users, setUsers] = useState(() =>
    USERS.map((u) => ({ ...u })).concat([
      { id: "u5", name: "Nikhil Rao", role: "PL", title: "Chief Operating Officer", email: "coo@ethara.ai", password: "demo123", avatarUrl: "" },
    ])
  );
  const [alerts, setAlerts] = useState({
    email: true,
    slack: true,
    thresholds: [50, 75, 90, 100],
    frequency: "instant",
  });
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "PL", title: "" });

  const updateUser = (id, patch) => setUsers((us) => us.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  const removeUser = (id) => {
    setUsers((us) => us.filter((u) => u.id !== id));
    toast.success("User removed");
  };
  const saveRole = (id) => {
    const u = users.find((x) => x.id === id);
    toast.success("Role updated", { description: `${u.name} → ${u.role}` });
  };
  const addUser = () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast.error("Name and email required");
      return;
    }
    const id = `u-${Date.now().toString(36)}`;
    setUsers((us) => [...us, { ...newUser, id, password: "demo123", avatarUrl: "" }]);
    toast.success("User added", { description: `${newUser.name} · ${newUser.role}` });
    setNewUser({ name: "", email: "", role: "PL", title: "" });
  };

  return (
    <div className="space-y-6" data-testid="page-settings">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
          <SettingsIcon className="w-3 h-3" /> Settings
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Organization settings</h1>
        <p className="text-sm text-zinc-400 mt-1">Role management, alerts, security &amp; workspace preferences</p>
      </div>

      {/* Role Management */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="role-mgmt">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-fuchsia-300" />
            <div className="font-display font-semibold text-[15px] text-white">Role management</div>
          </div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
            Signed in as {user?.role || "—"}
          </div>
        </div>

        {/* Existing users table */}
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Name</th>
                <th className="text-left py-2 px-3">Email</th>
                <th className="text-left py-2 px-3">Title</th>
                <th className="text-left py-2 px-3">Role</th>
                <th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} data-testid={`user-${u.id}`} className="border-b border-white/5">
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={u.name}
                      onChange={(e) => updateUser(u.id, { name: e.target.value })}
                      data-testid={`user-name-${u.id}`}
                      className="w-full h-9 px-2 rounded-md bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="email"
                      value={u.email}
                      onChange={(e) => updateUser(u.id, { email: e.target.value })}
                      data-testid={`user-email-${u.id}`}
                      className="w-full h-9 px-2 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={u.title || ""}
                      onChange={(e) => updateUser(u.id, { title: e.target.value })}
                      data-testid={`user-title-${u.id}`}
                      className="w-full h-9 px-2 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      data-testid={`user-role-${u.id}`}
                      className="w-full h-9 px-2 rounded-md bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => saveRole(u.id)}
                        data-testid={`save-user-${u.id}`}
                        className="h-8 w-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/30 text-fuchsia-300 flex items-center justify-center"
                        title="Save"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeUser(u.id)}
                        data-testid={`remove-user-${u.id}`}
                        className="h-8 w-8 rounded-md hover:bg-red-500/15 text-zinc-500 hover:text-red-300 flex items-center justify-center"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add new user */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Add new user</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="relative">
              <UserIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Name"
                data-testid="new-user-name"
                className="w-full h-9 pl-9 pr-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="Email"
                data-testid="new-user-email"
                className="w-full h-9 pl-9 pr-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
            <div className="relative">
              <Building className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={newUser.title}
                onChange={(e) => setNewUser({ ...newUser, title: e.target.value })}
                placeholder="Title"
                data-testid="new-user-title"
                className="w-full h-9 pl-9 pr-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              data-testid="new-user-role"
              className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            >
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <Button
              onClick={addUser}
              className="h-9 rounded-md bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2"
              data-testid="btn-add-user"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="alerts-config">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-fuchsia-300" />
          <div className="font-display font-semibold text-[15px] text-white">Alerts &amp; notifications</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Toggle
            label="Email notifications"
            value={alerts.email}
            onChange={(v) => { setAlerts({ ...alerts, email: v }); toast(`Email alerts ${v ? "enabled" : "disabled"}`); }}
            testid="toggle-email"
          />
          <Toggle
            label="Slack notifications"
            value={alerts.slack}
            onChange={(v) => { setAlerts({ ...alerts, slack: v }); toast(`Slack alerts ${v ? "enabled" : "disabled"}`); }}
            testid="toggle-slack"
          />
        </div>
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Alert thresholds (% of budget)</div>
          <div className="flex items-center gap-2 flex-wrap">
            {alerts.thresholds.map((t) => (
              <span key={t} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-200 font-semibold tabular">
                {t}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="security">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-fuchsia-300" />
          <div className="font-display font-semibold text-[15px] text-white">Security</div>
        </div>
        <div className="space-y-2 text-xs text-zinc-300">
          <SecurityRow icon={Lock} label="Two-factor authentication" status="Enabled" />
          <SecurityRow icon={Shield} label="SSO with Google Workspace" status="Configured" />
          <SecurityRow icon={UserIcon} label="Session timeout" status="30 minutes" />
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ label, value, onChange, testid }) => (
  <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
    <span className="text-sm text-zinc-200">{label}</span>
    <button
      onClick={() => onChange(!value)}
      data-testid={testid}
      className={`w-10 h-5 rounded-full relative transition-colors ${value ? "bg-fuchsia-500" : "bg-white/10"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  </div>
);

const SecurityRow = ({ icon: Icon, label, status }) => (
  <div className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-fuchsia-300" />
      <span>{label}</span>
    </div>
    <span className="text-emerald-300 font-semibold">{status}</span>
  </div>
);

export default Settings;
