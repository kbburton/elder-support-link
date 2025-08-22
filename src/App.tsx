import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { DemoProvider } from "@/contexts/DemoContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import PasswordReset from "./pages/auth/PasswordReset";
import Onboarding from "./pages/auth/Onboarding";
import AppLayout from "./components/layout/AppLayout";
import CalendarPage from "./pages/app/CalendarPage";
import AdminConsolePage from "./pages/app/AdminConsolePage";
import GroupInvitePage from "./pages/app/GroupInvitePage";
import SearchPage from "./pages/app/SearchPage";
import ProfilePage from "./pages/app/ProfilePage";
import GroupSettingsPage from "./pages/app/GroupSettingsPage";
import InviteAccept from "./pages/auth/InviteAccept";
import UsersCrud from "./pages/crud/UsersCrud";
import CareGroupsCrud from "./pages/crud/CareGroupsCrud";
import CareGroupMembersCrud from "./pages/crud/CareGroupMembersCrud";
import AppointmentsCrud from "./pages/crud/AppointmentsCrud";
import TasksCrud from "./pages/crud/TasksCrud";
import DocumentsCrud from "./pages/crud/DocumentsCrud";
import ActivityLogsCrud from "./pages/crud/ActivityLogsCrud";
import ContactDetailPage from "./pages/app/ContactDetailPage";
import ContactFormPage from "./pages/app/ContactFormPage";
import ContactsImportPage from "./pages/app/ContactsImportPage";
import SearchJobsPage from "./pages/app/SearchJobsPage";
import CreateGroupPage from "./pages/app/CreateGroupPage";
import FeedbackPage from "./pages/app/FeedbackPage";
import TasksPage from "./pages/app/TasksPage";
import AdminEmailPage from "./pages/app/AdminEmailPage";
import ContactsPage from "./pages/app/ContactsPage";
import DocumentsPage from "./pages/app/DocumentsPage";
import ActivityPage from "./pages/app/ActivityPage";
import SystemAdminPage from "./pages/app/SystemAdminPage";
const queryClient = new QueryClient();
const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DemoProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/password-reset" element={<PasswordReset />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/invite/accept" element={<InviteAccept />} />
            <Route path="/invite/:id" element={<InviteAccept />} />
            <Route path="/app/groups/new" element={<CreateGroupPage />} />

            <Route path="/app/:groupId" element={<AppLayout />}>
              <Route index element={<CalendarPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="contacts/:contactId" element={<ContactDetailPage />} />
              <Route path="contacts/:contactId/edit" element={<ContactFormPage />} />
              <Route path="contacts/import" element={<ContactsImportPage />} />
              <Route path="contacts/new" element={<ContactFormPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<GroupSettingsPage />} />
              <Route path="settings/feedback" element={<FeedbackPage />} />
              <Route path="invite" element={<GroupInvitePage />} />
              <Route path="admin" element={<AdminConsolePage />} />
              <Route path="admin/users" element={<UsersCrud />} />
              <Route path="admin/care-groups" element={<CareGroupsCrud />} />
              <Route path="admin/members" element={<CareGroupMembersCrud />} />
              <Route path="admin/appointments" element={<AppointmentsCrud />} />
              <Route path="admin/tasks" element={<TasksCrud />} />
              <Route path="admin/documents" element={<DocumentsCrud />} />
              <Route path="admin/activity-logs" element={<ActivityLogsCrud />} />
              <Route path="admin/search-jobs" element={<SearchJobsPage />} />
              <Route path="admin/email" element={<AdminEmailPage />} />
              <Route path="system-admin" element={<SystemAdminPage />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </DemoProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
