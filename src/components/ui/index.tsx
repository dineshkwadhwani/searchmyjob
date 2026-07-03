import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Loader2, Sparkles, TrendingUp } from 'lucide-react'

// ── Button ──
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}
export function Button({ variant = 'primary', size = 'md', loading, children, className = '', ...props }: ButtonProps) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-5 py-2.5 text-sm', lg: 'px-7 py-3.5 text-base' }
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  }
  return (
    <button className={`${variants[variant]} ${sizes[size]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

// ── Input ──
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string; icon?: ReactNode
}
export function Input({ label, error, hint, icon, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</div>}
        <input className={`input ${icon ? 'pl-10' : ''} ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''} ${className}`} {...props} />
      </div>
      {error && <p className="text-xs text-red-400 flex items-center gap-1">⚠ {error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

// ── Select ──
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string
  options: { value: string; label: string; disabled?: boolean }[]
}
export function Select({ label, error, options, className = '', ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="label">{label}</label>}
      <select className={`input ${error ? 'border-red-500/50' : ''} ${className}`} {...props}>
        {options.map(o => <option key={o.value} value={o.value} disabled={o.disabled} className="bg-slate-800">{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
    </div>
  )
}

// ── Textarea ──
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string
}
export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="label">{label}</label>}
      <textarea className={`input resize-none ${error ? 'border-red-500/50' : ''} ${className}`} {...props} />
      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
    </div>
  )
}

// ── Card ──
export function Card({ children, className = '', glow = false }: { children: ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`glass-card p-6 ${glow ? 'glow' : ''} ${className}`}>
      {children}
    </div>
  )
}

// ── Badge ──
type BadgeVariant = 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'purple' | 'premium'
export function Badge({ label, variant = 'gray' }: { label: string; variant?: BadgeVariant }) {
  const v: Record<BadgeVariant, string> = {
    green:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    red:     'bg-red-500/15 text-red-400 border-red-500/20',
    yellow:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
    gray:    'bg-slate-700/50 text-slate-400 border-slate-600/30',
    blue:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
    purple:  'bg-violet-500/15 text-violet-400 border-violet-500/20',
    premium: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${v[variant]}`}>
      {variant === 'premium' && <Sparkles className="w-3 h-3" />}
      {label}
    </span>
  )
}

// ── Spinner ──
export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return <Loader2 className={`animate-spin text-violet-400 ${s[size]} ${className}`} />
}

// ── Page loading ──
export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  )
}

// ── Empty State ──
export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-600 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-300 mb-2">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">{description}</p>}
      {action}
    </div>
  )
}

// ── Stat Card ──
export function StatCard({ label, value, icon, sub, trend }: {
  label: string; value: string | number; icon?: ReactNode; sub?: string; trend?: 'up' | 'down'
}) {
  return (
    <div className="glass-card p-5 card-hover">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        {icon && <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">{icon}</div>}
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      {sub && (
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Page Header ──
export function PageHeader({ title, description, action, badge }: {
  title: string; description?: string; action?: ReactNode; badge?: string
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
          {badge && <Badge label={badge} variant="purple" />}
        </div>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Tag Input ──
interface TagInputProps {
  label?: string; tags: string[]; onChange: (tags: string[]) => void
  max?: number; placeholder?: string; hint?: string; error?: string
}
export function TagInput({ label, tags, onChange, max = 3, placeholder, hint, error }: TagInputProps) {
  function commit(input: HTMLInputElement) {
    const val = input.value.trim()
    if (val && !tags.includes(val) && tags.length < max) {
      onChange([...tags, val])
      input.value = ''
    }
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(e.currentTarget)
    }
    if (e.key === 'Backspace' && !e.currentTarget.value) onChange(tags.slice(0, -1))
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    commit(e.currentTarget)
  }
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="label">
          {label}
          <span className="text-slate-600 font-normal ml-1">({tags.length}/{max})</span>
        </label>
      )}
      <div className={`min-h-[46px] flex flex-wrap gap-2 p-2.5 rounded-xl border bg-slate-800/80
        ${error ? 'border-red-500/50' : 'border-slate-700'}
        focus-within:ring-2 focus-within:ring-violet-500/50 focus-within:border-violet-500/50 transition-all`}>
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-lg text-xs font-medium">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-white transition-colors text-violet-400">×</button>
          </span>
        ))}
        {tags.length < max && (
          <input type="text" className="flex-1 min-w-[140px] text-sm outline-none bg-transparent text-slate-200 placeholder:text-slate-600"
            placeholder={tags.length === 0 ? placeholder : 'Add more...'} onKeyDown={handleKeyDown} onBlur={handleBlur} />
        )}
      </div>
      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

// ── Match Score Ring ──
export function MatchScoreRing({ score }: { score: number }) {
  const r = 28, c = 2 * Math.PI * r
  const pct = score / 100
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative inline-flex items-center justify-center w-20 h-20">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={c - pct * c} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute text-center">
        <span className="text-lg font-bold text-slate-100">{score}</span>
        <span className="block text-[9px] text-slate-500 -mt-0.5">score</span>
      </div>
    </div>
  )
}

// ── Divider ──
export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="border-t border-slate-700/50 my-6" />
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 border-t border-slate-700/50" />
      <span className="text-xs text-slate-600 font-medium uppercase tracking-wider">{label}</span>
      <div className="flex-1 border-t border-slate-700/50" />
    </div>
  )
}

// ── Alert ──
export function Alert({ type, message }: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) {
  const styles = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error:   'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    info:    'bg-violet-500/10 border-violet-500/30 text-violet-400',
  }
  return (
    <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${styles[type]}`}>
      {message}
    </div>
  )
}
