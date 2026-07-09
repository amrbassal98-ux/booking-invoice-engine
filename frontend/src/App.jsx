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
                <ProtectedRoute roles={['tenant_admin', 'staff']}>
                  <SlotForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/slots/:id/edit"
              element={
                <ProtectedRoute roles={['tenant_admin', 'staff']}>
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
