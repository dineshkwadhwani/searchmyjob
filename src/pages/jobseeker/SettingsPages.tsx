import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, Trash2, ExternalLink, Eye, EyeOff, Save, AlertCircle, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, PageHeader, Input, Select, TagInput, Badge } from '../../components/ui'
import type { Resume, SearchConfig, AffiliateKey, FeatureConfig } from '../../types'
import { TIME_FRAME_OPTIONS, PLATFORM_OPTIONS, MAX_RESUME_SIZE_BYTES, formatDate } from '../../lib/constants'

// ─────────────────────────────────────────
// RESUME SETTINGS
// ─────────────────────────────────────────
export function ResumeSettings() {
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
  }

  const sizeKB = resume?.file_size_bytes ? Math.round(resume.file_size_bytes / 1024) : 0

  return (
    <div>
      <PageHeader title="Resume" description="Upload your resume for AI matching and customization" />
      <div className="max-w-xl space-y-6">
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
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// SEARCH SETTINGS
// ─────────────────────────────────────────
export function SearchSettings() {
  const { profile } = useAuth()
  const [config, setConfig] = useState<Partial<SearchConfig>>({
    job_titles: [], locations: [], skills: [], time_frame: 'r86400', platform: 'linkedin'
  })
  const [features, setFeatures] = useState<FeatureConfig[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadConfig(); loadFeatures() }, [profile])

  async function loadConfig() {
    if (!profile) return
    const { data } = await supabase.from('search_config').select('*').eq('user_id', profile.id).single()
    if (data) setConfig({ ...data, skills: Array.isArray(data.skills) ? data.skills : [] })
  }

  async function loadFeatures() {
    const { data } = await supabase.from('feature_config').select('*')
    if (data) setFeatures(data as FeatureConfig[])
  }

  function getFeatureCost(name: string) {
    return features.find(f => f.feature === name)?.credit_cost ?? 0
  }

  async function handleSave() {
    if (!profile) return
    if ((config.job_titles?.length ?? 0) === 0) { toast.error('Add at least one job role'); return }
    if ((config.locations?.length ?? 0) === 0) { toast.error('Add at least one location'); return }
    setSaving(true)
    const payload = {
      user_id: profile.id,
      job_titles: config.job_titles ?? [],
      locations: config.locations ?? [],
      skills: config.skills ?? [],
      time_frame: config.time_frame ?? 'r86400',
      platform: config.platform ?? 'linkedin',
    }
    const { error: err } = await supabase.from('search_config').upsert(payload, { onConflict: 'user_id' })
    setSaving(false)
    if (err) { toast.error(err.message); return }
    toast.success('Search config saved!')
  }

  return (
    <div>
      <PageHeader title="Search Settings" description="Configure your job search preferences" />
      <div className="max-w-2xl space-y-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Target Roles</h3>
          <TagInput label="Job Titles" tags={config.job_titles ?? []} max={3}
            onChange={v => setConfig(c => ({ ...c, job_titles: v }))}
            placeholder="e.g. Software Engineer" hint="Press Enter to add · Max 3 roles" />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Locations & Skills</h3>
          <div className="space-y-4">
            <TagInput label="Locations" tags={config.locations ?? []} max={3}
              onChange={v => setConfig(c => ({ ...c, locations: v }))}
              placeholder="e.g. Bangalore, Remote" hint="Press Enter to add · Max 3" />
            <TagInput label="Skills" tags={config.skills ?? []} max={3}
              onChange={v => setConfig(c => ({ ...c, skills: v }))}
              placeholder="e.g. React, Python" hint="Optional · Max 3 skills" />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Search Preferences</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Posted Within" value={config.time_frame ?? 'r86400'}
              onChange={e => setConfig(c => ({ ...c, time_frame: e.target.value as any }))}
              options={TIME_FRAME_OPTIONS} />
            <div className="space-y-1.5">
              <label className="label">Platform</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORM_OPTIONS.map(p => (
                  <button key={p.value} type="button"
                    onClick={() => setConfig(c => ({ ...c, platform: p.value as any }))}
                    className={`relative px-3 py-3 rounded-xl border text-sm font-medium transition-all text-center ${
                      config.platform === p.value
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                        : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-600'
                    }`}>
                    {p.value === 'all' && <span className="text-lg leading-none block mb-1">⚡</span>}
                    {p.value !== 'all' && <Building2 className="w-4 h-4 mx-auto mb-1" />}
                    <span className="block text-xs">{p.label}</span>
                    {p.isPremium && (
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] px-1 py-0.5 bg-amber-500 text-black rounded font-bold">PRO</span>
                    )}
                  </button>
                ))}
              </div>
              {config.platform === 'all' && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                  ⚡ Costs {getFeatureCost('all_platforms')} extra credits per search
                </p>
              )}
            </div>
          </div>
        </Card>

        <Button onClick={handleSave} loading={saving} size="lg">
          <Save className="w-4 h-4" /> Save Search Config
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// APIFY SETTINGS
// ─────────────────────────────────────────
export function ApifySettings() {
  const { profile, refreshProfile } = useAuth()
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [affiliate, setAffiliate] = useState<AffiliateKey | null>(null)
  const hasKey = !!profile?.apify_key_encrypted

  useEffect(() => { loadAffiliate() }, [])

  async function loadAffiliate() {
    const { data } = await supabase.from('affiliate_keys').select('*').eq('platform', 'apify').single()
    if (data) setAffiliate(data as AffiliateKey)
  }

  async function handleSave() {
    if (!key.trim()) { toast.error('Please enter your Apify API key'); return }
    setSaving(true)
    const { data: valData, error: valErr } = await supabase.functions.invoke('validate-apify-key', { body: { key: key.trim() } })
    if (valErr || !valData?.valid) {
      toast.error(valData?.error ?? valErr?.message ?? 'Invalid API key — please check and try again')
      setSaving(false); return
    }
    const { error: saveErr } = await supabase.from('profiles').update({ apify_key_encrypted: key.trim() }).eq('id', profile!.id)
    setSaving(false)
    if (saveErr) { toast.error(saveErr.message); return }
    await refreshProfile()
    setKey(''); toast.success('Apify key saved!')
  }

  return (
    <div>
      <PageHeader title="Apify Settings" description="Connect your Apify account to enable job scraping" />
      <div className="max-w-xl space-y-6">
        {affiliate?.referral_url && (
          <Card className="bg-violet-500/5 border-violet-500/20">
            <p className="text-sm font-semibold text-violet-300 mb-2">Don't have an Apify account?</p>
            <p className="text-xs text-slate-500 mb-3">{affiliate.instructions}</p>
            <a href={affiliate.referral_url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm"><ExternalLink className="w-3.5 h-3.5" /> Sign up on Apify</Button>
            </a>
          </Card>
        )}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">API Key</h3>
            {hasKey && <Badge label="Key saved" variant="green" />}
          </div>
          <div className="space-y-3">
            <div className="relative">
              <Input type={show ? 'text' : 'password'}
                placeholder={hasKey ? 'Enter new key to replace' : 'apify_api_xxxxxxxxxxxxxxxx'}
                value={key} onChange={e => setKey(e.target.value)} />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button onClick={handleSave} loading={saving} className="w-full">
              <Save className="w-4 h-4" /> {hasKey ? 'Update Key' : 'Save Key'}
            </Button>
          </div>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">
            Get your key from{' '}
            <a href="https://apify.com/account/integrations" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
              Apify → Account → Integrations <ExternalLink className="inline w-3 h-3" />
            </a>
          </p>
        </Card>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// GROQ SETTINGS
// ─────────────────────────────────────────
export function GroqSettings() {
  const { profile, refreshProfile } = useAuth()
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [affiliate, setAffiliate] = useState<AffiliateKey | null>(null)
  const hasKey = !!profile?.groq_key_encrypted

  useEffect(() => { loadAffiliate() }, [])

  async function loadAffiliate() {
    const { data } = await supabase.from('affiliate_keys').select('*').eq('platform', 'groq').single()
    if (data) setAffiliate(data as AffiliateKey)
  }

  async function handleSave() {
    if (!key.trim()) { toast.error('Please enter your Groq API key'); return }
    setSaving(true)
    const { error: saveErr } = await supabase.from('profiles').update({ groq_key_encrypted: key.trim() }).eq('id', profile!.id)
    setSaving(false)
    if (saveErr) { toast.error(saveErr.message); return }
    await refreshProfile()
    setKey(''); toast.success('Groq key saved!')
  }

  return (
    <div>
      <PageHeader title="Groq Settings" description="Connect Groq AI for resume matching and customization" />
      <div className="max-w-xl space-y-6">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <div className="flex gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="text-sm font-semibold text-amber-300 mb-1">Why Groq?</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Groq runs Llama 3.3 70B at blazing speed — your resume gets matched and customized in seconds.
                Your key is stored securely and only used for your requests.
              </p>
            </div>
          </div>
        </Card>
        {affiliate?.referral_url && (
          <Card className="bg-violet-500/5 border-violet-500/20">
            <p className="text-sm font-semibold text-violet-300 mb-2">Get a free Groq API key</p>
            <p className="text-xs text-slate-500 mb-3">{affiliate.instructions}</p>
            <a href={affiliate.referral_url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm"><ExternalLink className="w-3.5 h-3.5" /> Sign up on Groq</Button>
            </a>
          </Card>
        )}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">API Key</h3>
            {hasKey && <Badge label="Key saved" variant="green" />}
          </div>
          <div className="space-y-3">
            <div className="relative">
              <Input type={show ? 'text' : 'password'}
                placeholder={hasKey ? 'Enter new key to replace' : 'gsk_xxxxxxxxxxxxxxxx'}
                value={key} onChange={e => setKey(e.target.value)} />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button onClick={handleSave} loading={saving} className="w-full">
              <Save className="w-4 h-4" /> {hasKey ? 'Update Key' : 'Save Key'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
