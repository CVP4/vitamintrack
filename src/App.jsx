import { BrowserRouter, Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TrackerProvider } from './context/TrackerContext';
import { Layout } from './components/Layout';
import { LoadingState } from './components/UI';
import { DashboardPage } from './pages/DashboardPage';
import { AuthPage } from './pages/AuthPage';
import { SupplementsPage } from './pages/SupplementsPage';
import { SupplementDetailPage } from './pages/SupplementDetailPage';
import { HistoryPage } from './pages/HistoryPage';
import { CatalogPage } from './pages/CatalogPage';
import { ProfilePage } from './pages/ProfilePage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function NotFoundPage() {
  return (
    <div className="not-found">
      <span>404</span>
      <h1>Эта страница не нашлась</h1>
      <p>Вернитесь к своему плану — он на месте.</p>
      <Link className="button button-primary" to="/">
        <ArrowLeft size={17} />К моему трекеру
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage key="login" />} />
          <Route path="/register" element={<AuthPage key="register" mode="register" />} />
          <Route
            element={
              <ProtectedRoute>
                <TrackerProvider>
                  <Layout />
                </TrackerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="supplements" element={<SupplementsPage />} />
            <Route path="supplements/:id" element={<SupplementDetailPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="library" element={<Navigate to="/catalog" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
