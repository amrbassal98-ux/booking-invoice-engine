import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogIn, Mail, Lock, ArrowRight, Building2, ChevronRight } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingWorkspaces, setPendingWorkspaces] = useState(null);
  const { login, switchTenant, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { clearError(); }, [clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (!result.success) return;

    if (result.workspaces.length === 1) {
      navigate('/dashboard');
    } else {
      setPendingWorkspaces(result.workspaces);
    }
  };

  const handleSelectWorkspace = (tenantId) => {
    switchTenant(tenantId);
    navigate('/dashboard');
  };

  if (pendingWorkspaces) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/30">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Select workspace</h1>
            <p className="text-slate-500 mt-2 text-sm">Choose an organization to continue</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/40 divide-y divide-slate-100">
            {pendingWorkspaces.map((ws) => (
              <button
                key={ws.tenant_id}
                onClick={() => handleSelectWorkspace(ws.tenant_id)}
                className="w-full flex flex-row items-center justify-between p-5 hover:bg-slate-50 transition-colors duration-150 group"
              >
                <div className="flex flex-row items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                    {ws.name?.[0]?.toUpperCase() || 'W'}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-slate-900">{ws.name}</span>
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                      {ws.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            <button
              onClick={() => { setPendingWorkspaces(null); }}
              className="text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Sign in as different user
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/30">
            <LogIn className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
          <p className="text-slate-500 mt-2 text-sm">Sign in to access your booking dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/40 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200/60 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-500 text-xs font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-slate-700">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="email"
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
            <label htmlFor="password" className="text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
                placeholder="Enter your password"
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
                Sign in
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-sm text-slate-500 pt-2">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};
