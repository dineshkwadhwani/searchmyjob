import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Download, Wand2, Search, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageHeader, EmptyState, Badge, Button, PageLoading } from '../../components/ui'
import type { CustomizedResume, JobResult } from '../../types'
import { formatDate } from '../../lib/constants'

type ResumeWithJob = CustomizedResume & { job?: JobResult }

export default function CustomizedResumesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [resumes, setResumes] = useState<ResumeWithJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [profile])

  async function load() {
    if (!profile) return
    const { data } = await supabase.from('customized_resumes').select('*')
      .eq('user_id', profile.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (data) {
      const ids = data.map((r: any) => r.job_result_id)
      const { data: jobs } = await supabase.from('job_results').select('*').in('id', ids)
      const jobMap = new Map((jobs ?? []).map((j: any) => [j.id, j]))
      setResumes(data.map((r: any) => ({ ...r, job: jobMap.get(r.job_result_id) })))
    }
    setLoading(false)
  }

  function downloadResume(resume: ResumeWithJob) {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Customized Resume - ${resume.job?.title ?? 'Resume'}</title>
          <style>
            body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #111; padding: 40px; max-width: 750px; margin: 0 auto; }
            h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 6px; }
            h2 { font-size: 13pt; border-bottom: 1px solid #aaa; padding-bottom: 3px; margin-top: 20px; }
            ul { margin: 4px 0; padding-left: 18px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${resume.customized_content}</body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
  }

  if (loading) return <PageLoading />

  return (
    <div>
      <PageHeader
        title="AI Resumes"
        description="Your AI-customized resumes, archived for 30 days"
        badge="Premium"
      />

      {resumes.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-7 h-7" />}
          title="No customized resumes yet"
          description="Search for jobs, run a match, then customize your resume to perfectly fit each role."
          action={<Button onClick={() => navigate('/search')}><Search className="w-4 h-4" /> Find Jobs to Apply</Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map(resume => {
            const daysLeft = Math.max(0, Math.ceil((new Date(resume.expires_at).getTime() - Date.now()) / 86400000))
            return (
              <div key={resume.id} className="glass-card p-5 card-hover flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-200 text-sm leading-tight truncate">{resume.job?.title ?? 'Unknown Role'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{resume.job?.company}</p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Badge label={`Created ${formatDate(resume.created_at)}`} variant="gray" />
                  <Badge label={`${daysLeft}d left`} variant={daysLeft < 5 ? 'yellow' : 'purple'} />
                </div>

                <div className="mt-auto flex gap-2">
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => downloadResume(resume)}>
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/customize/${resume.job_result_id}`)}>
                    <Wand2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
