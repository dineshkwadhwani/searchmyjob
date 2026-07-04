import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ArrowLeft } from 'lucide-react'
import Footer from '../../components/layout/Footer'

export default function LegalPageLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="border-b border-slate-800/60">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-100">SearchMyJob AI</span>
          </Link>
          <Link to="/login" className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to app
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: {updated}</p>
        <div className="prose prose-invert prose-slate max-w-none
          prose-headings:text-slate-100 prose-headings:font-semibold
          prose-p:text-slate-400 prose-p:leading-relaxed
          prose-li:text-slate-400 prose-strong:text-slate-300
          prose-a:text-violet-400 hover:prose-a:text-violet-300">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  )
}
