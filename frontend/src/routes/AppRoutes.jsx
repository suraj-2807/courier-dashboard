import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import DashboardLayout from '../layouts/DashboardLayout'

import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import BookingsPage from '../pages/BookingsPage'
import BookingDetailPage from '../pages/BookingDetailPage'
import NewBookingPage from '../pages/NewBookingPage'
import TrackingPage from '../pages/TrackingPage'
import ApiSettingsPage from '../pages/ApiSettingsPage'
import RatesPage from '../pages/RatesPage'
import CustomerBookingPage from '../pages/CustomerBookingPage'
import BookingRequestsPage from '../pages/BookingRequestsPage'

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookings"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <BookingsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookings/new"
        element={
          <ProtectedRoute>
            <NewBookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookings/edit/:id"
        element={
          <ProtectedRoute>
            <NewBookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookings/:id"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <BookingDetailPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tracking"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <TrackingPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/api-settings"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ApiSettingsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rates"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <RatesPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking-requests"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <BookingRequestsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Customer-facing routes (public — auth handled by WP plugin) */}
      <Route path="/customer/booking" element={<CustomerBookingPage />} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
