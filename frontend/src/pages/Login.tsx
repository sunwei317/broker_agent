import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Mic } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import Button from '../components/Button'

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  
  const loginMutation = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: async (response) => {
      const token = response.data.access_token
      
      // Set auth with basic info (user info can be fetched later if needed)
      const userInfo = {
        id: 0,
        email: email,
        full_name: '',
        is_verified: true,
      }
      
      setAuth(token, userInfo)
      navigate('/')
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    },
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    loginMutation.mutate()
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 mb-4">
            <Mic className="w-8 h-8 text-midnight-950" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Welcome back</h1>
          <p className="text-midnight-400 mt-2">Sign in to your Broker Agent account</p>
        </div>
        
        {/* Login Form */}
        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-midnight-300 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-midnight-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-midnight-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-midnight-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-midnight-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <Button
              type="submit"
              loading={loginMutation.isPending}
              className="w-full py-3"
            >
              Sign in
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-midnight-400">
              Don't have an account?{' '}
              <Link to="/signup" className="text-gold-400 hover:text-gold-300 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

