import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Sparkles, Mail, Lock, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { Button, Input } from '../../components/ui'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { toast.error(error.message); return }
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex overflow-hidden">
      {/* Left decorative panel */}
      <div className="hidden lg:flex w-1/2 relative bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl animate-pulse-slow" style={{animationDelay:'1.5s'}} />
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />

        <div className="relative z-10 max-w-md text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-violet-500/40 animate-float">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-4 leading-tight">
            Find your<br />
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">dream job</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            AI-powered job search across LinkedIn and Naukri. Match your resume, customize for each role, and land interviews faster.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[{label:'Jobs Found',value:'10K+'},{label:'Match Accuracy',value:'94%'},{label:'Time Saved',value:'5hrs'}].map(s=>(
              <div key={s.label} className="glass rounded-2xl p-4">
                <p className="text-2xl font-bold text-violet-300">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-100">SearchMyJob AI</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-100 mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm">Sign in to continue your job search</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email address" type="email" placeholder="you@example.com"
              value={email} onChange={e=>setEmail(e.target.value)} icon={<Mail className="w-4 h-4"/>} required />
            <Input label="Password" type="password" placeholder="••••••••"
              value={password} onChange={e=>setPassword(e.target.value)} icon={<Lock className="w-4 h-4"/>} required />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300">Forgot password?</Link>
            </div>
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign in <ArrowRight className="w-4 h-4"/>
            </Button>
          </form>

          <p className="text-center text-sm text-slate-600 mt-6">
            No account?{' '}
            <Link to="/register" className="text-violet-400 hover:text-violet-300 font-medium">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
