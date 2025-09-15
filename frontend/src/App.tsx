import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
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
import AdminTokenSetter from "./components/AdminTokenSetter";

const queryClient = new QueryClient();

// Custom route component that only checks auth for admin routes
const AppRoutes = () => {
  const { isAuthenticated } = useApp();
  const location = useLocation();
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Layout wrapper */}
      <Route element={<Layout />}>
        {/* Public routes inside layout */}
        <Route path="/" element={<GroupsPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:groupId" element={<GroupWorkspace />} />
        <Route path="/attendance/live" element={<LiveAttendance />} />
        
        {/* Protected admin routes */}
        <Route path="/admin-dashboard" element={
          <AuthCheck>
            <AdminDashboard />
          </AuthCheck>
        } />
        <Route path="/admin/register" element={
          <AuthCheck>
            <RegisterStudent />
          </AuthCheck>
        } />
        <Route path="/admin/students" element={
          <AuthCheck>
            <ManageStudents />
          </AuthCheck>
        } />
        <Route path="/admin/groups" element={
          <AuthCheck>
            <ManageGroups />
          </AuthCheck>
        } />
        <Route path="/attendance/upload" element={
          <AuthCheck>
            <UploadAttendance />
          </AuthCheck>
        } />
        <Route path="/attendance/logs" element={
          <AuthCheck>
            <AttendanceLogs />
          </AuthCheck>
        } />
      </Route>
      
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
        <AdminTokenSetter />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;