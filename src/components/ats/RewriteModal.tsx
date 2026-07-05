import { useState } from 'react'
import { toast } from 'sonner'
import { Download, TrendingUp } from 'lucide-react'
import { Modal, Button, Spinner } from '../ui'
import type { AtsAnalysis } from '../../lib/atsScoring'

export default function RewriteModal({ rewriting, rewrittenHtml, originalScore, rewrittenAnalysis, onClose }: {
  rewriting: boolean
  rewrittenHtml: string | null
  originalScore: number
  rewrittenAnalysis: AtsAnalysis | null
  onClose: () => void
}) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPDF() {
    if (!rewrittenHtml) return
    setDownloading(true)
    try {
      const { downloadResumeAsPdf } = await import('../../lib/resumePdf')
      await downloadResumeAsPdf(rewrittenHtml, 'ATS-Optimized-Resume.pdf')
    } catch {
      toast.error('Could not generate the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal title="ATS-Optimized Resume" onClose={onClose}>
      {rewriting && !rewrittenHtml && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Spinner size="lg" />
          <p className="text-sm text-slate-400">Rewriting your resume with AI...</p>
        </div>
      )}

      {rewrittenHtml && (
        <div className="space-y-4">
          {rewrittenAnalysis && (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="text-slate-500">Estimated new score: </span>
                <span className="font-bold text-slate-300">{originalScore}</span>
                <span className="text-slate-600 mx-1">→</span>
                <span className="font-bold text-emerald-400">{rewrittenAnalysis.overallScore}</span>
                {rewrittenAnalysis.overallScore > originalScore && (
                  <span className="text-emerald-400 ml-1">(+{rewrittenAnalysis.overallScore - originalScore})</span>
                )}
              </div>
            </div>
          )}

          <div className="glass-card p-6 max-h-[400px] overflow-y-auto">
            <div
              className="prose prose-sm prose-invert max-w-none text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: rewrittenHtml }}
            />
          </div>

          <Button onClick={handleDownloadPDF} loading={downloading} disabled={downloading} className="w-full">
            <Download className="w-4 h-4" /> Download as PDF
          </Button>
        </div>
      )}
    </Modal>
  )
}
