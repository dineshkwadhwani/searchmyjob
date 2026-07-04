export type UserRole = 'superadmin' | 'jobseeker'
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed'
export type SearchPlatform = 'linkedin' | 'naukri' | 'all'
export type TimeFrame = 'r86400' | 'r172800' | 'r604800' | 'r1296000'
export type FeatureName = 'search' | 'apply' | 'match' | 'customize' | 'all_platforms'
export type CreditTxType = 'topup' | 'search' | 'apply' | 'match' | 'customize' | 'refund' | 'admin_grant' | 'signup_bonus'

export interface Profile {
  id: string
  email: string
  role: UserRole
  is_enabled: boolean
  wallet_credits: number
  apify_key_encrypted?: string
  groq_key_encrypted?: string
  created_at: string
  updated_at: string
}

export interface SearchConfig {
  id: string
  user_id: string
  name: string
  job_titles: string[]
  locations: string[]
  skills: string[]        // ← fixed: was string
  time_frame: TimeFrame
  platform: SearchPlatform
  created_at: string
  updated_at: string
}

export interface JobRun {
  id: string
  user_id: string
  search_config_id?: string
  status: RunStatus
  platform: SearchPlatform
  apify_run_id?: string
  apify_run_id_2?: string
  result_count: number
  credits_charged: number
  error_message?: string
  created_at: string
  completed_at?: string
}

export interface JobResult {
  id: string
  run_id: string
  user_id: string
  platform: SearchPlatform  // ← added
  title: string
  company: string
  location?: string
  link?: string
  job_id?: string
  posted_at?: string
  search_location?: string
  search_keywords?: string
  is_applied: boolean
  applied_at?: string
  created_at: string
}

export interface Resume {
  id: string
  user_id: string
  file_path: string
  file_name: string
  file_size_bytes?: number
  is_active: boolean
  uploaded_at: string
}

export interface MatchResult {
  id: string
  user_id: string
  job_result_id: string
  resume_id: string
  match_score: number
  match_summary?: string
  matched_skills?: string[]
  missing_skills?: string[]
  credits_charged: number
  created_at: string
}

export interface CustomizedResume {
  id: string
  user_id: string
  job_result_id: string
  resume_id: string
  original_file_path: string
  customized_content: string
  customized_file_path?: string
  expires_at: string
  credits_charged: number
  created_at: string
}

export interface CreditLedgerEntry {
  id: string
  user_id: string
  type: CreditTxType
  amount: number
  balance_after: number
  reference_id?: string
  note?: string
  created_at: string
}

export interface FeatureConfig {
  id: string
  feature: FeatureName
  credit_cost: number
  is_premium: boolean
  updated_at: string
  updated_by?: string
}

export interface AffiliateKey {
  id: string
  platform: 'apify' | 'groq'
  referral_url?: string
  referral_code?: string
  instructions?: string
  created_at: string
  updated_at: string
}

export interface RazorpayOrder {
  id: string
  user_id: string
  razorpay_order_id: string
  razorpay_payment_id?: string
  amount_paise: number
  credits_to_add: number
  status: string
  created_at: string
  confirmed_at?: string
}
