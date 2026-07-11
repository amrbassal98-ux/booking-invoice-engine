/**
 * @fileoverview Root application component.
 *
 * Defines the client-side routing table using React Router v7. All routes
 * are nested inside a shared <Layout /> wrapper that provides the navigation
 * bar and <Outlet /> for page content.
 *
 * Route architecture:
 *   /                        — Public slot browsing (unauthenticated)
 *   /login                   — User login form
 *   /register                — Tenant + admin registration
 *   /unauthorized            — 403 access denied page
 *   /accept-invite           — Invitation acceptance (token-based)
 *   /dashboard               — Admin dashboard (protected)
 *   /book/:slotId            — Slot booking + Stripe checkout (protected)
 *   /admin/slots/new         — Create availability slot (admin/provider/staff)
 *   /admin/slots/:id/edit    — Edit availability slot (admin/provider/staff)
 *
 * @module App
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { Layout } from './components/Layout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Login } from './pages/Login.jsx';
import { Register } from './pages/Register.jsx';
import { PublicDashboard } from './pages/PublicDashboard.jsx';
import { AdminDashboard } from './pages/AdminDashboard.jsx';
import { BookingForm } from './pages/BookingForm.jsx';
import { SlotForm } from './pages/SlotForm.jsx';
import { Unauthorized } from './pages/Unauthorized.jsx';
import { AcceptInvitation } from './pages/AcceptInvitation.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<PublicDashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/accept-invite" element={<AcceptInvitation />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/book/:slotId"
              element={
                <ProtectedRoute>
                  <BookingForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/slots/new"
              element={
                <ProtectedRoute roles={['tenant_admin', 'staff', 'provider']}>
                  <SlotForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/slots/:id/edit"
              element={
                <ProtectedRoute roles={['tenant_admin', 'staff', 'provider']}>
                  <SlotForm />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
