/**
 * @fileoverview Express application bootstrap.
 * Configures CORS with origin whitelisting, mounts all API route groups,
 * and exposes a /health endpoint used by Kubernetes liveness/readiness probes.
 *
 * Route architecture:
 *   /api/webhooks/*   — Stripe webhook receiver (raw body, no JSON parser)
 *   /api/public/*     — Unauthenticated public endpoints
 *   /api/auth         — Authentication (login)
 *   /api/tenants      — Tenant onboarding / registration
 *   /api/users        — User directory queries
 *   /api/availabilities — Availability slot CRUD (authenticated)
 *   /api/bookings     — Booking lifecycle + Stripe checkout (authenticated)
 *   /api/invitations  — Invitation creation and acceptance
 *   /health           — Liveness/readiness probe endpoint
 *
 * @module app
 */

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import userRoutes from './routes/userRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import stripeWebhookRoutes from './routes/stripeWebhookRoutes.js';
import publicAvailabilityRoutes from './routes/publicAvailabilityRoutes.js';

const app = express();

/** Parsed from CORS_ORIGINS env var (comma-separated), falls back to localhost dev origins. */
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:30080'];

/**
 * CORS middleware — restricts cross-origin requests to the whitelist.
 * Credentials are enabled to support cookie-based auth if adopted later.
 */
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
}));

/**
 * Stripe webhook endpoint mounted BEFORE express.json() so that the raw
 * request body is available for signature verification.
 */
app.use('/api/webhooks', stripeWebhookRoutes);

/** JSON body parser for all subsequent routes. */
app.use(express.json());

/** Public routes — no authentication required. */
app.use('/api/public/availabilities', publicAvailabilityRoutes);

/** Authenticated API route groups. */
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/availabilities', availabilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/invitations', invitationRoutes);

/**
 * Health check endpoint consumed by Kubernetes probes.
 * @route GET /health
 * @returns {object} 200 - { status: "UP", timestamp: ISO string }
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date() });
});

export default app;
