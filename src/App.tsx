import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProviders, useAuth } from './context/AppContext';
import { AppLayout } from './layouts/AppLayout';
import { ToastContainer } from './components/ToastNotification';

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then((module) => ({ default: module.ChatPage })));
const EncryptionVisualizerPage = lazy(() => import('./pages/EncryptionVisualizerPage').then((module) => ({ default: module.EncryptionVisualizerPage })));
const SecurityLabPage = lazy(() => import('./pages/SecurityLabPage').then((module) => ({ default: module.SecurityLabPage })));
const ContactsPage = lazy(() => import('./pages/ContactsPage').then((module) => ({ default: module.ContactsPage })));
const EventsPage = lazy(() => import('./pages/EventsPage').then((module) => ({ default: module.EventsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-slate-400" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" aria-hidden="true" />
      <span>Loading page…</span>
    </div>
  );
}

class RouteErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
          <p className="text-sm text-red-300">This page could not be displayed.</p>
          <button onClick={() => window.location.reload()} className="btn-secondary rounded-lg px-4 py-2 text-sm">Reload page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <RouteErrorBoundary><Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense></RouteErrorBoundary>;
}

function SessionRestoreFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 bg-[#0a0f1e] text-sm text-slate-400" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" aria-hidden="true" />
      <span>Checking your session…</span>
    </div>
  );
}

// ─── Route Guard ───────────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <SessionRestoreFallback />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <SessionRestoreFallback />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ─── Router ───────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LazyPage><LoginPage /></LazyPage></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><LazyPage><DashboardPage /></LazyPage></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><LazyPage><ChatPage /></LazyPage></ProtectedRoute>} />
      <Route path="/visualizer" element={<ProtectedRoute><LazyPage><EncryptionVisualizerPage /></LazyPage></ProtectedRoute>} />
      <Route path="/security-lab" element={<ProtectedRoute><LazyPage><SecurityLabPage /></LazyPage></ProtectedRoute>} />
      <Route path="/contacts" element={<ProtectedRoute><LazyPage><ContactsPage /></LazyPage></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><LazyPage><EventsPage /></LazyPage></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><LazyPage><SettingsPage /></LazyPage></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
        <ToastContainer />
      </AppProviders>
    </BrowserRouter>
  );
}
