import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../api/axios.js';
import { StripeProvider } from '../components/StripeProvider.jsx';
import { Calendar, Clock, DollarSign, CheckCircle, ArrowLeft, CreditCard, Loader2, WifiOff, RefreshCw } from 'lucide-react';

const BookingFormInner = ({ onClientSecretChange }) => {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

  const [slot, setSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentReady, setPaymentReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [totalAmount, setTotalAmount] = useState('');

  const fetchSlot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/availabilities/${slotId}`);
      setSlot(response.data.availability);
    } catch (err) {
      const status = err.response?.status;
      if (!err.response) {
        setError({ type: 'network', message: 'Unable to connect to the server. Please check your connection and try again.' });
      } else if (status >= 500) {
        setError({ type: 'server', message: 'Something went wrong on our end. Please try again in a moment.' });
      } else {
        setError({ type: 'client', message: err.response?.data?.error || 'Failed to load slot details.' });
      }
    } finally {
      setLoading(false);
    }
  }, [slotId]);

  useEffect(() => {
    fetchSlot();
  }, [fetchSlot]);

  const handleInitPayment = async () => {
    const amount = parseFloat(totalAmount);
    if (!amount || amount <= 0) {
      setError({ type: 'validation', message: 'Please enter a valid booking amount.' });
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await api.post('/bookings/checkout', {
        availability_id: slotId,
        total_amount: amount,
        currency: 'USD',
      });
      setClientSecret(response.data.clientSecret);
      onClientSecretChange(response.data.clientSecret);
      setPaymentReady(true);
    } catch (err) {
      if (!err.response) {
        setError({ type: 'network', message: 'Unable to connect. Please check your connection and try again.' });
      } else if (err.response.status >= 500) {
        setError({ type: 'server', message: 'Something went wrong on our end. Please try again.' });
      } else {
        setError({ type: 'client', message: err.response?.data?.error || 'Failed to initialize payment.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/book/${slotId}/success`,
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError({ type: 'payment', message: stripeError.message || 'Payment failed. Please try again.' });
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="h-4 w-16 bg-slate-200 rounded animate-[skeleton_1.8s_ease-in-out_infinite] mb-6" />
        <div className="h-7 w-48 bg-slate-200 rounded-lg animate-[skeleton_1.8s_ease-in-out_infinite] mb-6" />
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200 animate-[skeleton_1.8s_ease-in-out_infinite]" />
              <div className="h-4 w-52 bg-slate-200 rounded animate-[skeleton_1.8s_ease-in-out_infinite]" />
            </div>
            <div className="flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200 animate-[skeleton_1.8s_ease-in-out_infinite]" />
              <div className="h-4 w-36 bg-slate-200 rounded animate-[skeleton_1.8s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-32 bg-slate-200 rounded animate-[skeleton_1.8s_ease-in-out_infinite]" />
            <div className="h-10 w-full bg-slate-200 rounded-xl animate-[skeleton_1.8s_ease-in-out_infinite]" />
          </div>
          <div className="flex flex-row gap-3 pt-2">
            <div className="flex-1 h-11 bg-slate-200 rounded-xl animate-[skeleton_1.8s_ease-in-out_infinite]" />
            <div className="flex-1 h-11 bg-slate-200 rounded-xl animate-[skeleton_1.8s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !slot) {
    const isNetworkError = error.type === 'network' || error.type === 'server';
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6 border-4 border-slate-200">
          <WifiOff className="w-9 h-9 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {isNetworkError ? 'Connection Problem' : 'Unable to Load Slot'}
        </h2>
        <p className="text-slate-500 text-sm text-center mb-8 max-w-xs leading-relaxed">
          {error.message}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          {isNetworkError && (
            <button
              onClick={fetchSlot}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-3 px-5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="flex-1 inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 py-3 px-5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            Back to Slots
          </button>
        </div>
      </div>
    );
  }

  if (slot && slot.is_booked) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-500 mb-4 font-medium">This slot is no longer available.</p>
        <button onClick={() => navigate('/')} className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm">
          Browse other slots
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Confirmed!</h2>
        <p className="text-slate-500 mb-8 text-sm">Your payment was processed successfully. Your booking is being finalized.</p>

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
            {error.message || error}
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
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              disabled={paymentReady}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="0.00"
            />
          </div>
        </div>

        {!paymentReady && (
          <div className="flex flex-row gap-3 pt-2">
            <button
              type="button" onClick={() => navigate(-1)}
              className="flex-1 inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button" onClick={handleInitPayment} disabled={submitting || !totalAmount}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white py-3 px-4 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all duration-200"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Continue to Payment
                  <CreditCard className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {paymentReady && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Payment Details
              </label>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <PaymentElement
                  options={{
                    layout: 'tabs',
                  }}
                />
              </div>
            </div>

            <div className="flex flex-row gap-3 pt-2">
              <button
                type="button" onClick={() => { setPaymentReady(false); setClientSecret(null); setError(null); }}
                className="flex-1 inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200"
              >
                Back
              </button>
              <button
                type="submit" disabled={submitting || !stripe || !elements}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white py-3 px-4 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all duration-200"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Pay ${totalAmount}
                    <CreditCard className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export const BookingForm = () => {
  const [clientSecret, setClientSecret] = useState(null);

  return (
    <StripeProvider clientSecret={clientSecret}>
      <BookingFormInner onClientSecretChange={setClientSecret} />
    </StripeProvider>
  );
};
