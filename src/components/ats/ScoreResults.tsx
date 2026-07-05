import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, AlertOctagon, Info } from 'lucide-react'
import { Card } from '../ui'
import type { AtsAnalysis, Severity } from '../../lib/atsScoring'

function scoreVariant(score: number): { text: string; bg: string; border: string; ring: string } {
  if (score >= 85) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', ring: '#10b981' }
  if (score >= 70) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', ring: '#f59e0b' }
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', ring: '#ef4444' }
}

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs)
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

const SEVERITY_META: Record<Severity, { icon: typeof AlertOctagon; label: string; color: string }> = {
  critical: { icon: AlertOctagon, label: 'CRITICAL', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  important: { icon: AlertTriangle, label: 'IMPORTANT', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  recommended: { icon: Info, label: 'RECOMMENDED', color: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30' },
}

export default function ScoreResults({ analysis }: { analysis: AtsAnalysis }) {
  const animatedScore = useCountUp(analysis.overallScore)
  const variant = scoreVariant(analysis.overallScore)
  const r = 54, c = 2 * Math.PI * r
  const pct = animatedScore / 100

  return (
    <div className="space-y-6">
      {/* Overall score */}
      <Card className={`${variant.bg} ${variant.border} flex flex-col sm:flex-row items-center gap-6`}>
        <div className="relative inline-flex items-center justify-center w-32 h-32 flex-shrink-0">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            <circle cx="64" cy="64" r={r} fill="none" stroke={variant.ring} strokeWidth="10"
              strokeDasharray={c} strokeDashoffset={c - pct * c} strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.2s linear' }} />
          </svg>
          <div className="absolute text-center">
            <span className={`text-4xl font-bold ${variant.text}`}>{animatedScore}</span>
            <span className="block text-[10px] text-slate-500 -mt-1">/ 100</span>
          </div>
        </div>
        <div>
          <p className={`text-lg font-bold ${variant.text}`}>
            {analysis.overallScore >= 85 ? 'Excellent ATS Compatibility' : analysis.overallScore >= 70 ? 'Good, with room to improve' : 'Needs Improvement'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            This score reflects how well your resume is likely to pass through Applicant Tracking Systems, weighted across 6 categories.
          </p>
        </div>
      </Card>

      {/* Category breakdown */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Category Breakdown</h3>
        <div className="space-y-4">
          {analysis.categories.map(cat => {
            const v = scoreVariant(cat.score)
            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400">{cat.label} <span className="text-slate-600">({cat.weight}%)</span></span>
                  <span className={`font-semibold ${v.text}`}>{cat.score}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cat.score}%`, backgroundColor: v.ring }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Top Strengths
          </h3>
          {analysis.strengths.length === 0 ? (
            <p className="text-xs text-slate-600">No standout strengths detected yet — check the recommendations for quick wins.</p>
          ) : (
            <ul className="space-y-2.5">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recommendations */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Top Recommendations
          </h3>
          {analysis.recommendations.length === 0 ? (
            <p className="text-xs text-slate-600">No major issues found — great work!</p>
          ) : (
            <ul className="space-y-3">
              {analysis.recommendations.map((rec, i) => {
                const meta = SEVERITY_META[rec.severity]
                const Icon = meta.icon
                return (
                  <li key={i} className={`p-3 rounded-xl border ${meta.color}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold tracking-wide">{meta.label}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">{rec.issue}</p>
                    <p className="text-xs text-slate-500 mt-1">{rec.fix}</p>
                    {rec.details && rec.details.length > 0 && (
                      <ul className="mt-2 pt-2 border-t border-white/5 space-y-1">
                        {rec.details.map((d, di) => (
                          <li key={di} className="text-[11px] text-slate-500 flex gap-1.5">
                            <span className="text-slate-600">·</span>
                            <span className="italic">{d}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
