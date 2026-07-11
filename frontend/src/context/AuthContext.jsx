/**
 * @fileoverview Authentication context provider.
 *
 * Manages the global authentication state including:
 *   - User session (token, user profile, tenant memberships)
 *   - Active tenant/workspace selection
 *   - Login, register, and invitation acceptance flows
 *   - Tenant switching for multi-workspace users
 *
 * All auth state is persisted to localStorage for session continuity
 * across page reloads.
 *
 * @module context/AuthContext
 */

import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);

/**
 * Custom hook for consuming the auth context.
 * @returns {AuthContextValue} Authentication state and actions
 * @throws {Error} If used outside an AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Authentication context provider component.
 * Wraps the application tree and provides auth state + actions via context.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 */
export const AuthProvider = ({ children }) => {
  /** @type {[User|null, Function]} Authenticated user object or null. */
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  /** @type {[Membership[], Function]} All tenant memberships for the user. */
  const [memberships, setMemberships] = useState(() => {
    const stored = localStorage.getItem('memberships');
    return stored ? JSON.parse(stored) : [];
  });

  /** @type {[Membership|null, Function]} Currently active workspace. */
  const [activeTenant, setActiveTenant] = useState(() => {
    const stored = localStorage.getItem('activeTenant');
    return stored ? JSON.parse(stored) : null;
  });

  /** @type {[string|null, Function]} JWT authentication token. */
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /** Whether the user has an active authenticated session. */
  const isAuthenticated = !!token && !!user;

  /**
   * Switches the active workspace by tenant ID.
   * @param {number} tenantId - Target tenant ID
   */
  const switchTenant = useCallback((tenantId) => {
    const membership = memberships.find((m) => m.tenant_id === tenantId);
    if (membership) {
      setActiveTenant(membership);
      localStorage.setItem('activeTenant', JSON.stringify(membership));
    }
  }, [memberships]);

  /**
   * Persists auth state to both React state and localStorage.
   * @param {string} newToken - JWT token
   * @param {object} userData - User profile object
   * @param {Membership[]} workspaces - Tenant memberships array
   */
  const persistAuth = useCallback((newToken, userData, workspaces) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('memberships', JSON.stringify(workspaces));

    const primary = workspaces[0];
    localStorage.setItem('activeTenant', JSON.stringify(primary));

    setToken(newToken);
    setUser(userData);
    setMemberships(workspaces);
    setActiveTenant(primary);
  }, []);

  /** Clears all auth state from React and localStorage. */
  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('memberships');
    localStorage.removeItem('activeTenant');
    setToken(null);
    setUser(null);
    setMemberships([]);
    setActiveTenant(null);
  }, []);

  /**
   * Authenticates a user by email/password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, workspaces?: Membership[], error?: string}>}
   */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, user: userData, workspaces } = response.data;

      persistAuth(newToken, userData, workspaces);

      return { success: true, workspaces };
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [persistAuth]);

  /**
   * Registers a new tenant with an admin user.
   * @param {object} data - Registration payload (tenantName, email, password, etc.)
   * @returns {Promise<{success: boolean, workspaces?: Membership[], error?: string}>}
   */
  const register = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/tenants/onboard', data);
      const { token: newToken, user: userData, workspaces } = response.data;

      persistAuth(newToken, userData, workspaces);

      return { success: true, workspaces };
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [persistAuth]);

  /**
   * Accepts a workspace invitation by token.
   * @param {object} inviteData - { token, password?, firstName?, lastName?, email? }
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  const acceptInvite = useCallback(async (inviteData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/invitations/accept', inviteData);
      const { token: newToken, user: userData, workspaces } = response.data;

      if (newToken && workspaces) {
        persistAuth(newToken, userData, workspaces);
      }

      return { success: true, data: response.data };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to accept invitation.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [persistAuth]);

  /** Clears the current error state. */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /** Logs out the user by clearing all auth state. */
  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  /**
   * Checks if the active tenant has one of the specified roles.
   * @param  {...string} roles - Allowed roles
   * @returns {boolean}
   */
  const hasRole = useCallback((...roles) => {
    return activeTenant ? roles.includes(activeTenant.role) : false;
  }, [activeTenant]);

  /** Context value object provided to consuming components. */
  const value = {
    user,
    token,
    memberships,
    activeTenant,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    acceptInvite,
    logout,
    clearError,
    hasRole,
    switchTenant,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
