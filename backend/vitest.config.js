import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    exclude: [
      '**/node_modules/**',
      '**/src/__tests__/stripe-webhook-mock.test.js',
      '**/src/__tests__/booking-concurrency-stress.test.js',
    ],
  },
});
