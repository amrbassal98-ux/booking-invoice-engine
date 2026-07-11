/**
 * @fileoverview Swagger/OpenAPI configuration.
 *
 * Aggregates project metadata and defines the JSDoc scan paths for
 * swagger-jsdoc to generate the OpenAPI 3.0 specification from
 * JSDoc annotations in route and controller files.
 *
 * @module config/swagger
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * swagger-jsdoc options object.
 * @type {import('swagger-jsdoc').Options}
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BookingInvoiceEngine API',
      version: '1.0.0',
      description:
        'Multi-tenant booking and invoice engine with Stripe payment integration.\n\n' +
        '## Authentication\n' +
        'Most endpoints require a Bearer token in the `Authorization` header.\n' +
        'Obtain a token via `POST /api/auth/login` or `POST /api/tenants/onboard`.\n\n' +
        '## Multi-Tenancy\n' +
        'All authenticated requests must include an `x-tenant-id` header identifying ' +
        'the active workspace. The tenant context is resolved from the JWT if omitted.',
      contact: {
        name: 'API Support',
      },
      license: {
        name: 'Apache 2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login or registration endpoints',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Human-readable error message',
            },
          },
          required: ['error'],
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'User ID' },
            email: { type: 'string', format: 'email', description: 'User email' },
            first_name: { type: 'string', nullable: true, description: 'First name' },
            last_name: { type: 'string', nullable: true, description: 'Last name' },
            role: { type: 'string', enum: ['tenant_admin', 'provider', 'staff', 'customer'], description: 'User role within workspace' },
          },
        },
        Workspace: {
          type: 'object',
          properties: {
            tenant_id: { type: 'integer', description: 'Tenant ID' },
            slug: { type: 'string', description: 'URL-friendly tenant identifier' },
            name: { type: 'string', description: 'Tenant display name' },
            role: { type: 'string', enum: ['tenant_admin', 'provider', 'staff', 'customer'], description: 'User role in this workspace' },
          },
        },
        AvailabilitySlot: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Slot UUID' },
            tenant_id: { type: 'integer', description: 'Tenant ID' },
            staff_id: { type: 'string', format: 'uuid', description: 'Provider/staff user ID' },
            start_time: { type: 'string', format: 'date-time', description: 'Slot start time (ISO 8601)' },
            end_time: { type: 'string', format: 'date-time', description: 'Slot end time (ISO 8601)' },
            is_booked: { type: 'boolean', description: 'Whether the slot is booked' },
          },
        },
        Booking: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Booking UUID' },
            tenant_id: { type: 'integer', description: 'Tenant ID' },
            customer_id: { type: 'string', format: 'uuid', description: 'Customer user ID' },
            availability_id: { type: 'string', format: 'uuid', description: 'Booked slot ID' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'completed'], description: 'Booking status' },
            total_amount: { type: 'number', format: 'float', description: 'Total amount in dollars' },
            currency: { type: 'string', default: 'USD', description: 'Payment currency' },
            created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
            updated_at: { type: 'string', format: 'date-time', nullable: true, description: 'Last update timestamp' },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Invoice UUID' },
            tenant_id: { type: 'integer', description: 'Tenant ID' },
            booking_id: { type: 'string', format: 'uuid', description: 'Associated booking ID' },
            status: { type: 'string', enum: ['pending', 'paid', 'void'], description: 'Invoice status' },
            amount_due: { type: 'number', format: 'float', description: 'Amount due in dollars' },
            amount_paid: { type: 'number', format: 'float', description: 'Amount paid in dollars' },
            created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
          },
        },
        Invitation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Invitation UUID' },
            tenant_id: { type: 'integer', description: 'Tenant ID' },
            email: { type: 'string', format: 'email', description: 'Invitee email' },
            role: { type: 'string', enum: ['provider', 'staff', 'customer'], description: 'Assigned role' },
            token: { type: 'string', description: 'Invitation token (64-char hex)' },
            expires_at: { type: 'string', format: 'date-time', description: 'Expiry timestamp (7 days)' },
            created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'UP', description: 'Service status' },
            timestamp: { type: 'string', format: 'date-time', description: 'Current server timestamp' },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: [
    resolve(__dirname, '../routes/*.js'),
    resolve(__dirname, '../controllers/*.js'),
    resolve(__dirname, '../app.js'),
  ],
};

export default swaggerOptions;
