import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Upload, FileText, Sparkles, Loader2, X, Wand2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageHeader, Card, Button, PageLoading } from '../../components/ui'
import ScoreResults from '../../components/ats/ScoreResults'
import RewriteModal from '../../components/ats/RewriteModal'
import { parseResumeFile } from '../../lib/resumeParsing'
import type { ParsedResumeFile } from '../../lib/resumeParsing'
import { analyzeResume, htmlToPlainText } from '../../lib/atsScoring'
import type { AtsAnalysis } from '../../lib/atsScoring'

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024 // 4MB — generous for a resume, keeps parsing snappy

export default function AtsEvaluatorPage() {
  const { profile, refreshProfile, isFeatureEnabled } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsed, setParsed] = useState<ParsedResumeFile | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AtsAnalysis | null>(null)

  const [showRewrite, setShowRewrite] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [rewrittenHtml, setRewrittenHtml] = useState<string | null>(null)
  const [rewrittenAnalysis, setRewrittenAnalysis] = useState<AtsAnalysis | null>(null)

  const cost = 5 // display fallback; actual cost enforced server-side from feature_config

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('File is too large. Please upload a resume under 4MB.')
      return
    }
    setParsing(true)
    setAnalysis(null)
    setRewrittenHtml(null)
    setRewrittenAnalysis(null)
    try {
      const result = await parseResumeFile(file)
      if (!result.text.trim()) {
        toast.error('Could not extract any text from this file. It may be a scanned image — try a text-based PDF or DOCX instead.')
        return
      }
      setParsed(result)
      toast.success(`${file.name} loaded`)
    } catch (err: any) {
      toast.error(err.message ?? 'Could not read this file. Please try a different PDF, DOCX, or TXT file.')
    } finally {
      setParsing(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [])

  function handleAnalyze() {
    if (!parsed) return
    setAnalyzing(true)
    // Small deliberate delay so the loading state is perceptible — the
    // actual analysis below is pure local computation and runs in milliseconds.
    setTimeout(() => {
      const result = analyzeResume({
        text: parsed.text,
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        pageCount: parsed.pageCount,
        visualInfo: parsed.visualInfo,
      })
      setAnalysis(result)
      setAnalyzing(false)
    }, 400)
  }

  async function handleRewrite() {
    if (!profile || !parsed || !analysis) return
    if (!isFeatureEnabled('ats_rewrite')) { toast.error('Resume rewrite is currently disabled'); return }
    if (!profile.groq_key_encrypted) { navigate('/settings/groq'); return }
    if (profile.wallet_credits < cost) { toast.error(`Need at least ${cost} credits to rewrite your resume.`); return }

    setShowRewrite(true)
    setRewriting(true)
    setRewrittenHtml(null)
    setRewrittenAnalysis(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ats-rewrite-resume', {
        body: { resume_text: parsed.text }
      })
      if (fnErr || data?.error) {
        toast.error(data?.error ?? fnErr?.message ?? 'Resume rewrite failed')
        setShowRewrite(false)
        return
      }
      setRewrittenHtml(data.rewritten_html)
      await refreshProfile()

      const plainText = htmlToPlainText(data.rewritten_html)
      setRewrittenAnalysis(analyzeResume({
        text: plainText,
        fileName: parsed.fileName,
        fileType: 'txt',
        pageCount: Math.max(1, Math.round(plainText.split(/\s+/).length / 550)),
      }))
    } catch (err: any) {
      toast.error(err.message ?? 'Resume rewrite failed')
      setShowRewrite(false)
    } finally {
      setRewriting(false)
    }
  }

  function reset() {
    setParsed(null)
    setAnalysis(null)
    setRewrittenHtml(null)
    setRewrittenAnalysis(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <PageHeader
        title="ATS Resume Evaluator"
        description="Check how well your resume performs against Applicant Tracking Systems"
      />

      {!analysis && (
        <div className="max-w-2xl space-y-6">
          <Card
            className={`border-2 border-dashed transition-all ${dragActive ? 'border-violet-500/60 bg-violet-500/5' : 'border-slate-700'}`}
          >
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="text-center py-10 cursor-pointer"
            >
              {parsing ? (
                <>
                  <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Reading your resume...</p>
                </>
              ) : parsed ? (
                <>
                  <FileText className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                  <p className="text-slate-200 font-semibold">{parsed.fileName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {parsed.pageCount} page{parsed.pageCount === 1 ? '' : 's'}{parsed.pageCountIsEstimate ? ' (estimated)' : ''} · Click or drop to replace
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-300 font-semibold mb-1">Drag & drop your resume here</p>
                  <p className="text-xs text-slate-600">PDF, DOCX, or TXT · Max 4MB · or click to browse</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </Card>

          <Button size="lg" className="w-full" onClick={handleAnalyze} loading={analyzing} disabled={!parsed || analyzing}>
            {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Sparkles className="w-4 h-4" /> Analyze Resume</>}
          </Button>
        </div>
      )}

      {analyzing && !analysis && (
        <div className="max-w-2xl mt-6">
          <PageLoading />
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="w-3.5 h-3.5" /> Analyze a Different Resume
            </Button>
            {isFeatureEnabled('ats_rewrite') && (
              <Button onClick={handleRewrite} loading={rewriting && showRewrite}>
                <Wand2 className="w-4 h-4" /> Rewrite My Resume
                <span className="text-[10px] text-slate-300/80">({cost} cr)</span>
              </Button>
            )}
          </div>

          <ScoreResults analysis={analysis} />
        </div>
      )}

      {showRewrite && (
        <RewriteModal
          rewriting={rewriting}
          rewrittenHtml={rewrittenHtml}
          originalScore={analysis?.overallScore ?? 0}
          rewrittenAnalysis={rewrittenAnalysis}
          onClose={() => setShowRewrite(false)}
        />
      )}
    </div>
  )
}
