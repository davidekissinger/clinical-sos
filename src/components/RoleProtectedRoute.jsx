import { useEffect } from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function RoleProtectedRoute({ roles, fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  const userRole = user?.role || 'user';
  // Unprovisioned users (Base44 native "user" or Clinical SOS "pending") must never access Command Center
  if (userRole === 'pending' || userRole === 'user') {
    return <Navigate to="/access-pending" replace />;
  }
  if (!roles.includes(userRole)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="h-14 w-14 rounded-full bg-rose-100 mx-auto flex items-center justify-center text-rose-600">
            <ShieldX className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">Access Denied</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your role ({userRole.replace(/_/g, ' ')}) does not have permission to view this area.
            Contact an administrator if you believe this is an error.
          </p>
          <button onClick={() => navigate('/command-center')} className="btn-secondary mt-5 text-sm">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}