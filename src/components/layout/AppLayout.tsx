import type { ReactNode } from 'react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Search, Briefcase, FileText, Wallet,
  Users, Key, Sliders, LogOut, Menu, X,
  Sparkles, ChevronRight, Coins, LayoutDashboard,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import type { FeatureName } from '../../types'

const adminNav = [
  { to: '/admin/features',       label: 'Feature Config',  icon: <Sliders className="w-4 h-4" /> },
  { to: '/admin/affiliate-keys', label: 'Affiliate Keys',  icon: <Key className="w-4 h-4" /> },
  { to: '/admin/users',          label: 'Manage Users',    icon: <Users className="w-4 h-4" /> },
]

const jobseekerNav: { to: string; label: string; icon: ReactNode; isPremium?: boolean; feature?: FeatureName }[] = [
  { to: '/dashboard',   label: 'Dashboard',        icon: <LayoutDashboard className="w-4 h-4" /> },
  { to: '/search',      label: 'Search Jobs',      icon: <Search className="w-4 h-4" />,   feature: 'search' },
  { to: '/job-bucket',  label: 'Job Bucket',        icon: <Briefcase className="w-4 h-4" />, feature: 'apply' },
  { to: '/wallet',      label: 'Wallet',            icon: <Wallet className="w-4 h-4" />,   feature: 'wallet' },
  { to: '/customized-resumes', label: 'AI Resumes', icon: <FileText className="w-4 h-4" />, isPremium: true, feature: 'customize' },
]

const settingsNav = [
  { to: '/settings/resume', label: 'Resume Upload' },
  { to: '/settings/search', label: 'Search Config' },
  { to: '/settings/apify',  label: 'Apify Key' },
  { to: '/settings/groq',   label: 'Groq Key' },
]

function NavItem({ to, label, icon, isPremium }: { to: string; label: string; icon: ReactNode; isPremium?: boolean }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium leading-none transition-all duration-150 ${
        isActive
          ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
      }`}>
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {isPremium && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold leading-none">PRO</span>
      )}
    </NavLink>
  )
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, isFeatureEnabled } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const isAdmin = profile?.role === 'superadmin'
  const visibleJobseekerNav = jobseekerNav.filter(n => !n.feature || isFeatureEnabled(n.feature))
  const walletEnabled = isFeatureEnabled('wallet')

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-700/50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-100 text-sm leading-tight">SearchMyJob AI</p>
            <p className="text-xs text-slate-500">{isAdmin ? 'Super Admin' : 'Job Seeker'}</p>
          </div>
        </div>
      </div>

      {/* Credits pill (jobseeker) */}
      {!isAdmin && walletEnabled && (
        <div className="px-3 pt-3">
          <button onClick={() => navigate('/wallet')}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border border-violet-500/20 hover:border-violet-500/40 transition-all group">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Coins className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-violet-300">{profile?.wallet_credits ?? 0} Credits</p>
              <p className="text-xs text-slate-600">Tap to top up</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 transition-colors" />
          </button>
        </div>
      )}

      {/* Nav */}
      <div className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {isAdmin
          ? adminNav.map(n => <NavItem key={n.to} {...n} />)
          : visibleJobseekerNav.map(n => <NavItem key={n.to} {...n} />)
        }

        {!isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Settings</p>
            </div>
            <div className="space-y-0.5">
              {settingsNav.map(s => (
                <NavLink key={s.to} to={s.to} className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs leading-none transition-all ${
                    isActive ? 'text-violet-400 bg-violet-500/10' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/40'
                  }`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${location.pathname === s.to ? 'bg-violet-400' : 'bg-slate-700'}`} />
                  {s.label}
                </NavLink>
              ))}
            </div>
          </>
        )}
      </div>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/60 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {profile?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-300 truncate">{profile?.email}</p>
            <p className="text-[10px] text-slate-600 capitalize">{profile?.role}</p>
          </div>
        </div>
        <button onClick={async () => { await signOut(); navigate('/login') }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0">{sidebarContent}</aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 shadow-2xl">
            {sidebarContent}
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3.5 bg-slate-900 border-b border-slate-700/50">
          <button onClick={() => setOpen(true)} className="text-slate-400">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm text-slate-100">SearchMyJob AI</span>
          </div>
          <div className="w-5" />
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
