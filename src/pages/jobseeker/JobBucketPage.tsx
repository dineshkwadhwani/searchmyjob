import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, ExternalLink, MapPin, Building2, Clock, Globe2, Wand2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageHeader, EmptyState, Badge, Button, MatchScoreRing, PageLoading } from '../../components/ui'
import type { JobResult, MatchResult } from '../../types'
import { formatDateTime } from '../../lib/constants'

type JobWithMatch = JobResult & { matchResult?: MatchResult }

export default function JobBucketPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<JobWithMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadApplied() }, [profile])

  async function loadApplied() {
    if (!profile) return
    const { data } = await supabase.from('job_results').select('*')
      .eq('user_id', profile.id).eq('is_applied', true).order('applied_at', { ascending: false })
    if (data) {
      const ids = data.map((j: any) => j.id)
      const { data: matches } = await supabase.from('match_results').select('*').in('job_result_id', ids)
      const map = new Map((matches ?? []).map((m: any) => [m.job_result_id, m]))
      setJobs(data.map((j: any) => ({ ...j, matchResult: map.get(j.id) })))
    }
    setLoading(false)
  }

  if (loading) return <PageLoading />

  return (
    <div>
      <PageHeader
        title="Job Bucket"
        description="All jobs you've applied to"
        badge={jobs.length > 0 ? `${jobs.length} jobs` : undefined}
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="w-7 h-7" />}
          title="Your job bucket is empty"
          description="Jobs you apply to from the Search page will appear here for tracking."
          action={<Button onClick={() => navigate('/search')}><Search className="w-4 h-4" /> Search Jobs</Button>}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="glass-card p-5 card-hover">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center flex-shrink-0 text-lg font-bold text-slate-400">
                  {job.company?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-100 text-sm">{job.title}</h3>
                        <Badge label="Applied" variant="green" />
                        {job.platform === 'linkedin'
                          ? <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-0.5"><Globe2 className="w-3 h-3" /> LinkedIn</span>
                          : <span className="text-[10px] text-orange-400 font-semibold flex items-center gap-0.5"><Building2 className="w-3 h-3" /> Naukri</span>
                        }
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>
                        {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Applied {formatDateTime(job.applied_at)}</span>
                      </div>
                    </div>
                    {job.matchResult && <MatchScoreRing score={job.matchResult.match_score} />}
                  </div>
                  <div className="flex gap-2 mt-3">
                    {job.link && (
                      <Button variant="secondary" size="sm" onClick={() => window.open(job.link, '_blank')}>
                        <ExternalLink className="w-3.5 h-3.5" /> View Job
                      </Button>
                    )}
                    {job.matchResult && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/customize/${job.id}`)}>
                        <Wand2 className="w-3.5 h-3.5" /> Customize Resume
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
