import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { SlotCard } from '../components/SlotCard.jsx';
import { Search, CalendarDays, Sparkles } from 'lucide-react';

export const PublicDashboard = () => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/availabilities?is_booked=false');
      setSlots(response.data.availabilities);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load available slots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlots(); }, []);

  const handleBook = (slot) => navigate(`/book/${slot.id}`);

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="flex flex-row items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Available Slots</h1>
            <p className="text-slate-500 text-sm">Browse and book available time slots</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200/60 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-6 flex flex-row items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchSlots} className="text-red-600 hover:text-red-700 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-400 text-sm font-medium">Loading available slots...</p>
        </div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-600 font-semibold text-lg">No available slots</p>
          <p className="text-slate-400 text-sm mt-1">Check back later for new openings</p>
        </div>
      ) : (
        <>
          <div className="flex flex-row items-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium text-slate-500">
              {slots.length} slot{slots.length !== 1 ? 's' : ''} available
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} onBook={handleBook} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
