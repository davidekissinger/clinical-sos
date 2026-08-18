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
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Public site
import PublicLayout from '@/components/PublicLayout';
import Home from '@/pages/Home';
import About from '@/pages/About';
import Services from '@/pages/Services';
import ServiceDetail from '@/pages/ServiceDetail';
import RapidSurveyRecovery from '@/pages/RapidSurveyRecovery';
import WhoWeHelp from '@/pages/WhoWeHelp';
import Resources from '@/pages/Resources';
import ResourceDetail from '@/pages/ResourceDetail';
import FAQ from '@/pages/FAQ';
import Contact from '@/pages/Contact';

// Command center
import CommandCenterLayout from '@/components/CommandCenterLayout';
import Dashboard from '@/pages/cc/Dashboard';
import Leads from '@/pages/cc/Leads';
import Pipeline from '@/pages/cc/Pipeline';
import Facilities from '@/pages/cc/Facilities';
import Contacts from '@/pages/cc/Contacts';
import Tasks from '@/pages/cc/Tasks';
import Signals from '@/pages/cc/Signals';
import Agents from '@/pages/cc/Agents';
import Outreach from '@/pages/cc/Outreach';
import Proposals from '@/pages/cc/Proposals';
import LaunchReadiness from '@/pages/cc/LaunchReadiness';
import Engagements from '@/pages/cc/Engagements';
import Settings from '@/pages/cc/Settings';
import RecoveryDashboard from '@/pages/cc/RecoveryDashboard';
import Cases from '@/pages/cc/Cases';
import CaseDetail from '@/pages/cc/CaseDetail';
import DeficiencyDetail from '@/pages/cc/DeficiencyDetail';
import Knowledge from '@/pages/cc/Knowledge';

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
              <Route path="/command-center/settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <TestDataProvider>
          <ThemeProvider>
            <Router>
              <ScrollToTop />
              <AuthenticatedApp />
            </Router>
            <Toaster />
          </ThemeProvider>
        </TestDataProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App