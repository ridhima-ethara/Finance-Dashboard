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

## What's Implemented (2026-02-10 · iteration 7) — CFO Portal + Login Logo Swap

### CFO Portal (workflow: Receive from CTO → Financial Review → Approve/Partial/Reject → Activate → Monitor → Client Recovery → Closure)
- [x] **Sidebar reorganized** — CFO gets: Dashboard, Approval Queue, Financial Monitoring, Budget Management, Contingency Buffer, Client Recovery, AI Cost Analytics, Reports, Audit Log, Settings (Settings is CFO-only)
- [x] **CFO Dashboard alert strip** — 4 tiles (Approval Queue pending · Pending Top-ups · Outstanding Recovery · Buffer Utilization) linking to modules
- [x] **`/approval-queue`** — Full CFO decision workspace with per-row actions:
    - **Approve full** — approves at requested amount
    - **Partial Approve** — CFO enters the amount they're approving. This amount **becomes the new baseline visible to TPM** — all future top-ups will reference this amount (not the original request)
    - **Return with comments** — sends back to CTO with notes
    - **Reject** — final rejection with comment
    - **Allocate hidden buffer (CFO-only)** — separate input reserves from confidential buffer pool, **not visible to TPM/CTO**
    - **Forward for payment** — post-approval action
    - Stats: Pending / Approved / Partial / Rejected / Total requested; hidden buffer banner (available / total / already allocated); search + priority filters
- [x] **`/financial-monitoring`** — 8 KPIs (Org spend, Daily, Monthly, Variance, EAC, Cash flow (Jul), Financial risk, Exhaustion in days). 4 charts: Daily financial consumption, Cash flow forecast (6 months), Department-wise spend, AI spend distribution (pie). Project-spend ranking with utilization bars
- [x] **`/buffer` — Contingency Buffer** (CFO-only, "Confidential") — Total pool card with visual bar, Utilization + Policy stats, Critical/Warning alerts, 4 actions (Increase / Reduce / Allocate / Release) with amount + project inputs, per-project buffer allocation table, allocation history log
- [x] **`/recovery` — Client Cost Recovery** — 6 KPIs (Total recoverable, Recovered, Outstanding, Net company cost, Profitability%, Recoverable projects). Recovery trend LineChart + by-client BarChart. Per-client table with invoiced/received/outstanding/profitability. Recoverable projects table

### Data
- [x] Added `/data/mockCfo.js` — `BUFFER` (pool, per-project allocation, history, alerts), `RECOVERY` (per-client stats, monthly trend), `CASH_FLOW` (6-month forecast), `DEPT_SPEND`, `APPROVAL_TREND`

### Global
- [x] **Login logo replaced** — SVG mandala swapped with the user-provided PNG emblem (Ethara.AI leaf/floral mark) with fuchsia drop-shadow glow


### CTO Portal (full workflow: Project → TPM assignment → Budget Review → Task/Model review → Modify → Approve & Forward to CFO → Monitor → CR approvals → Closure)
- [x] **Sidebar** — Role-based nav. CTO gets: Dashboard, Projects, Budget Reviews, Project Monitoring, AI Cost Analytics, Change Requests, Model Keys, Reports, Audit Log (NO Settings)
- [x] **CTO alert strip on Dashboard** — 4 tile row: Budget Reviews (pending), Change Requests (pending), High-Risk Projects (util ≥ 90%), Over Budget count — each links to the relevant module
- [x] **Budget Reviews list** (`/budget-reviews`) — Queue of budgets awaiting CTO decision. Filters (urgency: All/High/Normal/Low, search by project/TPM/client). Each row shows: urgency chip, type, TPM, client, timeline, tasks, phases, lines flagged, requested amount, AI recommended amount with savings delta, and per-category breakdown (AI/Infra/Subs/Misc)
- [x] **Budget Review Workspace** (`/budget-reviews/:id`) — Comprehensive review canvas with 6 tabs (Overview, Phase-wise, Task-wise, Model/Infra/Subs, Comparison, Audit) + sticky decision sidebar with Modify Budget, AI recommendation quick-set, comment box, Save Draft / Reject / Approve & Forward to CFO actions. All modifications logged to audit trail
- [x] **Change Requests** (`/change-requests`) — Stage filter (All/CTO Review/COO Approval/Approved/Rejected) + expand-to-view details. Actions per pending CR: Approve · Approve & Forward to CFO · Modify · Reject. Impact assessment (budget/timeline/phase) + AI analysis suggestion
- [x] **Project Monitoring** (`/monitoring`) — Project switcher + range toggle (7d/30d). 7 KPI cards (daily estimated, daily actual, remaining, burn rate, health, EAC, exhaustion in X days). Daily & Weekly cost trend charts. Phase-wise consumption bars linking to Phase Workspace. Utilization circular gauge. Last 7-day daily consumption table

### TPM Portal — Reworked
- [x] **Removed "Returned Budgets" module completely** — per product decision, CTO can only Approve, Reject, or Edit-and-forward to CFO. No "return to TPM for edits" flow exists. Removed sidebar item, KPI card, pending action, `/cto-review` routes, `CtoReview.jsx`, and `RETURNED_BUDGETS` mock data
- [x] **Daily Consumption reworked** (`/consumption`) — TPM now submits **TODAY'S ACTUAL** consumption (not tomorrow's estimate). Row-based form with per-project: Project · Model · Tasks (count) · Trajectories (count) · Cost (USD). Live totals (tasks/trajectories/cost/projects). Inline % of approved daily budget with red/amber/green health. Add/remove rows. Submit to record for the day
- [x] **Consumption Heatmap** — Project × last 14 days grid, cell color intensity based on % of approved daily budget consumed (green &lt; 40%, magenta 40-80%, amber 80-100%, red &gt; 100%). Cells with pct ≥ 100% show "!" indicator. Hover shows exact tasks/trajectories/spent/approved
- [x] **Approved vs Actual chart + Recent submissions log** — Per-project comparison, plus last 10 submissions with health chips
- [x] **TPM Dashboard cleaned** — Removed "Budgets returned" KPI and "Review returned budget from CTO" pending action item. Replaced with "Log today's consumption" primary CTA

### Global — Settings visibility
- [x] **Settings only for CFO** — Removed Settings nav from CTO, TPM, and PL sidebars. CFO gets Dashboard, Projects, Approvals, Top-ups, Reimbursements, AI Cost, Reports, Audit Log, Team, Settings

### Data
- [x] `mockTpm.js` updated: added `BUDGET_REVIEWS` (3 pending), `CTO_AUDIT` (2 sample modifications), `DAILY_CONSUMPTION_LOG` (14-day × 6-project seeded per-project daily consumption for heatmap). Removed `RETURNED_BUDGETS`


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


## What's Implemented (2026-02-08 · iteration 8) — Role-Based Projects + TPM Task Logging + 2-Stage Top-up Approvals

### Role-based Projects module
- [x] **CFO strict read-only** — On `/projects` no `Raise top-up`/`New project` buttons; header shows `Read-only` badge; on `ProjectDetail` `cfo-readonly-badge` present; no Request top-up button; on PhaseWorkspace `phase-readonly-badge` present; on the Phase sidebar drawer the `Read-only` pill is shown, no `Log daily task`/`Raise top-up` buttons.
- [x] **TPM daily task logging** — New `TpmTaskLogDialog` (fields: task name, assignee, hours, cost incurred, date, notes, evidence URL). Wired into two surfaces so TPM always has a path:
    - `ProjectsTable` phase drawer (`drawer-btn-log-task` → `task-log-dialog`) — accessible from Dashboard for TPM
    - `PhaseWorkspace` (`btn-add-task` / `btn-log-task-inline` → `task-log-dialog`) — accessible via `link-upcoming-phase`
    - `TpmDashboard` now embeds `<ProjectsTable/>` beneath its widgets so TPM can drill into any phase drawer
- [x] **24h edit window** — Logged tasks show `log-edit-*` / `log-delete-*` icons within 24 hours of `createdAt`; after that they are locked (Lock icon shown). Enforced in `AppContext.updatePhaseTask` / `deletePhaseTask` via `isTaskEditable`.
- [x] **TPM tasks visible to CTO & CFO** — CTO sees them in phase drawer; CFO sees them read-only (no edit/delete icons).

### TPM Top-up requests (phase-wise) + 2-stage approvals
- [x] **`TopupRequestDialog`** — TPM raises phase-scoped top-up (phase select with mini stats, amount, urgency, business justification). Reachable from: Projects page `btn-raise-topup`, ProjectDetail `btn-request-topup`, PhaseWorkspace `btn-raise-topup-phase`, Phase drawer `drawer-btn-topup`, `/topups` `btn-new-topup`.
- [x] **`/topups` for TPM** — dedicated list (`page-tpm-topups`) with stats (Total / Pending / Approved / Value approved) + status filters (all/pending/approved/rejected). CFO route stays on the existing `Topups` page via `TopupsRoute` role switch.
- [x] **`TopupRequestDetail` (`/topup-requests/:id`)** — 2-stage decision workspace. Stage 1: CTO gets `Approve full` / `Partial` / `Reject` (with slider + comment). Stage 2 (CFO final): max approved amount is capped at the CTO-forwarded amount. Rejection requires a comment.
- [x] **Journey visual pipeline** — TPM → CTO → CFO → Approved with pending / current / done / reject states.
- [x] **Baseline math** — `AppContext.projects` memo folds `cfoDecision.amount` for `approved`/`partial` requests into `approvedBudget`, `topupsTotal`, `remaining`, `utilization`. Verified live: Crowley Generation approved $48.0k → $50.0k, util 85% → 82%.
- [x] **Approval Queue unified** — `/approval-queue` merges budget reviews + real top-up requests; top-up rows link to `/topup-requests/:id`.
- [x] **Activity log & AI recommendation** — Each top-up detail shows a step-by-step audit history and an "Approve at 85%" AI suggestion.

### Testing
- Iteration 7 flagged CRITICAL: TPM had no path to phase drawer (TpmDashboard didn't render ProjectsTable). Fixed in iteration 8 by rendering ProjectsTable in TpmDashboard AND wiring PhaseWorkspace to TpmTaskLogDialog + TopupRequestDialog.
- Iteration 8 test report: **10/10 review scenarios pass · 100% success rate · zero console errors** (only pre-existing Recharts sizing warnings, non-blocking).

## Next Action Items
1. **P1** — Complete Reports Module (Budget / Phase / Expense / Variance exportable reports across all portals).
2. **P2** — Upgrade AI Assistant (AiPanel) to role-specific queries (CFO cash flow, CTO over-budget forecast, TPM burn-rate).
3. **P2** — Address Recharts ResponsiveContainer width(-1)/height(-1) console warnings on dashboard renders.
4. **P2** — Split large files (`AppContext.jsx`, `PhaseWorkspace.jsx` ~450 lines) into domain contexts + sub-components as they grow past 700 lines.
5. **P2** — Real backend (FastAPI + MongoDB) with CRUD for projects/expenses/top-ups/approvals + real auth.
6. **P3** — Bill upload with object storage; live LLM via Emergent LLM key; INR toggle.


## What's Implemented (2026-02-08 · iteration 9) — CFO Dashboard Refinements + Reports Downloads

### 1. Financial Monitoring — Project-wise Spend
- [x] Each spend bar now shows a **contingency buffer indicator** overlay: repeating-diagonal emerald segment for buffer allocated + solid amber for buffer consumed. Two vertical marker lines highlight (a) actual/buffer boundary (fuchsia) and (b) buffer coverage extent (emerald). Legend + per-row summary shows Buffer allocated & used.
- Data joined from `BUFFER.perProject` (allocated + consumed).

### 2. Contingency Buffer
- [x] Removed **Buffer Allocation History** section entirely.
- [x] **Buffer Actions** are now **percentage-based** — single `%` input + slider drives all four actions (Increase pool, Reduce pool, Allocate to project, Release back). Preview shows both `Pool amount` (% of pool) and `Project amount` (% of project's approved).
- [x] **Projects Using Buffer** redesigned as a lifecycle view — expandable rows show: **Initial buffer → Additional requested → Buffer approved → Consumed → Remaining**, plus a dual-track visual (Requested vs Approved / Consumed vs Remaining) and a per-project mini-stat panel.

### 3. Recoverable Projects (Client Recovery)
- [x] Recoverable projects table is now **expandable phase-wise**. Clicking a project reveals per-phase rows with:
    - Recoverable amount · Invoiced · Received · Outstanding
    - **TPM remarks** submitted at phase closure
    - **Client feedback/reason for recovery**
- [x] Surfaced identically to CFO and CTO (same page, role-agnostic).

### 4. AI Cost Analytics
- [x] Replaced the "Token Usage Analysis" theme with three tabs: **Model Spend · Task Log · Usage Analysis**.
- [x] **Removed** the Provider Breakdown table entirely.
- [x] **Model Breakdown** table kept — enriched with per-model click-selection state.
- [x] **Task Log** tab flattens `PHASE_TASKS` + synthesized aggregate rows so every task with its model, owner, and cost delta is searchable/filterable by status.
- [x] **Usage Analysis** tab shows cost per model (bar), token throughput in/out (bar), and cost by project attribution with AI insight cards.
- [x] KPI grid updated (removed input-token KPI; added Active-models KPI). Pie switched from provider share → model share.

### 5. Reports
- [x] Real client-side **CSV/JSON download** via new `lib/reportGenerators.js` — pulls from `PROJECTS`, `PHASE_TASKS`, `AI_COST_BY_MODEL/PROVIDER`, `RECOVERY`, `DAILY_CONSUMPTION_LOG`. XLSX/PDF placeholders emit CSV (Excel-compatible).
- [x] `Generate all` button now downloads every filtered report at once.
- [x] Row-count and filename surfaced in the toast.
- [x] **Removed** `Reports` from the TPM sidebar (`NAV_TPM`). If a TPM opens `/reports` directly, a `reports-tpm-notice` banner explains the section is now consolidated under CFO/CTO.

### Testing
- Manual smoke tests via screenshots verified all 5 pages render correctly (CFO Buffer, Financial Monitoring w/ buffer bars, Recovery with expandable phase drops, AI Cost tabs, Reports with real downloads). No automated agent run this iteration per user request.


## What's Implemented (2026-02-08 · iteration 12) — TPM Task Logging + Cost-per-Task Model Formula + R&D Section Cleanup

### TPM Daily Task Logging (Project → Tasks tab)
- [x] **TpmTaskLogDialog** reworked for the new phase-first flow:
    - `task-phase` selector inside the dialog (previously fixed by parent). Users pick a phase, then log work.
    - `task-tasks-done` — number of tasks completed today
    - `task-cost` — Estimated cost (USD) attributed to those tasks
    - `task-notes` — Note / remark
    - Live "avg cost/task" hint below cost input
- [x] **Phase progress bar** — new panel inside the dialog (`task-progress`) shows `<tasks done> / <total planned> · X%` for the selected phase, with a visual bar (`task-progress-bar`) that projects the new entry against total.
- [x] **ProjectDetail Tasks tab** — replaced Hours column with **Tasks Done**; retained Est. cost column. Added a phase-progress grid (`phase-progress-grid`) above the log table that shows one bar per phase (green when ≥100%, fuchsia otherwise) so the whole team can see phase-level completion at a glance.
- [x] `AppContext.logPhaseTask` / `updatePhaseTask` now accept and persist `tasksDone`. `submitBudget` writes per-phase `totalTasks` (planned) + `trajectoriesPerTask` so the progress bar has the denominator.

### Budget Builder — Cost/Task Model Formula
- [x] Model row simplified to **Model · Provider · Cost / task ($, editable) · Est. cost**.
- [x] Formula: **Est. cost = totalTrajectories × cost/task** (where totalTrajectories = sum of `tasks × trajectories` across phases). Increasing tasks or trajectories in step 1 automatically recomputes model estCost in step 2 while preserving the user-entered cost/task.
- [x] Removed the old auto-computed `costPerTraj` column and In/Out token inputs.
- [x] Live formula footer under the models table: **`<N> tasks × <T> trajectories/task × cost/task · Total models: $X`**.

### R&D "New Budget" Section Cleanup
- [x] Removed **Doc attachment (URL)** field and **Upload spec sheet (optional)** placeholder from Budget Builder (they were project-creation concerns anyway).
- [x] Step 1 grid reduced from 4 fields to 3 (Project · Priority · Budget type). No file/upload row.
- [x] Single-phase section reordered: **Number of tasks + Est. trajectories/task on top → Total trajectories chip → Start + End dates below**.

### Testing
- Manual smoke test via screenshots verified: R&D single-phase layout matches spec (screenshot `/tmp/bb_rnd_new.png`), model formula computes correctly (1000×4×0.135 = $540, screenshot `/tmp/bb_models_new.png`), task-log dialog captures all new fields (screenshot `/tmp/task_dialog.png`), and Tasks tab renders with `Tasks Done` + `Est. cost` columns after submission (screenshot `/tmp/task_after_log.png`). No automated agent run this iteration per user request.

## What's Implemented (2026-02-08 · iteration 11) — Streamlined CTO Project Creation, R&D Budget Builder & CTO Return-to-Sender Loop

### CTO Project Creation (NewProjectDialog)
- [x] Removed the **Client dropdown** and **Estimated end date** field.
- [x] Added **Client project name** (`input-client-project-name`) and **Internal project name** (`input-internal-name`) — the internal name becomes the codename shown across dashboards; the client name is stored on the project record.
- [x] Added **Doc attachment URL** (`input-doc-url`) — Drive/Notion/etc. link visible to allocated members.
- [x] Added **R&D team multi-picker** (`rnd-multi-picker` · toggle pills `rnd-toggle-<id>`). Selected members are stored on `project.rndMembers`; project appears on their dashboards automatically.
- [x] `AppContext.addProject` extended with `docUrl`, `rndMembers`; `visibleProjects` filters R&D users to projects where their name is in `rndMembers` (or they are the TPM).

### Budget Builder (TPM & R&D · `/budget-builder`)
- [x] **Role-aware locks (R&D)** — R&D user sees header "R&D Portal · Budget Builder"; budget type locked to `RnD` (select disabled); delivery mode locked to **Single phase** (Multiple phases toggle removed). TPM can pick `Production` or `RnD` and choose single or multiple phases.
- [x] **Trajectory-driven budget** — Step 1 adds Number of tasks + Est. trajectories / task per phase. Header shows live "Total trajectories" and drives Step 2 model est. cost via `costPerTrajectory(model)`.
- [x] **Models tab simplified** — columns are Model · Provider · Cost/trajectory · Est. cost (no In/Out token inputs).
- [x] **Infra tab reworked** — user enters Monthly cost ($); `≈ $/day` auto-shown; Est. cost = monthly × months.
- [x] **Subscriptions tab reworked** — price/seat + Seats + Months + Assign members pill row. Toggling members adjusts seat count.
- [x] **Doc URL + mock file upload** — Step 1 URL input and mock file picker; both surface on Preview.
- [x] **Edit & Resubmit prefilled from returned review** — `/budget-builder?edit=<reviewId>` loads the review with amber banner and CTO comment; submit CTA becomes `Resubmit budget`. On submit AppContext marks review as `resubmitted`.

### CTO Budget Review Workspace (`/budget-reviews/:id`)
- [x] **Tabs trimmed** — only Overview and Modify Budget remain. Phase-wise, Task-wise, Model/Infra/Subs, Comparison, and Audit tabs removed.
- [x] **Return to TPM/R&D** — new header action `btn-return-tpm` and sidebar target toggle (TPM/R&D). Requires a comment; `AppContext.ctoReturnBudgetReview` writes status `returned-to-tpm`.
- [x] **Overview enriched** — Estimated vs business requirement comparison merged into Overview.

### TPM / R&D Dashboard
- [x] **Returned budgets widget** (`widget-returned-budgets`) shows all reviews returned to the current user with CTO comment. Each card links to `/budget-builder?edit=<id>`.

### Testing
- Iteration 11 test report (`/app/test_reports/iteration_9.json`): **47/47 assertions pass · 100% success** across 8 review flows. No functional bugs.


## What's Implemented (2026-02-08 · iteration 10) — Budget Builder Redesign + Batch Delivery Recovery Loop

### Budget Builder (TPM · `/budget-builder`)
- [x] **3-step flow** (removed the User/Approval tab): **Details → Budget Items → Preview & Submit** with a visual step-pill stepper.
- [x] **Step 1 — Basic Budget Details**: Project · Priority · Budget type · Total number of tasks · Project delivery toggle (`Single phase` / `Multiple phases`).
    - Single phase → estimated start & end dates
    - Multiple phases → per-phase cards with Phase name, Tasks, Start & End dates + `Add phase` button (matches reference image 2)
- [x] **Step 2 — Budget Items**: multi-select budget-type pills (`Models`, `Infrastructure`, `Subscriptions`). Selected types become tabs.
    - **Models tab**: Bedrock model dropdown (Claude Opus 4.8, Sonnet 4.6, Haiku 4.5, Titan Premier, Nova Pro/Lite/Micro, Llama 3.3/3.1, Mistral, Mixtral, Command R+/R, Jamba, Stable Image, embeddings). Est. cost auto-computed from `pricePer1kIn × tokensIn + pricePer1kOut × tokensOut`.
    - **Infrastructure tab**: full EC2 instance dropdown (t3/m5/m6i, c5/c6i, r5, g4dn/g5/p3/p4d/p5, inf1/inf2, trn1) with vCPU/mem/hourly and Qty × Hrs/mo × Months cost calc.
    - **Subscriptions tab**: catalog picker (Claude Max, ChatGPT Team, Cursor Pro, GitHub Enterprise, Figma, Notion, Linear) × Seats × Months.
- [x] **Step 3 — Preview & Submit**: category + phase summaries with an AI insight ribbon.
- [x] Submitting invokes `submitBudget()` in AppContext, which stores the budget and **patches the target project** (`customProjects`) with the new phases, approved budget, budget items, delivery mode, and total tasks — so it flows straight into the Projects section, phase drawer, task log surfaces.

### Batch Delivery + Client Recovery Loop (TPM ↔ CFO)
- [x] **Deliver batch** — new TPM action inside the phase drawer (`drawer-btn-deliver`) opens `DeliverBatchDialog` where TPM enters **proposed recoverable amount**, **client representative** (optional), and **client comment/reason**. Batch = phase. Button disables to `Batch delivered` once submitted.
- [x] **CFO notification** — CFO Dashboard's alert strip now has a 5th tile `Batch deliveries` with a red pulse when `pendingBatchDeliveries > 0` and links to the new page.
- [x] **CFO Projects section** — new page `/batch-deliveries` (sidebar entry `Batch Deliveries`, `nav-batch-deliveries`) shows each delivered batch as a card with proposed amount + client comment. CFO enters **actual amount recovered** + optional note → `recordActualRecovery()`. Status flips to `Recovered · full` or `Recovered · partial` depending on delta. UI shows both proposed vs actual side-by-side with variance chip (+/−).
- [x] **Delivery status card** on the phase drawer surfaces the same data (proposed / actual / client comment / CFO note) — visible to all roles for cross-transparency.

### Files touched
- Added: `data/mockCatalog.js`, `components/DeliverBatchDialog.jsx`, `pages/cfo/BatchDeliveries.jsx`
- Modified: `context/AppContext.jsx` (budgets/batchDeliveries state + submitBudget/deliverBatch/recordActualRecovery), `pages/tpm/BudgetBuilder.jsx` (rewritten), `components/dashboard/ProjectsTable.jsx` (Deliver batch button + status card), `App.js` (route), `components/layout/Sidebar.jsx` (nav), `pages/Dashboard.jsx` (5th CFO tile + pending badge)

### Testing
- Manual smoke tests via screenshots verified: Step 1 single phase, Step 1 multiple phases (matching reference image 2), Step 2 Budget Items with Bedrock model dropdown (matching reference image 1's tabs), CFO Dashboard 5-tile alert strip, CFO Batch Deliveries page. No automated agent run this iteration per user request.

