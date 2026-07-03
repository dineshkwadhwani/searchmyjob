import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Wand2, Download, ArrowLeft, Sparkles, FileText, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, PageHeader, Badge, PageLoading } from '../../components/ui'
import type { JobResult, CustomizedResume, FeatureConfig } from '../../types'

export default function CustomizePage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const printRef = useRef<HTMLDivElement>(null)

  const [job, setJob] = useState<JobResult | null>(null)
  const [existing, setExisting] = useState<CustomizedResume | null>(null)
  const [features, setFeatures] = useState<FeatureConfig[]>([])
  const [customizing, setCustomizing] = useState(false)
  const [loading, setLoading] = useState(true)

  const customizeCost = features.find(f => f.feature === 'customize')?.credit_cost ?? 10

  useEffect(() => { init() }, [jobId, profile])

  async function init() {
    if (!jobId || !profile) return
    const [{ data: j }, { data: c }, { data: f }] = await Promise.all([
      supabase.from('job_results').select('*').eq('id', jobId).single(),
      supabase.from('customized_resumes').select('*').eq('job_result_id', jobId).eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('feature_config').select('*'),
    ])
    setJob(j as JobResult | null)
    setExisting(c as CustomizedResume | null)
    setFeatures((f ?? []) as FeatureConfig[])
    setLoading(false)
  }

  async function handleCustomize() {
    if (!profile || !job) return
    if (!profile.groq_key_encrypted) { toast.error('Please add your Groq API key in settings first.'); return }
    if (profile.wallet_credits < customizeCost) {
      toast.error(`Need ${customizeCost} credits. Current balance: ${profile.wallet_credits}`); return
    }
    setCustomizing(true)
    const { data, error: fnErr } = await supabase.functions.invoke('customize-resume', { body: { job_result_id: job.id } })
    setCustomizing(false)
    if (fnErr || data?.error) { toast.error(data?.error ?? 'Customization failed. Please try again.'); return }
    await refreshProfile()
    setExisting(data.customized as CustomizedResume)
  }

  function handleDownloadPDF() {
    if (!printRef.current) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Customized Resume</title>
          <style>
            body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #111; padding: 40px; max-width: 750px; margin: 0 auto; }
            h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 6px; }
            h2 { font-size: 13pt; border-bottom: 1px solid #aaa; padding-bottom: 3px; margin-top: 20px; }
            h3 { font-size: 11pt; font-weight: bold; margin: 10px 0 2px; }
            ul { margin: 4px 0; padding-left: 18px; }
            li { margin: 2px 0; }
            .section { margin-bottom: 16px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
  }

  if (loading) return <PageLoading />
  if (!job) return <div className="text-slate-500 p-8">Job not found.</div>

  const daysLeft = existing ? Math.max(0, Math.ceil((new Date(existing.expires_at).getTime() - Date.now()) / 86400000)) : 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <PageHeader
        title="Customize Resume"
        description={`Tailored for: ${job.title} at ${job.company}`}
        badge="Premium"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Job info + action */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Job Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-slate-600 w-20">Role</span>
                <span className="text-slate-200 font-medium">{job.title}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-slate-600 w-20">Company</span>
                <span className="text-slate-200">{job.company}</span>
              </div>
              {job.location && (
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-slate-600 w-20">Location</span>
                  <span className="text-slate-200">{job.location}</span>
                </div>
              )}
              {job.link && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 text-sm w-20">Link</span>
                  <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-xs truncate">
                    View original posting →
                  </a>
                </div>
              )}
            </div>
          </Card>

          {!existing ? (
            <Card className="border-violet-500/20 bg-violet-500/5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Wand2 className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200 text-sm">AI Resume Customization</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Groq's Llama 3.3 70B will rewrite your resume to highlight skills and experiences most relevant to this specific job, boosting your match score.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Costs</span>
                  <Badge label={`${customizeCost} credits`} variant="premium" />
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-slate-600">Balance: {profile?.wallet_credits ?? 0}</span>
                </div>
              </div>
              <Button onClick={handleCustomize} loading={customizing} className="w-full mt-4" size="lg">
                {customizing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Customizing with AI...</>
                  : <><Sparkles className="w-4 h-4" /> Customize My Resume</>
                }
              </Button>
            </Card>
          ) : (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <p className="font-semibold text-emerald-300 text-sm">Resume customized!</p>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Badge label={`Expires in ${daysLeft} days`} variant={daysLeft < 7 ? 'yellow' : 'gray'} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDownloadPDF} className="flex-1">
                  <Download className="w-4 h-4" /> Download PDF
                </Button>
                <Button variant="secondary" onClick={handleCustomize} loading={customizing}>
                  <Wand2 className="w-4 h-4" /> Redo
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Right: Customized content preview */}
        {existing && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" /> Customized Resume Preview
              </p>
              <Button variant="ghost" size="sm" onClick={handleDownloadPDF}>
                <Download className="w-3.5 h-3.5" /> Save as PDF
              </Button>
            </div>
            <div className="glass-card p-6 max-h-[600px] overflow-y-auto">
              <div
                ref={printRef}
                className="prose prose-sm prose-invert max-w-none text-slate-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: existing.customized_content }}
              />
            </div>
          </div>
        )}

        {customizing && (
          <div className="glass-card p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-200 mb-1">AI is working...</p>
              <p className="text-sm text-slate-500">Analyzing job description and tailoring your resume</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
