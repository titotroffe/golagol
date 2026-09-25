import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store';

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
