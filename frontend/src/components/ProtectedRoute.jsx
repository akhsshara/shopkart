// Route guards: keep unauthenticated visitors out of private pages.
// They rely on AuthContext, which already knows whether the HttpOnly session
// cookie is valid (via GET /customers/me).

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Checking() {
  return (
    <div className="page">
      <p className="muted">Checking your session...</p>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, initialising } = useAuth();
  const location = useLocation();

  // While the session is still being resolved we must NOT redirect: the JWT is
  // in an HttpOnly cookie, so "no user yet" means "not asked yet". Redirecting
  // here would bounce a signed-in user to /login on every refresh.
  if (initialising) return <Checking />;

  // Remember where the customer was heading so Login can return them there
  // instead of dumping them on the home page.
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return children;
}

// Inverse guard: a logged-in customer should not sit on /login or /register.
export function GuestRoute({ children }) {
  const { user, initialising } = useAuth();

  if (initialising) return <Checking />;
  if (user) return <Navigate to="/home" replace />;

  return children;
}