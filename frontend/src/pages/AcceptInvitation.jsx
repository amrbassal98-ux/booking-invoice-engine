/**
 * @fileoverview Invitation acceptance page.
 *
 * Handles workspace invitation acceptance via a URL token parameter.
 * Three flows:
 *   1. **Auto-accept** — If already logged in, accepts the invite automatically
 *   2. **Login + accept** — Existing users sign in, then the invite is accepted
 *   3. **Register + accept** — New users create an account, then join the workspace
 *
 * @module pages/AcceptInvitation
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios.js';
import { Mail, Lock, ArrowRight, Building2, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export const AcceptInvitation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, login, acceptInvite, switchTenant, memberships } = useAuth();

  const [token] = useState(() => searchParams.get('token'));
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /** Validates token presence on mount. */
  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. No token provided.');
    }
  }, [token]);

  /** Auto-accepts invite if user is already authenticated. */
  useEffect(() => {
    if (isAuthenticated && token && !success && !loading) {
      handleAcceptInvite();
    }
  }, [isAuthenticated, token]);

  /** Accepts invitation using the current session (auto-accept flow). */
  const handleAcceptInvite = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/invitations/accept', { token });
      const { user, tenant_id } = response.data;

      const newMembership = {
        tenant_id,
        name: user.email,
        slug: tenant_id.slice(0, 8),
        role: user.role,
      };

      const updatedMemberships = [...memberships, newMembership];
      localStorage.setItem('memberships', JSON.stringify(updatedMemberships));
      localStorage.setItem('activeTenant', JSON.stringify(newMembership));

      setSuccess({
        message: `Successfully joined the workspace as ${user.role}`,
        tenant_id,
      });

      setTimeout(() => {
        switchTenant(tenant_id);
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to accept invitation.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /** Logs in existing user, then auto-accepts the invitation. */
  const handleLoginAndAccept = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setLoading(false);
        return;
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed.';
      setError(message);
      setLoading(false);
    }
  };

  /** Registers a new account and accepts the invitation in one step. */
  const handleRegisterAndAccept = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await acceptInvite({ token, password, firstName, lastName, email });
      if (!result.success) {
        setLoading(false);
        return;
      }

      const { user, tenant_id } = result.data;

      const newMembership = {
        tenant_id,
        name: user.email,
        slug: tenant_id.slice(0, 8),
        role: user.role,
      };

      const updatedMemberships = [...memberships, newMembership];
      localStorage.setItem('memberships', JSON.stringify(updatedMemberships));
      localStorage.setItem('activeTenant', JSON.stringify(newMembership));

      setSuccess({
        message: `Successfully joined the workspace as ${user.role}`,
        tenant_id,
      });

      setTimeout(() => {
        switchTenant(tenant_id);
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed.';
      setError(message);
      setLoading(false);
    }
  };

  /** Invalid token state. */
  if (!token) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Invalid Invitation</h1>
          <p className="text-slate-500 text-sm mb-6">
            This invitation link is invalid or missing a token. Please request a new invitation from your workspace admin.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold text-sm"
          >
            Go to login
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  /** Loading state during auto-accept. */
  if (loading && isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/30">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Accepting Invitation</h1>
          <p className="text-slate-500 text-sm">Adding you to the workspace...</p>
        </div>
      </div>
    );
  }

  /** Success state with redirect countdown. */
  if (success) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Welcome aboard!</h1>
          <p className="text-slate-500 text-sm mb-4">{success.message}</p>
          <p className="text-slate-400 text-xs">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  /** Login/register form for invitation acceptance. */
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/30">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">You've been invited</h1>
          <p className="text-slate-500 mt-2 text-sm">
            {mode === 'login'
              ? 'Sign in to accept this workspace invitation'
              : 'Create an account to accept this workspace invitation'}
          </p>
        </div>

        <form
          onSubmit={mode === 'login' ? handleLoginAndAccept : handleRegisterAndAccept}
          className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/40 space-y-5"
        >
          {error && (
            <div className="bg-red-50 border border-red-200/60 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-500 text-xs font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-indigo-700 text-sm font-medium">
              {mode === 'login'
                ? "After signing in, you'll be automatically added to the workspace."
                : 'Create your account to join the workspace.'}
            </p>
          </div>

          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="invite-firstName" className="text-sm font-semibold text-slate-700">
                  First name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="invite-firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
                    placeholder="John"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="invite-lastName" className="text-sm font-semibold text-slate-700">
                  Last name
                </label>
                <input
                  id="invite-lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
                  placeholder="Doe"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-email" className="text-sm font-semibold text-slate-700">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-password" className="text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="invite-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
                placeholder={mode === 'login' ? 'Enter your password' : 'Min 6 characters'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white py-3 px-4 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-200"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Sign in & Accept' : 'Create account & Accept'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-sm text-slate-500 pt-2">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); }}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
};
