import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const StripeProvider = ({ children, clientSecret }) => {
  if (!clientSecret) {
    return children;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#4f46e5',
            colorBackground: '#f8fafc',
            colorText: '#1e293b',
            colorDanger: '#ef4444',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            borderRadius: '12px',
          },
        },
      }}
    >
      {children}
    </Elements>
  );
};
