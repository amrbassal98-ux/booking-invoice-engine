/**
 * @fileoverview Express application bootstrap.
 * Configures CORS with origin whitelisting, mounts all API route groups,
 * exposes a /health endpoint used by Kubernetes liveness/readiness probes,
 * and serves interactive Swagger/OpenAPI documentation at /api-docs.
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
 *   /api-docs         — Interactive Swagger UI documentation
 *   /health           — Liveness/readiness probe endpoint
 *
 * @module app
 */

import express from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import swaggerOptions from './config/swagger.js';
import authRoutes from './routes/authRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import userRoutes from './routes/userRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import stripeWebhookRoutes from './routes/stripeWebhookRoutes.js';
import publicAvailabilityRoutes from './routes/publicAvailabilityRoutes.js';

const app = express();

/** Disable X-Powered-By header to prevent information disclosure. */
app.disable('x-powered-by');

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

/**
 * Swagger/OpenAPI documentation UI.
 * Served at /api-docs with the generated OpenAPI 3.0 specification.
 */
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'BookingInvoiceEngine API Docs',
}));

/**
 * OpenAPI spec as JSON (for code generation tools).
 * @route GET /api-docs.json
 */
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

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
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: |
 *       Liveness/readiness probe endpoint consumed by Kubernetes.
 *       Returns service status and current server timestamp.
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date() });
});

export default app;
