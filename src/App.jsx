import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleProtectedRoute from '@/components/RoleProtectedRoute';
import { TestDataProvider } from '@/lib/TestDataContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import PublicLayout from '@/components/PublicLayout';
import CommandCenterLayout from '@/components/CommandCenterLayout';
import ClientPortalLayout from '@/components/portal/ClientPortalLayout';
import ClientEntitlementRoute from '@/components/portal/ClientEntitlementRoute';

// Lazy-loaded auth pages
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

// Lazy-loaded public site pages
const Home = lazy(() => import('@/pages/Home'));
const About = lazy(() => import('@/pages/About'));
const Services = lazy(() => import('@/pages/Services'));
const ServiceDetail = lazy(() => import('@/pages/ServiceDetail'));
const RapidSurveyRecovery = lazy(() => import('@/pages/RapidSurveyRecovery'));
const WhoWeHelp = lazy(() => import('@/pages/WhoWeHelp'));
const Resources = lazy(() => import('@/pages/Resources'));
const ResourceDetail = lazy(() => import('@/pages/ResourceDetail'));
const FAQ = lazy(() => import('@/pages/FAQ'));
const Contact = lazy(() => import('@/pages/Contact'));
const Accessibility = lazy(() => import('@/pages/Accessibility'));

// Lazy-loaded command center pages
const Dashboard = lazy(() => import('@/pages/cc/Dashboard'));
const Leads = lazy(() => import('@/pages/cc/Leads'));
const Pipeline = lazy(() => import('@/pages/cc/Pipeline'));
const Facilities = lazy(() => import('@/pages/cc/Facilities'));
const Contacts = lazy(() => import('@/pages/cc/Contacts'));
const Tasks = lazy(() => import('@/pages/cc/Tasks'));
const Signals = lazy(() => import('@/pages/cc/Signals'));
const Agents = lazy(() => import('@/pages/cc/Agents'));
const Outreach = lazy(() => import('@/pages/cc/Outreach'));
const Proposals = lazy(() => import('@/pages/cc/Proposals'));
const LaunchReadiness = lazy(() => import('@/pages/cc/LaunchReadiness'));
const Engagements = lazy(() => import('@/pages/cc/Engagements'));
const Settings = lazy(() => import('@/pages/cc/Settings'));
const RecoveryDashboard = lazy(() => import('@/pages/cc/RecoveryDashboard'));
const Cases = lazy(() => import('@/pages/cc/Cases'));
const CaseDetail = lazy(() => import('@/pages/cc/CaseDetail'));
const DeficiencyDetail = lazy(() => import('@/pages/cc/DeficiencyDetail'));
const Knowledge = lazy(() => import('@/pages/cc/Knowledge'));
const ClientAccounts = lazy(() => import('@/pages/cc/ClientAccounts'));
const UserIdentityManagement = lazy(() => import('@/pages/cc/UserIdentityManagement'));

// Lazy-loaded client portal pages
const ClientDashboard = lazy(() => import('@/pages/portal/Dashboard'));
const ClientEngagements = lazy(() => import('@/pages/portal/Engagements'));
const ClientEngagementDetail = lazy(() => import('@/pages/portal/EngagementDetail'));
const ClientRecovery = lazy(() => import('@/pages/portal/Recovery'));
const ClientPOCs = lazy(() => import('@/pages/portal/POCs'));
const ClientWorkProducts = lazy(() => import('@/pages/portal/WorkProducts'));
const ClientEvidence = lazy(() => import('@/pages/portal/Evidence'));
const ClientAudits = lazy(() => import('@/pages/portal/Audits'));
const ClientTasks = lazy(() => import('@/pages/portal/Tasks'));
const ClientReadiness = lazy(() => import('@/pages/portal/Readiness'));
const ClientDocuments = lazy(() => import('@/pages/portal/Documents'));
const ClientAccount = lazy(() => import('@/pages/portal/Account'));
const ClientCaseDetail = lazy(() => import('@/pages/portal/CaseDetail'));
const ClientDeficiencyDetail = lazy(() => import('@/pages/portal/DeficiencyDetail'));
const AccessPending = lazy(() => import('@/pages/AccessPending'));
const MyProfile = lazy(() => import('@/pages/MyProfile'));

const SuspenseFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<SuspenseFallback />}>
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public website */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/:slug" element={<ServiceDetail />} />
        <Route path="/rapid-survey-recovery" element={<RapidSurveyRecovery />} />
        <Route path="/who-we-help" element={<WhoWeHelp />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:slug" element={<ResourceDetail />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/accessibility" element={<Accessibility />} />
      </Route>

      {/* Access pending — for users with no role assignment */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/access-pending" element={<AccessPending />} />
        <Route path="/my-profile" element={<MyProfile />} />
      </Route>

      {/* Client portal — authenticated + client-entitled */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<ClientEntitlementRoute />}>
          <Route element={<ClientPortalLayout />}>
            <Route path="/client" element={<ClientDashboard />} />
            <Route path="/client/engagements" element={<ClientEngagements />} />
            <Route path="/client/engagements/:id" element={<ClientEngagementDetail />} />
            <Route path="/client/cases/:id" element={<ClientCaseDetail />} />
            <Route path="/client/deficiencies/:id" element={<ClientDeficiencyDetail />} />
            <Route path="/client/recovery" element={<ClientRecovery />} />
            <Route path="/client/pocs" element={<ClientPOCs />} />
            <Route path="/client/work-products" element={<ClientWorkProducts />} />
            <Route path="/client/evidence" element={<ClientEvidence />} />
            <Route path="/client/audits" element={<ClientAudits />} />
            <Route path="/client/tasks" element={<ClientTasks />} />
            <Route path="/client/readiness" element={<ClientReadiness />} />
            <Route path="/client/documents" element={<ClientDocuments />} />
            <Route path="/client/account" element={<ClientAccount />} />
          </Route>
        </Route>
      </Route>

      {/* Private command center — authenticated + role-authorized */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<RoleProtectedRoute roles={['admin', 'business_development', 'clinical', 'finance', 'read_only']} unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<CommandCenterLayout />}>
            <Route path="/command-center" element={<Dashboard />} />
            <Route path="/command-center/pipeline" element={<Pipeline />} />
            <Route path="/command-center/facilities" element={<Facilities />} />
            <Route path="/command-center/tasks" element={<Tasks />} />
            <Route path="/command-center/engagements" element={<Engagements />} />

            <Route element={<RoleProtectedRoute roles={['admin', 'business_development', 'clinical']} unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/command-center/leads" element={<Leads />} />
              <Route path="/command-center/contacts" element={<Contacts />} />
              <Route path="/command-center/outreach" element={<Outreach />} />
              <Route path="/command-center/agents" element={<Agents />} />
            </Route>
            <Route element={<RoleProtectedRoute roles={['admin', 'clinical', 'read_only']} unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/command-center/signals" element={<Signals />} />
              <Route path="/command-center/recovery" element={<RecoveryDashboard />} />
              <Route path="/command-center/cases" element={<Cases />} />
              <Route path="/command-center/cases/:id" element={<CaseDetail />} />
              <Route path="/command-center/deficiencies/:id" element={<DeficiencyDetail />} />
              <Route path="/command-center/knowledge" element={<Knowledge />} />
            </Route>
            <Route element={<RoleProtectedRoute roles={['admin', 'business_development', 'finance']} unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/command-center/proposals" element={<Proposals />} />
            </Route>
            <Route element={<RoleProtectedRoute roles={['admin']} unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/command-center/launch-readiness" element={<LaunchReadiness />} />
              <Route path="/command-center/identity-management" element={<UserIdentityManagement />} />
              <Route path="/command-center/client-accounts" element={<ClientAccounts />} />
              <Route path="/command-center/settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <TestDataProvider>
          <Router>
            <ScrollToTop />
            <ThemeProvider>
              <AuthenticatedApp />
            </ThemeProvider>
            <Toaster />
          </Router>
        </TestDataProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App