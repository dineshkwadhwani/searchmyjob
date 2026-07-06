import { useState, useEffect } from 'react'
import { Trash2, ExternalLink, Eye, EyeOff, Save, Building2, Globe2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, PageHeader, Input, Select, TagInput, Badge, PageLoading } from '../../components/ui'
import ResumeUploadCard from '../../components/profile/ResumeUploadCard'
import type { SearchConfig, AffiliateKey, FeatureConfig } from '../../types'
import { TIME_FRAME_OPTIONS, PLATFORM_OPTIONS, MAX_SEARCH_CONFIGS } from '../../lib/constants'

// ─────────────────────────────────────────
// RESUME SETTINGS
// ─────────────────────────────────────────
export function ResumeSettings() {
  return (
    <div>
      <PageHeader title="Resume" description="Upload your resume for AI matching and customization" />
      <div className="max-w-xl">
        <ResumeUploadCard />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// SEARCH SETTINGS
// ─────────────────────────────────────────
export function SearchSettings() {
  const { profile } = useAuth()
  const [configs, setConfigs] = useState<Partial<SearchConfig>[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [features, setFeatures] = useState<FeatureConfig[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadConfigs(); loadFeatures() }, [profile])

  function blankConfig(): Partial<SearchConfig> {
    return { job_titles: [], locations: [], skills: [], time_frame: 'r86400', platform: 'linkedin', name: '' }
  }

  async function loadConfigs() {
    if (!profile) return
    const { data } = await supabase.from('search_config').select('*').eq('user_id', profile.id).order('created_at')
    const loaded = (data ?? []).map(d => ({ ...d, skills: Array.isArray(d.skills) ? d.skills : [] }))
    setConfigs(loaded.length > 0 ? loaded : [blankConfig()])
    setActiveIndex(0)
    setLoading(false)
  }

  async function loadFeatures() {
    const { data } = await supabase.from('feature_config').select('*')
    if (data) setFeatures(data as FeatureConfig[])
  }

  function getFeatureCost(name: string) {
    return features.find(f => f.feature === name)?.credit_cost ?? 0
  }

  const allPlatformsEnabled = features.find(f => f.feature === 'all_platforms')?.is_enabled !== false
  const indeedEnabled = features.find(f => f.feature === 'indeed')?.is_enabled !== false
  const visiblePlatformOptions = PLATFORM_OPTIONS.filter(p =>
    (p.value !== 'all' || allPlatformsEnabled) && (p.value !== 'indeed' || indeedEnabled)
  )
  const platformGridCols = visiblePlatformOptions.length >= 4 ? 'grid-cols-2 sm:grid-cols-4'
    : visiblePlatformOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'

  function updateActive(patch: Partial<SearchConfig>) {
    setConfigs(prev => prev.map((c, i) => i === activeIndex ? { ...c, ...patch } : c))
  }

  function addConfig() {
    if (configs.length >= MAX_SEARCH_CONFIGS) return
    setConfigs(prev => [...prev, blankConfig()])
    setActiveIndex(configs.length)
  }

  async function handleDelete(index: number) {
    const draft = configs[index]
    if (!window.confirm(`Delete "${draft.name || `Search ${index + 1}`}"? This cannot be undone.`)) return
    if (draft.id) {
      setDeleting(true)
      const { error } = await supabase.from('search_config').delete().eq('id', draft.id)
      setDeleting(false)
      if (error) { toast.error(error.message); return }
    }
    const remaining = configs.filter((_, i) => i !== index)
    setConfigs(remaining.length > 0 ? remaining : [blankConfig()])
    setActiveIndex(prev => Math.max(0, prev >= index ? prev - 1 : prev))
    toast.success('Search config removed')
  }

  async function handleSave() {
    if (!profile) return
    const draft = configs[activeIndex]
    if (!draft) return
    if ((draft.job_titles?.length ?? 0) === 0) { toast.error('Add at least one job role'); return }
    if ((draft.locations?.length ?? 0) === 0) { toast.error('Add at least one location'); return }
    setSaving(true)
    const payload = {
      user_id: profile.id,
      name: draft.name?.trim() || `Search ${activeIndex + 1}`,
      job_titles: draft.job_titles ?? [],
      locations: draft.locations ?? [],
      skills: draft.skills ?? [],
      time_frame: draft.time_frame ?? 'r86400',
      platform: draft.platform ?? 'linkedin',
    }
    if (draft.id) {
      const { error } = await supabase.from('search_config').update(payload).eq('id', draft.id)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      updateActive({ name: payload.name })
      toast.success('Search config saved!')
    } else {
      const { data, error } = await supabase.from('search_config').insert(payload).select().single()
      setSaving(false)
      if (error) { toast.error(error.message); return }
      setConfigs(prev => prev.map((c, i) => i === activeIndex ? (data as SearchConfig) : c))
      toast.success('Search config created!')
    }
  }

  if (loading) return <PageLoading />

  const active = configs[activeIndex] ?? blankConfig()

  return (
    <div>
      <PageHeader title="Search Settings" description="Configure up to 3 saved job searches" />
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          {configs.map((c, i) => (
            <button key={c.id ?? `draft-${i}`} onClick={() => setActiveIndex(i)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                i === activeIndex
                  ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                  : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-600'
              }`}>
              {c.name || `Search ${i + 1}`}{!c.id && <span className="text-slate-600"> (unsaved)</span>}
            </button>
          ))}
          {configs.length < MAX_SEARCH_CONFIGS && (
            <button onClick={addConfig}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-slate-700 text-slate-500 hover:border-violet-500/50 hover:text-violet-400 transition-all">
              + Add Search
            </button>
          )}
        </div>

        <Card>
          <Input label="Search Name" value={active.name ?? ''}
            onChange={e => updateActive({ name: e.target.value })}
            placeholder={`e.g. Remote PM Roles`} hint="Shown as the tile name on the Search Jobs page" />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Target Roles</h3>
          <TagInput label="Job Titles" tags={active.job_titles ?? []} max={3}
            onChange={v => updateActive({ job_titles: v })}
            placeholder="e.g. Software Engineer" hint="Press Enter to add · Max 3 roles" />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Locations & Skills</h3>
          <div className="space-y-4">
            <TagInput label="Locations" tags={active.locations ?? []} max={3}
              onChange={v => updateActive({ locations: v })}
              placeholder="e.g. Bangalore, Remote" hint="Press Enter to add · Max 3" />
            <TagInput label="Skills" tags={active.skills ?? []} max={3}
              onChange={v => updateActive({ skills: v })}
              placeholder="e.g. React, Python" hint="Optional · Max 3 skills" />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Search Preferences</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Posted Within" value={active.time_frame ?? 'r86400'}
              onChange={e => updateActive({ time_frame: e.target.value as any })}
              options={TIME_FRAME_OPTIONS} />
            <div className="space-y-1.5">
              <label className="label">Platform</label>
              <div className={`grid gap-2 ${platformGridCols}`}>
                {visiblePlatformOptions.map(p => (
                  <button key={p.value} type="button"
                    onClick={() => updateActive({ platform: p.value as any })}
                    className={`relative px-3 py-3 rounded-xl border text-sm font-medium transition-all text-center ${
                      active.platform === p.value
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                        : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-600'
                    }`}>
                    {p.value === 'all' && <span className="text-lg leading-none block mb-1">⚡</span>}
                    {p.value === 'indeed' && <Globe2 className="w-4 h-4 mx-auto mb-1" />}
                    {p.value !== 'all' && p.value !== 'indeed' && <Building2 className="w-4 h-4 mx-auto mb-1" />}
                    <span className="block text-xs">{p.label}</span>
                    {p.isPremium && (
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] px-1 py-0.5 bg-amber-500 text-black rounded font-bold">PRO</span>
                    )}
                  </button>
                ))}
              </div>
              {active.platform === 'all' && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                  ⚡ Costs {getFeatureCost('all_platforms')} extra credits per search
                </p>
              )}
              {active.platform === 'indeed' && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                  ⚡ Costs {getFeatureCost('indeed')} extra credits per search
                </p>
              )}
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} loading={saving} size="lg">
            <Save className="w-4 h-4" /> Save Search Config
          </Button>
          {configs.length > 1 && (
            <Button variant="danger" size="lg" onClick={() => handleDelete(activeIndex)} loading={deleting}>
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          )}
        </div>
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
        <Card className="bg-violet-500/5 border-violet-500/20">
          <p className="text-sm font-semibold text-violet-300 mb-2">Why do I need this?</p>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            You'll need to connect an Apify account to fetch jobs matching your search criteria.
            Apify gives you a free $5.00 credit when you sign up, which is good for about 50 searches.
            Follow these steps to activate your connector:
          </p>
          <ol className="text-xs text-slate-400 space-y-2.5 list-decimal list-inside leading-relaxed">
            <li>
              Go to{' '}
              <a href={affiliate?.referral_url || 'https://apify.com'} target="_blank" rel="noopener noreferrer"
                className="text-violet-400 hover:underline">
                apify.com <ExternalLink className="inline w-3 h-3" />
              </a>
            </li>
            <li>Click <strong className="text-slate-300">"Get Started"</strong> in the top right. On mobile, tap the three lines in the top left instead.</li>
            <li>Click <strong className="text-slate-300">"Continue with Google"</strong>, or sign up with your email.</li>
            <li>Once you're in, choose a username of your liking.</li>
            <li>Click <strong className="text-slate-300">"Integrations"</strong> in the left panel, then click the <strong className="text-slate-300">API</strong> button in the top right of the screen.</li>
            <li>Click <strong className="text-slate-300">"Manage Tokens"</strong>, then click <strong className="text-slate-300">"Create a new Token"</strong> and give it a description.</li>
            <li>Copy the newly created token and paste it below.</li>
          </ol>
          {affiliate?.referral_url && (
            <a href={affiliate.referral_url} target="_blank" rel="noopener noreferrer" className="block mt-4">
              <Button variant="secondary" size="sm" className="w-full"><ExternalLink className="w-3.5 h-3.5" /> Sign up on Apify</Button>
            </a>
          )}
        </Card>
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
        <Card className="bg-violet-500/5 border-violet-500/20">
          <p className="text-sm font-semibold text-violet-300 mb-2">Why do I need this?</p>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            You'll need to connect a Groq AI account to match your profile against jobs. Groq is free
            and gives you enough credits to match and score your profile against jobs of your choice.
            Follow these steps to activate your connector:
          </p>
          <ol className="text-xs text-slate-400 space-y-2.5 list-decimal list-inside leading-relaxed">
            <li>
              Go to{' '}
              <a href={affiliate?.referral_url || 'https://groq.com'} target="_blank" rel="noopener noreferrer"
                className="text-violet-400 hover:underline">
                groq.com <ExternalLink className="inline w-3 h-3" />
              </a>
            </li>
            <li>Click <strong className="text-slate-300">"Start Building"</strong> in the top right, or the three lines on mobile.</li>
            <li>Click <strong className="text-slate-300">"Continue with Google"</strong>, or pick an option of your choice to register.</li>
            <li>Once you're logged in, click <strong className="text-slate-300">"API Keys"</strong>.</li>
            <li>Click <strong className="text-slate-300">"Create API Key"</strong>. Give it a name and set it to no expiration.</li>
            <li>Copy the key and paste it below.</li>
          </ol>
          {affiliate?.referral_url && (
            <a href={affiliate.referral_url} target="_blank" rel="noopener noreferrer" className="block mt-4">
              <Button variant="secondary" size="sm" className="w-full"><ExternalLink className="w-3.5 h-3.5" /> Sign up on Groq</Button>
            </a>
          )}
        </Card>
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
