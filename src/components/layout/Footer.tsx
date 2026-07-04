import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-800/60 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <p>© {year} SearchMyJob AI. All rights reserved.</p>
        <div className="flex items-center gap-3">
          <Link to="/privacy-policy" className="text-slate-500 hover:text-violet-400 transition-colors">Privacy Policy</Link>
          <span className="text-slate-700">·</span>
          <Link to="/terms-of-service" className="text-slate-500 hover:text-violet-400 transition-colors">Terms of Service</Link>
        </div>
      </div>
    </footer>
  )
}
