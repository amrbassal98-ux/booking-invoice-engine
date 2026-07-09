import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [memberships, setMemberships] = useState(() => {
    const stored = localStorage.getItem('memberships');
    return stored ? JSON.parse(stored) : [];
  });

  const [activeTenant, setActiveTenant] = useState(() => {
    const stored = localStorage.getItem('activeTenant');
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAuthenticated = !!token && !!user;

  const switchTenant = useCallback((tenantId) => {
    const membership = memberships.find((m) => m.tenant_id === tenantId);
    if (membership) {
      setActiveTenant(membership);
      localStorage.setItem('activeTenant', JSON.stringify(membership));
    }
  }, [memberships]);

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

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/auth/login', { email, password });
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

  const register = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/tenants/onboard', data);
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

  const acceptInvite = useCallback(async (inviteData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/invitations/accept', inviteData);
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

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const hasRole = useCallback((...roles) => {
    return activeTenant ? roles.includes(activeTenant.role) : false;
  }, [activeTenant]);

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
    hasRole,
    switchTenant,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
