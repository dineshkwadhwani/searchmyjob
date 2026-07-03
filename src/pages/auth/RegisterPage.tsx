import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Sparkles, Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { Button, Input } from '../../components/ui'

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    const { error } = await signUp(email, password)
    setLoading(false)
    if (error) { toast.error(error.message); return }
    setSuccess(true)
    setTimeout(() => navigate('/login'), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-100">SearchMyJob AI</span>
        </div>

        {success ? (
          <div className="glass-card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-2">Account created!</h2>
            <p className="text-sm text-slate-500">Redirecting you to login...</p>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-slate-100 mb-1">Create account</h2>
              <p className="text-slate-500 text-sm">Start your AI-powered job search today</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Email address" type="email" placeholder="you@example.com"
                value={email} onChange={e=>setEmail(e.target.value)} icon={<Mail className="w-4 h-4"/>} required />
              <Input label="Password" type="password" placeholder="Min. 8 characters"
                value={password} onChange={e=>setPassword(e.target.value)} icon={<Lock className="w-4 h-4"/>} required />
              <Input label="Confirm password" type="password" placeholder="Repeat password"
                value={confirm} onChange={e=>setConfirm(e.target.value)} icon={<Lock className="w-4 h-4"/>} required />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Create account <ArrowRight className="w-4 h-4"/>
              </Button>
            </form>

            <p className="text-center text-sm text-slate-600 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
