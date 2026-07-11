/**
 * @fileoverview Route protection component.
 *
 * Guards child routes by checking authentication state and optional role
 * requirements. Redirects unauthenticated users to /login and users
 * with insufficient roles to /unauthorized.
 *
 * @module components/ProtectedRoute
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Wraps a route element to enforce authentication and optional RBAC.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The protected route element
 * @param {string[]} [props.roles] - Optional list of allowed roles
 * @returns {JSX.Element} The children if authorized, or a redirect
 */
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
