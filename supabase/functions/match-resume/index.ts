import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const matchFeature = features?.find((f: any) => f.feature === 'match')
    if (matchFeature && !matchFeature.is_enabled) {
      return Response.json({ error: 'Resume matching is currently disabled' }, { headers: corsHeaders })
    }
    const cost = matchFeature?.credit_cost ?? 5

    if (profile.wallet_credits < cost) {
      return Response.json({ error: `Need ${cost} credits. Balance: ${profile.wallet_credits}` }, { headers: corsHeaders })
    }

    // Get job
    const { data: job } = await supabase.from('job_results').select('*').eq('id', job_result_id).single()
    if (!job) return Response.json({ error: 'Job not found' }, { headers: corsHeaders })

    // Get active resume
    const { data: resume } = await supabase.from('resumes').select('*').eq('user_id', user.id).eq('is_active', true).single()
    if (!resume) return Response.json({ error: 'No active resume found' }, { headers: corsHeaders })

    // Call Groq
    const prompt = `You are an expert ATS resume analyst. Analyze this resume against the job description and return ONLY valid JSON.

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'Not specified'}

RESUME TEXT:
${resume_text}

Return this exact JSON structure (no markdown, no extra text):
{
  "match_score": <integer 0-100>,
  "match_summary": "<2-3 sentence summary of fit>",
  "matched_skills": ["skill1", "skill2", "skill3"],
  "missing_skills": ["skill1", "skill2", "skill3"],
  "recommendation": "<one actionable sentence>"
}`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${profile.groq_key_encrypted}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.1,
      })
    })

    const groqData = await groqRes.json()
    if (!groqRes.ok) throw new Error(groqData?.error?.message ?? 'Groq API error')

    const raw = groqData.choices[0].message.content.trim()
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

    // Save match result
    const newBalance = profile.wallet_credits - cost
    const { data: matchResult } = await supabase.from('match_results').upsert({
      user_id: user.id,
      job_result_id,
      resume_id: resume.id,
      match_score: Math.min(100, Math.max(0, parsed.match_score)),
      match_summary: parsed.match_summary,
      matched_skills: parsed.matched_skills ?? [],
      missing_skills: parsed.missing_skills ?? [],
      credits_charged: cost,
    }, { onConflict: 'user_id,job_result_id,resume_id' }).select().single()

    // Deduct credits
    if (cost > 0) {
      await supabase.from('profiles').update({ wallet_credits: newBalance }).eq('id', user.id)
      await supabase.from('credit_ledger').insert({
        user_id: user.id, type: 'match', amount: -cost,
        balance_after: newBalance, reference_id: job_result_id
      })
    }

    return Response.json({ match: matchResult, recommendation: parsed.recommendation }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('match-resume error:', err)
    return Response.json({ error: err.message }, { headers: corsHeaders })
  }
})
