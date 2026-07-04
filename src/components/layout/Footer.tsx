import { Link } from 'react-router-dom'
import { Mail, MapPin } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-800/60 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="text-sm text-slate-500 space-y-1.5">
          <p className="text-slate-400 font-medium">Dinesh Wadhwani</p>
          <p className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-600" />
            <a href="mailto:dinesh.k.wadhwani@gmail.com" className="hover:text-violet-400 transition-colors">
              dinesh.k.wadhwani@gmail.com
            </a>
          </p>
          <p className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-600 mt-0.5 flex-shrink-0" />
            <span>A1002 Sai Ambience, Near Indian Bank, Pimple Saudagar, Pune 411027</span>
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2 text-sm">
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="text-slate-500 hover:text-violet-400 transition-colors">Privacy Policy</Link>
            <span className="text-slate-700">·</span>
            <Link to="/terms-of-service" className="text-slate-500 hover:text-violet-400 transition-colors">Terms of Service</Link>
          </div>
          <p className="text-xs text-slate-600">© {year} SearchMyJob AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
