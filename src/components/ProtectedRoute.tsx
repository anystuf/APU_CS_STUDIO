import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, type AppRole } from '../features/auth/AuthProvider'

export function ProtectedRoute({ roles }: { roles?: AppRole[] }) {
  const { session, role, loading } = useAuth()
  if (loading) return <main className="center"><p>Loading your classroom…</p></main>
  if (!session) return <Navigate to="/login" replace />
  if (roles && (!role || !roles.includes(role))) return <Navigate to="/unauthorized" replace />
  return <Outlet />
}
