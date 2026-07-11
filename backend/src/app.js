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

app.use(cors());

app.use('/api/webhooks', stripeWebhookRoutes);

app.use(express.json());

app.use('/api/public/availabilities', publicAvailabilityRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/availabilities', availabilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/invitations', invitationRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date() });
});

export default app;
