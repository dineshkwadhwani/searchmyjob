import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Sparkles, Wand2, Edit3, Save, Plus, Trash2, ChevronDown, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, Input, Select, Textarea, TagInput, PageHeader, PageLoading, Alert, Badge } from '../../components/ui'
import ResumeUploadCard from '../../components/profile/ResumeUploadCard'
import { extractPdfText } from '../../lib/pdf'
import { isValidEmail, isValidPhone } from '../../lib/profileValidation'
import type {
  Resume, ProfileDetails, ProfileTagType, ProfileLanguage,
  ProfileWorkExperience, ProfileEducation, ProfileCertification, ProfilePortfolioItem,
} from '../../types'

// ─────────────────────────────────────────
// Generic field-driven form rendering
// ─────────────────────────────────────────
type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'checkbox' | 'select' | 'lines' | 'tags'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  tagMax?: number
  rows?: number
}

function FieldControl({ def, value, onChange, error, id }: { def: FieldDef; value: any; onChange: (v: any) => void; error?: string; id?: string }) {
  const label = def.label + (def.required ? ' *' : '')
  switch (def.type) {
    case 'textarea':
      return <Textarea id={id} label={label} value={value ?? ''} rows={def.rows ?? 4} placeholder={def.placeholder} onChange={e => onChange(e.target.value)} error={error} />
    case 'date':
      return <Input id={id} label={label} type="date" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)} error={error} />
    case 'number':
      return <Input id={id} label={label} type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} error={error} />
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 pt-6 text-sm text-slate-300 select-none cursor-pointer">
          <input id={id} type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-violet-500/50" />
          {def.label}
        </label>
      )
    case 'select':
      return <Select id={id} label={label} value={value ?? ''} onChange={e => onChange(e.target.value)}
        options={[{ value: '', label: 'Select...' }, ...(def.options ?? [])]} error={error} />
    case 'lines':
      return <Textarea id={id} label={label} value={(value ?? []).join('\n')} rows={def.rows ?? 5} placeholder="One per line"
        onChange={e => onChange(e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean))} error={error} />
    case 'tags':
      return <TagInput label={def.label} tags={value ?? []} onChange={onChange} max={def.tagMax ?? 30} placeholder={def.placeholder} />
    default:
      return <Input id={id} label={label} type="text" value={value ?? ''} placeholder={def.placeholder} onChange={e => onChange(e.target.value)} error={error} />
  }
}

function FieldGrid({ fields, values, onChange, errors, idPrefix = '' }: {
  fields: FieldDef[]; values: Record<string, any>; onChange: (key: string, v: any) => void
  errors?: Record<string, string>; idPrefix?: string
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {fields.map(f => (
        <div key={f.key} className={f.type === 'textarea' || f.type === 'lines' || f.type === 'tags' ? 'sm:col-span-2' : ''}>
          <FieldControl def={f} value={values[f.key]} onChange={v => onChange(f.key, v)} error={errors?.[f.key]} id={`${idPrefix}${f.key}`} />
        </div>
      ))}
    </div>
  )
}

function AccordionSection({ title, description, defaultOpen = true, forceOpenSignal, badge, children }: {
  title: string; description?: string; defaultOpen?: boolean; forceOpenSignal?: number; badge?: ReactNode; children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => { if (forceOpenSignal) setOpen(true) }, [forceOpenSignal])

  return (
    <div className="glass-card overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-slate-800/30 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-200">{title}</span>
          {badge}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-6 pt-1 border-t border-slate-700/50">
          {description && <p className="text-xs text-slate-500 mt-4 mb-4">{description}</p>}
          <div className={description ? '' : 'mt-4'}>{children}</div>
        </div>
      )}
    </div>
  )
}

interface Keyed { _key: string }

function RepeatableSection<T extends Keyed>({ title, description, items, fields, emptyItem, onChange, itemLabel, defaultOpen = false }: {
  title: string; description?: string; items: T[]; fields: FieldDef[]; emptyItem: () => T
  onChange: (items: T[]) => void; itemLabel: (item: T, idx: number) => string; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  function updateItem(idx: number, key: string, value: any) {
    onChange(items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)))
  }
  function addItem() { onChange([...items, emptyItem()]); setOpen(true) }
  function removeItem(idx: number) { onChange(items.filter((_, i) => i !== idx)) }

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className="font-semibold text-slate-200">{title}</span>
          {items.length > 0 && <Badge label={String(items.length)} variant="purple" />}
        </button>
        <Button size="sm" variant="secondary" onClick={addItem}><Plus className="w-3.5 h-3.5" /> Add</Button>
      </div>
      {open && (
        <div className="px-6 pb-6 pt-1 border-t border-slate-700/50">
          {description && <p className="text-xs text-slate-500 mt-4 mb-4">{description}</p>}
          <div className="space-y-3 mt-4">
            {items.length === 0 && <p className="text-sm text-slate-600">Nothing added yet.</p>}
            {items.map((item, idx) => (
              <div key={item._key} className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-400">{itemLabel(item, idx)}</p>
                  <button onClick={() => removeItem(idx)} className="text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <FieldGrid fields={fields} values={item as any} onChange={(k, v) => updateItem(idx, k, v)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Field definitions
// ─────────────────────────────────────────
const CORE_IDENTITY_FIELDS: FieldDef[] = [
  { key: 'first_name', label: 'First Name', type: 'text', required: true },
  { key: 'middle_name', label: 'Middle Name', type: 'text' },
  { key: 'last_name', label: 'Last Name', type: 'text', required: true },
  { key: 'preferred_name', label: 'Preferred Name', type: 'text' },
  { key: 'full_name', label: 'Full Name (override)', type: 'text' },
  { key: 'title', label: 'Professional Title', type: 'text', placeholder: 'e.g. Senior Product Manager' },
  { key: 'current_job_role', label: 'Current Role', type: 'text' },
  { key: 'headline', label: 'Headline', type: 'text' },
  { key: 'summary', label: 'Summary', type: 'textarea', rows: 6 },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text', required: true },
  { key: 'alternate_phone', label: 'Alternate Phone', type: 'text' },
  { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
  { key: 'gender', label: 'Gender', type: 'select', options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }, { value: 'Prefer not to say', label: 'Prefer not to say' }] },
  { key: 'marital_status', label: 'Marital Status', type: 'select', options: [{ value: 'Single', label: 'Single' }, { value: 'Married', label: 'Married' }, { value: 'Other', label: 'Other' }] },
  { key: 'nationality', label: 'Nationality', type: 'text' },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'text' },
  { key: 'github_url', label: 'GitHub URL', type: 'text' },
  { key: 'portfolio_url', label: 'Portfolio URL', type: 'text' },
  { key: 'website_url', label: 'Website URL', type: 'text' },
  { key: 'current_company', label: 'Current Company', type: 'text' },
  { key: 'current_location', label: 'Current City', type: 'text', required: true },
  { key: 'willing_to_relocate', label: 'Willing to Relocate', type: 'checkbox' },
  { key: 'open_to_work', label: 'Open to Work', type: 'checkbox' },
  { key: 'notice_period', label: 'Notice Period', type: 'text', placeholder: 'e.g. 30 days' },
  { key: 'total_experience_years', label: 'Total Experience (years)', type: 'number' },
  { key: 'current_salary', label: 'Current Salary', type: 'number' },
  { key: 'expected_salary', label: 'Expected Salary', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'text', placeholder: 'e.g. INR' },
  { key: 'availability_date', label: 'Availability Date', type: 'date' },
  { key: 'work_authorization_status', label: 'Work Authorization Status', type: 'text' },
  { key: 'visa_status', label: 'Visa Status', type: 'text' },
  { key: 'remote_preference', label: 'Remote Preference', type: 'select', options: [{ value: 'Remote', label: 'Remote' }, { value: 'Hybrid', label: 'Hybrid' }, { value: 'Onsite', label: 'Onsite' }, { value: 'Flexible', label: 'Flexible' }] },
  { key: 'employment_type_preference', label: 'Employment Type Preference', type: 'select', options: [{ value: 'Full-time', label: 'Full-time' }, { value: 'Part-time', label: 'Part-time' }, { value: 'Contract', label: 'Contract' }, { value: 'Freelance', label: 'Freelance' }] },
  { key: 'preferred_locations', label: 'Preferred Locations', type: 'tags', tagMax: 10 },
]

const CONTACT_FIELDS: FieldDef[] = [
  { key: 'address_line1', label: 'Address Line 1', type: 'text' },
  { key: 'address_line2', label: 'Address Line 2', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'country', label: 'Country', type: 'text' },
  { key: 'postal_code', label: 'Postal Code', type: 'text' },
  { key: 'timezone', label: 'Timezone', type: 'text' },
  { key: 'latitude', label: 'Latitude', type: 'number' },
  { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'emergency_contact_name', label: 'Emergency Contact Name', type: 'text' },
  { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'text' },
  { key: 'emergency_contact_relation', label: 'Emergency Contact Relation', type: 'text' },
]

const TAG_SECTIONS: { key: ProfileTagType; label: string }[] = [
  { key: 'skills', label: 'Skills' },
  { key: 'tools', label: 'Tools' },
  { key: 'technologies', label: 'Technologies' },
  { key: 'certificationsKeywords', label: 'Certification Keywords' },
  { key: 'industries', label: 'Industries' },
  { key: 'domains', label: 'Domains' },
  { key: 'functionalAreas', label: 'Functional Areas' },
  { key: 'specializations', label: 'Specializations' },
]

const LANGUAGE_FIELDS: FieldDef[] = [
  { key: 'language', label: 'Language', type: 'text' },
  { key: 'proficiency', label: 'Proficiency', type: 'select', options: [{ value: 'Native', label: 'Native' }, { value: 'Fluent', label: 'Fluent' }, { value: 'Professional', label: 'Professional' }, { value: 'Intermediate', label: 'Intermediate' }, { value: 'Basic', label: 'Basic' }] },
]

const WORK_EXPERIENCE_FIELDS: FieldDef[] = [
  { key: 'company_name', label: 'Company Name', type: 'text' },
  { key: 'company_logo_url', label: 'Company Logo URL', type: 'text' },
  { key: 'job_title', label: 'Job Title', type: 'text' },
  { key: 'job_level', label: 'Job Level', type: 'text' },
  { key: 'employment_type', label: 'Employment Type', type: 'select', options: [{ value: 'Full-time', label: 'Full-time' }, { value: 'Part-time', label: 'Part-time' }, { value: 'Contract', label: 'Contract' }, { value: 'Internship', label: 'Internship' }, { value: 'Freelance', label: 'Freelance' }] },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'location_type', label: 'Location Type', type: 'select', options: [{ value: 'Onsite', label: 'Onsite' }, { value: 'Remote', label: 'Remote' }, { value: 'Hybrid', label: 'Hybrid' }] },
  { key: 'start_date', label: 'Start Date', type: 'date' },
  { key: 'end_date', label: 'End Date', type: 'date' },
  { key: 'is_current', label: 'I currently work here', type: 'checkbox' },
  { key: 'responsibilities', label: 'Roles & Responsibilities', type: 'lines', rows: 7 },
  { key: 'achievements', label: 'Achievements', type: 'lines', rows: 6 },
  { key: 'technologies_used', label: 'Technologies Used', type: 'tags' },
  { key: 'team_size', label: 'Team Size', type: 'number' },
  { key: 'budget_owned', label: 'Budget Owned', type: 'text' },
  { key: 'reporting_line', label: 'Reporting Line', type: 'text' },
  { key: 'business_domain', label: 'Business Domain', type: 'text' },
  { key: 'product_name', label: 'Product Name', type: 'text' },
  { key: 'reason_for_leaving', label: 'Reason for Leaving', type: 'text' },
  { key: 'manager_name', label: 'Manager Name', type: 'text' },
  { key: 'manager_title', label: 'Manager Title', type: 'text' },
  { key: 'reference_available', label: 'Reference Available', type: 'checkbox' },
  { key: 'company_industry', label: 'Company Industry', type: 'text' },
  { key: 'company_size', label: 'Company Size', type: 'text' },
  { key: 'promoted_within_role', label: 'Promoted Within Role', type: 'checkbox' },
  { key: 'relocation_in_role', label: 'Relocated Within Role', type: 'checkbox' },
]

const EDUCATION_FIELDS: FieldDef[] = [
  { key: 'institution_name', label: 'Institution Name', type: 'text' },
  { key: 'degree', label: 'Degree', type: 'text' },
  { key: 'field_of_study', label: 'Field of Study', type: 'text' },
  { key: 'specialization', label: 'Specialization', type: 'text' },
  { key: 'start_date', label: 'Start Date', type: 'date' },
  { key: 'end_date', label: 'End Date', type: 'date' },
  { key: 'graduation_date', label: 'Graduation Date', type: 'date' },
  { key: 'grade', label: 'Grade', type: 'text' },
  { key: 'grade_type', label: 'Grade Type', type: 'text', placeholder: 'e.g. GPA, Percentage' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'is_highest_qualification', label: 'Highest Qualification', type: 'checkbox' },
  { key: 'honors', label: 'Honors', type: 'text' },
  { key: 'activities', label: 'Activities', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea', rows: 5 },
  { key: 'thesis_title', label: 'Thesis Title', type: 'text' },
  { key: 'study_mode', label: 'Study Mode', type: 'select', options: [{ value: 'Full-time', label: 'Full-time' }, { value: 'Part-time', label: 'Part-time' }, { value: 'Online', label: 'Online' }, { value: 'Distance', label: 'Distance' }] },
  { key: 'verification_status', label: 'Verification Status', type: 'text' },
]

const CERTIFICATION_FIELDS: FieldDef[] = [
  { key: 'certification_name', label: 'Certification Name', type: 'text' },
  { key: 'issuing_organization', label: 'Issuing Organization', type: 'text' },
  { key: 'issue_date', label: 'Issue Date', type: 'date' },
  { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
  { key: 'credential_id', label: 'Credential ID', type: 'text' },
  { key: 'credential_url', label: 'Credential URL', type: 'text' },
  { key: 'certificate_url', label: 'Certificate URL', type: 'text' },
  { key: 'status', label: 'Status', type: 'text' },
  { key: 'score', label: 'Score', type: 'text' },
  { key: 'skill_tags', label: 'Skill Tags', type: 'tags' },
]

const PORTFOLIO_FIELDS: FieldDef[] = [
  { key: 'item_type', label: 'Type', type: 'select', options: [
    { value: 'project', label: 'Project' }, { value: 'patent', label: 'Patent' }, { value: 'publication', label: 'Publication' },
    { value: 'caseStudy', label: 'Case Study' }, { value: 'githubRepo', label: 'GitHub Repository' }, { value: 'app', label: 'App Built' },
    { value: 'productLaunch', label: 'Product Launched' }, { value: 'speakingEngagement', label: 'Speaking Engagement' },
    { value: 'blog', label: 'Blog' }, { value: 'video', label: 'Video' },
  ] },
  { key: 'project_name', label: 'Title', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea', rows: 5 },
  { key: 'role', label: 'Your Role', type: 'text' },
  { key: 'company_or_personal', label: 'Company or Personal', type: 'select', options: [{ value: 'Company', label: 'Company' }, { value: 'Personal', label: 'Personal' }] },
  { key: 'start_date', label: 'Start Date', type: 'date' },
  { key: 'end_date', label: 'End Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'text' },
  { key: 'tech_stack', label: 'Tech Stack', type: 'tags' },
  { key: 'outcome', label: 'Outcome', type: 'textarea', rows: 4 },
  { key: 'url', label: 'URL', type: 'text' },
  { key: 'screenshots', label: 'Screenshot URLs', type: 'tags' },
  { key: 'impact_metrics', label: 'Impact Metrics', type: 'tags' },
]

// ─────────────────────────────────────────
// Extraction merge helpers
// ─────────────────────────────────────────
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
}

function convertKeys(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj ?? {})) out[camelToSnake(k)] = v
  return out
}

// ─────────────────────────────────────────
// Form state shape
// ─────────────────────────────────────────
interface FormState {
  details: Partial<ProfileDetails>
  tags: Record<ProfileTagType, string[]>
  languages: (Partial<ProfileLanguage> & Keyed)[]
  workExperience: (Partial<ProfileWorkExperience> & Keyed)[]
  education: (Partial<ProfileEducation> & Keyed)[]
  certifications: (Partial<ProfileCertification> & Keyed)[]
  portfolioItems: (Partial<ProfilePortfolioItem> & Keyed)[]
}

function emptyTags(): Record<ProfileTagType, string[]> {
  const t = {} as Record<ProfileTagType, string[]>
  TAG_SECTIONS.forEach(s => { t[s.key] = [] })
  return t
}

function emptyForm(): FormState {
  return { details: {}, tags: emptyTags(), languages: [], workExperience: [], education: [], certifications: [], portfolioItems: [] }
}

function stripKeys<T extends Record<string, any>>(item: T): Omit<T, '_key' | 'id'> {
  const { _key, id, ...rest } = item as any
  return rest
}

// Postgres rejects '' outright for date/numeric columns (no field-level validation catches this —
// it surfaces as a raw, unhelpful DB error). Belt-and-suspenders: FieldControl's onChange already
// converts '' to undefined going forward, but this cleans up anything already in state (e.g. from
// a resume extraction merge) right before it's sent to Supabase.
function sanitizeForSave<T extends Record<string, any>>(item: T, fields: FieldDef[]): T {
  const out = { ...item }
  for (const f of fields) {
    if ((f.type === 'date' || f.type === 'number') && out[f.key as keyof T] === '') {
      out[f.key as keyof T] = null as any
    }
  }
  return out
}

const MAX_PHOTO_SIZE_BYTES = 3 * 1024 * 1024 // 3MB

function PhotoUpload({ userId, url, onChange }: { userId: string; url?: string | null; onChange: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    if (file.size > MAX_PHOTO_SIZE_BYTES) { toast.error('Image must be under 3MB'); return }
    setUploading(true)
    try {
      const path = `${userId}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: saveErr } = await supabase.from('profile_details')
        .upsert({ user_id: userId, profile_photo_url: data.publicUrl }, { onConflict: 'user_id' })
      if (saveErr) throw saveErr
      onChange(data.publicUrl)
      toast.success('Profile photo updated')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemove() {
    await supabase.from('profile_details').update({ profile_photo_url: null }).eq('user_id', userId)
    onChange(null)
  }

  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
        {url ? <img src={url} alt="Profile" className="w-full h-full object-cover" /> : <UserCircle className="w-10 h-10 text-slate-600" />}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={uploading}>
          {url ? 'Replace Photo' : 'Upload Photo'}
        </Button>
        {url && (
          <Button size="sm" variant="danger" onClick={handleRemove}><Trash2 className="w-3.5 h-3.5" /></Button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  )
}

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const [form, setForm] = useState<FormState>(emptyForm())
  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [coreIdentityForceOpen, setCoreIdentityForceOpen] = useState(0)
  const coreIdentityRef = useRef<HTMLDivElement>(null)

  const hasGroq = !!profile?.groq_key_encrypted

  useEffect(() => { if (profile) load() }, [profile?.id])

  async function load() {
    if (!profile) return
    setLoading(true)
    const [detailsRes, tagsRes, langRes, weRes, eduRes, certRes, portRes] = await Promise.all([
      supabase.from('profile_details').select('*').eq('user_id', profile.id).maybeSingle(),
      supabase.from('profile_tags').select('*').eq('user_id', profile.id).order('sort_order'),
      supabase.from('profile_languages').select('*').eq('user_id', profile.id).order('sort_order'),
      supabase.from('profile_work_experience').select('*').eq('user_id', profile.id).order('sort_order'),
      supabase.from('profile_education').select('*').eq('user_id', profile.id).order('sort_order'),
      supabase.from('profile_certifications').select('*').eq('user_id', profile.id).order('sort_order'),
      supabase.from('profile_portfolio_items').select('*').eq('user_id', profile.id).order('sort_order'),
    ])

    const tags = emptyTags()
    ;(tagsRes.data ?? []).forEach((row: any) => {
      if (!tags[row.tag_type as ProfileTagType]) tags[row.tag_type as ProfileTagType] = []
      tags[row.tag_type as ProfileTagType].push(row.value)
    })

    setForm({
      details: detailsRes.data ?? { email: profile.email },
      tags,
      languages: (langRes.data ?? []).map((r: any) => ({ ...r, _key: r.id })),
      workExperience: (weRes.data ?? []).map((r: any) => ({ ...r, _key: r.id })),
      education: (eduRes.data ?? []).map((r: any) => ({ ...r, _key: r.id })),
      certifications: (certRes.data ?? []).map((r: any) => ({ ...r, _key: r.id })),
      portfolioItems: (portRes.data ?? []).map((r: any) => ({ ...r, _key: r.id })),
    })
    setLoading(false)
  }

  function updateDetail(key: string, value: any) {
    setForm(prev => ({ ...prev, details: { ...prev.details, [key]: value } }))
  }

  function applyExtraction(extracted: any) {
    setForm(prev => ({
      details: { ...prev.details, ...convertKeys(extracted.profile ?? {}) },
      tags: {
        ...prev.tags,
        ...Object.fromEntries(
          Object.entries(extracted.tags ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v : []])
        ),
      } as Record<ProfileTagType, string[]>,
      languages: (extracted.languages ?? []).length
        ? extracted.languages.map((l: any) => ({ ...l, _key: crypto.randomUUID() }))
        : prev.languages,
      workExperience: (extracted.workExperience ?? []).length
        ? extracted.workExperience.map((w: any) => ({ ...convertKeys(w), _key: crypto.randomUUID() }))
        : prev.workExperience,
      education: (extracted.education ?? []).length
        ? extracted.education.map((e: any) => ({ ...convertKeys(e), _key: crypto.randomUUID() }))
        : prev.education,
      certifications: (extracted.certifications ?? []).length
        ? extracted.certifications.map((c: any) => ({ ...convertKeys(c), _key: crypto.randomUUID() }))
        : prev.certifications,
      portfolioItems: (extracted.portfolioItems ?? []).length
        ? extracted.portfolioItems.map((p: any) => ({ ...convertKeys(p), _key: crypto.randomUUID() }))
        : prev.portfolioItems,
    }))
  }

  async function handleFillFromResume() {
    if (!hasGroq) { toast.error('Connect your Groq API key first (Settings → Groq Connector)'); return }
    if (!resume) { toast.error('Upload your resume first'); return }
    setExtracting(true)
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from('resumes').download(resume.file_path)
      if (dlErr || !blob) throw new Error('Could not read your resume file')
      const resumeText = await extractPdfText(blob)
      const { data, error } = await supabase.functions.invoke('extract-profile-from-resume', { body: { resume_text: resumeText } })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      applyExtraction(data.extracted)
      await refreshProfile()
      toast.success('Profile pre-filled from your resume — review and save below')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setExtracting(false)
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!form.details.first_name?.trim()) newErrors.first_name = 'Required'
    if (!form.details.last_name?.trim()) newErrors.last_name = 'Required'
    if (!form.details.phone?.trim()) newErrors.phone = 'Required'
    else if (!isValidPhone(form.details.phone)) newErrors.phone = 'Enter a valid phone number'
    if (!form.details.current_location?.trim()) newErrors.current_location = 'Required'
    if (form.details.email && !isValidEmail(form.details.email)) newErrors.email = 'Enter a valid email address'
    if (form.details.alternate_phone && !isValidPhone(form.details.alternate_phone)) newErrors.alternate_phone = 'Enter a valid phone number'
    setErrors(newErrors)

    const errorKeys = Object.keys(newErrors)
    if (errorKeys.length > 0) {
      // Focus the first invalid field in on-page order, not validation-check order
      const firstKey = CORE_IDENTITY_FIELDS.find(f => f.key in newErrors)?.key ?? errorKeys[0]
      setCoreIdentityForceOpen(n => n + 1)
      setTimeout(() => {
        const el = document.getElementById(`field-details-${firstKey}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.focus()
      }, 60)
    }
    return errorKeys.length === 0
  }

  async function replaceChildRows(table: string, rows: Record<string, any>[]) {
    await supabase.from(table).delete().eq('user_id', profile!.id)
    if (rows.length === 0) return
    const { error } = await supabase.from(table).insert(rows.map((r, i) => ({ ...r, user_id: profile!.id, sort_order: i })))
    if (error) throw error
  }

  async function handleSave() {
    if (!profile) return
    if (!validate()) { toast.error('Please fix the highlighted fields'); return }
    setSaving(true)
    try {
      const sanitizedDetails = sanitizeForSave(form.details, [...CORE_IDENTITY_FIELDS, ...CONTACT_FIELDS])
      const { error: upsertErr } = await supabase.from('profile_details').upsert(
        { ...sanitizedDetails, user_id: profile.id, completed_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      if (upsertErr) throw upsertErr

      const tagRows = Object.entries(form.tags).flatMap(([tagType, values]) =>
        values.map(value => ({ tag_type: tagType, value }))
      )

      await Promise.all([
        replaceChildRows('profile_tags', tagRows),
        replaceChildRows('profile_languages', form.languages.map(stripKeys)),
        replaceChildRows('profile_work_experience', form.workExperience.map(w => sanitizeForSave(stripKeys(w), WORK_EXPERIENCE_FIELDS))),
        replaceChildRows('profile_education', form.education.map(e => sanitizeForSave(stripKeys(e), EDUCATION_FIELDS))),
        replaceChildRows('profile_certifications', form.certifications.map(c => sanitizeForSave(stripKeys(c), CERTIFICATION_FIELDS))),
        replaceChildRows('profile_portfolio_items', form.portfolioItems.map(p => sanitizeForSave(stripKeys(p), PORTFOLIO_FIELDS))),
      ])

      toast.success('Profile saved!')
      await load()
    } catch (err: any) {
      toast.error(`Could not save profile: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading />

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Keep your profile complete so we can auto-fill applications and forms for you"
        action={<Button onClick={handleSave} loading={saving}><Save className="w-4 h-4" /> Save Profile</Button>}
      />

      <div className="max-w-4xl space-y-6">
        <Card>
          <h3 className="font-semibold text-slate-200 mb-3">Your Resume</h3>
          <ResumeUploadCard showTips={false} onResumeChange={setResume} />
        </Card>

        <Card className="bg-violet-500/5 border-violet-500/20">
          <div className="flex gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-300 mb-1">Why complete your profile?</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                A complete profile lets SearchMyJob AI auto-fill job applications and other forms on your behalf —
                saving you from retyping the same details every time. Fill it out automatically from your resume,
                or enter everything yourself below.
              </p>
            </div>
          </div>
          {!hasGroq && (
            <div className="mb-4">
              <Alert type="info" message="Connect your Groq API key in Settings → Groq Connector to unlock filling your profile automatically from your resume." />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleFillFromResume} loading={extracting} disabled={!resume || !hasGroq}>
              <Wand2 className="w-4 h-4" /> Fill Profile from Resume
            </Button>
            <Button variant="secondary" onClick={() => coreIdentityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <Edit3 className="w-4 h-4" /> Fill Manually
            </Button>
          </div>
        </Card>

        <div ref={coreIdentityRef}>
          <AccordionSection title="Core Identity" defaultOpen forceOpenSignal={coreIdentityForceOpen}>
            <PhotoUpload userId={profile!.id} url={form.details.profile_photo_url} onChange={url => updateDetail('profile_photo_url', url)} />
            <FieldGrid fields={CORE_IDENTITY_FIELDS} values={form.details} onChange={updateDetail} errors={errors} idPrefix="field-details-" />
          </AccordionSection>
        </div>

        <AccordionSection title="Contact & Address" defaultOpen>
          <FieldGrid fields={CONTACT_FIELDS} values={form.details} onChange={updateDetail} errors={errors} idPrefix="field-details-" />
        </AccordionSection>

        <AccordionSection title="Skills & Expertise" defaultOpen description="Add as many as apply — press Enter or comma to add each one">
          <div className="grid sm:grid-cols-2 gap-4">
            {TAG_SECTIONS.map(t => (
              <TagInput key={t.key} label={t.label} tags={form.tags[t.key] ?? []} max={30}
                onChange={v => setForm(prev => ({ ...prev, tags: { ...prev.tags, [t.key]: v } }))} />
            ))}
          </div>
        </AccordionSection>

        <RepeatableSection
          title="Languages" items={form.languages} fields={LANGUAGE_FIELDS}
          emptyItem={() => ({ _key: crypto.randomUUID() })}
          onChange={v => setForm(prev => ({ ...prev, languages: v }))}
          itemLabel={(it) => it.language || 'New language'}
          defaultOpen={form.languages.length > 0}
        />

        <RepeatableSection
          title="Work Experience" items={form.workExperience} fields={WORK_EXPERIENCE_FIELDS}
          emptyItem={() => ({ _key: crypto.randomUUID() })}
          onChange={v => setForm(prev => ({ ...prev, workExperience: v }))}
          itemLabel={(it, i) => it.job_title || it.company_name || `Experience ${i + 1}`}
          defaultOpen={form.workExperience.length > 0}
        />

        <RepeatableSection
          title="Education" items={form.education} fields={EDUCATION_FIELDS}
          emptyItem={() => ({ _key: crypto.randomUUID() })}
          onChange={v => setForm(prev => ({ ...prev, education: v }))}
          itemLabel={(it, i) => it.institution_name || `Education ${i + 1}`}
          defaultOpen={form.education.length > 0}
        />

        <RepeatableSection
          title="Certifications" items={form.certifications} fields={CERTIFICATION_FIELDS}
          emptyItem={() => ({ _key: crypto.randomUUID() })}
          onChange={v => setForm(prev => ({ ...prev, certifications: v }))}
          itemLabel={(it, i) => it.certification_name || `Certification ${i + 1}`}
          defaultOpen={form.certifications.length > 0}
        />

        <RepeatableSection
          title="Projects & Portfolio" items={form.portfolioItems} fields={PORTFOLIO_FIELDS}
          emptyItem={() => ({ _key: crypto.randomUUID(), item_type: 'project' as const })}
          onChange={v => setForm(prev => ({ ...prev, portfolioItems: v }))}
          itemLabel={(it, i) => it.project_name || `Item ${i + 1}`}
          defaultOpen={form.portfolioItems.length > 0}
        />

        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={handleSave} loading={saving}><Save className="w-4 h-4" /> Save Profile</Button>
        </div>
      </div>
    </div>
  )
}
