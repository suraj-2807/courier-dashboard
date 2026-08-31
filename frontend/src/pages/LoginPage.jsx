import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/auth.api'
import { Loader2, Eye, EyeOff, ArrowRight, Mail, Lock, Truck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(form)
      if (data.success) {
        setAuth(data.user, data.token)
        toast.success('Welcome back!')
        navigate('/')
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-alt flex flex-col">
      {/* Main content — centered */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          {/* Card */}
          <div className="bg-surface rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-border-light p-8 sm:p-10">
            {/* Logo & Brand */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-[22px] font-extrabold text-text-primary tracking-tight leading-none">
                Prince Courier Service
              </h1>
              <p className="text-[13px] text-text-tertiary mt-1.5 font-medium">
                Enterprise Hub Access
              </p>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-border mb-7" />

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-danger-bg border border-red-100 text-danger text-[13px] px-4 py-3 rounded-xl animate-fade-in font-medium">
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-2">
                  Corporate Email
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Mail className="w-[16px] h-[16px] text-text-tertiary" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="user@princecourier.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[13px] font-semibold text-text-secondary">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-primary hover:text-primary-dark transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock className="w-[16px] h-[16px] text-text-tertiary" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    style={{ textTransform: 'none' }}
                    className="w-full pl-10 pr-11 py-2.5 bg-surface border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember */}
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded border border-border bg-surface peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                    {rememberMe && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[13px] text-text-secondary group-hover:text-text-primary transition-colors">
                  Remember this device
                </span>
              </label>

              {/* Submit */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white text-[14px] font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg hover:shadow-primary/25 active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-5 px-4 border-t border-border-light">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-[12px] text-text-tertiary">
          <span>© {new Date().getFullYear()} Prince Courier Service. All rights reserved.</span>
          <div className="hidden sm:block w-px h-3 bg-border" />
          <div className="flex items-center gap-4">
            <button className="hover:text-text-secondary transition-colors cursor-pointer">Privacy Policy</button>
            <span className="text-border">|</span>
            <button className="hover:text-text-secondary transition-colors cursor-pointer">Terms of Service</button>
            <span className="text-border">|</span>
            <button className="hover:text-text-secondary transition-colors cursor-pointer flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Security Audit
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
