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
1. Wire real backend (FastAPI + MongoDB) with CRUD for projects/expenses/top-ups/approvals
2. Add role gating (Finance can approve reimbursements, COO can approve top-ups, etc.)
3. Replace mock AI with Claude Sonnet 4.5 via emergentintegrations
