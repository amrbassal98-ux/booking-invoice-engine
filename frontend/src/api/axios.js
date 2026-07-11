/**
 * @fileoverview Axios HTTP client configuration.
 *
 * Creates and exports a pre-configured Axios instance with:
 *   - Base URL from VITE_API_BASE_URL env var (defaults to /api)
 *   - Request interceptor that attaches JWT token and tenant ID headers
 *   - Response interceptor that clears auth state on 401 responses
 *
 * @module api/axios
 */

import axios from 'axios';

/**
 * Pre-configured Axios instance for all API communication.
 * @type {import('axios').AxiosInstance}
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor — attaches auth headers to every outgoing request.
 * Reads JWT token and active tenant from localStorage.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const activeTenant = localStorage.getItem('activeTenant');
    if (activeTenant) {
      const { tenant_id } = JSON.parse(activeTenant);
      config.headers['x-tenant-id'] = tenant_id;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor — handles 401 Unauthorized globally.
 * Clears all auth-related localStorage keys and redirects to /login.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('memberships');
      localStorage.removeItem('activeTenant');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
