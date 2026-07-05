import { useState, useEffect } from 'react'
import { Save, Key, ExternalLink, Users, ToggleLeft, ToggleRight, Coins, Shield, CheckCircle, Wallet, TrendingUp, TrendingDown, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { PageHeader, Card, Button, Input, Badge, StatCard, PageLoading, Modal } from '../../components/ui'
import type { FeatureConfig, AffiliateKey, ActorConfig, Profile, CreditLedgerEntry } from '../../types'
import { ALWAYS_ON_FEATURES } from '../../types'
import { formatDateTime } from '../../lib/constants'

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
    const isEnabled = ALWAYS_ON_FEATURES.includes(f.feature) ? true : f.is_enabled
    await supabase.from('feature_config').update({ credit_cost: f.credit_cost, is_premium: f.is_premium, is_enabled: isEnabled }).eq('id', f.id)
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
    all_platforms: 'Searching all supported platforms at once via a dedicated Apify actor',
    indeed: 'Running a job search against Indeed',
    wallet: 'Buying credits via Razorpay — turn off if the payment gateway is unavailable',
    ats_evaluator: 'Resume scoring against ATS best practices — turning this off also disables Rewrite My Resume',
    ats_rewrite: 'AI-powered resume rewrite with Groq (requires ATS Evaluator to also be enabled)',
  }

  if (loading) return <PageLoading />

  return (
    <div>
      <PageHeader title="Feature Config" description="Set credit costs and premium flags for each feature" />

      <div className="space-y-3 max-w-2xl">
        {features.map(f => {
          const alwaysOn = ALWAYS_ON_FEATURES.includes(f.feature)
          const enabled = alwaysOn ? true : f.is_enabled
          return (
            <Card key={f.id} className="card-hover">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-200 capitalize">{f.feature.replace('_', ' ')}</p>
                    <Badge label={enabled ? 'Enabled' : 'Disabled'} variant={enabled ? 'green' : 'red'} />
                    {f.is_premium && <Badge label="Premium" variant="premium" />}
                  </div>
                  <p className="text-xs text-slate-600">
                    {featureDescriptions[f.feature]}
                    {alwaysOn && ' · always on'}
                  </p>
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

                  <button onClick={() => !alwaysOn && update(f.id, 'is_enabled', !f.is_enabled)}
                    disabled={alwaysOn} title={alwaysOn ? 'Basic feature — always on' : 'Toggle feature on/off'}
                    className={`transition-colors ${alwaysOn ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    {enabled
                      ? <ToggleRight className="w-7 h-7 text-emerald-400" />
                      : <ToggleLeft className="w-7 h-7 text-slate-600" />
                    }
                  </button>

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
          )
        })}
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
// ACTOR CONFIGURATION
// ─────────────────────────────────────────

// Admins tend to paste the full Apify console URL rather than the bare
// "username/actor-name" slug the API needs — accept either and normalize.
function normalizeActorId(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/apify\.com\/([^/?#]+\/[^/?#]+)/)
  return match ? match[1] : trimmed
}

export function AdminActorConfigPage() {
  const [actors, setActors] = useState<ActorConfig[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('actor_config').select('*').order('platform')
    if (data) setActors(data as ActorConfig[])
    setLoading(false)
  }

  async function save(a: ActorConfig) {
    const actor_id = normalizeActorId(a.actor_id)
    if (!actor_id) { toast.error('Actor ID cannot be empty'); return }
    setSaving(a.id)
    await supabase.from('actor_config').update({ actor_id }).eq('id', a.id)
    setSaving(null)
    toast.success(`${platformInfo[a.platform]?.label ?? a.platform} actor updated`)
    load()
  }

  function update(id: string, value: string) {
    setActors(prev => prev.map(a => a.id === id ? { ...a, actor_id: value } : a))
  }

  const platformInfo: Record<string, { label: string; desc: string }> = {
    linkedin: { label: 'LinkedIn', desc: 'Used when a user searches LinkedIn' },
    naukri: { label: 'Naukri', desc: 'Used when a user searches Naukri' },
    indeed: { label: 'Indeed', desc: 'Used when a user searches Indeed' },
    all: { label: 'All Platforms', desc: 'Dedicated actor used for the "All Platforms" search — scrapes multiple sources in one run' },
  }

  if (loading) return <PageLoading />

  return (
    <div>
      <PageHeader title="Actor Configuration" description="Set the Apify actor used for each search platform — update here if an actor is renamed or replaced, no code changes needed" />

      <div className="space-y-4 max-w-2xl">
        {actors.map(a => {
          const info = platformInfo[a.platform]
          return (
            <Card key={a.id}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">{info?.label ?? a.platform}</p>
                  <p className="text-xs text-slate-600">{info?.desc}</p>
                </div>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    label="Apify Actor ID"
                    value={a.actor_id}
                    onChange={e => update(a.id, e.target.value)}
                    placeholder="username/actor-name"
                  />
                </div>
                <Button onClick={() => save(a)} loading={saving === a.id}>
                  <Save className="w-4 h-4" /> Save
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 glass-card p-4 max-w-2xl">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Note:</strong> Paste either the actor's <code className="text-slate-400">username/actor-name</code> slug or its full apify.com URL — either is accepted and normalized on save. Changes take effect on the next search; no deployment needed.
        </p>
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
  const [walletUser, setWalletUser] = useState<Profile | null>(null)
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function openWallet(user: Profile) {
    setWalletUser(user)
    setLedgerLoading(true)
    const { data, error } = await supabase.from('credit_ledger').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    if (error) toast.error(error.message)
    setLedger((data ?? []) as CreditLedgerEntry[])
    setLedgerLoading(false)
  }

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
                  <div className="flex items-center justify-end gap-3">
                    <Button size="sm" variant="ghost" onClick={() => openWallet(user)}>
                      <Wallet className="w-3.5 h-3.5" /> Wallet
                    </Button>
                    {user.role !== 'superadmin' && (
                      <button onClick={() => toggleUser(user)} disabled={toggling === user.id}
                        className="transition-colors disabled:opacity-50">
                        {user.is_enabled
                          ? <ToggleRight className="w-8 h-8 text-emerald-400 hover:text-emerald-300" />
                          : <ToggleLeft className="w-8 h-8 text-slate-600 hover:text-slate-400" />
                        }
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-600 text-sm">No users found</div>
        )}
      </div>

      {walletUser && (
        <Modal title={`${walletUser.email} — Wallet`} onClose={() => setWalletUser(null)}>
          <div className="flex items-center gap-3 mb-5 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Coins className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-100">{walletUser.wallet_credits}</p>
              <p className="text-xs text-slate-500">Current balance</p>
            </div>
          </div>

          {ledgerLoading ? (
            <PageLoading />
          ) : ledger.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">No transactions yet.</p>
          ) : (
            <div className="space-y-1">
              {ledger.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 py-3 border-b border-slate-800/60 last:border-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                    {['topup', 'admin_grant', 'refund', 'signup_bonus'].includes(entry.type)
                      ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge label={entry.type.replace('_', ' ')} variant="gray" />
                    {entry.note && <p className="text-xs text-slate-600 truncate mt-0.5">{entry.note}</p>}
                    <p className="text-[10px] text-slate-600 mt-0.5">{formatDateTime(entry.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${entry.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {entry.amount > 0 ? '+' : ''}{entry.amount}
                    </p>
                    <p className="text-[10px] text-slate-600">bal: {entry.balance_after}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
