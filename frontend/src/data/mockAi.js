// Model keys governance data
const maskKey = (full) => `${full.slice(0, 7)}${"•".repeat(18)}${full.slice(-4)}`;

export const MODEL_KEYS = [
  { id: "k1", project: "crowley-gen", projectName: "Crowley Generation", provider: "Anthropic", model: "Opus 4.8", type: "R&D", env: "production", fullKey: "sk-ant-live-A21F94Xa8ec4nabc4", tags: ["prod", "inference", "eval"], lastUsed: "2026-06-24T09:12:00Z", usage: 4231, createdBy: "Vikram Kumar", createdAt: "2026-06-01T10:00:00Z", status: "active" },
  { id: "k2", project: "crowley-gen", projectName: "Crowley Generation", provider: "Anthropic", model: "Opus 4.8", type: "R&D", env: "testing", fullKey: "sk-ant-test-B92G01Xf5be2tdef9", tags: ["test", "dev"], lastUsed: "2026-06-23T14:30:00Z", usage: 812, createdBy: "Aanya Sharma", createdAt: "2026-06-01T10:15:00Z", status: "active" },
  { id: "k3", project: "talos", projectName: "Talos", provider: "Google", model: "Gemini 2.5 Pro", type: "Operations", env: "production", fullKey: "AIza-live-C13H82Ye7dc5oghi3", tags: ["prod", "classify"], lastUsed: "2026-06-24T11:44:00Z", usage: 2984, createdBy: "Maria Lopez", createdAt: "2026-05-28T09:00:00Z", status: "active" },
  { id: "k4", project: "sourcing", projectName: "Crowley Sourcing", provider: "OpenAI", model: "GPT-4o", type: "R&D", env: "production", fullKey: "sk-oai-live-D74J12Zk3fa8pjkl7", tags: ["prod", "retrieval"], lastUsed: "2026-06-24T07:05:00Z", usage: 5421, createdBy: "Aanya Sharma", createdAt: "2026-06-05T13:20:00Z", status: "active" },
  { id: "k5", project: "kaiju", projectName: "Kaiju Eval", provider: "Anthropic", model: "Opus 4.8", type: "R&D", env: "production", fullKey: "sk-ant-live-E48K23Am6gc9qmno2", tags: ["prod", "eval"], lastUsed: "2026-06-22T18:11:00Z", usage: 1673, createdBy: "Arjun Mehta", createdAt: "2026-06-10T11:10:00Z", status: "active" },
  { id: "k6", project: "atlas", projectName: "Atlas Ingest", provider: "OpenAI", model: "GPT-4o", type: "Operations", env: "production", fullKey: "sk-oai-live-F31L45Bp9hd3rpqr8", tags: ["prod", "ingest"], lastUsed: "2026-06-24T05:33:00Z", usage: 8102, createdBy: "Arjun Mehta", createdAt: "2026-06-01T08:00:00Z", status: "active" },
  { id: "k7", project: "atlas", projectName: "Atlas Ingest", provider: "OpenAI", model: "GPT-4o", type: "Operations", env: "testing", fullKey: "sk-oai-test-G62M56Cq0je4stuv9", tags: ["test"], lastUsed: "2026-06-19T10:00:00Z", usage: 240, createdBy: "Arjun Mehta", createdAt: "2026-06-01T08:15:00Z", status: "active" },
  { id: "k8", project: "vesper", projectName: "Vesper Docker", provider: "Anthropic", model: "Opus 4.8", type: "Operations", env: "production", fullKey: "sk-ant-live-H73N67Dr1kf5tuwx0", tags: ["prod"], lastUsed: "2026-06-15T09:00:00Z", usage: 3812, createdBy: "Aanya Sharma", createdAt: "2026-05-20T14:00:00Z", status: "revoked" },
  { id: "k9", project: "nimbus", projectName: "Nimbus QC", provider: "xAI", model: "Grok-2", type: "Operations", env: "production", fullKey: "xai-live-I84O78Es2lg6uvxy1", tags: ["prod", "qc"], lastUsed: "2026-06-23T22:14:00Z", usage: 942, createdBy: "Maria Lopez", createdAt: "2026-06-12T12:00:00Z", status: "active" },
];
export const MODEL_KEYS_MASKED = MODEL_KEYS.map((k) => ({ ...k, maskedKey: maskKey(k.fullKey) }));

// Budget line categories
export const LINE_CATEGORIES = [
  { id: "model", label: "AI Model", unit: "tokens (M)", defaultRate: 8 },
  { id: "infra", label: "Infrastructure", unit: "hours", defaultRate: 12 },
  { id: "subscription", label: "Subscription", unit: "seats × mo", defaultRate: 60 },
  { id: "hardware", label: "Hardware", unit: "units", defaultRate: 1200 },
  { id: "employee", label: "Employee", unit: "person-days", defaultRate: 400 },
  { id: "other", label: "Other", unit: "line", defaultRate: 0 },
];

// Alert thresholds
export const THRESHOLDS = [50, 75, 90, 100];

// Daily activity for last 30 days (portfolio-wide)
const seedDaily = () => {
  const days = [];
  const today = new Date(2026, 5, 30);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const seed = (d.getDate() * 7 + d.getMonth() * 3) % 11;
    const base = 2500 + seed * 400;
    const est = base + ((seed % 3) - 1) * 300;
    days.push({
      date: d.toISOString().slice(0, 10),
      dow: d.getDay(),
      spend: base,
      estimate: est,
      approvals: seed % 4,
      expenses: 8 + (seed % 6),
      byCategory: {
        model: Math.round(base * 0.45),
        infra: Math.round(base * 0.24),
        employee: Math.round(base * 0.16),
        other: Math.round(base * 0.15),
      },
    });
  }
  return days;
};
export const DAILY_ACTIVITY = seedDaily();

// Per-model 30-day trajectory
const seedModelTraj = () => {
  const models = ["Opus 4.7", "Gemini 2.5 Pro", "GPT-4o", "Sonnet", "Kimi"];
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(2026, 5, 30 - i);
    const day = d.toISOString().slice(0, 10);
    const point = { date: day };
    models.forEach((m, idx) => {
      const seed = (d.getDate() * (idx + 2)) % 9;
      point[m] = Math.round(200 + seed * 45 + idx * 40);
    });
    rows.push(point);
  }
  return rows;
};
export const MODEL_TRAJECTORY = seedModelTraj();
