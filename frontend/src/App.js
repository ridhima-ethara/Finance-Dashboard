import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import AppShell from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Approvals from "./pages/Approvals";
import TopUps from "./pages/TopUps";
import Reimbursements from "./pages/Reimbursements";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import Tasks from "./pages/Tasks";
import Login from "./pages/Login";
import ModelKeys from "./pages/ModelKeys";
import Daily from "./pages/Daily";
import BudgetBuilder from "./pages/tpm/BudgetBuilder";
import PhaseWorkspace from "./pages/tpm/PhaseWorkspace";
import AiCost from "./pages/tpm/AiCost";
import Consumption from "./pages/tpm/Consumption";
import CtoReview from "./pages/tpm/CtoReview";
import Reports from "./pages/Reports";
import { Toaster } from "./components/ui/sonner";

const Protected = ({ children }) => {
  const { isAuth } = useApp();
  const location = useLocation();
  if (!isAuth) return <Navigate to="/login" replace state={{ from: location }} />;
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
              <Route path="/topups" element={<TopUps />} />
              <Route path="/reimbursements" element={<Reimbursements />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/team" element={<Team />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/keys" element={<ModelKeys />} />
              <Route path="/daily" element={<Daily />} />
              <Route path="/budget-builder" element={<BudgetBuilder />} />
              <Route path="/projects/:id/phase/:phaseId" element={<PhaseWorkspace />} />
              <Route path="/ai-cost" element={<AiCost />} />
              <Route path="/consumption" element={<Consumption />} />
              <Route path="/cto-review/:id" element={<CtoReview />} />
              <Route path="/cto-review" element={<CtoReview />} />
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
