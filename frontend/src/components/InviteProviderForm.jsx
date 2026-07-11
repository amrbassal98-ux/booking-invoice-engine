import { useState } from 'react';
import api from '../api/axios.js';
import { Mail, UserPlus, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';

export const InviteProviderForm = ({ onInvitationSent }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('provider');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const roles = [
    { value: 'provider', label: 'Provider' },
    { value: 'staff', label: 'Staff' },
    { value: 'customer', label: 'Customer' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post('/invitations', { email, role });
      const invitation = response.data.invitation;

      setSuccess({
        message: `Invitation sent to ${invitation.email}`,
        token: invitation.token,
      });
      setEmail('');
      setRole('provider');

      if (onInvitationSent) {
        onInvitationSent(invitation);
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to send invitation.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
      <div className="flex flex-row items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <UserPlus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Invite Provider</h2>
          <p className="text-slate-500 text-sm">Send an invitation to join your workspace</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200/60 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success.message}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-emerald-600 font-semibold">Invitation token (share securely):</span>
              <code className="text-xs bg-emerald-100 px-2 py-1.5 rounded-lg font-mono break-all">
                {success.token}
              </code>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-email" className="text-sm font-semibold text-slate-700">
            Email address
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
              placeholder="provider@example.com"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-role" className="text-sm font-semibold text-slate-700">
            Role
          </label>
          <div className="relative">
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 appearance-none cursor-pointer"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white py-2.5 px-4 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-200"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Send Invitation
              <Mail className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
