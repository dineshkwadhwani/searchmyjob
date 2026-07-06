import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Turn a raw Groq error into a message the user can actually act on.
function classifyGroqError(status: number, data: any): string {
  const raw = data?.error?.message ?? ''
  if (status === 429) {
    const isDaily = /per day|daily|tpd|rpd/i.test(raw)
    if (isDaily) {
      return "You've reached today's Groq usage limit for your account. Please try again tomorrow, or upgrade your Groq plan for higher limits."
    }
    return 'Groq is temporarily rate-limiting your requests. Please wait a moment and try again.'
  }
  if (status === 401) {
    return 'Your Groq API key appears to be invalid or expired. Please check your Groq account and update your API key in Settings.'
  }
  return `We couldn't complete this request with Groq. Please check your Groq account budget and that your API key hasn't expired, then try again.${raw ? ` (Groq said: ${raw})` : ''}`
}

const PROMPT_INSTRUCTIONS = `You are an expert resume parser. Extract structured profile data from the resume text below and
return ONLY valid JSON matching the exact structure specified — no markdown, no extra commentary.

Rules:
- Only extract information that is genuinely present in the resume text. Do NOT invent, guess, or hallucinate values.
- Omit a field entirely (do not include the key) if it isn't present in the resume, rather than guessing.
- Never fabricate personal fields that resumes essentially never contain: dateOfBirth, gender, maritalStatus,
  nationality, currentSalary, expectedSalary, noticePeriod, workAuthorizationStatus, visaStatus. Leave these out
  unless the text explicitly and unambiguously states them.
- All dates must be full ISO "YYYY-MM-DD" strings. If only a month and year are known, use "01" for the day.
  If only a year is known, use "01-01" for month-day.
- "totalExperienceYears" should be your best numeric estimate (e.g. 5.5) computed from the work history, only if
  work history with dates is present.
- Return the exact JSON shape below. Arrays that have no items should be omitted or returned as [].

CRITICAL — do not summarize, condense, or shorten anything. This is extraction, not summarization:
- "summary" must be the candidate's summary/profile section copied in FULL, verbatim, word for word, exactly as
  written in the resume — every sentence and every paragraph of it. Do NOT paraphrase it, do NOT shorten it to one
  sentence, do NOT cut it off partway through. If the resume's summary section is 2 paragraphs long, your "summary"
  value must also be those same 2 full paragraphs.
- "workExperience" must contain ONE entry for EVERY job/role listed in the resume's work history — never skip,
  merge, or drop any job, no matter how far back it is or how brief its description. If the resume lists 4 jobs,
  your output must have exactly 4 objects in "workExperience".
- For each job, "responsibilities" and "achievements" must include EVERY bullet point under that job in the
  original resume, each copied close to verbatim (light cleanup only, e.g. removing a leading bullet character) —
  not condensed into a shorter list. If a job has 6 bullet points in the resume, "responsibilities"/"achievements"
  together must also add up to around 6 entries, not 1 or 2.
- The same "do not condense" rule applies to "education", "certifications", and "portfolioItems": every degree,
  certification, patent, and project mentioned in the resume must appear as its own entry.
- Before finalizing your answer, re-check it against the resume text: does every job, every bullet point, every
  degree, and the full summary text all still appear in your JSON? If anything is missing or shortened, fix it
  before responding.

{
  "profile": {
    "firstName": "", "middleName": "", "lastName": "", "preferredName": "", "fullName": "",
    "title": "", "currentJobRole": "", "headline": "", "summary": "",
    "email": "", "phone": "", "alternatePhone": "",
    "linkedinUrl": "", "githubUrl": "", "portfolioUrl": "", "websiteUrl": "",
    "currentCompany": "", "currentLocation": "", "totalExperienceYears": 0,
    "addressLine1": "", "addressLine2": "", "city": "", "state": "", "country": "", "postalCode": ""
  },
  "tags": {
    "skills": [], "tools": [], "technologies": [], "certificationsKeywords": [],
    "industries": [], "domains": [], "functionalAreas": [], "specializations": []
  },
  "languages": [ { "language": "", "proficiency": "" } ],
  "workExperience": [ {
    "companyName": "", "jobTitle": "", "jobLevel": "", "employmentType": "", "location": "", "locationType": "",
    "startDate": "", "endDate": "", "isCurrent": false,
    "responsibilities": [], "achievements": [], "technologiesUsed": [],
    "companyIndustry": "", "businessDomain": "", "productName": "", "teamSize": 0
  } ],
  "education": [ {
    "institutionName": "", "degree": "", "fieldOfStudy": "", "specialization": "",
    "startDate": "", "endDate": "", "graduationDate": "", "grade": "", "location": "", "description": ""
  } ],
  "certifications": [ {
    "certificationName": "", "issuingOrganization": "", "issueDate": "", "expiryDate": "",
    "credentialId": "", "credentialUrl": ""
  } ],
  "portfolioItems": [ {
    "itemType": "project", "projectName": "", "description": "", "role": "",
    "startDate": "", "endDate": "", "techStack": [], "outcome": "", "url": ""
  } ]
}`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders })

    const { resume_text } = await req.json()
    if (!resume_text) return Response.json({ error: 'resume_text required' }, { headers: corsHeaders })

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile?.groq_key_encrypted) return Response.json({ error: 'No Groq key configured' }, { headers: corsHeaders })

    const { data: features } = await supabase.from('feature_config').select('*')
    const feature = features?.find((f: any) => f.feature === 'profile_extract')
    if (feature && !feature.is_enabled) {
      return Response.json({ error: 'Profile auto-fill is currently disabled' }, { headers: corsHeaders })
    }
    const cost = feature?.credit_cost ?? 5

    if (profile.wallet_credits < cost) {
      return Response.json({ error: `Need ${cost} credits. Balance: ${profile.wallet_credits}` }, { headers: corsHeaders })
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${profile.groq_key_encrypted}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: PROMPT_INSTRUCTIONS },
          { role: 'user', content: `RESUME TEXT:\n${resume_text}` },
        ],
        max_tokens: 8000,
        temperature: 0.1,
      })
    })

    const groqData = await groqRes.json()
    if (!groqRes.ok) throw new Error(classifyGroqError(groqRes.status, groqData))

    if (groqData.choices[0].finish_reason === 'length') {
      throw new Error("The extraction was cut off because it hit the AI's output limit before finishing your full resume. Please try again — if this keeps happening, your resume may be too long for a single extraction.")
    }

    const raw = groqData.choices[0].message.content.trim()
    const extracted = JSON.parse(raw.replace(/```json|```/g, '').trim())

    // Deduct credits
    const newBalance = profile.wallet_credits - cost
    if (cost > 0) {
      await supabase.from('profiles').update({ wallet_credits: newBalance }).eq('id', user.id)
      await supabase.from('credit_ledger').insert({
        user_id: user.id, type: 'profile_extract', amount: -cost,
        balance_after: newBalance, note: 'AI profile extraction from resume'
      })
    }

    return Response.json({ extracted }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('extract-profile-from-resume error:', err)
    return Response.json({ error: err.message }, { headers: corsHeaders })
  }
})
