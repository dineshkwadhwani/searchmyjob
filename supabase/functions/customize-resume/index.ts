import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Turn a raw Groq error into a message the user can actually act on.
// Falls back to an optimistic "check your account" message for anything
// we can't confidently classify, rather than showing raw API text.
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders })

    const { job_result_id, resume_text } = await req.json()
    if (!job_result_id || !resume_text) {
      return Response.json({ error: 'job_result_id and resume_text required' }, { headers: corsHeaders })
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile?.groq_key_encrypted) return Response.json({ error: 'No Groq key configured' }, { headers: corsHeaders })

    const { data: features } = await supabase.from('feature_config').select('*')
    const customizeFeature = features?.find((f: any) => f.feature === 'customize')
    if (customizeFeature && !customizeFeature.is_enabled) {
      return Response.json({ error: 'Resume customization is currently disabled' }, { headers: corsHeaders })
    }
    const cost = customizeFeature?.credit_cost ?? 10

    if (profile.wallet_credits < cost) {
      return Response.json({ error: `Need ${cost} credits. Balance: ${profile.wallet_credits}` }, { headers: corsHeaders })
    }

    const { data: job } = await supabase.from('job_results').select('*').eq('id', job_result_id).single()
    if (!job) return Response.json({ error: 'Job not found' }, { headers: corsHeaders })

    const { data: resume } = await supabase.from('resumes').select('*').eq('user_id', user.id).eq('is_active', true).single()
    if (!resume) return Response.json({ error: 'No active resume found' }, { headers: corsHeaders })

    const prompt = `You are an expert resume writer and ATS optimization specialist. Rewrite the candidate's resume to be tailored for this specific job posting, while preserving the FULL content and structure of the original. This is a rewrite for tone, emphasis, and keywords — NOT a summary.

JOB TARGET:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'Not specified'}

ORIGINAL RESUME:
${resume_text}

CRITICAL RULES — do not violate these:
1. Do NOT omit, drop, merge, or condense away any job, role, internship, project, certification, degree, or skill that appears in the original resume. Every single entry in the original must also appear in the output.
2. Do NOT shorten the resume overall. If a job in the original has 4 bullet points, your rewritten version of that job must also have around 4 bullet points — not 1 or 2. Match the original's level of detail and length, section by section.
3. Do NOT fabricate anything — only rephrase, reorder, and re-emphasize real content that is already present in the original resume.
4. You MAY reorder sections and bullet points to put the most relevant experience first, and you MAY rephrase wording to naturally include keywords from the job title/description — but every original section and entry must still be present somewhere in the output.
5. Use strong, quantified action verbs when rephrasing — but do not invent numbers or facts that aren't implied by the original text.
6. Ensure the resume is ATS-friendly: clean structure, standard section headers, no tables or multi-column layouts.
7. Return ONLY clean HTML (no markdown, no code blocks, no commentary before or after the HTML).
8. Use these HTML elements: <h1> for name, <h2> for section headers, <h3> for job titles/company/degree, <p> for summary or paragraph text, <ul><li> for bullet points.

Before returning your answer, re-check it against the original resume: does every job, degree, certification, and skill from the original still appear in your output? If anything is missing, add it back before responding.

Return only the HTML content, starting with <h1>:`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${profile.groq_key_encrypted}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 6000,
        temperature: 0.3,
      })
    })

    const groqData = await groqRes.json()
    if (!groqRes.ok) throw new Error(classifyGroqError(groqRes.status, groqData))

    if (groqData.choices[0].finish_reason === 'length') {
      throw new Error('The customized resume was cut off because it hit the AI\'s output limit. Please try again — if this keeps happening, your master resume may be too long for a single rewrite.')
    }

    let htmlContent = groqData.choices[0].message.content.trim()
    // Strip any accidental markdown code fences
    htmlContent = htmlContent.replace(/^```html?\n?/, '').replace(/\n?```$/, '').trim()

    // Save to DB
    const newBalance = profile.wallet_credits - cost
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: customized } = await supabase.from('customized_resumes').insert({
      user_id: user.id,
      job_result_id,
      resume_id: resume.id,
      original_file_path: resume.file_path,
      customized_content: htmlContent,
      expires_at: expiresAt,
      credits_charged: cost,
    }).select().single()

    // Deduct credits
    if (cost > 0) {
      await supabase.from('profiles').update({ wallet_credits: newBalance }).eq('id', user.id)
      await supabase.from('credit_ledger').insert({
        user_id: user.id, type: 'customize', amount: -cost,
        balance_after: newBalance, reference_id: job_result_id
      })
    }

    return Response.json({ customized }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('customize-resume error:', err)
    return Response.json({ error: err.message }, { headers: corsHeaders })
  }
})
