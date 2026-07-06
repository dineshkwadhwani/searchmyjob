export type UserRole = 'superadmin' | 'jobseeker'
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed'
export type SearchPlatform = 'linkedin' | 'naukri' | 'indeed' | 'all'
export type TimeFrame = 'r86400' | 'r172800' | 'r604800' | 'r1296000'
export type FeatureName = 'search' | 'apply' | 'match' | 'customize' | 'all_platforms' | 'indeed' | 'wallet' | 'ats_evaluator' | 'ats_rewrite' | 'profile_extract'
export const ALWAYS_ON_FEATURES: FeatureName[] = ['search', 'apply']
export type CreditTxType = 'topup' | 'search' | 'apply' | 'match' | 'customize' | 'refund' | 'admin_grant' | 'signup_bonus' | 'ats_rewrite' | 'profile_extract'

export interface Profile {
  id: string
  email: string
  role: UserRole
  is_enabled: boolean
  wallet_credits: number
  apify_key_encrypted?: string
  groq_key_encrypted?: string
  has_seen_welcome: boolean
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
  description?: string
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
  is_enabled: boolean
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

export interface ActorConfig {
  id: string
  platform: SearchPlatform
  actor_id: string
  updated_at: string
}

// ─── Candidate Profile ───
export interface ProfileDetails {
  user_id: string
  first_name?: string
  middle_name?: string
  last_name?: string
  preferred_name?: string
  full_name?: string
  title?: string
  current_job_role?: string
  headline?: string
  summary?: string
  email?: string
  phone?: string
  alternate_phone?: string
  date_of_birth?: string
  gender?: string
  marital_status?: string
  nationality?: string
  profile_photo_url?: string
  linkedin_url?: string
  github_url?: string
  portfolio_url?: string
  website_url?: string
  current_company?: string
  current_location?: string
  willing_to_relocate?: boolean
  open_to_work?: boolean
  notice_period?: string
  total_experience_years?: number
  current_salary?: number
  expected_salary?: number
  currency?: string
  availability_date?: string
  work_authorization_status?: string
  visa_status?: string
  remote_preference?: string
  employment_type_preference?: string
  preferred_locations?: string[]
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  timezone?: string
  latitude?: number
  longitude?: number
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relation?: string
  completed_at?: string
  created_at?: string
  updated_at?: string
}

export type ProfileTagType = 'skills' | 'tools' | 'technologies' | 'certificationsKeywords' | 'industries' | 'domains' | 'functionalAreas' | 'specializations'

export interface ProfileTag {
  id: string
  user_id: string
  tag_type: ProfileTagType
  value: string
  category?: string
  sort_order: number
}

export interface ProfileLanguage {
  id: string
  user_id: string
  language: string
  proficiency?: string
  sort_order: number
}

export interface ProfileWorkExperience {
  id: string
  user_id: string
  company_name?: string
  company_logo_url?: string
  job_title?: string
  job_level?: string
  employment_type?: string
  location?: string
  location_type?: string
  start_date?: string
  end_date?: string
  is_current?: boolean
  responsibilities?: string[]
  achievements?: string[]
  technologies_used?: string[]
  team_size?: number
  budget_owned?: string
  reporting_line?: string
  business_domain?: string
  product_name?: string
  reason_for_leaving?: string
  manager_name?: string
  manager_title?: string
  reference_available?: boolean
  company_industry?: string
  company_size?: string
  promoted_within_role?: boolean
  relocation_in_role?: boolean
  sort_order: number
}

export interface ProfileEducation {
  id: string
  user_id: string
  institution_name?: string
  degree?: string
  field_of_study?: string
  specialization?: string
  start_date?: string
  end_date?: string
  graduation_date?: string
  grade?: string
  grade_type?: string
  location?: string
  is_highest_qualification?: boolean
  honors?: string
  activities?: string
  description?: string
  thesis_title?: string
  study_mode?: string
  verification_status?: string
  sort_order: number
}

export interface ProfileCertification {
  id: string
  user_id: string
  certification_name?: string
  issuing_organization?: string
  issue_date?: string
  expiry_date?: string
  credential_id?: string
  credential_url?: string
  certificate_url?: string
  status?: string
  score?: string
  skill_tags?: string[]
  sort_order: number
}

export type PortfolioItemType = 'project' | 'patent' | 'publication' | 'caseStudy' | 'githubRepo' | 'app' | 'productLaunch' | 'speakingEngagement' | 'blog' | 'video'

export interface ProfilePortfolioItem {
  id: string
  user_id: string
  item_type: PortfolioItemType
  project_name?: string
  description?: string
  role?: string
  company_or_personal?: string
  start_date?: string
  end_date?: string
  status?: string
  tech_stack?: string[]
  outcome?: string
  url?: string
  screenshots?: string[]
  impact_metrics?: string[]
  sort_order: number
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
