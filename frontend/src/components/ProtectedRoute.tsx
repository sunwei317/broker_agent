import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireVerified?: boolean
}

export default function ProtectedRoute({ children, requireVerified = false }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()
  
  if (!isAuthenticated) {
    // Redirect to login, saving the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  if (requireVerified && user && !user.is_verified) {
    // User is logged in but email not verified
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <h2 className="font-display text-2xl font-bold text-white mb-4">
            Email verification required
          </h2>
          <p className="text-midnight-400 mb-6">
            Please verify your email address to access this feature.
            Check your inbox for the verification link.
          </p>
          <button
            onClick={() => useAuthStore.getState().logout()}
            className="text-gold-400 hover:text-gold-300"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    )
  }
  
  return <>{children}</>
}

