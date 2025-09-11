import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import Layout from "./components/Layout";
import AdminDashboard from "./pages/AdminDashboard";
import RegisterStudent from "./pages/RegisterStudent";
import ManageStudents from "./pages/ManageStudents";
import LiveAttendance from "./pages/LiveAttendance";
import UploadAttendance from "./pages/UploadAttendance";
import AttendanceLogs from "./pages/AttendanceLogs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/admin/register" element={<RegisterStudent />} />
              <Route path="/admin/students" element={<ManageStudents />} />
              <Route path="/attendance/live" element={<LiveAttendance />} />
              <Route path="/attendance/upload" element={<UploadAttendance />} />
              <Route path="/attendance/logs" element={<AttendanceLogs />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
