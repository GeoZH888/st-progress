import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../lib/auth'
import { Loading } from './Status'

/**
 * Wrap any /admin/* route to require an authenticated session.
 * Unauthenticated visits redirect to /admin/login, preserving the intended
 * destination in router state so login can bounce back.
 */
export default function AdminGuard({ children }) {
  const { session, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page">
        <Loading />
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }
  return children
}
