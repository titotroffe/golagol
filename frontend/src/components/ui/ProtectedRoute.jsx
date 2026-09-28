import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store';

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  return token ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />;
}
