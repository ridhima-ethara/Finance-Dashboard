import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
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
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <div className="App">
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/budget" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/topups" element={<TopUps />} />
              <Route path="/reimbursements" element={<Reimbursements />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/team" element={<Team />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </AppProvider>
    </div>
  );
}

export default App;
