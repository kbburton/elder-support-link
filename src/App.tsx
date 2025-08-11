import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Onboarding from "./pages/auth/Onboarding";
import AppLayout from "./components/layout/AppLayout";
import CalendarPage from "./pages/app/CalendarPage";
import TasksPage from "./pages/app/TasksPage";
import DocumentsPage from "./pages/app/DocumentsPage";
import ActivityLogPage from "./pages/app/ActivityLogPage";
import AdminConsolePage from "./pages/app/AdminConsolePage";
import SearchPage from "./pages/app/SearchPage";
import ProfilePage from "./pages/app/ProfilePage";
import GroupSettingsPage from "./pages/app/GroupSettingsPage";
import UsersCrud from "./pages/crud/UsersCrud";
import CareGroupsCrud from "./pages/crud/CareGroupsCrud";
import CareGroupMembersCrud from "./pages/crud/CareGroupMembersCrud";
import AppointmentsCrud from "./pages/crud/AppointmentsCrud";
import TasksCrud from "./pages/crud/TasksCrud";
import DocumentsCrud from "./pages/crud/DocumentsCrud";
import ActivityLogsCrud from "./pages/crud/ActivityLogsCrud";
const queryClient = new QueryClient();
const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />

            <Route path="/app/:groupId" element={<AppLayout />}>
              <Route index element={<CalendarPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="activity" element={<ActivityLogPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<GroupSettingsPage />} />
              <Route path="admin" element={<AdminConsolePage />} />
              <Route path="admin/users" element={<UsersCrud />} />
              <Route path="admin/care-groups" element={<CareGroupsCrud />} />
              <Route path="admin/members" element={<CareGroupMembersCrud />} />
              <Route path="admin/appointments" element={<AppointmentsCrud />} />
              <Route path="admin/tasks" element={<TasksCrud />} />
              <Route path="admin/documents" element={<DocumentsCrud />} />
              <Route path="admin/activity-logs" element={<ActivityLogsCrud />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
