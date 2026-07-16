import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import AppShell from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Approvals from "./pages/Approvals";
import MyRequestDetail from "./pages/MyRequestDetail";
import Reimbursements from "./pages/Reimbursements";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import Tasks from "./pages/Tasks";
import Login from "./pages/Login";
import Daily from "./pages/Daily";
import PhaseWorkspace from "./pages/tpm/PhaseWorkspace";
import Consumption from "./pages/tpm/Consumption";
import BudgetBuilder from "./pages/tpm/BudgetBuilder";
import BudgetReviews from "./pages/cto/BudgetReviews";
import BudgetReviewWorkspace from "./pages/cto/BudgetReviewWorkspace";
import ChangeRequests from "./pages/cto/ChangeRequests";
import ProjectMonitoring from "./pages/cto/ProjectMonitoring";
import ApprovalQueue from "./pages/cfo/ApprovalQueue";
import ApprovalDetail from "./pages/cfo/ApprovalDetail";
import ChangeRequestDetail from "./pages/cfo/ChangeRequestDetail";
import TopupRequestDetail from "./pages/TopupRequestDetail";
import CfoBatchDeliveries from "./pages/cfo/BatchDeliveries";
import FinancialMonitoring from "./pages/cfo/FinancialMonitoring";
import Buffer from "./pages/cfo/Buffer";
import Recovery from "./pages/cfo/Recovery";
import EarlyWarning from "./pages/cfo/EarlyWarning";
import MonthlyForecast from "./pages/cfo/MonthlyForecast";
import Reports from "./pages/Reports";
import { Toaster } from "./components/ui/sonner";

const Protected = ({ children }) => {
  const { isAuth } = useApp();
  const location = useLocation();
  if (!isAuth) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
};

const RoleProtected = ({ roles = [], children }) => {
  const { role } = useApp();
  if (roles.length && !roles.includes(role)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <div className="App">
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <Protected>
                  <AppShell />
                </Protected>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/approvals/:id" element={<MyRequestDetail />} />
              <Route path="/topups" element={<Navigate to="/projects" replace />} />
              <Route path="/reimbursements" element={<Reimbursements />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/team" element={<Team />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/keys" element={<Navigate to="/projects" replace />} />
              <Route path="/daily" element={<Daily />} />
              <Route path="/budget-builder" element={<BudgetBuilder />} />
              <Route path="/projects/:id/phase/:phaseId" element={<PhaseWorkspace />} />
              <Route path="/ai-cost" element={<Navigate to="/projects" replace />} />
              <Route path="/consumption" element={<Consumption />} />
              <Route path="/budget-reviews" element={<BudgetReviews />} />
              <Route path="/budget-reviews/:id" element={<BudgetReviewWorkspace />} />
              <Route path="/change-requests" element={<ChangeRequests />} />
              <Route path="/monitoring" element={<ProjectMonitoring />} />
              <Route path="/approval-queue" element={<ApprovalQueue />} />
              <Route
                path="/approval-queue/:id"
                element={(
                  <RoleProtected roles={["CFO"]}>
                    <ApprovalDetail />
                  </RoleProtected>
                )}
              />
              <Route path="/approval-queue/change-request/:id" element={<ChangeRequestDetail />} />
              <Route path="/topup-requests/:id" element={<TopupRequestDetail />} />
              <Route path="/batch-deliveries" element={<CfoBatchDeliveries />} />
              <Route path="/financial-monitoring" element={<FinancialMonitoring />} />
              <Route
                path="/buffer"
                element={(
                  <RoleProtected roles={["CFO"]}>
                    <Buffer />
                  </RoleProtected>
                )}
              />
              <Route path="/recovery" element={<Recovery />} />
              <Route path="/early-warning" element={<EarlyWarning />} />
              <Route path="/monthly-forecast" element={<MonthlyForecast />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" theme="dark" />
      </AppProvider>
    </div>
  );
}

export default App;
