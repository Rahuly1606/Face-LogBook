import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import Layout from "./components/Layout";
import AdminDashboard from "./pages/AdminDashboard";
import RegisterStudent from "./pages/RegisterStudent";
import ManageStudents from "./pages/ManageStudents";
import ManageGroups from "./pages/ManageGroups";
import LiveAttendance from "./pages/LiveAttendance";
import UploadAttendance from "./pages/UploadAttendance";
import AttendanceLogs from "./pages/AttendanceLogs";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import GroupsPage from "./pages/GroupsPage";
import GroupWorkspace from "./pages/GroupWorkspace";
import Diagnostics from "./pages/Diagnostics";
import AuthCheck from "./components/AuthCheck";

const queryClient = new QueryClient();

// Application routes
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public login route */}
      <Route path="/login" element={<Login />} />

      {/* Protected application routes inside layout */}
      <Route element={<AuthCheck><Layout /></AuthCheck>}>
        {/* Default redirect after login */}
        <Route path="/" element={<Navigate to="/admin-dashboard" replace />} />

        {/* All app functionality is protected */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin/register" element={<RegisterStudent />} />
        <Route path="/admin/students" element={<ManageStudents />} />
        <Route path="/admin/groups" element={<ManageGroups />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:groupId" element={<GroupWorkspace />} />
        <Route path="/attendance/live" element={<LiveAttendance />} />
        <Route path="/attendance/upload" element={<UploadAttendance />} />
        <Route path="/attendance/logs" element={<AttendanceLogs />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
      </Route>

      {/* Not found */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;