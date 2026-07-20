# Ethara.AI Finance Dashboard

Current implementation snapshot: July 20, 2026

Ethara.AI Finance Dashboard is a role-based internal platform for running AI projects from kickoff through budgeting, approvals, execution, IT provisioning, recovery, and finance reporting. The implementation is project-centric: budgets, tasks, approvals, access, actuals, and CFO monitoring all anchor back to the same project record instead of being spread across disconnected modules.

This README is intended to be the single current-context document for the repository. It explains what the platform does, how the workflow behaves today, which roles own which actions, where the data lives, and which files matter most when someone needs to understand or extend the system.

## 1. Product Summary

The platform currently supports:

- role-based dashboards for `CTO`, `CFO`, `TPM`, `R&D`, `IT`, and a limited legacy `PL`
- project creation with kickoff data, `Project Goal`, document upload, and member allocation
- project-scoped budget building instead of a separate disconnected budgeting module
- provider-first model and infra selection with filtered downstream options
- subscription allocation to selected project members
- R&D execution flow across `Testing`, `Sample`, and `Rework`
- TPM production execution and delivery tracking
- general-budget entry with phase-wise table building and total calculation
- daily task logging plus separate IT-filed actuals
- CTO review and CFO approval with modification, return, partial approval, and rejection flows
- project-scoped change requests after approval
- IT provisioning for keys, access, and internal platform tokens
- CFO comparison of claimed cost versus actual cost
- central auditability and persistence across local and backend-backed modes

## 2. Core Product Intent

The platform is built to solve one main business problem: AI projects should not move through kickoff, budgeting, execution, cost logging, access provisioning, and CFO review as separate spreadsheets or disconnected tools.

Instead, the current implementation treats each project as the source of truth for:

- team membership
- kickoff recipients
- project goal
- requested and approved budgets
- testing and sample progression
- phase-level logging
- general-budget actuals
- delivery and recovery
- IT provisioning and token issuance
- CFO approval history and variance monitoring

## 3. Current Implementation Highlights

These are the most important product behaviors implemented in the codebase today:

- Project creation is split into `Basic info`, `Doc upload`, and `Members allocation`.
- `Project Goal` is captured during kickoff and stored on the project.
- When `R&D` creates a project, `TPM` is not mandatory at creation time; `PL / QL` is also not mandatory.
- R&D member selection is restricted to members from the R&D directory.
- Budgets are raised from inside project workflows through the dedicated Budget Builder page.
- `Build Budget` is the entry point for new projects; after approval, project-level change requests take over.
- Provider selection comes first for both models and infra; the next dropdown is filtered by the selected provider.
- Built-in provider support in the current seeded experience includes `AWS / Bedrock`, `OpenAI`, `OpenRouter`, `GCP`, `Moonshot`, `Azure`, and `AIML APIs`.
- Subscription rows support project-member assignment with multi-select style allocation.
- General budgets can be built phase-wise with custom table sections, custom headers, manual rows, and calculated totals.
- The R&D workflow is intentionally sequential: `Testing` must be submitted before `Sample` becomes active.
- Each phase behaves like a batch. Once one batch is submitted, the next batch becomes active.
- Daily logs entered by TPM / R&D are compared against actuals filed by IT for CFO visibility.
- CFO actions require comments for `approve`, `partial approve`, `return`, and `reject`.
- Rejected budgets grey out the project and block logging until a fresh budget is raised after the retry window.
- Approved budgets and approved changes create IT provisioning requests.
- Provider keys stay masked; project members receive internal platform tokens and route through the gateway.

## 4. Technology Stack

### Frontend

- `React`
- `React Router`
- `CRACO`
- `Tailwind CSS`
- `Radix UI`
- `lucide-react`
- `Recharts`
- `Sonner`

### Backend

- `FastAPI`
- `Pydantic`
- `Uvicorn`
- `Motor / PyMongo`
- `python-dotenv`

### Data And File Handling

- browser `localStorage`
- backend `GET /api/app-state` and `PUT /api/app-state`
- MongoDB when configured
- local JSON fallback in [backend/.local_runtime_data.json](backend/.local_runtime_data.json)
- CSV / spreadsheet-style import helpers for task logs and IT actuals

### Supporting Python Packages Present In The Repo

The backend requirements also include packages for auth, data import, and utilities such as:

- `boto3`
- `cryptography`
- `pyjwt`
- `passlib`
- `pandas`
- `numpy`
- `python-multipart`
- `pytest`, `pytest-xdist`, `black`, `isort`, `flake8`, `mypy`

Not every installed package is used equally in the currently active UI flow, but they are part of the present backend environment.

## 5. Architecture Overview

At a high level, the current system works like this:

```text
React UI
  -> AppContext state layer
  -> localStorage persistence
  -> FastAPI app-state sync
  -> MongoDB or local JSON fallback

Approved budget / approved change request
  -> IT provisioning request
  -> provider key record
  -> internal platform token issuance
  -> /api/gateway/execute validation
  -> usage logging and budget burn tracking
```

### Frontend Architecture

- The application is routed from [frontend/src/App.js](frontend/src/App.js).
- Most business logic currently lives in [frontend/src/context/AppContext.jsx](frontend/src/context/AppContext.jsx).
- Project-level operations converge in [frontend/src/pages/ProjectDetail.jsx](frontend/src/pages/ProjectDetail.jsx).
- Budget intake is handled in [frontend/src/pages/tpm/BudgetBuilder.jsx](frontend/src/pages/tpm/BudgetBuilder.jsx).

### Backend Architecture

- The backend is a thin FastAPI service in [backend/server.py](backend/server.py).
- It primarily handles:
  - application state retrieval
  - application state persistence
  - sample status endpoints
  - gateway token validation and usage logging

### Persistence Model

The app is intentionally usable in multiple persistence modes:

- demo/local mode with seeded data and `localStorage`
- backend-backed mode using `/api/app-state`
- MongoDB-backed hosted mode when `MONGO_URL` and `DB_NAME` are configured
- local file fallback mode when MongoDB is not configured

## 6. Main Data Domains

The current platform state is organized around a few major business objects.

### 6.1 Projects

Each project is the primary record. It can contain or derive:

- client project name
- internal name
- project goal
- start date
- kickoff recipients
- team members
- assigned TPM / R&D / PL / QL context
- approved budget
- budget items
- budget status
- workflow stage
- deliveries
- recovery
- audit history
- IT provisioning linkage
- gateway token visibility

### 6.2 Budget Reviews

Budget reviews are the approval objects used by CTO and CFO. They hold:

- source project reference
- requested budget
- itemized model / infra / subscription / misc data
- CTO adjustments
- CFO adjustments
- approval history
- return / reject notes
- final status

### 6.3 Change Requests

Change requests are now project-scoped and are used for:

- budget changes
- model changes
- infra changes
- subscription changes
- scope or timeline changes tied to the project

### 6.4 Task Logs

Task logs track execution from the delivery side and include:

- phase or batch context
- delivered tasks
- failed tasks
- token counts
- LLM calls
- provider / model usage
- claimed budget consumption

### 6.5 IT Actuals

IT actuals represent the operational cost side and can include:

- daily actual model cost
- daily actual infra cost
- daily actual subscription cost
- month-end actuals
- imported usage rows
- note or reconciliation context for CFO

### 6.6 IT Provisioning Requests

Provisioning requests are created when budgets or changes are approved and carry:

- project reference
- approved amount
- requested models
- requested infra
- requested subscriptions
- eligible project members
- status such as `pending-it` or `completed`

### 6.7 Model Key Records And Access Tokens

These represent gateway-governed access:

- provider key metadata
- masked provider key views
- project mappings
- allowed model mappings
- member assignments
- internal platform tokens
- rate limits
- allowed devices
- allowed networks
- remaining budget
- expiration

### 6.8 Audit Log

Audit history captures important transitions such as:

- project creation
- budget submission
- CTO action
- CFO action
- delivery submission
- IT provisioning activity
- rejection and return notes

## 7. Roles And Responsibilities

| Role | Main responsibility | Current key areas |
| --- | --- | --- |
| `CTO` | Review and control budgets before finance approval | Dashboard, Projects, Budget Reviews, Change Requests, Audit |
| `CFO` | Final budget decisions, variance review, recovery, reporting, buffer governance | Dashboard, Projects, Approval Queue, Financial Monitoring, Early Warning, Monthly Forecast, Buffer, Recovery, Batch Deliveries, Reports, Audit |
| `TPM` | Production-side project execution, budget raising, delivery logging, change requests | Dashboard, My Projects, Daily Consumption, My Requests |
| `R&D` | Testing, sample, rework budgeting and execution | Dashboard, My Projects, Daily Consumption, My Requests |
| `IT` | Provision access, issue platform tokens, file actuals, maintain gateway-governed project access | Dashboard, Projects, Reports |
| `PL` | Limited legacy views retained for continuity | Dashboard, Projects, Daily, Approvals, Reimbursements, Reports, Tasks |

## 8. Navigation By Role

Navigation is defined in [frontend/src/components/layout/Sidebar.jsx](frontend/src/components/layout/Sidebar.jsx).

### CTO

- `Dashboard`
- `Projects`
- `Budget Reviews`
- `Change Requests`
- `Audit Log`

### CFO

- `Dashboard`
- `Projects`
- `Approval Queue`
- `Financial Monitoring`
- `Early Warning`
- `Monthly Forecast`
- `Contingency Buffer`
- `Client Recovery`
- `Batch Deliveries`
- `Reports`
- `Audit Log`
- `Settings`

### TPM And R&D

- `Dashboard`
- `My Projects`
- `Daily Consumption`
- `My Requests`

### IT

- `Dashboard`
- `Projects`
- `Reports`

### Legacy PL

- `Dashboard`
- `Projects`
- `Daily`
- `Approvals`
- `Reimbursements`
- `Reports`
- `Tasks`

## 9. End-To-End Business Flows

### 9.1 Authentication And Demo Access

- Authentication is local/demo oriented.
- Demo users are seeded from [frontend/src/data/mockUsers.js](frontend/src/data/mockUsers.js).
- Quick role login is available from the login screen.
- No external SSO or enterprise identity provider is wired in the current implementation.

### 9.2 Project Creation And Kickoff

Project creation is handled in [frontend/src/components/NewProjectDialog.jsx](frontend/src/components/NewProjectDialog.jsx).

The dialog is split into three tabs:

- `Basic info`
- `Doc upload`
- `Members allocation`

Key behaviors:

- `Client project name`, internal name, `Project Goal`, and start date are captured.
- `Project Goal` is shared with kickoff recipients.
- The project can include document links and a limited set of attachments.
- Kickoff recipients are built from selected members and stored in project state.
- When `R&D` creates a project, assigning a `TPM` is not mandatory at creation time.
- `PL / QL` is not mandatory at creation time.
- Members can be added later from the project workspace.
- Under R&D assignment, only R&D department members are expected to appear.

### 9.3 Project Visibility Rules

Project visibility is role-aware and member-aware.

Examples of the current intended behavior:

- project members added during kickoff can receive kickoff context
- R&D-created projects can later surface to TPM when TPM is assigned
- project visibility follows assignments instead of living only in a generic list
- approval and change history stay attached to the project rather than redirecting users into unrelated modules

### 9.4 Budget Building

Budget intake is centered in [frontend/src/pages/tpm/BudgetBuilder.jsx](frontend/src/pages/tpm/BudgetBuilder.jsx).

Current behaviors include:

- `Build Budget` is used for new projects.
- Budget entry is project-linked even though the builder opens as its own page.
- Dates are labeled `Start Date` and `End Date`.
- The number of `Days` is auto-derived from the selected dates.
- `Team type` appears above budget classification.
- When the selected team type is `R&D`, the R&D-specific `budget type` dropdown is used.
- When the budget is raised from non-R&D contexts, it is treated as production-oriented.
- Current budget tracks include `Testing`, `Sample`, and `Rework`.
- There is no dependency that forces testing budget before sample budget at creation time; whichever R&D budget is needed can be raised.
- Model selection is provider-first, then model-first within that provider.
- Infra selection is provider-first, then instance selection within that provider.
- The provider catalog is used to filter valid downstream options.
- Subscription rows can allocate access to selected project members.
- Preview behavior is project-oriented rather than using a separate AI-cost module.

### General Budget Entry

The general budget flow supports:

- phase-wise structure
- custom table creation
- custom headers
- custom rows
- multiple cost sections
- auto-calculated totals
- approval through the same CTO to CFO flow

This means TPM or ops-style budget owners can define phases first, then enter ask and cost data within those phases.

### 9.5 Approval Flow

Budget approvals currently follow this sequence:

```text
Requester (TPM or R&D)
  -> CTO review
  -> CFO final action
  -> IT provisioning if approved
```

### CTO Review

The CTO workspace is [frontend/src/pages/cto/BudgetReviewWorkspace.jsx](frontend/src/pages/cto/BudgetReviewWorkspace.jsx).

Current CTO actions:

- approve and forward
- modify and forward
- reject
- return for revision

The CTO can change line-item pricing before forwarding. That includes model, infra, subscription, and other budget sections.

Reject and return require comments in the current UI.

### CFO Review

The CFO review workspace is [frontend/src/pages/cfo/ApprovalDetail.jsx](frontend/src/pages/cfo/ApprovalDetail.jsx).

Current CFO actions:

- approve
- partial approve
- return
- reject

Important current rules:

- comment is mandatory for every CFO decision
- CFO can change costing across the full request before deciding
- requester-visible logs are intended to reflect CTO and CFO changes
- approved or partially approved requests route to IT provisioning

### 9.6 Rejection, Return, And Locking Rules

The current implementation includes project-level rejection state.

If a budget is rejected by CTO or CFO:

- the project is greyed out in project views
- task logging is blocked
- execution does not continue on the rejected budget
- the project must wait before raising the next budget
- a rejection note is captured

There is also a retry-delay rule in the current state layer:

- rejected budgets cannot be raised again immediately
- the current implementation stores retry timing on the project
- the builder page blocks direct entry during the retry window

If a request is returned:

- the project is not treated as permanently rejected
- the requester can revise and resubmit

### 9.7 R&D Testing, Sample, And Rework Flow

The R&D path is sequential and batch-based.

Current expected flow:

1. R&D creates or enters the project context.
2. R&D raises the required budget, such as testing or sample.
3. R&D executes the active phase.
4. `Testing` is submitted as a batch.
5. Only after testing submission does `Sample` become active.
6. If sample is accepted, the project progresses toward TPM production.
7. If sample changes are requested or rejected, the project can move into rework logic.

Important current behavior:

- phases behave like batches
- users cannot log for the next phase until the current phase or batch is submitted
- once a batch is submitted, the prior phase becomes unavailable for continued logging
- task actions remain visible but are disabled when that batch has already been submitted

### 9.8 TPM Production Flow

After R&D handoff, TPM drives the production-side execution.

The project detail page acts as the main workspace for:

- current budget status
- budget history
- phase execution
- daily logging
- delivery submission
- change requests
- IT access visibility

TPM can:

- raise the production budget
- log phase execution
- review approvals in `My Requests`
- submit project deliveries
- request project-level budget or scope changes

### 9.9 Deliverable-Based Costing Logic

The current finance model includes deliverable-based cost comparison for CFO visibility.

Implemented business formulas:

- `Per Task Cost = Total Budget Requested / Total Task Count`
- `Claimed Cost = Number of Deliverables Completed x Per Task Cost`
- `Actual Cost = Total Amount Consumed / Number of Tasks Delivered`

How the platform uses this:

- operational teams log delivered tasks
- IT files actual consumed amounts
- CFO compares `Claimed Cost` versus `Actual Cost`
- variances are surfaced for monitoring and financial analysis

This comparison is reflected in CFO-oriented views such as the approval detail and dashboard analytics.

### 9.10 Daily Task Logging

Daily logging is handled primarily through [frontend/src/components/TpmTaskLogDialog.jsx](frontend/src/components/TpmTaskLogDialog.jsx).

Current capabilities include:

- manual task entry
- successful and failed task tracking
- token counts
- LLM call counts
- model cost rollups
- CSV / spreadsheet-style import
- phase-aware logging restrictions

For general-budget projects:

- users can upload a CSV for actuals
- users can also enter rows manually
- those actuals are rolled into project totals
- CFO sees them as actuals for the relevant project

### 9.11 General Budget Actuals And IT Actuals

There are two related but distinct actual layers in the current system:

- project execution logs entered by TPM / R&D
- IT-filed actuals entered from the IT side

The IT dashboard in [frontend/src/pages/it/ItDashboard.jsx](frontend/src/pages/it/ItDashboard.jsx) supports:

- daily actual entry
- imported actuals
- model-level usage capture
- infra and subscription actual capture
- note fields for finance reconciliation context

These actuals feed back into finance-facing comparison views and dashboards.

### 9.12 Change Requests

Change requests are now part of the project flow.

Important current rules:

- separate disconnected change-request modules are not the intended primary experience
- change requests can include budget changes and model / infra / subscription changes
- provider context is carried for model and infra changes
- project users raise the request from the project context
- CTO reviews first
- CFO finalizes when required

### 9.13 Contingency Buffer

The buffer is CFO-governed.

Current intent:

- buffer is not a general requester-facing ask
- non-CFO roles should not have a buffer request flow
- CFO controls contingency allocation from CFO views

### 9.14 IT Provisioning And Key Allocation

Approved budgets and approved changes can create IT provisioning work.

The current IT and key-management model is:

1. CFO approves or partially approves a request.
2. A project-linked IT provisioning request is created.
3. IT stores or maps the provider key.
4. IT assigns project members who should receive access.
5. Project members receive internal platform tokens instead of raw provider keys.
6. Those tokens are used through the internal gateway route.

### Tokenized Gateway Flow

The intended current access flow is:

1. Member receives an internal platform token.
2. Member calls the AI gateway.
3. The gateway validates:
   - token status
   - token owner
   - identity
   - device
   - network
   - allowed model
   - remaining budget
   - rate limit
   - expiration
4. The gateway uses the stored provider-key context.
5. Usage is recorded against the employee and project context.
6. Remaining budget and token usage are updated.

In the repo today:

- provider keys stay masked in the UI
- CFO and IT have elevated visibility
- project teams see tokenized access instead of raw provider secrets
- the backend endpoint [backend/server.py](backend/server.py) exposes `POST /api/gateway/execute`
- the current endpoint validates policy, decrements remaining budget, updates token usage, and stores gateway usage logs

### 9.15 CFO Monitoring, Recovery, And Governance

CFO views aggregate the portfolio through:

- dashboard summaries
- approval queue
- financial monitoring
- early warning
- monthly forecast
- contingency buffer
- client recovery
- batch deliveries
- reports

Current CFO-specific behaviors include:

- cleaner approval detail view with line-item visibility
- comparison of delivery-side logs versus IT-filed actuals
- variance visibility
- approval comments required
- project grey-out and logging lock after rejection

## 10. Current Route Map

The main routes are declared in [frontend/src/App.js](frontend/src/App.js).

| Route | Purpose |
| --- | --- |
| `/` | Role-based dashboard |
| `/login` | Demo login |
| `/projects` | Project list |
| `/projects/:id` | Project detail workspace |
| `/projects/:id/phase/:phaseId` | Phase workspace |
| `/approvals` | Requester-side approvals / my requests |
| `/approvals/:id` | Request detail for requester-side tracking |
| `/budget-builder` | Budget Builder page |
| `/budget-reviews` | CTO budget review queue |
| `/budget-reviews/:id` | CTO budget review workspace |
| `/change-requests` | CTO change request queue |
| `/approval-queue` | CFO approval queue |
| `/approval-queue/:id` | CFO approval detail |
| `/approval-queue/change-request/:id` | CFO change request detail |
| `/financial-monitoring` | CFO financial monitoring |
| `/early-warning` | CFO early warning |
| `/monthly-forecast` | CFO monthly forecast |
| `/buffer` | CFO contingency buffer |
| `/recovery` | Recovery view |
| `/batch-deliveries` | CFO batch deliveries |
| `/reports` | Reports |
| `/audit` | Audit log |

Some legacy routes now redirect back into the project-centric experience:

- `/ai-cost`
- `/topups`
- `/keys`

## 11. Persistence And Sync

The app uses layered persistence so it can work locally and in hosted environments.

### Local-First Behavior

- state is stored in browser `localStorage`
- demo data is seeded from [frontend/src/data/demoState.js](frontend/src/data/demoState.js)

### Backend Sync

- frontend reads from `GET /api/app-state`
- frontend writes to `PUT /api/app-state`

### Backend Storage Options

- MongoDB when `MONGO_URL` and `DB_NAME` are configured
- local file fallback in [backend/.local_runtime_data.json](backend/.local_runtime_data.json)

This is the core mechanism that keeps data saved and syncable when the app is hosted.

## 12. Demo Accounts

The seeded demo users live in [frontend/src/data/mockUsers.js](frontend/src/data/mockUsers.js).

| Role | Email | Password |
| --- | --- | --- |
| `CTO` | `cto@ethara.ai` | `ethara123` |
| `CFO` | `cfo@ethara.ai` | `ethara123` |
| `TPM` | `tpm@ethara.ai` | `ethara123` |
| `PL` | `pl@ethara.ai` | `ethara123` |
| `R&D` | `rd@ethara.ai` | `ethara123` |
| `IT` | `it@ethara.ai` | `ethara123` |

## 13. Local Development

### Prerequisites

- `Node.js`
- `npm`
- `Python 3.10+`

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Optional backend environment variables:

```env
MONGO_URL=your_mongodb_connection_string
DB_NAME=your_database_name
CORS_ORIGINS=http://localhost:3000
```

If MongoDB is not configured, the backend falls back to [backend/.local_runtime_data.json](backend/.local_runtime_data.json).

### Frontend

```bash
cd frontend
npm install
npm start
```

Useful frontend scripts:

```bash
npm run build
npm test
```

Optional frontend environment variable:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

If `REACT_APP_API_BASE_URL` is not set, the frontend still tries common local API base URLs.

## 14. API Surface

The FastAPI server currently exposes:

- `GET /api/`
- `POST /api/status`
- `GET /api/status`
- `GET /api/app-state`
- `PUT /api/app-state`
- `POST /api/gateway/execute`

The most important runtime endpoints are:

- `GET /api/app-state`
- `PUT /api/app-state`
- `POST /api/gateway/execute`

## 15. Important Files To Read First

If someone needs to understand the codebase quickly, start here:

- [frontend/src/context/AppContext.jsx](frontend/src/context/AppContext.jsx)  
  Central state model, workflow transitions, approvals, project updates, persistence, gateway token records, and derived summaries.

- [frontend/src/pages/ProjectDetail.jsx](frontend/src/pages/ProjectDetail.jsx)  
  The main project workspace. Budgets, approvals, tasks, IT access context, deliveries, and changes converge here.

- [frontend/src/pages/tpm/BudgetBuilder.jsx](frontend/src/pages/tpm/BudgetBuilder.jsx)  
  Budget intake, provider filtering, team-type logic, phase costing, subscription allocation, and general-budget tables.

- [frontend/src/pages/cto/BudgetReviewWorkspace.jsx](frontend/src/pages/cto/BudgetReviewWorkspace.jsx)  
  CTO review workspace for budget modification, rejection, return, and forwarding.

- [frontend/src/pages/cfo/ApprovalDetail.jsx](frontend/src/pages/cfo/ApprovalDetail.jsx)  
  CFO decision workspace, line-item editing, mandatory comments, and daily-log versus IT-actual comparison.

- [frontend/src/components/TpmTaskLogDialog.jsx](frontend/src/components/TpmTaskLogDialog.jsx)  
  Task logging, CSV import, model usage capture, and general actual entry.

- [frontend/src/components/NewProjectDialog.jsx](frontend/src/components/NewProjectDialog.jsx)  
  New project flow with `Basic info`, `Doc upload`, and `Members allocation`.

- [frontend/src/pages/it/ItDashboard.jsx](frontend/src/pages/it/ItDashboard.jsx)  
  IT actual entry, provisioning visibility, and gateway-governed access operations.

- [frontend/src/pages/ModelKeys.jsx](frontend/src/pages/ModelKeys.jsx)  
  Provider key governance, masked-key UX, and internal token visibility.

- [frontend/src/lib/generalBudget.js](frontend/src/lib/generalBudget.js)  
  Helpers for general budget and general actual structures.

- [frontend/src/lib/projectMetrics.js](frontend/src/lib/projectMetrics.js)  
  Project summaries, actual rollups, variance helpers, and financial metrics.

- [frontend/src/App.js](frontend/src/App.js)  
  Route map and page registration.

- [backend/server.py](backend/server.py)  
  Backend persistence, app-state sync, and gateway validation.

## 16. Project Structure

```text
backend/
  server.py
  requirements.txt
  .local_runtime_data.json

frontend/
  public/
    platform-overview.html
  src/
    components/
    constants/
    context/
    data/
    hooks/
    lib/
    pages/
    App.js

tests/
memory/
test_reports/
```

## 17. Implementation Notes And Honest Boundaries

These points are important for understanding the repo accurately:

- Authentication is demo-oriented and not enterprise-grade auth.
- Kickoff mail and approval communication are modeled inside app state and audit logs rather than wired to a live email provider.
- Most business workflow logic currently lives in the frontend state layer.
- The backend is primarily a persistence and validation layer.
- Old standalone modules like AI cost and top-ups have been folded back into the project-centric workflow.
- Provider keys are intentionally masked in the UI.
- The gateway endpoint currently validates and records usage against stored token policy; it is not a full external provider orchestration platform in this repo.
- Demo data is intentionally rich so dashboards and role views are visible immediately.

## 18. Recommended Onboarding Path

For a new engineer, reviewer, or product stakeholder, the fastest way to understand the current implementation is:

1. Read this README once end to end.
2. Open [frontend/src/context/AppContext.jsx](frontend/src/context/AppContext.jsx) to understand the central state shape and workflow transitions.
3. Read [frontend/src/components/NewProjectDialog.jsx](frontend/src/components/NewProjectDialog.jsx) to understand kickoff and member allocation.
4. Read [frontend/src/pages/tpm/BudgetBuilder.jsx](frontend/src/pages/tpm/BudgetBuilder.jsx) to understand how budgets are created.
5. Read [frontend/src/pages/ProjectDetail.jsx](frontend/src/pages/ProjectDetail.jsx) to understand the unified project workspace.
6. Read [frontend/src/pages/cto/BudgetReviewWorkspace.jsx](frontend/src/pages/cto/BudgetReviewWorkspace.jsx) and [frontend/src/pages/cfo/ApprovalDetail.jsx](frontend/src/pages/cfo/ApprovalDetail.jsx) to understand approval behavior.
7. Read [frontend/src/pages/it/ItDashboard.jsx](frontend/src/pages/it/ItDashboard.jsx) and [frontend/src/pages/ModelKeys.jsx](frontend/src/pages/ModelKeys.jsx) to understand provisioning and gateway access.
8. Read [backend/server.py](backend/server.py) to understand persistence and gateway validation.

## 19. In One Sentence

This codebase is a project-centric operating system for AI delivery finance: kickoff, budgets, approvals, execution, access provisioning, actuals, recovery, and CFO oversight all flow through the same project record.
