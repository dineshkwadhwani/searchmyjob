import { useState, useEffect } from 'react'
import { Save, Key, ExternalLink, Users, ToggleLeft, ToggleRight, Coins, Shield, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { PageHeader, Card, Button, Input, Badge, StatCard, PageLoading } from '../../components/ui'
import type { FeatureConfig, AffiliateKey, Profile } from '../../types'

// ─────────────────────────────────────────
// FEATURE CONFIG
// ─────────────────────────────────────────
export function AdminFeaturesPage() {
  const [features, setFeatures] = useState<FeatureConfig[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('feature_config').select('*').order('feature')
    if (data) setFeatures(data as FeatureConfig[])
    setLoading(false)
  }

  async function saveFeature(f: FeatureConfig) {
    setSaving(f.id)
    await supabase.from('feature_config').update({ credit_cost: f.credit_cost, is_premium: f.is_premium }).eq('id', f.id)
    setSaving(null); toast.success(`${f.feature} updated`)
  }

  function update(id: string, field: keyof FeatureConfig, value: any) {
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  const featureDescriptions: Record<string, string> = {
    search: 'Running a job search via Apify',
    apply: 'Clicking Apply on a job card',
    match: 'AI resume matching with Groq',
    customize: 'AI resume customization with Groq',
    all_platforms: 'Searching both LinkedIn + Naukri simultaneously',
  }

  if (loading) return <PageLoading />

  return (
    <div>
      <PageHeader title="Feature Config" description="Set credit costs and premium flags for each feature" />

      <div className="space-y-3 max-w-2xl">
        {features.map(f => (
          <Card key={f.id} className="card-hover">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-slate-200 capitalize">{f.feature.replace('_', ' ')}</p>
                  {f.is_premium && <Badge label="Premium" variant="premium" />}
                </div>
                <p className="text-xs text-slate-600">{featureDescriptions[f.feature]}</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5 text-violet-400" />
                  <input
                    type="number" min={0} max={1000}
                    value={f.credit_cost}
                    onChange={e => update(f.id, 'credit_cost', parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-center text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  <span className="text-xs text-slate-600">cr</span>
                </div>

                <button onClick={() => update(f.id, 'is_premium', !f.is_premium)} className="transition-colors">
                  {f.is_premium
                    ? <ToggleRight className="w-7 h-7 text-amber-400" />
                    : <ToggleLeft className="w-7 h-7 text-slate-600" />
                  }
                </button>

                <Button size="sm" onClick={() => saveFeature(f)} loading={saving === f.id}>
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 glass-card p-4 max-w-2xl">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Note:</strong> Credit costs of 0 mean the feature is free. Toggle Premium to restrict a feature to users with positive wallet balance. Changes take effect immediately.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// AFFILIATE KEYS
// ─────────────────────────────────────────
export function AdminAffiliateKeysPage() {
  const [keys, setKeys] = useState<AffiliateKey[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('affiliate_keys').select('*')
    if (data) setKeys(data as AffiliateKey[])
    setLoading(false)
  }

  async function save(k: AffiliateKey) {
    setSaving(k.id)
    await supabase.from('affiliate_keys').update({
      referral_url: k.referral_url, referral_code: k.referral_code, instructions: k.instructions
    }).eq('id', k.id)
    setSaving(null); toast.success(`${k.platform} keys updated`)
  }

  function update(id: string, field: keyof AffiliateKey, value: string) {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, [field]: value } : k))
  }

  const platformInfo: Record<string, { label: string; color: string; desc: string }> = {
    apify: { label: 'Apify', color: 'text-emerald-400', desc: 'Referral link shown to users when they set up their Apify account' },
    groq: { label: 'Groq', color: 'text-violet-400', desc: 'Referral link shown to users when they set up their Groq API key' },
  }

  if (loading) return <PageLoading />

  return (
    <div>
      <PageHeader title="Affiliate Keys" description="Configure referral links and setup instructions shown to users" />

      <div className="space-y-6 max-w-2xl">
        {keys.map(k => {
          const info = platformInfo[k.platform]
          return (
            <Card key={k.id}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Key className={`w-5 h-5 ${info?.color ?? 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">{info?.label ?? k.platform}</p>
                  <p className="text-xs text-slate-600">{info?.desc}</p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  label="Referral URL"
                  value={k.referral_url ?? ''}
                  onChange={e => update(k.id, 'referral_url', e.target.value)}
                  placeholder={`https://${k.platform}.com/referral/your-code`}
                  icon={<ExternalLink className="w-4 h-4" />}
                />
                <Input
                  label="Referral Code"
                  value={k.referral_code ?? ''}
                  onChange={e => update(k.id, 'referral_code', e.target.value)}
                  placeholder="Your referral code"
                />
                <div className="space-y-1.5">
                  <label className="label">Setup Instructions</label>
                  <textarea
                    rows={3}
                    value={k.instructions ?? ''}
                    onChange={e => update(k.id, 'instructions', e.target.value)}
                    className="input resize-none"
                    placeholder="Instructions shown to users on the settings page..."
                  />
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button onClick={() => save(k)} loading={saving === k.id}>
                  <Save className="w-4 h-4" /> Save {info?.label}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────
export function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [grantingId, setGrantingId] = useState<string | null>(null)
  const [grantAmount, setGrantAmount] = useState<Record<string, number>>({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setUsers(data as Profile[])
    setLoading(false)
  }

  async function toggleUser(user: Profile) {
    setToggling(user.id)
    await supabase.from('profiles').update({ is_enabled: !user.is_enabled }).eq('id', user.id)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_enabled: !u.is_enabled } : u))
    setToggling(null)
  }

  async function grantCredits(user: Profile) {
    const amount = grantAmount[user.id] ?? 0
    if (!amount || amount <= 0) return
    setGrantingId(user.id)
    const newBalance = user.wallet_credits + amount
    await supabase.from('profiles').update({ wallet_credits: newBalance }).eq('id', user.id)
    await supabase.from('credit_ledger').insert({
      user_id: user.id, type: 'admin_grant', amount, balance_after: newBalance, note: 'Admin grant'
    })
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, wallet_credits: newBalance } : u))
    setGrantAmount(prev => ({ ...prev, [user.id]: 0 }))
    setGrantingId(null)
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const jobseekers = filtered.filter(u => u.role === 'jobseeker')
  const enabled = jobseekers.filter(u => u.is_enabled).length

  if (loading) return <PageLoading />

  return (
    <div>
      <PageHeader title="Manage Users" description="Enable/disable jobseekers and grant credits" />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Users" value={jobseekers.length} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Active" value={enabled} icon={<CheckCircle className="w-4 h-4" />} />
        <StatCard label="Disabled" value={jobseekers.length - enabled} icon={<Shield className="w-4 h-4" />} />
      </div>

      <div className="mb-4">
        <input
          className="input max-w-sm"
          placeholder="Search by email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Credits</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Grant Credits</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {filtered.map(user => (
              <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-200 text-sm">{user.email}</p>
                      <Badge label={user.role} variant={user.role === 'superadmin' ? 'purple' : 'gray'} />
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <Badge label={user.is_enabled ? 'Active' : 'Disabled'} variant={user.is_enabled ? 'green' : 'red'} />
                </td>
                <td className="px-5 py-4">
                  <span className="font-bold text-violet-400">{user.wallet_credits}</span>
                  <span className="text-slate-600 text-xs ml-1">credits</span>
                </td>
                <td className="px-5 py-4">
                  {user.role !== 'superadmin' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} max={10000}
                        value={grantAmount[user.id] ?? ''}
                        onChange={e => setGrantAmount(prev => ({ ...prev, [user.id]: parseInt(e.target.value) || 0 }))}
                        placeholder="Amount"
                        className="w-24 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                      <Button size="sm" variant="secondary" onClick={() => grantCredits(user)} loading={grantingId === user.id}>
                        Grant
                      </Button>
                    </div>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  {user.role !== 'superadmin' && (
                    <button onClick={() => toggleUser(user)} disabled={toggling === user.id}
                      className="transition-colors disabled:opacity-50">
                      {user.is_enabled
                        ? <ToggleRight className="w-8 h-8 text-emerald-400 hover:text-emerald-300" />
                        : <ToggleLeft className="w-8 h-8 text-slate-600 hover:text-slate-400" />
                      }
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-600 text-sm">No users found</div>
        )}
      </div>
    </div>
  )
}
