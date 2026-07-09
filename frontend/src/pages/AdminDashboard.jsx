import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import { SlotCard } from '../components/SlotCard.jsx';
import { LayoutDashboard, Plus, RefreshCw, Calendar, BookOpen } from 'lucide-react';

export const AdminDashboard = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('slots');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [slotsRes, bookingsRes] = await Promise.all([
        api.get('/api/availabilities'),
        api.get('/api/bookings'),
      ]);
      setSlots(slotsRes.data.availabilities);
      setBookings(bookingsRes.data.bookings);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (slot) => {
    if (!confirm('Delete this availability slot?')) return;
    try {
      await api.delete(`/api/availabilities/${slot.id}`);
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete slot.');
    }
  };

  const handleStatusUpdate = async (bookingId, status) => {
    try {
      await api.patch(`/api/bookings/${bookingId}/status`, { status });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update booking status.');
    }
  };

  const statusColors = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    cancelled: 'bg-red-50 text-red-600 border-red-100',
    completed: 'bg-blue-50 text-blue-700 border-blue-100',
  };

  return (
    <div className="w-full">
      <div className="flex flex-row items-center justify-between mb-8">
        <div className="flex flex-row items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-slate-500 text-sm">Manage slots and monitor bookings</p>
          </div>
        </div>
        <div className="flex flex-row gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex flex-row items-center gap-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {hasRole('tenant_admin', 'staff') && (
            <Link
              to="/admin/slots/new"
              className="inline-flex flex-row items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/25 hover:shadow-md transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Slot</span>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200/60 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-6">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-1">
          <nav className="flex flex-row gap-1">
            <button
              onClick={() => setActiveTab('slots')}
              className={`inline-flex flex-row items-center gap-2 px-5 py-3.5 text-sm font-semibold rounded-t-xl transition-all duration-200 ${
                activeTab === 'slots'
                  ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:text-slate-600 border-b-2 border-transparent'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Slots
              <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {slots.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`inline-flex flex-row items-center gap-2 px-5 py-3.5 text-sm font-semibold rounded-t-xl transition-all duration-200 ${
                activeTab === 'bookings'
                  ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:text-slate-600 border-b-2 border-transparent'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Bookings
              <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {bookings.length}
              </span>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
              <p className="text-slate-400 text-sm font-medium">Loading...</p>
            </div>
          ) : activeTab === 'slots' ? (
            slots.length === 0 ? (
              <div className="text-center py-16">
                <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No slots created yet</p>
                <p className="text-slate-400 text-sm mt-1">Create your first availability slot to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {slots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    showActions
                    onEdit={(s) => navigate(`/admin/slots/${s.id}/edit`)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )
          ) : bookings.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No bookings yet</p>
              <p className="text-slate-400 text-sm mt-1">Bookings will appear here once customers start booking</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pl-4">Booking</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3">Customer</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3">Amount</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3">Date</th>
                    <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 pl-4">
                        <span className="text-sm font-mono font-medium text-slate-900 bg-slate-100 px-2 py-1 rounded-md">
                          {booking.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className="text-sm text-slate-600 font-mono">{booking.customer_id.slice(0, 8)}...</span>
                      </td>
                      <td className="py-3.5">
                        <span className="text-sm font-semibold text-slate-900">
                          {booking.total_amount} <span className="text-slate-400 font-normal">{booking.currency}</span>
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors[booking.status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className="text-sm text-slate-500">
                          {new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right">
                        {hasRole('tenant_admin', 'staff') && (
                          <div className="inline-flex flex-row items-center justify-end gap-1">
                            {booking.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleStatusUpdate(booking.id, 'confirmed')}
                                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                                  className="text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {booking.status === 'confirmed' && (
                              <button
                                onClick={() => handleStatusUpdate(booking.id, 'completed')}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
