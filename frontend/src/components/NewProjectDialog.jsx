import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { TEAM, CLIENTS } from "../data/mockUsers";
import { FolderPlus, User, Building2, Calendar as CalIcon } from "lucide-react";

const NewProjectDialog = ({ open, onOpenChange }) => {
  const nav = useNavigate();
  const { addProject, user } = useApp();

  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    clientProjectName: "",
    internalName: "",
    client: CLIENTS[0] || "",
    startDate: today,
    estimatedEndDate: nextMonth,
    tpm: "",
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.clientProjectName.trim()) return toast.error("Enter the client project name");
    if (!form.internalName.trim()) return toast.error("Enter the internal project name");
    if (!form.tpm) return toast.error("Assign a TPM");
    if (!form.startDate || !form.estimatedEndDate) return toast.error("Set start and estimated end date");
    if (new Date(form.startDate) >= new Date(form.estimatedEndDate)) return toast.error("End date must be after start date");

    const proj = addProject({
      ...form,
      createdBy: user?.name || "CTO",
    });
    toast.success("Project created", {
      description: `${proj.name} · TPM ${proj.tpm} · ${proj.startDate} → ${proj.estimatedEndDate}`,
    });
    onOpenChange(false);
    // reset
    setForm({ clientProjectName: "", internalName: "", client: CLIENTS[0] || "", startDate: today, estimatedEndDate: nextMonth, tpm: "" });
    // navigate to new project detail
    setTimeout(() => nav(`/projects/${proj.id}`), 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0F0F16] border-white/10 text-zinc-100 max-w-lg" data-testid="dialog-new-project">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <FolderPlus className="w-3 h-3" /> CTO · Create project
          </div>
          <DialogTitle className="font-display text-xl text-white mt-1">New project</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Set up the engagement shell. Budget lines &amp; phases are added later by the assigned TPM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Client project name" hint="How the client refers to it">
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={form.clientProjectName}
                onChange={(e) => update("clientProjectName", e.target.value)}
                placeholder="e.g. Acme AI · Q3 Personalization"
                data-testid="input-client-project-name"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
          </Field>

          <Field label="Internal project name" hint="Codename used across dashboards">
            <input
              type="text"
              value={form.internalName}
              onChange={(e) => update("internalName", e.target.value)}
              placeholder="e.g. Nova, Falcon, Prism…"
              data-testid="input-internal-name"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
          </Field>

          <Field label="Client">
            <select
              value={form.client}
              onChange={(e) => update("client", e.target.value)}
              data-testid="input-client"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            >
              {CLIENTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <div className="relative">
                <CalIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                  data-testid="input-start-date"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 [color-scheme:dark]"
                />
              </div>
            </Field>
            <Field label="Estimated end date">
              <div className="relative">
                <CalIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={form.estimatedEndDate}
                  onChange={(e) => update("estimatedEndDate", e.target.value)}
                  data-testid="input-end-date"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 [color-scheme:dark]"
                />
              </div>
            </Field>
          </div>

          <Field label="Assign TPM" hint="Owns budget building & delivery">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={form.tpm}
                onChange={(e) => update("tpm", e.target.value)}
                data-testid="input-tpm"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                <option value="">— Select TPM —</option>
                {TEAM.filter((t) => ["Project Lead", "Engineer", "CTO"].includes(t.role)).map((t) => (
                  <option key={t.id} value={t.name}>{t.name} · {t.role}</option>
                ))}
              </select>
            </div>
          </Field>
        </div>

        <DialogFooter className="pt-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200"
            data-testid="btn-cancel-new-project"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="btn-create-project"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Create &amp; assign TPM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, hint, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1">
      <label className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</label>
      {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
    </div>
    {children}
  </div>
);

export default NewProjectDialog;
