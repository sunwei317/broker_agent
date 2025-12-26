import { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, User, Mic, CheckCircle2, XCircle, Check } from 'lucide-react'
import { authApi } from '../api/auth'
import Button from '../components/Button'

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  // Password validation rules
  const passwordRules = useMemo(() => ({
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'`~]/.test(password),
  }), [password])
  
  const isPasswordValid = Object.values(passwordRules).every(Boolean)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const isFormValid = fullName.trim() && email && isPasswordValid && passwordsMatch
  
  const signupMutation = useMutation({
    mutationFn: () => authApi.signup({ email, password, full_name: fullName }),
    onSuccess: () => {
      setSuccess(true)
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.')
    },
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!fullName.trim()) {
      setError('Full name is required')
      return
    }
    
    if (!isPasswordValid) {
      setError('Please meet all password requirements')
      return
    }
    
    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }
    
    signupMutation.mutate()
  }
  
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="glass rounded-2xl p-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white mb-4">
              Check your email
            </h1>
            <p className="text-midnight-400 mb-6">
              We've sent a verification link to <span className="text-white">{email}</span>. 
              Please check your inbox and click the link to verify your account.
            </p>
            <p className="text-midnight-500 text-sm mb-6">
              Didn't receive the email? Check your spam folder or{' '}
              <button 
                onClick={() => authApi.resendVerification(email)}
                className="text-gold-400 hover:text-gold-300"
              >
                click here to resend
              </button>
            </p>
            <Link to="/login">
              <Button variant="secondary" className="w-full">
                Back to login
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
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
          <h1 className="font-display text-3xl font-bold text-white">Create an account</h1>
          <p className="text-midnight-400 mt-2">Start managing your conversations with AI</p>
        </div>
        
        {/* Signup Form */}
        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
            
            {/* Full Name - Required */}
            <div>
              <label className="block text-sm font-medium text-midnight-300 mb-2">
                Full name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-midnight-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50"
                />
              </div>
            </div>
            
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-midnight-300 mb-2">
                Email address <span className="text-red-400">*</span>
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
            
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-midnight-300 mb-2">
                Password <span className="text-red-400">*</span>
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
              
              {/* Password Requirements */}
              <div className="mt-3 space-y-1.5">
                <p className="text-xs text-midnight-400 mb-2">Password must contain:</p>
                <PasswordRule met={passwordRules.minLength} text="At least 8 characters" />
                <PasswordRule met={passwordRules.hasUppercase} text="One uppercase letter (A-Z)" />
                <PasswordRule met={passwordRules.hasLowercase} text="One lowercase letter (a-z)" />
                <PasswordRule met={passwordRules.hasNumber} text="One number (0-9)" />
                <PasswordRule met={passwordRules.hasSymbol} text="One symbol (!@#$%^&*...)" />
              </div>
            </div>
            
            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-midnight-300 mb-2">
                Confirm password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-12 pr-12 py-3 bg-white/5 border rounded-xl text-white placeholder-midnight-500 focus:outline-none focus:ring-1 ${
                    confirmPassword.length === 0
                      ? 'border-white/10 focus:border-gold-500/50 focus:ring-gold-500/50'
                      : passwordsMatch
                      ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/50'
                      : 'border-red-500/50 focus:border-red-500 focus:ring-red-500/50'
                  }`}
                />
                {confirmPassword.length > 0 && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {passwordsMatch ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                )}
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
              {confirmPassword.length > 0 && passwordsMatch && (
                <p className="text-xs text-emerald-400 mt-1">Passwords match ✓</p>
              )}
            </div>
            
            <Button
              type="submit"
              loading={signupMutation.isPending}
              disabled={!isFormValid}
              className="w-full py-3"
            >
              Create account
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-midnight-400">
              Already have an account?{' '}
              <Link to="/login" className="text-gold-400 hover:text-gold-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// Password requirement indicator component
function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border border-midnight-500" />
      )}
      <span className={`text-xs ${met ? 'text-emerald-400' : 'text-midnight-500'}`}>
        {text}
      </span>
    </div>
  )
}
