# Ethara.AI Finance Dashboard

Role-based operating workspace for AI project finance, delivery control, budget approvals, task logging, and IT access provisioning.

This repository is organized around a project-centric workflow. Budgets, daily logs, batch submissions, approvals, subscriptions, model access, recovery tracking, and CFO monitoring all feed back into the same project record instead of living as disconnected modules.

## What Is Implemented

- Role-aware dashboards for `CTO`, `CFO`, `TPM`, `R&D`, `IT`, and a limited legacy `PL/QL` experience.
- Project creation with kickoff metadata, `Project Goal`, start date, attachments, and seeded recipients.
- Team assignment rules, including R&D-only member selection for R&D sections and the ability to add members later.
- R&D lifecycle support for `Testing -> Sample -> Rework -> TPM production handoff`.
- Budget Builder with provider-first model and infra selection, subscription member assignment, and general-budget table entry.
- Daily task logging for model-based execution plus daily actual logging for general-budget projects.
- CTO review and CFO approval flows for budgets and project-linked budget changes.
- Batch submission and recovery workflows.
- IT provisioning queues created automatically from approved budgets and approved change requests.
- CFO monitoring views for approvals, recovery, early warning, monthly forecast, buffer, and reporting.
- Demo state plus local and backend-backed persistence.

## Technology Stack

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

### Persistence

- Browser `localStorage` for local-first state
- Backend `/api/app-state` sync endpoint
- Optional MongoDB persistence when `MONGO_URL` and `DB_NAME` are configured
- Local file fallback in [backend/.local_runtime_data.json](backend/.local_runtime_data.json)

## Role Model

| Role | Primary responsibility | Main areas |
| --- | --- | --- |
| `CTO` | Budget review, risk oversight, audit visibility | Dashboard, Projects, Budget Reviews, Change Requests, Audit Log |
| `CFO` | Final approval, recovery, forecast, buffer, reporting | Dashboard, Projects, Approval Queue, Financial Monitoring, Early Warning, Monthly Forecast, Buffer, Recovery, Batch Deliveries, Reports |
| `TPM` | Production budgeting, project execution, recovery submissions | Dashboard, My Projects, Budget Builder, Daily Consumption, My Requests |
| `R&D` | Testing/sample budgeting and execution | Dashboard, My Projects, Budget Builder, Daily Consumption, My Requests |
| `IT` | Access provisioning and post-approval visibility | Dashboard, Projects, Reports |
| `PL / QL` | Legacy/limited support views | Dashboard, Projects, Daily, Approvals, Reimbursements, Reports, Tasks |

Notes:

- Quick role login is available in the local workspace.
- Some legacy routes now redirect back into project-centric views, for example standalone `AI Cost`, `Top-ups`, and `Keys`.

## Implemented Business Flows

### 1. Project Creation And Kickoff

- Projects can be created from the frontend by `CTO`, `TPM`, or `R&D`.
- When `R&D` creates a project, `TPM` and `PL/QL` are not mandatory at creation time.
- `Project Goal` is captured during kickoff and stored on the project.
- Kickoff recipients are built from assigned members and stored in project state.
- Attachments and kickoff artifacts are tracked in the project record.
- Project members can be added later from the project workspace.
- Core members such as TPM and R&D lead can be updated later.
- Assigned membership drives downstream visibility for dashboards, budget access, and subscription allocation.

### 2. Budget Raising And Approval

- Budget requests are raised from [frontend/src/pages/tpm/BudgetBuilder.jsx](frontend/src/pages/tpm/BudgetBuilder.jsx).
- Each budget can be tagged with a `Team type` such as `Technical`, `Generalist`, or `R&D`.
- Model costing is `provider-first`, then filtered model selection.
- Infra costing is `provider-first`, then filtered instance selection.
- Subscription lines pull selectable members from the current project roster.
- Start and end dates drive the total number of days used in costing.
- General budgets are raised through a custom phase-wise table, not a separate list/request mode.
- Submitted budgets move through `CTO -> CFO`.
- CTO can approve/forward, partially modify/forward, reject, or return for edits.
- CFO can approve, partially approve, reject, or return depending on the review state.
- Approved budgets update the project baseline and create IT provisioning requests when relevant.

### 3. R&D Testing, Sample, And Rework Flow

- R&D work is intentionally sequential.
- `Testing` budgets are treated as direct-cost estimates.
- After testing execution, R&D submits a `testing batch`.
- Testing submission does not use accept/reject/change-review controls.
- After testing submission, the project moves to the next `Sample` budget step.
- Sample execution can then proceed after the sample budget is raised and approved.
- Sample delivery supports accept, reject, or changes requested.
- Accepted sample delivery moves the project into TPM production readiness.
- Change-requested sample delivery can route the project into rework budgeting.

### 4. Production Execution And Batch Recovery

- TPM raises the production budget after the project is ready for TPM handoff.
- Daily task execution is logged phase by phase.
- Production batch delivery records proposed recovery values and client comments.
- CFO records actual recovered values and variance against proposed recovery.
- Recovery status rolls into project summaries and CFO monitoring.

### 5. Daily Task Logging

- Daily task logging is handled from [frontend/src/components/TpmTaskLogDialog.jsx](frontend/src/components/TpmTaskLogDialog.jsx).
- Model-based logs support:
  - successful-task rows
  - failed-task rows
  - token counts
  - LLM calls
  - model-level cost aggregation
- CSV and Excel import are supported for successful and failed task sheets.
- Task logs are editable within a 24-hour window.
- Task approval state is tied to budget/delivery status.
- In the project Tasks tab, the `Log task` action remains visible for the execution owner and is disabled once that batch is already submitted.

### 6. General Budget Actuals

- General-budget projects can log actuals separately from model usage.
- Users can upload a CSV/Excel file or add rows manually.
- Header-based row structures are supported for phase-wise general actuals.
- Cost totals from general actuals are rolled into project spend.
- Those general actuals are included in CFO actual views and downstream summaries.

### 7. Project-Scoped Budget Changes

- Budget changes are created in project context rather than relying on a separate disconnected budgeting experience.
- Change requests can carry model, infra, and subscription breakdowns.
- CTO reviews first.
- CFO finalizes the financial decision when required.
- Approved changes update project budgets and can also create IT provisioning requests.

### 8. IT Provisioning

- Approved budgets and approved change requests can create pending IT provisioning work.
- IT requests include:
  - requested models
  - requested infra
  - requested subscriptions
  - project members eligible for assignment
- IT can provision keys/access lines and map them to selected project members.
- Provisioned records are then stored in project-linked key/access state.

### 9. CFO Monitoring And Governance

- CFO views aggregate approved budget, actuals, utilization, recovery, and forecast.
- Early warning and monthly forecast screens are available.
- Contingency buffer controls are available to CFO only.
- Reports and exports are built from the same central state model.
- Audit entries are recorded across project creation, budget submission, approvals, delivery, and provisioning.

## Current Navigation Model

The app is routed from [frontend/src/App.js](frontend/src/App.js) and role navigation is defined in [frontend/src/components/layout/Sidebar.jsx](frontend/src/components/layout/Sidebar.jsx).

Key pages include:

- `Dashboard`
- `Projects`
- `Project Detail`
- `Budget Builder`
- `Budget Reviews`
- `Approval Queue`
- `Financial Monitoring`
- `Batch Deliveries`
- `Recovery`
- `Reports`

## Persistence And Sync Model

The app uses a layered persistence approach:

- Browser state is stored in `localStorage`.
- The frontend hydrates from `/api/app-state` when the backend is available.
- The frontend also pushes updates back to `/api/app-state`.
- The backend stores app state in MongoDB when configured.
- If MongoDB is not configured, the backend falls back to [backend/.local_runtime_data.json](backend/.local_runtime_data.json).
- Demo data is seeded from [frontend/src/data/demoState.js](frontend/src/data/demoState.js).

This means the project works in both:

- local/demo mode without a database
- hosted mode with backend-backed saved state

## Demo Login Accounts

These are defined in [frontend/src/data/mockUsers.js](frontend/src/data/mockUsers.js).

| Role | Email | Password |
| --- | --- | --- |
| `CTO` | `cto@ethara.ai` | `ethara123` |
| `CFO` | `cfo@ethara.ai` | `ethara123` |
| `TPM` | `tpm@ethara.ai` | `ethara123` |
| `PL` | `pl@ethara.ai` | `ethara123` |
| `R&D` | `rd@ethara.ai` | `ethara123` |
| `IT` | `it@ethara.ai` | `ethara123` |

Quick role cards are also available on the login screen for local use.

## Local Development

### Prerequisites

- `Node.js`
- `npm` or `yarn`
- `Python 3.10+`

### Backend

```bash
cd backend
python -m venv .venv
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

If `MONGO_URL` and `DB_NAME` are not provided, the backend uses local file persistence.

### Frontend

```bash
cd frontend
npm install
npm start
```

Useful frontend commands:

```bash
npm run build
npm test
```

Optional frontend environment variable:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

If not set, the frontend still tries common local API bases like `http://localhost:8000` and `http://localhost:8001`.

## API Surface

The FastAPI server currently exposes:

- `GET /api/`
- `POST /api/status`
- `GET /api/status`
- `GET /api/app-state`
- `PUT /api/app-state`

The most important runtime endpoint for the app is `GET/PUT /api/app-state`.

## Important Files To Understand First

If someone needs to understand the implementation quickly, start here:

- [frontend/src/context/AppContext.jsx](frontend/src/context/AppContext.jsx)
  Central state container, workflow rules, persistence, approvals, project updates, provisioning, and derived project metrics.

- [frontend/src/pages/ProjectDetail.jsx](frontend/src/pages/ProjectDetail.jsx)
  Main project workspace. Budget tracks, task logs, deliveries, approvals, provisioning, and team management converge here.

- [frontend/src/pages/tpm/BudgetBuilder.jsx](frontend/src/pages/tpm/BudgetBuilder.jsx)
  Budget intake flow for R&D and TPM, including provider filtering, phase-based costing, subscription allocation, and general-budget tables.

- [frontend/src/components/TpmTaskLogDialog.jsx](frontend/src/components/TpmTaskLogDialog.jsx)
  Daily execution logging, CSV/Excel import, model usage capture, and general actual logging.

- [frontend/src/components/NewProjectDialog.jsx](frontend/src/components/NewProjectDialog.jsx)
  Project creation, kickoff metadata, project goal capture, and team assignment rules.

- [frontend/src/components/DeliverBatchDialog.jsx](frontend/src/components/DeliverBatchDialog.jsx)
  R&D testing/sample submissions and TPM production delivery behavior.

- [frontend/src/lib/generalBudget.js](frontend/src/lib/generalBudget.js)
  Parsing, normalization, totals, and table helpers for general budgets and general actuals.

- [frontend/src/lib/projectMetrics.js](frontend/src/lib/projectMetrics.js)
  Lane separation, spend rollups, workflow normalization, and project summaries.

- [backend/server.py](backend/server.py)
  Runtime API and persistence sync endpoint.

## Project Structure

```text
backend/
  server.py
  requirements.txt
  .local_runtime_data.json

frontend/
  src/
    components/
    context/
    data/
    lib/
    pages/

tests/
memory/
test_reports/
```

## Implementation Notes And Assumptions

- Authentication is local/demo-oriented and not wired to an external identity provider.
- Kickoff mail and approval history are modeled in application state and audit logs.
- The project uses seeded demo data to make dashboards and workflows immediately visible.
- Standalone AI-cost style views have been folded into the project and approval workflows rather than kept as a separate active module.
- The business logic currently lives primarily in the frontend state layer, with the backend focused on persistence and sync.

## Recommended Onboarding Path

For a new developer or reviewer, the quickest way to understand the implementation is:

1. Read this README for the role model and workflow map.
2. Open [frontend/src/context/AppContext.jsx](frontend/src/context/AppContext.jsx) to understand how state and workflow transitions are stored.
3. Review [frontend/src/pages/tpm/BudgetBuilder.jsx](frontend/src/pages/tpm/BudgetBuilder.jsx) for budget intake and pricing behavior.
4. Review [frontend/src/pages/ProjectDetail.jsx](frontend/src/pages/ProjectDetail.jsx) for the unified project experience.
5. Review [frontend/src/components/TpmTaskLogDialog.jsx](frontend/src/components/TpmTaskLogDialog.jsx) for task and actual logging behavior.
6. Review [backend/server.py](backend/server.py) for persistence and deployment expectations.
