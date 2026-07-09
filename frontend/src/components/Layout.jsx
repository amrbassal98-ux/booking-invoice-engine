import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogOut, Calendar, LayoutDashboard, ChevronDown, Building2 } from 'lucide-react';

export const Layout = () => {
  const { user, isAuthenticated, memberships, activeTenant, switchTenant, logout } = useAuth();
  const navigate = useNavigate();
  const [showTenantMenu, setShowTenantMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchTenant = (tenantId) => {
    switchTenant(tenantId);
    setShowTenantMenu(false);
    navigate('/dashboard');
  };

  return (
    <div className="w-full min-h-screen bg-slate-50">
      <nav className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row items-center justify-between h-16">
            <div className="flex flex-row items-center gap-10">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:shadow-lg group-hover:shadow-indigo-500/30 transition-shadow">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">
                  Booking<span className="text-indigo-600">Engine</span>
                </span>
              </Link>

              <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-1">
                {isAuthenticated && (
                  <Link
                    to="/dashboard"
                    className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-medium flex flex-row items-center gap-1.5 transition-all duration-200"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                )}
              </div>
            </div>

            <div className="flex flex-row items-center gap-3">
              {isAuthenticated ? (
                <>
                  {memberships.length > 1 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowTenantMenu(!showTenantMenu)}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                      >
                        <Building2 className="w-4 h-4" />
                        <span className="hidden sm:inline max-w-[120px] truncate">{activeTenant?.slug}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {showTenantMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowTenantMenu(false)} />
                          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 z-50 py-1.5">
                            {memberships.map((ws) => (
                              <button
                                key={ws.tenant_id}
                                onClick={() => handleSwitchTenant(ws.tenant_id)}
                                className={`w-full flex flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${ws.tenant_id === activeTenant?.tenant_id ? 'bg-indigo-50/50' : ''}`}
                              >
                                <span className="text-sm font-medium text-slate-900">{ws.name || ws.slug}</span>
                                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                                  {ws.role?.replace('_', ' ')}
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="hidden sm:flex sm:flex-row items-center gap-2.5 mr-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                      {user.first_name?.[0] || user.email[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 leading-tight">
                        {user.first_name || user.email}
                      </span>
                      <span className="text-[11px] text-slate-400 leading-tight font-medium uppercase tracking-wider">
                        {activeTenant?.role?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-row items-center gap-2">
                  <Link
                    to="/login"
                    className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm shadow-indigo-500/25 hover:shadow-md hover:shadow-indigo-500/30 transition-all duration-200"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};
