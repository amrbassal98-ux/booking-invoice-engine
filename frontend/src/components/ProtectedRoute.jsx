import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, activeTenant } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(activeTenant?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
