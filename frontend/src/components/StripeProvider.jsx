/**
 * @fileoverview Stripe Elements wrapper component.
 *
 * Provides the Stripe.js context to child components via <Elements>.
 * Loads the Stripe publishable key at module level and passes a client
 * secret for payment element initialization.
 *
 * @module components/StripeProvider
 */

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

/** Stripe publishable key loaded from Vite environment variables. */
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

/**
 * Wraps children with Stripe's <Elements> provider.
 * Renders children directly (without Stripe context) if no clientSecret.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children    - Child components needing Stripe context
 * @param {string}          [props.clientSecret] - PaymentIntent client secret
 */
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
