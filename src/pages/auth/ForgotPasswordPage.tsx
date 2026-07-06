import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { Button, Input } from '../../components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    setSent(true)
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

        {sent ? (
          <div className="glass-card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-2">Check your email</h2>
            <p className="text-sm text-slate-500 mb-6">
              If an account exists for <span className="text-slate-300">{email}</span>, we've sent a link to reset your password.
            </p>
            <Link to="/login" className="text-sm text-violet-400 hover:text-violet-300 font-medium inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-slate-100 mb-1">Forgot password?</h2>
              <p className="text-slate-500 text-sm">Enter your email and we'll send you a reset link</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Email address" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} icon={<Mail className="w-4 h-4" />} required />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Send reset link <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            <p className="text-center text-sm text-slate-600 mt-6">
              <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
