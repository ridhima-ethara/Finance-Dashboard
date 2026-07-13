import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { TEAM } from "../data/mockUsers";
import { FolderPlus, User, Calendar as CalIcon, Link2, FileText, Users, Beaker, Upload, X } from "lucide-react";

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE = 750 * 1024;

const buildEmptyForm = (today) => ({
  clientProjectName: "",
  internalName: "",
  startDate: today,
  docUrl: "",
  tpm: "",
  plQlMembers: [],
  rndMembers: [],
  attachments: [],
});

const formatFileSize = (size) => {
  if (!size) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const NewProjectDialog = ({ open, onOpenChange }) => {
  const nav = useNavigate();
  const { addProject, user } = useApp();

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState(() => buildEmptyForm(today));

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleMulti = (key, name) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(name)
        ? f[key].filter((n) => n !== name)
        : [...f[key], name],
    }));
  const handleFilePick = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const oversize = files.find((file) => file.size > MAX_ATTACHMENT_SIZE);
    if (oversize) {
      toast.error("Attachment too large", {
        description: `${oversize.name} is above ${formatFileSize(MAX_ATTACHMENT_SIZE)}.`,
      });
      event.target.value = "";
      return;
    }

    setForm((current) => {
      const existing = new Set(current.attachments.map((file) => `${file.name}:${file.size}`));
      const next = files
        .filter((file) => !existing.has(`${file.name}:${file.size}`))
        .map((file) => ({
          id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          kind: "file",
        }));
      const merged = [...current.attachments, ...next];
      if (merged.length > MAX_ATTACHMENTS) {
        toast.error(`Only ${MAX_ATTACHMENTS} files can be attached in this workspace.`);
      }
      return {
        ...current,
        attachments: merged.slice(0, MAX_ATTACHMENTS),
      };
    });

    event.target.value = "";
  };
  const removeAttachment = (attachmentId) =>
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((file) => file.id !== attachmentId),
    }));

  const selectedMembers = Array.from(new Set([form.tpm, ...form.plQlMembers, ...form.rndMembers].filter(Boolean))).map((name) => {
    const match = TEAM.find((member) => member.name === name);
    return {
      id: match?.id || `member-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      role: name === form.tpm ? "TPM" : match?.role || "R&D",
      email: match?.email || `${name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai`,
    };
  });

  const submit = () => {
    if (!form.clientProjectName.trim()) return toast.error("Enter the client project name");
    if (!form.internalName.trim()) return toast.error("Enter the internal project name");
    if (!form.tpm) return toast.error("Assign a TPM");
    if (!form.startDate) return toast.error("Set the start date");

    const plMembers = form.plQlMembers.filter((name) => {
      const member = TEAM.find((entry) => entry.name === name);
      return member?.role !== "Quality Lead";
    });
    const qlMembers = form.plQlMembers.filter((name) => {
      const member = TEAM.find((entry) => entry.name === name);
      return member?.role === "Quality Lead";
    });
    const proj = addProject({
      ...form,
      plMembers,
      qlMembers,
      createdBy: user?.name || "CTO",
      createdByRole: user?.role || "CTO",
    });
    toast.success("Project created", {
      description: `${proj.name} · kickoff sent to ${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"}`,
    });
    onOpenChange(false);
    setForm(buildEmptyForm(today));
    setTimeout(() => nav(`/projects/${proj.id}`), 250);
  };

  const tpmOptions = TEAM.filter((t) => ["Project Lead", "Engineer", "CTO"].includes(t.role));
  const plQlOptions = TEAM.filter((t) => ["Project Lead", "Quality Lead"].includes(t.role));
  const rndOptions = TEAM.filter((t) => t.role === "R&D" || t.role === "Engineer");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0F0F16] border-white/10 text-zinc-100 max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-new-project">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <FolderPlus className="w-3 h-3" /> {user?.role || "CTO"} · Create project
          </div>
          <DialogTitle className="font-display text-xl text-white mt-1">New project</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Set up the engagement shell &amp; assign owners. Budget lines &amp; phases are added later by the assigned TPM / R&amp;D.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Client project name" hint="How the client refers to it">
            <div className="relative">
              <FileText className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={form.clientProjectName}
                onChange={(e) => update("clientProjectName", e.target.value)}
                placeholder="e.g. Client modernization program"
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
              placeholder="e.g. Internal delivery track"
              data-testid="input-internal-name"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
          </Field>

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

          <Field label="Doc attachment (URL / Drive link)" hint="Visible to assigned members">
            <div className="relative">
              <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="url"
                value={form.docUrl}
                onChange={(e) => update("docUrl", e.target.value)}
                placeholder="https://drive.google.com/…"
                data-testid="input-doc-url"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-zinc-200 cursor-pointer hover:bg-white/[0.07]">
                <Upload className="w-3.5 h-3.5 text-fuchsia-300" />
                Attach file
                <input
                  type="file"
                  multiple
                  onChange={handleFilePick}
                  data-testid="input-doc-files"
                  className="hidden"
                />
              </label>
              <span className="text-[10px] text-zinc-500">Add up to {MAX_ATTACHMENTS} files. Each file can be up to {formatFileSize(MAX_ATTACHMENT_SIZE)}.</span>
            </div>
            {form.attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {form.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                    data-testid={`attachment-${attachment.id}`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-white truncate">{attachment.name}</div>
                      <div className="text-[10px] text-zinc-500">{formatFileSize(attachment.size)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="w-7 h-7 rounded-md hover:bg-red-500/15 text-zinc-500 hover:text-red-300 flex items-center justify-center flex-shrink-0"
                      data-testid={`remove-attachment-${attachment.id}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <Field label="Assign TPM" hint="Owns budget building &amp; delivery">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={form.tpm}
                onChange={(e) => update("tpm", e.target.value)}
                data-testid="input-tpm"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                <option value="">— Select TPM —</option>
                {tpmOptions.map((t) => (
                  <option key={t.id} value={t.name}>{t.name} · {t.role}</option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Assign PL / QL" hint="Added to project members + kickoff">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 max-h-32 overflow-y-auto space-y-1" data-testid="plql-multi-picker">
              {plQlOptions.length === 0 && (
                <div className="text-xs text-zinc-500 px-2 py-1.5">No PL / QL members available.</div>
              )}
              {plQlOptions.map((t) => {
                const on = form.plQlMembers.includes(t.name);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleMulti("plQlMembers", t.name)}
                    data-testid={`plql-toggle-${t.id}`}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      on ? "bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30" : "text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${on ? "border-fuchsia-400 bg-fuchsia-500" : "border-white/20"}`}>
                      {on && <span className="text-[9px] text-white">✓</span>}
                    </span>
                    <Users className="w-3 h-3 text-fuchsia-300" />
                    <span className="font-medium">{t.name}</span>
                    <span className="text-zinc-500 text-[10px]">· {t.role}</span>
                  </button>
                );
              })}
            </div>
            {form.plQlMembers.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-400">
                <Users className="w-3 h-3" />
                {form.plQlMembers.length} PL / QL assigned · {form.plQlMembers.join(", ")}
              </div>
            )}
          </Field>

          <Field label="Assign R&amp;D members" hint="Project appears on their dashboard">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 max-h-40 overflow-y-auto space-y-1" data-testid="rnd-multi-picker">
              {rndOptions.length === 0 && (
                <div className="text-xs text-zinc-500 px-2 py-1.5">No R&amp;D members available.</div>
              )}
              {rndOptions.map((t) => {
                const on = form.rndMembers.includes(t.name);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleMulti("rndMembers", t.name)}
                    data-testid={`rnd-toggle-${t.id}`}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      on ? "bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30" : "text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${on ? "border-fuchsia-400 bg-fuchsia-500" : "border-white/20"}`}>
                      {on && <span className="text-[9px] text-white">✓</span>}
                    </span>
                    <Beaker className="w-3 h-3 text-fuchsia-300" />
                    <span className="font-medium">{t.name}</span>
                    <span className="text-zinc-500 text-[10px]">· {t.role}</span>
                  </button>
                );
              })}
            </div>
            {form.rndMembers.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-400">
                <Users className="w-3 h-3" />
                {form.rndMembers.length} R&amp;D assigned · {form.rndMembers.join(", ")}
              </div>
            )}
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
            Create &amp; assign
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
