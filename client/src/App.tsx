import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";
import Tasks from "@/pages/Tasks";
import Communications from "@/pages/Communications";
import Settings from "@/pages/Settings";
import DropdownHub from "@/pages/DropdownHub";
import DropdownTypePage from "@/pages/DropdownTypePage";
import Login from "@/pages/Login";
import Reminders from "@/pages/Reminders";
import Stakeholders from "@/pages/Stakeholders";
import Contacts from "@/pages/Contacts";
import EngagementDashboard from "@/pages/EngagementDashboard";
import StakeholderDashboard from "@/pages/StakeholderDashboard";
import Users from "@/pages/Users";
import RolesInfo from "@/pages/RolesInfo";
import RoleDescriptionExample from "@/pages/RoleDescriptionExample";
import FilesManagement from "@/pages/FilesManagement";
import PermissionManager from "@/pages/PermissionManager";
import EventFiles from "@/pages/EventFiles";
import EventDetail from "@/pages/EventDetail";
import Updates from "@/pages/Updates";
import AllUpdates from "@/pages/AllUpdates";
import Scrapers from "@/pages/Scrapers";
import WhatsAppSettings from "@/pages/WhatsAppSettings";
import PublicArchive from "@/pages/PublicArchive";
import ArchiveDetail from "@/pages/ArchiveDetail";
import AdminArchive from "@/pages/AdminArchive";
import Workflows from "@/pages/Workflows";
import Partnerships from "@/pages/Partnerships";
import PartnershipDetail from "@/pages/PartnershipDetail";
import LeadManagement from "@/pages/LeadManagement";
import LeadDetail from "@/pages/LeadDetail";
import SearchResults from "@/pages/SearchResults";
import ElasticsearchAdmin from "@/pages/ElasticsearchAdmin";
import AIChatPage from "@/pages/AIChatPage";
import AIAssistant from "@/pages/AIAssistant";
import ExecutiveDashboard from "@/pages/analytics/ExecutiveDashboard";
import EventsDashboard from "@/pages/analytics/EventsDashboard";
import PartnershipsDashboard from "@/pages/analytics/PartnershipsDashboard";
import TasksDashboard from "@/pages/analytics/TasksDashboard";
import ContactsDashboard from "@/pages/analytics/ContactsDashboard";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { FiltersProvider } from "@/hooks/use-filters";
import { ProtectedRoute } from "@/lib/protected-route";
import { UnifiedLayout } from "@/components/UnifiedLayout";
import { LanguageProvider } from "@/contexts/LanguageContext";
import "@/i18n/config";

function Router() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isDepartmentScoped = user?.departmentId != null || user?.role === 'department' || user?.role === 'department_admin';
  const { data: settings, isLoading: isSettingsLoading } = useQuery<{ archiveEnabled?: boolean }>({
    queryKey: ['/api/settings'],
  });

  const isArchiveDisabled = settings?.archiveEnabled === false;
  
  // Define all routes in one place
  const routes = (
    <Switch>
      {/* Landing page for non-authenticated users, Dashboard for authenticated users */}
      <Route path="/">
        {() => (user ? <Dashboard /> : <LandingPage />)}
      </Route>
      <Route path="/calendar" component={Home} />
      <Route path="/login" component={Login} />
      {/* Public Archive Routes */}
      <Route path="/archive">
        {() => {
          if (isSettingsLoading) return null;
          return isArchiveDisabled ? <Redirect to="/" /> : <PublicArchive />;
        }}
      </Route>
      <Route path="/archive/:id">
        {(params) => {
          if (isSettingsLoading) return null;
          return isArchiveDisabled ? <Redirect to="/" /> : <ArchiveDetail id={params.id} />;
        }}
      </Route>
      {/* Redirect /admin to dashboard */}
      <Route path="/admin" component={Dashboard} />
      <ProtectedRoute path="/admin/tasks" component={Tasks} />
      <ProtectedRoute path="/admin/communications" component={Communications} />
      <ProtectedRoute path="/admin/stakeholders" component={Stakeholders} />
      <ProtectedRoute path="/admin/contacts" component={Contacts} />
      <ProtectedRoute path="/admin/engagement" component={EngagementDashboard} />
      <ProtectedRoute path="/admin/reminders" component={Reminders} />
      <ProtectedRoute path="/admin/updates" component={Updates} />
      <ProtectedRoute path="/admin/all-updates" component={AllUpdates} />
      <ProtectedRoute path="/admin/users" component={Users} />
      <ProtectedRoute path="/admin/roles" component={RolesInfo} />
      <ProtectedRoute path="/admin/roles-example" component={RoleDescriptionExample} />
      <ProtectedRoute path="/admin/permissions" component={PermissionManager} />
      <ProtectedRoute path="/admin/files-management" component={FilesManagement} />
      <ProtectedRoute path="/admin/events/:eventId/files" component={EventFiles} />
      <ProtectedRoute path="/admin/events/:eventId" component={EventDetail} />
      <ProtectedRoute path="/admin/scrapers" component={Scrapers} />
      <ProtectedRoute path="/admin/whatsapp" component={WhatsAppSettings} />
      <ProtectedRoute path="/admin/archive" component={AdminArchive} />
      <ProtectedRoute path="/admin/workflows" component={Workflows} />
      <ProtectedRoute path="/admin/partnerships/:id" component={PartnershipDetail} />
      <ProtectedRoute path="/admin/partnerships" component={Partnerships} />
      <ProtectedRoute path="/admin/leads/:id" component={LeadDetail} />
      <ProtectedRoute path="/admin/leads" component={LeadManagement} />
      <ProtectedRoute path="/admin/dropdowns/:type" component={DropdownTypePage} />
      <ProtectedRoute path="/admin/dropdowns" component={DropdownHub} />
      <ProtectedRoute path="/admin/settings" component={Settings} />
      <ProtectedRoute path="/admin/search" component={SearchResults} />
      <ProtectedRoute path="/admin/elasticsearch" component={ElasticsearchAdmin} />
      <ProtectedRoute path="/admin/ai/intake" component={AIAssistant} />
      <ProtectedRoute path="/admin/ai" component={AIChatPage} />
      <ProtectedRoute path="/admin/analytics/events" component={EventsDashboard} />
      <ProtectedRoute path="/admin/analytics/partnerships" component={PartnershipsDashboard} />
      <ProtectedRoute path="/admin/analytics/tasks" component={TasksDashboard} />
      <ProtectedRoute path="/admin/analytics/contacts" component={ContactsDashboard} />
      <ProtectedRoute path="/admin/analytics" component={ExecutiveDashboard} />
      <Route path="/stakeholder-dashboard">
        {isDepartmentScoped || user?.role === 'stakeholder' ? (
          <StakeholderDashboard />
        ) : (
          <Redirect to="/" />
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
  
  // Show sidebar for authenticated users (except on login page and public archive pages)
  const isPublicArchivePage = location === '/archive' || location.startsWith('/archive/');
  if (user && location !== '/login' && !isPublicArchivePage) {
    return <UnifiedLayout>{routes}</UnifiedLayout>;
  }
  
  // No sidebar for unauthenticated users or on login page or public archive pages
  return routes;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <FiltersProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </FiltersProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
