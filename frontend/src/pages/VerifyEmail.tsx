import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { authApi } from '../api/auth'
import Button from '../components/Button'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  
  const verifyMutation = useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
    onSuccess: (response) => {
      setStatus('success')
      setMessage(response.data.message)
    },
    onError: (err: any) => {
      setStatus('error')
      setMessage(err.response?.data?.detail || 'Verification failed. The link may be invalid or expired.')
    },
  })
  
  useEffect(() => {
    if (token) {
      verifyMutation.mutate(token)
    } else {
      setStatus('error')
      setMessage('No verification token provided.')
    }
  }, [token])
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
      </div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center relative z-10"
      >
        <div className="glass rounded-2xl p-8">
          {status === 'loading' && (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/20 mb-6">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              </div>
              <h1 className="font-display text-2xl font-bold text-white mb-4">
                Verifying your email...
              </h1>
              <p className="text-midnight-400">
                Please wait while we verify your email address.
              </p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h1 className="font-display text-2xl font-bold text-white mb-4">
                Email verified!
              </h1>
              <p className="text-midnight-400 mb-6">
                {message}
              </p>
              <Link to="/login">
                <Button className="w-full">
                  Sign in to your account
                </Button>
              </Link>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 mb-6">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="font-display text-2xl font-bold text-white mb-4">
                Verification failed
              </h1>
              <p className="text-midnight-400 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <Link to="/signup">
                  <Button className="w-full">
                    Try signing up again
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary" className="w-full">
                    Back to login
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

