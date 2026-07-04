import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import { Spinner } from './components/ui'

import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage'
import TermsOfServicePage from './pages/legal/TermsOfServicePage'
import DashboardPage from './pages/jobseeker/DashboardPage'
import SearchPage from './pages/jobseeker/SearchPage'
import JobBucketPage from './pages/jobseeker/JobBucketPage'
import WalletPage from './pages/jobseeker/WalletPage'
import CustomizePage from './pages/jobseeker/CustomizePage'
import CustomizedResumesPage from './pages/jobseeker/CustomizedResumesPage'
import { ResumeSettings, SearchSettings, ApifySettings, GroqSettings } from './pages/jobseeker/SettingsPages'
import { AdminFeaturesPage, AdminAffiliateKeysPage, AdminUsersPage } from './pages/admin/AdminPages'

const queryClient = new QueryClient()

function AppRoutes() {
  const { user, profile, loading, profileError } = useAuth()
  const location = useLocation()

  if (location.pathname === '/privacy-policy') return <PrivacyPolicyPage />
  if (location.pathname === '/terms-of-service') return <TermsOfServicePage />

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Spinner />
          </div>
          <p className="text-slate-500 text-sm">Loading SearchMyJob AI...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (profileError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-2">Couldn't load your profile</h2>
          <p className="text-sm text-slate-500">{profileError}</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!profile.is_enabled && profile.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-2">Account Disabled</h2>
          <p className="text-sm text-slate-500">Your account has been disabled. Please contact the administrator.</p>
        </div>
      </div>
    )
  }

  const isAdmin = profile.role === 'superadmin'

  return (
    <AppLayout>
      <Routes>
        {isAdmin ? (
          <>
            <Route path="/" element={<Navigate to="/admin/features" replace />} />
            <Route path="/admin/features" element={<AdminFeaturesPage />} />
            <Route path="/admin/affiliate-keys" element={<AdminAffiliateKeysPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="*" element={<Navigate to="/admin/features" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/job-bucket" element={<JobBucketPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/customized-resumes" element={<CustomizedResumesPage />} />
            <Route path="/customize/:jobId" element={<CustomizePage />} />
            <Route path="/settings/resume" element={<ResumeSettings />} />
            <Route path="/settings/search" element={<SearchSettings />} />
            <Route path="/settings/apify" element={<ApifySettings />} />
            <Route path="/settings/groq" element={<GroqSettings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" theme="dark" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
