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

    const { resume_text } = await req.json()
    if (!resume_text) return Response.json({ error: 'resume_text required' }, { headers: corsHeaders })

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile?.is_enabled) return Response.json({ error: 'Account disabled' }, { headers: corsHeaders })
    if (!profile.groq_key_encrypted) return Response.json({ error: 'No Groq key configured' }, { headers: corsHeaders })

    const { data: features } = await supabase.from('feature_config').select('*')
    const atsFeature = features?.find((f: any) => f.feature === 'ats_evaluator')
    if (atsFeature && !atsFeature.is_enabled) {
      return Response.json({ error: 'The ATS Resume Evaluator is currently disabled' }, { headers: corsHeaders })
    }
    const rewriteFeature = features?.find((f: any) => f.feature === 'ats_rewrite')
    if (rewriteFeature && !rewriteFeature.is_enabled) {
      return Response.json({ error: 'Resume rewrite is currently disabled' }, { headers: corsHeaders })
    }
    const cost = rewriteFeature?.credit_cost ?? 5

    if (profile.wallet_credits < cost) {
      return Response.json({ error: `Need ${cost} credits. Balance: ${profile.wallet_credits}` }, { headers: corsHeaders })
    }

    const prompt = `You are an ATS resume optimization expert. Rewrite the resume below to be ATS-friendly while preserving the FULL content — this is a rewrite for tone, structure, and keywords, NOT a summary.

ORIGINAL RESUME:
${resume_text}

CRITICAL RULES:
1. Do NOT omit, drop, or condense away any distinct job, role, project, certification, degree, or skill from the original. Every unique entry must still appear in the output.
2. Match the original resume's overall length and page count as closely as possible. Do NOT make it longer — no padding sentences, no filler words, no over-elaborating on points that were already concise. If two bullets describe the same accomplishment or duplicate each other, merge them into one instead of keeping both.
3. Do NOT fabricate anything — only rephrase and reorganize real content already present.
4. Replace weak or passive phrasing with strong action verbs, but keep each bullet roughly the same length as its original — rephrasing should not inflate word count.
5. Add quantifiable metrics only where the original already implies a number without stating it, and only if it doesn't meaningfully add length — never invent specific figures that aren't implied by the original text.
6. Enhance the skills section to surface relevant, general industry keywords already implied by the candidate's experience, without padding it with excessive entries.
7. Ensure the resume is ATS-friendly: clean structure, standard section headers, no tables or multi-column layouts.
8. Fix any inconsistent date formats to a single consistent style.
9. Return ONLY clean HTML (no markdown, no code blocks, no commentary before or after).
10. Use these HTML elements: <h1> for name, <h2> for section headers, <h3> for job titles/company/degree, <p> for summary text, <ul><li> for bullet points.

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
      throw new Error('The rewritten resume was cut off because it hit the AI\'s output limit. Please try again.')
    }

    let htmlContent = groqData.choices[0].message.content.trim()
    htmlContent = htmlContent.replace(/^```html?\n?/, '').replace(/\n?```$/, '').trim()

    const newBalance = profile.wallet_credits - cost
    if (cost > 0) {
      await supabase.from('profiles').update({ wallet_credits: newBalance }).eq('id', user.id)
      await supabase.from('credit_ledger').insert({
        user_id: user.id, type: 'ats_rewrite', amount: -cost, balance_after: newBalance,
        note: 'ATS Resume Evaluator rewrite',
      })
    }

    return Response.json({ rewritten_html: htmlContent, credits_charged: cost }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('ats-rewrite-resume error:', err)
    return Response.json({ error: err.message }, { headers: corsHeaders })
  }
})
