import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, Badge } from '../ui'
import type { Resume } from '../../types'
import { MAX_RESUME_SIZE_BYTES, formatDate } from '../../lib/constants'

export default function ResumeUploadCard({ onResumeChange, showTips = true }: {
  onResumeChange?: (resume: Resume | null) => void
  showTips?: boolean
}) {
  const { profile } = useAuth()
  const [resume, setResume] = useState<Resume | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadResume() }, [profile])

  async function loadResume() {
    if (!profile) return
    const { data } = await supabase.from('resumes').select('*').eq('user_id', profile.id).eq('is_active', true).single()
    setResume(data as Resume | null)
    onResumeChange?.(data as Resume | null)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are allowed'); return }
    if (file.size > MAX_RESUME_SIZE_BYTES) { toast.error('File must be under 1MB'); return }
    setUploading(true)
    try {
      await supabase.from('resumes').update({ is_active: false }).eq('user_id', profile.id)
      const path = `${profile.id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('resumes').upload(path, file)
      if (upErr) throw upErr
      await supabase.from('resumes').insert({
        user_id: profile.id, file_path: path, file_name: file.name,
        file_size_bytes: file.size, is_active: true
      })
      toast.success('Resume uploaded successfully!')
      await loadResume()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!resume) return
    setDeleting(true)
    await supabase.storage.from('resumes').remove([resume.file_path])
    await supabase.from('resumes').delete().eq('id', resume.id)
    setResume(null); setDeleting(false)
    onResumeChange?.(null)
  }

  const sizeKB = resume?.file_size_bytes ? Math.round(resume.file_size_bytes / 1024) : 0

  return (
    <div className="space-y-4">
      {resume ? (
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-7 h-7 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-200 truncate">{resume.file_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge label={`${sizeKB} KB`} variant="gray" />
                <Badge label={`Uploaded ${formatDate(resume.uploaded_at)}`} variant="purple" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>Replace</Button>
              <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        </Card>
      ) : (
        <div onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-violet-500/50 rounded-2xl p-12 text-center cursor-pointer transition-all group">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 group-hover:bg-violet-500/10 border border-slate-700 group-hover:border-violet-500/30 flex items-center justify-center mx-auto mb-4 transition-all">
            <Upload className="w-7 h-7 text-slate-600 group-hover:text-violet-400 transition-colors" />
          </div>
          <p className="text-slate-300 font-semibold mb-1">Upload your resume</p>
          <p className="text-sm text-slate-600">PDF only · Max 1MB · Click to browse</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
      {showTips && (
        <Card className="bg-violet-500/5 border-violet-500/20">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-300 mb-1">Tips for best AI results</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Use a text-based PDF (not a scanned image)</li>
                <li>• Include skills, experience, and education clearly</li>
                <li>• Keep it 1–2 pages for best matching results</li>
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
