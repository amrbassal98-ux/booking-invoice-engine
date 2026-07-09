import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { Calendar, Clock, DollarSign, CheckCircle, ArrowLeft } from 'lucide-react';

export const BookingForm = () => {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const [slot, setSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [totalAmount, setTotalAmount] = useState('');

  useEffect(() => {
    const fetchSlot = async () => {
      try {
        const response = await api.get(`/api/availabilities/${slotId}`);
        setSlot(response.data.availability);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load slot details.');
      } finally {
        setLoading(false);
      }
    };
    fetchSlot();
  }, [slotId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/bookings', {
        availability_id: slotId,
        total_amount: parseFloat(totalAmount),
        currency: 'USD',
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">Loading slot details...</p>
      </div>
    );
  }

  if (error && !slot) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-500 mb-4 font-medium">{error}</p>
        <button onClick={() => navigate('/')} className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm">
          Back to slots
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-16">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6 border-4 border-emerald-100">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h2>
        <p className="text-slate-500 mb-8 text-sm">Your booking has been created successfully.</p>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 mb-8 text-left shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-row items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-sm text-slate-700">{formatDate(slot.start_time)}</span>
            </div>
            <div className="flex flex-row items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-violet-600" />
              </div>
              <span className="text-sm text-slate-700">{formatTime(slot.start_time)} — {formatTime(slot.end_time)}</span>
            </div>
            <div className="flex flex-row items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-sm font-semibold text-slate-900">${totalAmount} USD</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-8 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all duration-200"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="inline-flex flex-row items-center gap-2 text-slate-400 hover:text-slate-600 text-sm font-medium mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Book This Slot</h1>

      {slot && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">{formatDate(slot.start_time)}</span>
            </div>
            <div className="flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-violet-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">{formatTime(slot.start_time)} — {formatTime(slot.end_time)}</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 shadow-sm">
        {error && (
          <div className="bg-red-50 border border-red-200/60 text-red-600 px-4 py-3 rounded-xl text-sm font-medium inline-flex flex-row items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 text-xs font-bold">!</span>
            </div>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-sm font-semibold text-slate-700">
            Booking Amount (USD)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="amount" type="number" min="0.01" step="0.01" required
              value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
              placeholder="0.00"
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
            ) : 'Confirm Booking'}
          </button>
        </div>
      </form>
    </div>
  );
};
