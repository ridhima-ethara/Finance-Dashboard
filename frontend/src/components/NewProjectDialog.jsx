import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { TEAM, USERS } from "../data/mockUsers";
import { FolderPlus, User, Calendar as CalIcon, Link2, FileText, Users, Beaker, Upload, X, Plus } from "lucide-react";

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE = 750 * 1024;
const ETHARA_EMAIL_REGEX = /^[a-z0-9._%+-]+@ethara\.ai$/i;
const DIRECTORY = [...TEAM, ...USERS].reduce((acc, member) => {
  if (!member?.email) return acc;
  const key = String(member.email).trim().toLowerCase();
  if (!acc.has(key)) acc.set(key, member);
  return acc;
}, new Map());

const buildEmptyForm = (today, user) => ({
  clientProjectName: "",
  internalName: "",
  startDate: today,
  docUrl: "",
  tpmEmails: user?.role === "TPM" && user?.email ? [String(user.email).trim().toLowerCase()] : [],
  plQlEmails: [],
  rndEmails: [],
  attachments: [],
});

const normalizeRoleForSection = (memberRole = "", sectionRole = "Member") => {
  if (sectionRole === "TPM") return "TPM";
  if (sectionRole === "R&D") return memberRole === "Engineer" ? "Engineer" : "R&D";
  if (sectionRole === "PL / QL") {
    if (memberRole === "Quality Lead" || memberRole === "QL") return "Quality Lead";
    if (memberRole === "Project Lead" || memberRole === "PL") return "Project Lead";
    return "PL / QL";
  }
  return memberRole || sectionRole;
};

const formatNameFromEmail = (email = "") => {
  const localPart = String(email || "").split("@")[0] || "";
  const acronyms = {
    ai: "AI",
    cfo: "CFO",
    cto: "CTO",
    it: "IT",
    pl: "PL",
    ql: "QL",
    rd: "R&D",
    rnd: "R&D",
    tpm: "TPM",
  };
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((token) => {
      const lowered = token.toLowerCase();
      if (acronyms[lowered]) return acronyms[lowered];
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(" ") || email;
};

const parseEmailTokens = (value = "") => (
  String(value || "")
    .split(/[\s,;\n]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
);

const resolveMemberFromEmail = (email, sectionRole) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const match = DIRECTORY.get(normalizedEmail);
  const role = normalizeRoleForSection(match?.role || "", sectionRole);
  return {
    id: match?.id || `member-${normalizedEmail.replace(/[^a-z0-9]+/g, "-")}`,
    name: match?.name || formatNameFromEmail(normalizedEmail),
    role,
    email: normalizedEmail,
  };
};

const dedupeEmails = (emails = []) => {
  const seen = new Set();
  return emails.reduce((acc, email) => {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return acc;
    seen.add(normalized);
    acc.push(normalized);
    return acc;
  }, []);
};

const formatFileSize = (size) => {
  if (!size) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const NewProjectDialog = ({ open, onOpenChange }) => {
  const nav = useNavigate();
  const { addProject, user } = useApp();

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState(() => buildEmptyForm(today, user));

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
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

  const selectedMembers = useMemo(() => {
    const recipients = [
      ...form.tpmEmails.map((email) => resolveMemberFromEmail(email, "TPM")),
      ...form.plQlEmails.map((email) => resolveMemberFromEmail(email, "PL / QL")),
      ...form.rndEmails.map((email) => resolveMemberFromEmail(email, "R&D")),
    ];
    const seen = new Set();
    return recipients.filter((member) => {
      const key = String(member.email || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [form.plQlEmails, form.rndEmails, form.tpmEmails]);

  const submit = () => {
    if (!form.clientProjectName.trim()) return toast.error("Enter the client project name");
    if (!form.internalName.trim()) return toast.error("Enter the internal project name");
    if (!form.tpmEmails.length) return toast.error("Assign at least one TPM email");
    if (!form.startDate) return toast.error("Set the start date");

    const invalidEmails = dedupeEmails([
      ...form.tpmEmails,
      ...form.plQlEmails,
      ...form.rndEmails,
    ]).filter((email) => !ETHARA_EMAIL_REGEX.test(email));
    if (invalidEmails.length) {
      return toast.error("Only @ethara.ai emails are allowed", {
        description: invalidEmails.join(", "),
      });
    }

    const tpmRecipients = form.tpmEmails.map((email) => resolveMemberFromEmail(email, "TPM"));
    const plQlRecipients = form.plQlEmails.map((email) => resolveMemberFromEmail(email, "PL / QL"));
    const rndRecipients = form.rndEmails.map((email) => resolveMemberFromEmail(email, "R&D"));
    const primaryTpm = tpmRecipients[0];
    const plMembers = plQlRecipients
      .filter((member) => member.role !== "Quality Lead" && member.role !== "QL")
      .map((member) => member.name);
    const qlMembers = plQlRecipients
      .filter((member) => member.role === "Quality Lead" || member.role === "QL")
      .map((member) => member.name);
    const proj = addProject({
      ...form,
      tpm: primaryTpm?.name || "",
      tpmEmail: primaryTpm?.email || "",
      assignedMembers: [...tpmRecipients, ...plQlRecipients, ...rndRecipients],
      plMembers,
      qlMembers,
      rndMembers: rndRecipients.map((member) => member.name),
      createdBy: user?.name || "CTO",
      createdByRole: user?.role || "CTO",
    });
    toast.success("Project created", {
      description: `${proj.name} · kickoff sent to ${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"}`,
    });
    onOpenChange(false);
    setForm(buildEmptyForm(today, user));
    setTimeout(() => nav(`/projects/${proj.id}`), 250);
  };

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
            <EmailRecipientsInput
              icon={User}
              emails={form.tpmEmails}
              onChange={(emails) => update("tpmEmails", emails)}
              placeholder="tpm@ethara.ai"
              dataTestId="input-tpm"
              helperText="Enter one or more TPM emails. The first email becomes the primary TPM owner; all listed emails receive kickoff."
            />
          </Field>

          <Field label="Assign PL / QL" hint="Added to project members + kickoff">
            <EmailRecipientsInput
              icon={Users}
              emails={form.plQlEmails}
              onChange={(emails) => update("plQlEmails", emails)}
              placeholder="pl@ethara.ai, quality.1@ethara.ai"
              dataTestId="plql-multi-picker"
              helperText="Enter one or more PL / QL emails. Matching demo emails are auto-mapped to Project Lead or Quality Lead."
            />
          </Field>

          <Field label="Assign R&amp;D members" hint="Project appears on their dashboard">
            <EmailRecipientsInput
              icon={Beaker}
              emails={form.rndEmails}
              onChange={(emails) => update("rndEmails", emails)}
              placeholder="rd@ethara.ai, engineer.1@ethara.ai"
              dataTestId="rnd-multi-picker"
              helperText="Enter one or more R&D or engineer emails. Every @ethara.ai address listed here is added to kickoff and project access."
            />
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

const EmailRecipientsInput = ({
  icon: Icon,
  emails = [],
  onChange,
  placeholder,
  dataTestId,
  helperText,
}) => {
  const [draft, setDraft] = useState("");

  const addDraftEmails = () => {
    const parsed = parseEmailTokens(draft);
    if (!parsed.length) return;

    const valid = [];
    const invalid = [];
    parsed.forEach((email) => {
      if (ETHARA_EMAIL_REGEX.test(email)) valid.push(email);
      else invalid.push(email);
    });

    if (valid.length) {
      onChange(dedupeEmails([...emails, ...valid]));
    }
    if (invalid.length) {
      toast.error("Only @ethara.ai emails are allowed", {
        description: invalid.join(", "),
      });
    }
    setDraft("");
  };

  const removeEmail = (email) => {
    onChange(emails.filter((entry) => entry !== email));
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3" data-testid={dataTestId}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="email"
            data-testid={`${dataTestId}-input`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addDraftEmails();
              }
            }}
            onBlur={() => {
              if (draft.trim()) addDraftEmails();
            }}
            placeholder={placeholder}
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addDraftEmails}
          className="h-10 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>
      <div className="mt-2 text-[10px] text-zinc-500">{helperText}</div>
      {emails.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] text-fuchsia-100"
            >
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="text-fuchsia-200 hover:text-white"
                aria-label={`Remove ${email}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewProjectDialog;
