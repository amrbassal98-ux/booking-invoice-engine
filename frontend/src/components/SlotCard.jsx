import { Calendar, Clock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export const SlotCard = ({ slot, onBook, showActions = false, onEdit, onDelete }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const handleBook = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    onBook?.(slot);
  };

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-xl hover:shadow-slate-200/50 hover:border-indigo-200/80 transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex flex-row items-start justify-between mb-4">
        <div className="flex flex-row items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Staff
          </span>
        </div>
        {slot.is_booked ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
            Booked
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
            Available
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5 mb-5">
        <div className="flex flex-row items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">{formatDate(slot.start_time)}</span>
        </div>
        <div className="flex flex-row items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">
            {formatTime(slot.start_time)} — {formatTime(slot.end_time)}
          </span>
        </div>
      </div>

      <div className="flex flex-row gap-2 pt-3 border-t border-slate-100">
        {!slot.is_booked && !showActions && (
          <button
            onClick={handleBook}
            className="flex-1 inline-flex items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/25 hover:shadow-md hover:shadow-indigo-500/30 transition-all duration-200"
          >
            Book Now
          </button>
        )}

        {showActions && (
          <>
            {onEdit && (
              <button
                onClick={() => onEdit(slot)}
                className="flex-1 inline-flex items-center justify-center bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              >
                Edit
              </button>
            )}
            {onDelete && !slot.is_booked && (
              <button
                onClick={() => onDelete(slot)}
                className="inline-flex items-center justify-center bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 hover:border-red-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
