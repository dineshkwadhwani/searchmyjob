import { useState, useEffect } from 'react'
import { Coins, TrendingUp, TrendingDown, CreditCard, History, Zap, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageHeader, Card, StatCard, Badge, PageLoading } from '../../components/ui'
import type { CreditLedgerEntry } from '../../types'
import { CREDIT_PACKAGES, formatDateTime } from '../../lib/constants'

declare global {
  interface Window { Razorpay: any }
}

export default function WalletPage() {
  const { profile, refreshProfile } = useAuth()
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState<number | null>(null)

  useEffect(() => { loadLedger() }, [profile])

  async function loadLedger() {
    if (!profile) return
    const { data } = await supabase.from('credit_ledger').select('*')
      .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50)
    if (data) setLedger(data as CreditLedgerEntry[])
    setLoading(false)
  }

  async function handleTopUp(pkg: typeof CREDIT_PACKAGES[number], index: number) {
    setPayLoading(index)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('create-razorpay-order', {
        body: { package: pkg.id }
      })
      if (fnErr || data?.error) throw new Error(data?.error ?? fnErr?.message)

      if (!window.Razorpay) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement('script')
          s.src = 'https://checkout.razorpay.com/v1/checkout.js'
          s.onload = () => res(); s.onerror = () => rej()
          document.head.appendChild(s)
        })
      }

      const rzp = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: data.razorpay_order_id,
        amount: data.amount_paise,
        currency: 'INR',
        name: 'SearchMyJob AI',
        description: `${pkg.credits} Credits`,
        prefill: { email: profile?.email },
        theme: { color: '#7c3aed' },
        handler: async function (response: any) {
          const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('verify-razorpay-payment', {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }
          })
          await refreshProfile()
          await loadLedger()
          if (verifyData?.success) {
            toast.success(`${pkg.credits} credits added to your wallet!`)
          } else {
            toast.error(verifyData?.error ?? verifyErr?.message ?? 'Could not verify payment. Contact support if credits don\'t appear.')
          }
        },
      })
      rzp.open()
    } catch (err: any) {
      toast.error(err.message ?? 'Payment failed. Please try again.')
    } finally {
      setPayLoading(null)
    }
  }

  const txIcon = (type: string) => {
    if (['topup', 'admin_grant', 'refund', 'signup_bonus'].includes(type)) return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
    return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  }

  const txBadgeVariant = (type: string): any => {
    const m: Record<string, string> = { topup: 'green', admin_grant: 'green', refund: 'green', signup_bonus: 'green', search: 'purple', apply: 'gray', match: 'blue', customize: 'premium' }
    return m[type] ?? 'gray'
  }

  if (loading) return <PageLoading />

  return (
    <div>
      <PageHeader title="Wallet" description="Manage your credits and view transaction history" />

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Available Credits" value={profile?.wallet_credits ?? 0} icon={<Coins className="w-4 h-4" />} sub="Never expire" />
        <StatCard label="Total Topped Up"
          value={ledger.filter(l => l.type === 'topup').reduce((s, l) => s + l.amount, 0)}
          icon={<ArrowUpRight className="w-4 h-4" />} />
        <StatCard label="Total Used"
          value={Math.abs(ledger.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0))}
          icon={<Zap className="w-4 h-4" />} />
      </div>

      <Card className="mb-8">
        <h3 className="text-sm font-semibold text-slate-300 mb-5 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-violet-400" /> Top Up Credits
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CREDIT_PACKAGES.map((pkg, i) => (
            <button key={i} onClick={() => handleTopUp(pkg, i)}
              disabled={payLoading !== null}
              className={`relative p-5 rounded-2xl border text-left transition-all hover:border-violet-500/50 hover:bg-violet-500/5 group disabled:opacity-60
                ${i === 2 ? 'border-violet-500/40 bg-violet-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
              {i === 2 && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2.5 py-0.5 bg-violet-600 text-white rounded-full font-bold whitespace-nowrap">⚡ Popular</span>
              )}
              <p className="text-xs font-semibold text-violet-400 mb-2">{pkg.name}</p>
              <p className="text-2xl font-bold text-slate-100 mb-0.5">{pkg.credits}</p>
              <p className="text-xs text-slate-500 mb-4">Credits</p>
              <div className="flex items-baseline gap-1">
                <p className="text-lg font-bold text-violet-400">₹{pkg.amount_paise / 100}</p>
                <p className="text-xs text-slate-600">INR</p>
              </div>
              <p className="text-[10px] text-emerald-400 mt-1">
                ₹{(pkg.amount_paise / pkg.credits / 100).toFixed(2)}/credit
                {pkg.discountPct > 0 && <span className="text-amber-400"> · {pkg.discountPct}% off</span>}
              </p>
              {payLoading === i && (
                <div className="absolute inset-0 bg-slate-900/80 rounded-2xl flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-4 flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-center text-[10px] leading-4">🔒</span>
          Secured by Razorpay · Credits never expire · Instant top-up
        </p>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-300 mb-5 flex items-center gap-2">
          <History className="w-4 h-4 text-violet-400" /> Transaction History
        </h3>
        {ledger.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-600">No transactions yet. Top up to get started!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {ledger.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-3 border-b border-slate-800/60 last:border-0">
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                  {txIcon(entry.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge label={entry.type.replace('_', ' ')} variant={txBadgeVariant(entry.type)} />
                    {entry.note && <span className="text-xs text-slate-600 truncate">{entry.note}</span>}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{formatDateTime(entry.created_at)}</p>
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
      </Card>
    </div>
  )
}
