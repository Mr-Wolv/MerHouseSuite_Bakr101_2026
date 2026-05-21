import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function HomeRedirect() {
  const { user } = useAuth()

  if (user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'SUPPORT_ADMIN' || user?.role === 'AUDITOR') {
    return <Navigate to="/admin" replace />
  }

  if (user?.role === 'MERCHANT') {
    return <Navigate to="/merchant" replace />
  }

  if (user?.role === 'WAREHOUSE_OPERATOR') {
    return <Navigate to="/warehouse" replace />
  }

  return <Navigate to="/login" replace />
}
