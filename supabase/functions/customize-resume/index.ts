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

    const prompt = `You are an expert resume writer and ATS optimization specialist. Rewrite the candidate's resume to be perfectly tailored for this specific job posting.

JOB TARGET:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'Not specified'}

ORIGINAL RESUME:
${resume_text}

INSTRUCTIONS:
1. Keep ALL real experience, education, and skills — do not fabricate anything
2. Reorder and emphasize sections to highlight most relevant experience first
3. Rewrite bullet points to use keywords from the job title and context
4. Use strong action verbs and quantify achievements where possible
5. Ensure the resume is ATS-friendly
6. Return ONLY clean HTML (no markdown, no code blocks)
7. Use these HTML elements: <h1> for name, <h2> for sections, <h3> for job titles, <p> and <ul><li> for content

Return only the HTML content, starting with <h1>:`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${profile.groq_key_encrypted}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.3,
      })
    })

    const groqData = await groqRes.json()
    if (!groqRes.ok) throw new Error(groqData?.error?.message ?? 'Groq API error')

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
