import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Zap, ExternalLink, BookmarkPlus, Brain, Wand2,
  Clock, MapPin, Building2, Globe2, Loader2, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, PageHeader, Badge, EmptyState, MatchScoreRing } from '../../components/ui'
import type { JobResult, JobRun, SearchConfig, MatchResult, FeatureConfig } from '../../types'
import { formatDate, TIME_FRAME_OPTIONS } from '../../lib/constants'

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then(lib => {
      lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString()
      return lib
    })
  }
  return pdfjsLibPromise
}


type JobWithMatch = JobResult & { matchResult?: MatchResult; platform?: string }

export default function SearchPage() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [config, setConfig] = useState<SearchConfig | null>(null)
  const [currentRun, setCurrentRun] = useState<JobRun | null>(null)
  const [jobs, setJobs] = useState<JobWithMatch[]>([])
  const [features, setFeatures] = useState<FeatureConfig[]>([])
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<'connecting' | 'connected' | 'waiting'>('connecting')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [matchingId, setMatchingId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running || !currentRun?.created_at) return
    const startedAt = new Date(currentRun.created_at).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [running, currentRun?.created_at])

  useEffect(() => { init() }, [profile])

  async function init() {
    if (!profile) return
    await Promise.all([loadConfig(), loadFeatures(), loadLatestRun()])
  }

  async function loadConfig() {
    if (!profile) return
    const { data } = await supabase.from('search_config').select('*').eq('user_id', profile.id).single()
    setConfig(data as SearchConfig | null)
  }

  async function loadFeatures() {
    const { data } = await supabase.from('feature_config').select('*')
    if (data) setFeatures(data as FeatureConfig[])
  }

  async function loadLatestRun() {
    if (!profile) return
    const { data: run } = await supabase.from('job_runs').select('*')
      .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1).single()
    if (run) {
      setCurrentRun(run as JobRun)
      if (run.status === 'completed') await loadJobs(run.id)
      if (run.status === 'running' || run.status === 'pending') {
        setStage('waiting')
        subscribeToRun(run.id)
      }
    }
  }

  async function loadJobs(runId: string) {
    const { data } = await supabase.from('job_results').select('*')
      .eq('run_id', runId).order('created_at', { ascending: true })
    if (data && profile) {
      const jobIds = data.map((j: any) => j.id)
      const { data: matches } = await supabase.from('match_results').select('*')
        .in('job_result_id', jobIds).eq('user_id', profile.id)
      const matchMap = new Map((matches ?? []).map((m: any) => [m.job_result_id, m]))
      setJobs(data.map((j: any) => ({ ...j, matchResult: matchMap.get(j.id) })))
    }
  }

  function subscribeToRun(runId: string) {
    setRunning(true)
    const channel = supabase.channel(`run-${runId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_runs', filter: `id=eq.${runId}` },
        async (payload) => {
          const updated = payload.new as JobRun
          setCurrentRun(updated)
          if (updated.status === 'completed') {
            await loadJobs(runId)
            await refreshProfile()
            setRunning(false)
            channel.unsubscribe()
            const count = updated.result_count ?? 0
            toast.success(count > 0 ? `Search complete — found ${count} job${count === 1 ? '' : 's'}!` : 'Search complete — no jobs matched this time.')
          }
          if (updated.status === 'failed') {
            toast.error(updated.error_message ?? 'Search failed. Please try again.')
            setRunning(false)
            channel.unsubscribe()
          }
        }
      ).subscribe()
  }

  async function runSearch() {
    if (!profile || !config) return
    if (!profile.apify_key_encrypted) { navigate('/settings/apify'); return }
    const allPlatformCost = features.find(f => f.feature === 'all_platforms')?.credit_cost ?? 20
    if (config.platform === 'all' && profile.wallet_credits < allPlatformCost) {
      toast.error(`Need ${allPlatformCost} credits for All Platforms. Balance: ${profile.wallet_credits}`)
      return
    }
    setRunning(true)
    setStage('connecting')
    const { data, error: fnErr } = await supabase.functions.invoke('run-search', { body: { config_id: config.id } })
    if (fnErr || data?.error) {
      toast.error(data?.error ?? fnErr?.message ?? 'Failed to start search')
      setRunning(false); return
    }
    setStage('connected')
    toast.success('Connected to Apify — search started')
    const { data: run } = await supabase.from('job_runs').select('*').eq('id', data.run_id).single()
    if (run) setCurrentRun(run as JobRun)
    setTimeout(() => setStage('waiting'), 1200)
    subscribeToRun(data.run_id)
  }

  function formatElapsed(sec: number) {
    const m = Math.floor(sec / 60), s = sec % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  async function handleApply(job: JobWithMatch) {
    if (job.is_applied) { window.open(job.link, '_blank'); return }
    await supabase.from('job_results').update({ is_applied: true, applied_at: new Date().toISOString() }).eq('id', job.id)
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_applied: true } : j))
    window.open(job.link, '_blank')
  }

  async function handleMatch(job: JobWithMatch) {
    if (!profile) return
    const matchCost = features.find(f => f.feature === 'match')?.credit_cost ?? 5
    if (profile.wallet_credits < matchCost) { toast.error(`Need ${matchCost} credits to match.`); return }
    if (!profile.groq_key_encrypted) { navigate('/settings/groq'); return }

    const { data: resume } = await supabase.from('resumes').select('*').eq('user_id', profile.id).eq('is_active', true).single()
    if (!resume) { toast.error('Please upload a resume first.'); navigate('/settings/resume'); return }

    const { data: blob } = await supabase.storage.from('resumes').download(resume.file_path)
    if (!blob) { toast.error('Could not load your resume file.'); return }

    setMatchingId(job.id)
    try {
      const pdfjsLib = await loadPdfjs()
      const arrayBuffer = await blob.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let resumeText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        resumeText += (content.items as any[]).map(item => item.str).join(' ') + '\n'
      }

      const { data, error: fnErr } = await supabase.functions.invoke('match-resume', {
        body: { job_result_id: job.id, resume_text: resumeText }
      })
      if (fnErr || data?.error) { toast.error(data?.error ?? 'Match failed'); return }
      await refreshProfile()
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, matchResult: data.match } : j))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to process resume')
    } finally {
      setMatchingId(null)
    }
  }

  function getFeatureCost(name: string) {
    return features.find(f => f.feature === name)?.credit_cost ?? 0
  }

  const filteredJobs = platformFilter === 'all' ? jobs : jobs.filter(j => (j as any).platform === platformFilter)
  const configMissing = !config || (config.job_titles?.length ?? 0) === 0

  return (
    <div>
      <PageHeader
        title="Search Jobs"
        description="AI-powered search across LinkedIn and Naukri"
        action={
          <Button onClick={runSearch} loading={running} size="lg" disabled={configMissing || running}>
            {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching...</> : <><Zap className="w-4 h-4" /> Search My Jobs</>}
          </Button>
        }
      />

      {config && !configMissing && (
        <Card className="mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-sm">
              <Search className="w-4 h-4 text-violet-400" />
              <span className="text-slate-500">Roles:</span>
              <div className="flex gap-1 flex-wrap">
                {config.job_titles.map(t => <Badge key={t} label={t} variant="purple" />)}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-violet-400" />
              {config.locations.map(l => <Badge key={l} label={l} variant="gray" />)}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-violet-400" />
              <span className="text-slate-500">{TIME_FRAME_OPTIONS.find(t => t.value === config.time_frame)?.label}</span>
            </div>
            <button onClick={() => navigate('/settings/search')} className="ml-auto text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              Edit <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </Card>
      )}

      {configMissing && (
        <EmptyState
          icon={<Search className="w-7 h-7" />}
          title="Configure your search first"
          description="Set up your roles, locations and preferences before running a search."
          action={<Button onClick={() => navigate('/settings/search')}>Configure Search</Button>}
        />
      )}

      {running && (
        <Card className="mb-6 border-violet-500/30 bg-violet-500/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">
                {stage === 'connecting' && 'Connecting to Apify...'}
                {stage === 'connected' && 'Connected!'}
                {stage === 'waiting' && 'Getting search results...'}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                Scraping {config?.platform === 'all' ? 'LinkedIn & Naukri' : config?.platform} · Running for {formatElapsed(elapsed)}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {[0, 300, 600].map(delay => (
                <div key={delay} className="w-2 h-2 rounded-full bg-violet-400 animate-ping" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2 text-xs">
            {(['connecting', 'connected', 'waiting'] as const).map((s, i) => {
              const order = ['connecting', 'connected', 'waiting']
              const isDone = order.indexOf(stage) > i
              const isActive = stage === s
              const label = s === 'connecting' ? 'Connecting to Apify' : s === 'connected' ? 'Connected' : 'Getting results'
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                    isDone ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                    : isActive ? 'border-violet-500/40 text-violet-300 bg-violet-500/10'
                    : 'border-slate-700 text-slate-600'
                  }`}>
                    {isDone ? '✓' : isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : '•'} {label}
                  </span>
                  {i < 2 && <ChevronRight className="w-3 h-3 text-slate-700" />}
                </div>
              )
            })}
          </div>

          {(currentRun?.apify_run_id || currentRun?.apify_run_id_2) && (
            <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500 space-y-1">
              <p>Verify directly in your Apify Console → Actors → Runs tab, searching by Run ID:</p>
              {currentRun?.apify_run_id && <p className="font-mono text-slate-400">LinkedIn: {currentRun.apify_run_id}</p>}
              {currentRun?.apify_run_id_2 && <p className="font-mono text-slate-400">Naukri: {currentRun.apify_run_id_2}</p>}
            </div>
          )}
        </Card>
      )}

      {jobs.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">{jobs.length} jobs found</span>
              {currentRun?.completed_at && (
                <Badge label={`Last run ${formatDate(currentRun.completed_at)}`} variant="gray" />
              )}
            </div>
            {config?.platform === 'all' && (
              <div className="flex gap-2">
                {['all', 'linkedin', 'naukri'].map(p => (
                  <button key={p} onClick={() => setPlatformFilter(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      platformFilter === p ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    {p === 'all' ? 'All' : p === 'linkedin' ? 'LinkedIn' : 'Naukri'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {filteredJobs.map(job => (
              <JobCard key={job.id} job={job}
                matchCost={getFeatureCost('match')} customizeCost={getFeatureCost('customize')}
                onApply={() => handleApply(job)} onMatch={() => handleMatch(job)}
                onCustomize={() => navigate(`/customize/${job.id}`)}
                matchingId={matchingId} credits={profile?.wallet_credits ?? 0} hasGroq={!!profile?.groq_key_encrypted}
              />
            ))}
          </div>
        </>
      )}

      {!running && currentRun?.status === 'completed' && jobs.length === 0 && (
        <EmptyState
          icon={<Search className="w-7 h-7" />}
          title="No jobs found"
          description="Try different roles, locations, or a wider time frame."
          action={<Button variant="secondary" onClick={runSearch}>Search Again</Button>}
        />
      )}
    </div>
  )
}

function JobCard({ job, matchCost, customizeCost, onApply, onMatch, onCustomize, matchingId, credits, hasGroq }: {
  job: JobWithMatch; matchCost: number; customizeCost: number
  onApply: () => void; onMatch: () => void; onCustomize: () => void
  matchingId: string | null; credits: number; hasGroq: boolean
}) {
  const isMatching = matchingId === job.id
  const hasMatch = !!job.matchResult
  const canMatch = credits >= matchCost && hasGroq
  const platform = (job as any).platform

  return (
    <div className={`glass-card p-5 card-hover ${job.is_applied ? 'border-emerald-500/20' : ''}`}>
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center flex-shrink-0 text-lg font-bold text-slate-400">
          {job.company?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-100 text-sm">{job.title}</h3>
                {job.is_applied && <Badge label="Applied" variant="green" />}
                {platform === 'linkedin'
                  ? <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-0.5"><Globe2 className="w-3 h-3" /> LinkedIn</span>
                  : <span className="text-[10px] text-orange-400 font-semibold flex items-center gap-0.5"><Building2 className="w-3 h-3" /> Naukri</span>
                }
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>
                {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                {job.posted_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(job.posted_at)}</span>}
              </div>
            </div>
            {hasMatch && <MatchScoreRing score={job.matchResult!.match_score} />}
          </div>

          {hasMatch && job.matchResult?.match_summary && (
            <div className="mt-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <p className="text-xs text-slate-400 leading-relaxed">{job.matchResult.match_summary}</p>
              <div className="flex gap-1 flex-wrap mt-2">
                {(job.matchResult.matched_skills ?? []).slice(0, 4).map(s => (
                  <span key={s} className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[10px]">✓ {s}</span>
                ))}
                {(job.matchResult.missing_skills ?? []).slice(0, 2).map(s => (
                  <span key={s} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[10px]">✗ {s}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button variant="primary" size="sm" onClick={onApply}>
              {job.is_applied ? <><ExternalLink className="w-3.5 h-3.5" /> View Job</> : <><BookmarkPlus className="w-3.5 h-3.5" /> Apply</>}
            </Button>
            {!hasMatch && (
              <Button variant="secondary" size="sm" onClick={onMatch} loading={isMatching}
                disabled={!canMatch || isMatching}
                title={!hasGroq ? 'Add Groq key in settings' : !canMatch ? `Need ${matchCost} credits` : ''}>
                <Brain className="w-3.5 h-3.5" /> Match Resume
                {matchCost > 0 && <span className="text-[10px] text-slate-500">({matchCost} cr)</span>}
              </Button>
            )}
            {hasMatch && (
              <Button variant="secondary" size="sm" onClick={onCustomize}>
                <Wand2 className="w-3.5 h-3.5" /> Customize
                {customizeCost > 0 && <span className="text-[10px] text-slate-500">({customizeCost} cr)</span>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
