import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export function RequireAuth() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }
  return <Outlet />;
}
