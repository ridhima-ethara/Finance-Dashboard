import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import AiPanel from "./AiPanel";
import NotificationsDrawer from "./NotificationsDrawer";

const AppShell = () => {
  return (
    <div className="min-h-screen bg-slate-50" data-testid="app-shell">
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar />
        <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
      <AiPanel />
      <NotificationsDrawer />
    </div>
  );
};

export default AppShell;
