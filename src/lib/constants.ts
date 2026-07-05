import type { TimeFrame, SearchPlatform } from '../types'

export const TIME_FRAME_OPTIONS: { value: TimeFrame; label: string }[] = [
  { value: 'r86400',  label: 'Last 24 hours' },
  { value: 'r172800', label: 'Last 48 hours' },
  { value: 'r604800', label: 'Last 7 days' },
  { value: 'r1296000', label: 'Last 15 days' },
]

export const PLATFORM_OPTIONS: { value: SearchPlatform; label: string; isPremium?: boolean }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'naukri',   label: 'Naukri' },
  { value: 'indeed',   label: 'Indeed', isPremium: true },
  { value: 'all',      label: 'All Platforms', isPremium: true },
]

export const MAX_ROLES     = 3
export const MAX_LOCATIONS = 3
export const MAX_SKILLS    = 3
export const MAX_SEARCH_CONFIGS = 3
export const MAX_RESUME_SIZE_BYTES = 1024 * 1024 // 1MB

// Base rate: ₹10 per credit, before any pack discount.
// `id` must match the package keys defined server-side in the
// create-razorpay-order function — the server is the source of truth
// for pricing; these values are for display only.
export const CREDIT_PACKAGES = [
  { id: 'explorer',  name: 'Explorer Pack',  credits: 10,  amount_paise: 10000, discountPct: 0 },
  { id: 'seeker',    name: 'Seeker Pack',    credits: 25,  amount_paise: 23750, discountPct: 5 },
  { id: 'contender', name: 'Contender Pack', credits: 50,  amount_paise: 45000, discountPct: 10 },
  { id: 'achiever',  name: 'Achiever Pack',  credits: 100, amount_paise: 85000, discountPct: 15 },
]

export function formatCredits(n: number) {
  return `${n} credit${n === 1 ? '' : 's'}`
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function daysUntil(iso?: string | null) {
  if (!iso) return 0
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
