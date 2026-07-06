import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const authHeader = req.headers.get('Authorization')!
    const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })

    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders })
    }

    const { user_id } = await req.json()
    if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400, headers: corsHeaders })

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user_id).single()
    if (!profile) return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })

    const [resumeRes, configRes, appliedRes, customizedRes] = await Promise.all([
      supabase.from('resumes').select('id').eq('user_id', user_id).eq('is_active', true).maybeSingle(),
      supabase.from('search_config').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
      supabase.from('job_results').select('id', { count: 'exact', head: true }).eq('user_id', user_id).eq('is_applied', true),
      supabase.from('customized_resumes').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
    ])

    return Response.json({
      email: profile.email,
      apify: !!profile.apify_key_encrypted,
      groq: !!profile.groq_key_encrypted,
      resume: !!resumeRes.data,
      searchConfig: (configRes.count ?? 0) > 0,
      wallet: profile.wallet_credits,
      appliedCount: appliedRes.count ?? 0,
      customizedCount: customizedRes.count ?? 0,
    }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('admin-user-status error:', err)
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders })
  }
})
