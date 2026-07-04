import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plug, Sparkles, FileText, Search, Coins, Briefcase, Wand2, ArrowRight, Info, Rocket } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageHeader, Badge, Button, PageLoading, Modal } from '../../components/ui'

export default function DashboardPage() {
  const { profile, refreshProfile, isFeatureEnabled } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [hasResume, setHasResume] = useState(false)
  const [configCount, setConfigCount] = useState(0)
  const [appliedCount, setAppliedCount] = useState(0)
  const [customizedCount, setCustomizedCount] = useState(0)
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => { load() }, [profile])

  async function load() {
    if (!profile) return
    const [resumeRes, configRes, appliedRes, customizedRes] = await Promise.all([
      supabase.from('resumes').select('id').eq('user_id', profile.id).eq('is_active', true).maybeSingle(),
      supabase.from('search_config').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
      supabase.from('job_results').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('is_applied', true),
      supabase.from('customized_resumes').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
    ])
    setHasResume(!!resumeRes.data)
    setConfigCount(configRes.count ?? 0)
    setAppliedCount(appliedRes.count ?? 0)
    setCustomizedCount(customizedRes.count ?? 0)
    setLoading(false)
    if (!profile.has_seen_welcome) setShowWelcome(true)
  }

  async function dismissWelcome() {
    setShowWelcome(false)
    if (profile && !profile.has_seen_welcome) {
      await supabase.from('profiles').update({ has_seen_welcome: true }).eq('id', profile.id)
      await refreshProfile()
    }
  }

  if (loading) return <PageLoading />

  const hasApify = !!profile?.apify_key_encrypted
  const hasGroq = !!profile?.groq_key_encrypted
  const hasConfig = configCount > 0
  const credits = profile?.wallet_credits ?? 0

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back${profile?.email ? ', ' + profile.email.split('@')[0] : ''}`}
        action={
          <button onClick={() => setShowWelcome(true)} title="About SearchMyJob AI"
            className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-800/50 flex items-center justify-center text-slate-500 hover:text-violet-400 hover:border-violet-500/50 transition-all">
            <Info className="w-4 h-4" />
          </button>
        }
      />

      {showWelcome && (
        <Modal title="Welcome to SearchMyJob AI" onClose={dismissWelcome}>
          <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
            <p>
              A tool built to make your job search journey easy. With SearchMyJob AI, you can:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Search jobs</li>
              <li>Check your match score</li>
              <li>Customize your resume for the job</li>
              <li>Apply and track your applications</li>
            </ol>
            <p>
              Instead of searching for jobs yourself, let our agents work for you across multiple
              platforms. You can set up to <strong className="text-slate-200">3 search configs</strong>,
              each with up to <strong className="text-slate-200">3 roles, 3 skills, and 3 locations</strong>.
              We'll find jobs matching your criteria and show you how well your profile matches each
              one. When you're ready to apply, we'll customize your resume to closely match the job
              description — boosting your chances of landing an interview.
            </p>
            <p>
              This tool is built to help, so it's free to use. It runs on a{' '}
              <strong className="text-slate-200">Bring Your Own Key (BYOK)</strong> model — you connect
              your own free API keys, and SearchMyJob AI works relentlessly to help you succeed. If you
              run out of your free allowance, you'll need to wait for your next top-up or recharge your
              API account.
            </p>
            <Button onClick={dismissWelcome} size="lg" className="w-full mt-2">
              <Rocket className="w-4 h-4" /> Start My Job Search Journey
            </Button>
          </div>
        </Modal>
      )}

      <DashboardSection title="Connectors">
        <StatusTile
          icon={<Plug className="w-5 h-5" />}
          title="Apify Connector"
          description="Powers job scraping across LinkedIn and Naukri."
          isReady={hasApify}
          actionLabel="Setup"
          onAction={() => navigate('/settings/apify')}
        />
        <StatusTile
          icon={<Sparkles className="w-5 h-5" />}
          title="Groq Connector"
          description="Powers AI resume matching and customization."
          isReady={hasGroq}
          actionLabel="Setup"
          onAction={() => navigate('/settings/groq')}
        />
      </DashboardSection>

      <DashboardSection title="Search Setup">
        <StatusTile
          icon={<FileText className="w-5 h-5" />}
          title="Resume"
          description="Upload your resume to enable AI matching and customization."
          isReady={hasResume}
          actionLabel="Upload Resume"
          onAction={() => navigate('/settings/resume')}
        />
        <StatusTile
          icon={<Search className="w-5 h-5" />}
          title="Search Config"
          description="Set your target roles, locations and search preferences."
          isReady={hasConfig}
          actionLabel="Configure Search"
          onAction={() => navigate('/settings/search')}
        />
      </DashboardSection>

      <DashboardSection title="Activity">
        <ActivityTile
          icon={<Coins className="w-5 h-5" />}
          value={credits}
          label="Available Credits"
          badge={credits === 0 ? { label: 'Empty', variant: 'yellow' } : { label: 'Active', variant: 'green' }}
          actionLabel={isFeatureEnabled('wallet') ? 'Add Credits' : undefined}
          onAction={() => navigate('/wallet')}
        />
        <ActivityTile
          icon={<Briefcase className="w-5 h-5" />}
          value={appliedCount}
          label="Total Jobs Applied"
          actionLabel="View"
          onAction={() => navigate('/job-bucket')}
        />
        <ActivityTile
          icon={<Wand2 className="w-5 h-5" />}
          value={customizedCount}
          label="Customized Resumes"
          actionLabel={isFeatureEnabled('customize') ? 'View' : undefined}
          onAction={() => navigate('/customized-resumes')}
        />
      </DashboardSection>
    </div>
  )
}

function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  )
}

function StatusTile({ icon, title, description, isReady, actionLabel, onAction }: {
  icon: ReactNode; title: string; description: string; isReady: boolean
  actionLabel: string; onAction: () => void
}) {
  return (
    <div className="glass-card p-5 flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isReady ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        }`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-200 text-sm truncate">{title}</p>
          <Badge label={isReady ? 'Connected' : 'Not Set Up'} variant={isReady ? 'green' : 'red'} />
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-4 flex-1">{description}</p>
      {!isReady && (
        <Button size="sm" onClick={onAction} className="w-full">
          {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}

function ActivityTile({ icon, value, label, badge, actionLabel, onAction }: {
  icon: ReactNode; value: number; label: string
  badge?: { label: string; variant: 'green' | 'yellow' }
  actionLabel?: string; onAction: () => void
}) {
  return (
    <div className="glass-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400">
          {icon}
        </div>
        {badge && <Badge label={badge.label} variant={badge.variant} />}
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-xs text-slate-500 mb-4">{label}</p>
      {actionLabel && (
        <Button size="sm" variant="secondary" onClick={onAction} className="w-full mt-auto">
          {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}
