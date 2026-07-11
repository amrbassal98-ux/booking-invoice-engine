import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios.js';
import { Save, ArrowLeft, User, CalendarClock } from 'lucide-react';

export const SlotForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const isEditing = !!id;
  const isAdmin = hasRole('tenant_admin');

  const [form, setForm] = useState({ staff_id: '', start_time: '', end_time: '' });
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProviders = async () => {
      if (!isAdmin) return;
      try {
        const response = await api.get('/users/providers');
        setProviders(response.data.providers);
      } catch (err) {
        console.error('Failed to load providers:', err);
      }
    };
    fetchProviders();
  }, [isAdmin]);

  useEffect(() => {
    if (isEditing) {
      const fetchSlot = async () => {
        try {
          const response = await api.get(`/availabilities/${id}`);
          const slot = response.data.availability;
          setForm({
            staff_id: slot.staff_id,
            start_time: slot.start_time.slice(0, 16),
            end_time: slot.end_time.slice(0, 16),
          });
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to load slot.');
        } finally {
          setLoading(false);
        }
      };
      fetchSlot();
    }
  }, [id, isEditing]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      };

      if (isAdmin) {
        payload.staff_id = form.staff_id;
      }

      if (isEditing) {
        await api.put(`/availabilities/${id}`, payload);
      } else {
        await api.post('/availabilities', payload);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save slot.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">Loading slot...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="inline-flex flex-row items-center gap-2 text-slate-400 hover:text-slate-600 text-sm font-medium mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">
        {isEditing ? 'Edit Slot' : 'Create New Slot'}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 shadow-sm">
        {error && (
          <div className="bg-red-50 border border-red-200/60 text-red-600 px-4 py-3 rounded-xl text-sm font-medium inline-flex flex-row items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 text-xs font-bold">!</span>
            </div>
            {error}
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="staff_id" className="text-sm font-semibold text-slate-700">
              Staff Member
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                id="staff_id"
                name="staff_id"
                required
                value={form.staff_id}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 appearance-none"
              >
                <option value="">Select a provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.first_name || provider.last_name
                      ? `${provider.first_name || ''} ${provider.last_name || ''}`.trim()
                      : provider.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="start_time" className="text-sm font-semibold text-slate-700">
            Start Time
          </label>
          <div className="relative">
            <CalendarClock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="start_time" name="start_time" type="datetime-local" required
              value={form.start_time} onChange={handleChange}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="end_time" className="text-sm font-semibold text-slate-700">
            End Time
          </label>
          <div className="relative">
            <CalendarClock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="end_time" name="end_time" type="datetime-local" required
              value={form.end_time} onChange={handleChange}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex flex-row gap-3 pt-2">
          <button
            type="button" onClick={() => navigate(-1)}
            className="flex-1 inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white py-3 px-4 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all duration-200"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Update Slot' : 'Create Slot'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
