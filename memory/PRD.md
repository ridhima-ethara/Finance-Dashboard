# Ethara.AI — Enterprise Project Budget Dashboard (PRD)

## Problem Statement
Build a modern enterprise-grade Project Budget & Financial Management Dashboard for an AI company (Ethara.AI). Executive-friendly, professional light SaaS aesthetic inspired by Stripe / Ramp / Linear / Microsoft Fabric, with rich financial insights (budgets, expenses, top-ups, reimbursements, workflow approvals, AI insights). Reference: attached Ethara.AI dashboard image.

## User Choices (2026-02-06)
- Scope: **Frontend-focused polished demo (mocked data, no auth)**
- Auth: Simple role switcher (Admin / CTO / COO / Project Lead / Finance)
- AI Insights: Mocked responses (no LLM integration)
- Currency: USD only
- Branding: Reuse "Ethara.AI" name + sidebar nav from reference

## Roles
Admin · CTO · COO · Project Lead · Finance (role switcher in top bar; UI is shared today, gated actions in future iterations).

## Architecture
Frontend only (React + Tailwind + shadcn/ui + Recharts + react-router).
- `App.js` — router + provider
- `context/AppContext.jsx` — role state, AI/notif drawer state
- `data/mockData.js` — projects, portfolio aggregates, monthly trend, categories, models, infra, subscriptions, notifications, approvals, reimbursements, AI insights
- `components/layout/` — Sidebar, TopBar, AppShell, AiPanel, NotificationsDrawer
- `components/dashboard/` — AmountAtRisk, KpiGrid, Charts (Budget/Actual/Estimated, Model expenses, Infra stacked, Monthly trend, Category donut, Utilization bars, Subscription usage, Workflow strip), ProjectsTable
- `pages/` — Dashboard, Projects, ProjectDetail, Approvals, TopUps, Reimbursements, AuditLog, Team, Tasks, Settings

## What's Implemented (2026-02-08 · iteration 5) — TPM Workflow Sub-Modules
- [x] **AI Cost Screen** (`/ai-cost`) — 6 KPI cards (today, WoW, MTD, projected, tokens, requests), stacked 30-day cost trend by provider, provider share donut, provider breakdown table (Anthropic/OpenAI/Google/Moonshot/xAI), model breakdown table with $/1K unit economics, project attribution list, AI optimization insights panel
- [x] **Phase Workspace** (`/projects/:id/phase/:phaseId`) — Task table with owner, assigned model per task, infra, estimated vs actual cost, variance, status (planned/in-progress/done); 6 stat cards (est/actual/variance/util/completion/health); progress bar; status filter chips; AI phase insight
- [x] **Daily Consumption** (`/consumption`) — 6 stat cards, 14-day trend (actual vs estimated) LineChart, category breakdown bars, submit-tomorrow's-estimate form (4 categories + project selector + toast confirmation), last-7-days consumption table
- [x] **CTO Review / Returned Budget** (`/cto-review/:id`) — CTO note banner, version comparison (v1.1 → v1.2), flagged lines with per-line Accept/Reject decisions, budget summary sidebar with acceptance counts, response-to-CTO textarea, Resubmit action with toast + navigation, other returned-budgets nav list
- [x] **Reports Library** (`/reports`) — 8 report cards (Budget, Phase, Expense, Variance, Task, Model, Recovery, Daily) with type icons, filters (search + type + frequency), Run + Download actions per card, expandable format-selector (PDF/CSV/XLSX/JSON), Scheduled reports section with 3 example schedules
- [x] **TpmDashboard wiring** — kpi-returned links to `/cto-review/rb1`, today-est/today-actual link to `/consumption`, upcoming phase widget links to `/projects/:id/phase/:phaseId`; pending-actions rows navigate to correct new routes
- [x] **Sidebar nav** — TPM role sees 11 items including new nav-cto-review, nav-consumption, nav-ai-cost, nav-reports; default (CTO/CFO/PL) roles get nav-ai-cost + nav-reports added
- [x] **mockData.js refactor** — split into modular files: `mockUsers.js`, `mockProjects.js`, `mockFinance.js`, `mockAi.js`, `mockTpm.js`. `mockData.js` becomes a barrel re-export for backward compatibility. New mock data: `AI_COST_TODAY/MONTHLY/BY_PROVIDER/BY_MODEL/TREND/BY_PROJECT`, `PHASE_TASKS`, `CHANGE_REQUESTS`, `RETURNED_BUDGETS`, `REPORTS_CATALOG`
- [x] Tested end-to-end via Playwright · 100% pass · zero console errors (`/app/test_reports/iteration_5.json`)


- [x] **Login redesigned** — matches Ethara.AI branding image: dark background with subtle grid + diagonal wireframe, large white ornate mask + "Ethara.AI" wordmark (magenta ".AI"), "Financial Command Center" between fuchsia lines, 4 quick-login role cards color-coded per role (fuchsia/emerald/sky/amber), optional email+password form via toggle
- [x] **TPM visibility** — TPM sees only projects they requested (project.tpm === user.name); PL sees own; CTO/CFO see all; helper `visibleProjects` in context; Dashboard subtitle and Projects list reflect scope
- [x] **P1.1 Admin-defined project buffer** — Buffer panel on ProjectDetail with slider + numeric input + Save. Editable only by CTO/CFO. Effective budget = Approved × (1 + buffer%). Persisted in localStorage
- [x] **P1.2 Client Cost Recovery** — Recovery panel visible when project.recoverableFromClient. Actual / Recovered / Net cost mini-stats. Amount editable only by CFO/Finance. Persisted in localStorage
- [x] **P1.3 Daily expense & approval tracking** — new `/daily` page with today's spend/approvals stats, 30-day calendar heatmap (magenta intensity by spend), daily spend-vs-estimate combo chart, per-model trajectory line chart, and chronological daily log
- [x] **P2.1 Daily estimate entry** — TPM/PL/CTO can enter daily estimates via `daily-estimate-dialog` (date, category, amount, note)
- [x] **P2.2 Precise threshold alerts** — Utilization tracker on ProjectDetail shows vertical markers at 50/75/90/100 %, colored per crossing; Utilization chart on dashboard also renders threshold markers per project
- [x] **P2.3 Per-model trajectory** — 30-day line chart per model (Opus 4.7, Gemini 2.5 Pro, GPT-4o, Sonnet, Kimi) on the Daily page

## What's Implemented (2026-02-06 · iteration 3)
- [x] **Role-based auth (mock)** — Login page with 4 quick-login role cards (CTO/CFO/TPM/PL) and email+password form; localStorage session; protected routes; logout via sidebar or user menu
- [x] **P0.1 Line-wise Budget Request** — `RequestBudgetDialog` now captures line items (category, description, qty, unit cost, auto-computed total), delivery model (single/phase-wise), phase-wise deliverables, cost-per-task, and R&D/Ops scope · replaces the old single-amount request
- [x] **P0.2 Partial Approval** — new `PartialApprovalDialog` with slider + amount input + "Park / Defer / Close remaining" toggle + reason; each approval row now has Reject / Partial / Approve
- [x] **P0.3 R&D vs Operations bifurcation** — every project tagged R&D or Operations; global top-bar scope filter (All / R&D / Ops) filters projects table, projects grid, and dashboard header; violet/emerald chips visible on cards & rows
- [x] **P0.4 Model Keys governance** — new `/keys` page: 4 stat cards, search + Env/Type/Provider chip filters, masked keys with reveal (CTO/CFO only, audit-logged), copy, rotate, revoke actions; Generate Key dialog; revoked keys visibly disabled
- [x] Sidebar restructured: 10 nav items including "Model Keys"; logout button on user card

## What's Implemented (2026-02-06 · iteration 2)
- [x] **Dark Ethara.AI theme** — near-black #08080C background with hot magenta (#E619B8) accent, matching ethara.ai website aesthetic (no longer copies the reference image)
- [x] **Finance-grade KPI overhaul** — 8 KPIs curated as a finance specialist:
  - Approved Budget, Actual Spend (with util %), EAC (Estimate at Completion), CPI (Cost Performance Index), Burn Rate ($/day), Cash Runway (days), AI Model Cost Ratio, Pending Approvals ($ value)
  - Removed irrelevant/fake KPIs (Portfolio Budget $122.5M placeholder, generic "Active Projects")
- [x] **Removed 'Budget Consolidation'** nav item · dashboard is now primary "/"
- [x] **Role-gated 'Request Budget' CTA** — visible on Dashboard and Projects pages ONLY when role === "Project Lead"; opens `RequestBudgetDialog` with project selector, request type (Initial budget / Budget increase / Top-up), amount, justification, AI suggestion, submit → success toast
- [x] Portfolio computes CPI, EAC, burn rate, cash runway, AI cost ratio from project data automatically
- [x] Ethara.AI branded sidebar (Dashboard, Projects, Budget Consolidation, Approvals, Top-ups, Reimbursements, Audit Log, Team Overview, All Tasks, Settings)
- [x] Top bar: global search, role switcher (dropdown), Ask-AI button, notifications bell with unread badge
- [x] Budget Consolidation page — Amount at Risk hero (red gradient + grain texture), 6-card KPI grid, workflow strip, 7 charts (grouped bars, model expenses, infra stack, monthly area, donut, utilization bars, subscription usage panel), and expandable projects table
- [x] Expandable projects table — 11 columns, row expand shows nested Phases table, portfolio total row
- [x] Projects list — grid of cards with health chips, utilization bars, filters (all / healthy / watch / over) and search
- [x] Project detail — breadcrumb, header, 4 KPI blocks, cost breakdown chips (8 categories), tabs (Phases, Expenses, Top-ups, Budget history timeline, Audit log, Comments)
- [x] Approvals page — pending list with stage badges and approve/reject actions
- [x] Top-ups page — full history with amount, reason, approver, status
- [x] Reimbursements — bills upload button, approval + finance statuses
- [x] Audit log — portfolio-wide immutable ledger with actor + timestamp
- [x] Team overview — member cards with owned projects and budget under mgmt
- [x] Tasks — derived from phases with health badge
- [x] Settings — currency toggle, notification switches, role management list, exports (PDF/Excel/CSV)
- [x] Persistent AI panel — mock insights + chat interface with 4 pre-baked suggestions and canned answers
- [x] Notifications drawer — 6 typed alerts (danger/warning/success/info)

## Backlog (future iterations)
P1
- Real backend + MongoDB persistence (projects, expenses, top-ups, approvals, audit)
- Real auth + role-based route gating
- Bill upload with object storage
- Live LLM (Claude Sonnet 4.5 via Emergent LLM key) for AI panel
- Export to PDF/Excel/CSV (actual downloads)
- INR toggle with FX rate

P2
- Notifications realtime (websocket) + digest email
- Budget request wizard (multi-step form)
- Custom approval workflow editor
- Slack/Teams integration for alerts
- Comment mentions & attachments

## Next Action Items
1. **P2** — Upgrade floating AI Assistant (AiPanel) to handle TPM-specific queries: "Predict when this budget will be exhausted", "Show today's AI cost", "Which provider is cheapest for classification?"
2. **P2** — Actual downloads for reports (mock CSV/JSON generation client-side using project data)
3. **P2** — Real backend (FastAPI + MongoDB) with CRUD for projects/expenses/top-ups/approvals/budgets
4. **P2** — Real auth + role-based route gating (Emergent Google auth or JWT)
5. **P3** — Bill upload with object storage
6. **P3** — Live LLM (Claude Sonnet 4.5 via Emergent LLM key) for AI panel
7. **P3** — INR toggle with FX rate

