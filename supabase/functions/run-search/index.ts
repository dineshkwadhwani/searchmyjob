import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINKEDIN_ACTOR = 'dineshwadhwani/linkedin-jobs-scraper'
const NAUKRI_ACTOR   = 'dineshwadhwani/naukri-job-scrapper'

const NAUKRI_TIME_MAP: Record<string, string> = {
  r86400: '1', r172800: '2', r604800: '7', r1296000: '15'
}

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
  let run: { id: string } | null = null

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders })

    // Get profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile?.is_enabled) return Response.json({ error: 'Account disabled' }, { headers: corsHeaders })
    if (!profile.apify_key_encrypted) return Response.json({ error: 'No Apify key configured' }, { headers: corsHeaders })

    // Get search config
    const { config_id } = await req.json()
    if (!config_id) return Response.json({ error: 'config_id required' }, { headers: corsHeaders })
    const { data: config } = await supabase.from('search_config').select('*')
      .eq('id', config_id).eq('user_id', user.id).single()
    if (!config) return Response.json({ error: 'Search config not found' }, { headers: corsHeaders })

    // Check premium credits
    const { data: features } = await supabase.from('feature_config').select('*')
    const allPlatformFeature = features?.find((f: any) => f.feature === 'all_platforms')
    const searchFeature = features?.find((f: any) => f.feature === 'search')

    if (config.platform === 'all' && allPlatformFeature && !allPlatformFeature.is_enabled) {
      return Response.json({ error: 'Searching all platforms at once is currently disabled' }, { headers: corsHeaders })
    }

    let totalCost = searchFeature?.credit_cost ?? 0
    if (config.platform === 'all') {
      totalCost += allPlatformFeature?.credit_cost ?? 0
      if (profile.wallet_credits < totalCost) {
        return Response.json({ error: `Insufficient credits. Need ${totalCost}, have ${profile.wallet_credits}` }, { headers: corsHeaders })
      }
    }

    // Create job_run record
    const { data: newRun } = await supabase.from('job_runs').insert({
      user_id: user.id,
      search_config_id: config.id,
      status: 'running',
      platform: config.platform,
      credits_charged: totalCost,
    }).select().single()
    run = newRun

    const apifyKey = profile.apify_key_encrypted
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apify-webhook`

    // Build actor input
    const linkedinInput = {
      roles: config.job_titles,
      skills: config.skills ?? [],
      locations: config.locations,
      timeFrame: config.time_frame,
    }

    const naukriInput = {
      roles: config.job_titles,
      skills: config.skills ?? [],
      locations: config.locations,
      timeFrame: NAUKRI_TIME_MAP[config.time_frame] ?? '1',
    }

    async function startActor(actorId: string, input: object): Promise<string> {
      const platform = actorId.includes('naukri') ? 'naukri' : 'linkedin'
      const webhooks = [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
        requestUrl: `${webhookUrl}?run_id=${run.id}&platform=${platform}&service_key=${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      }]
      const webhooksParam = encodeURIComponent(btoa(JSON.stringify(webhooks)))

      const res = await fetch(
        `https://api.apify.com/v2/acts/${actorId.replace('/', '~')}/runs?webhooks=${webhooksParam}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apifyKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? 'Apify call failed')
      return data.data.id
    }

    // Start actor(s)
    let apifyRunId: string | null = null
    let apifyRunId2: string | null = null

    if (config.platform === 'linkedin' || config.platform === 'all') {
      apifyRunId = await startActor(LINKEDIN_ACTOR, linkedinInput)
    }
    if (config.platform === 'naukri' || config.platform === 'all') {
      apifyRunId2 = await startActor(NAUKRI_ACTOR, naukriInput)
    }

    // Update run with apify IDs
    await supabase.from('job_runs').update({
      apify_run_id: apifyRunId,
      apify_run_id_2: apifyRunId2,
    }).eq('id', run.id)

    // Deduct credits
    if (totalCost > 0) {
      const newBalance = profile.wallet_credits - totalCost
      await supabase.from('profiles').update({ wallet_credits: newBalance }).eq('id', user.id)
      await supabase.from('credit_ledger').insert({
        user_id: user.id, type: 'search', amount: -totalCost,
        balance_after: newBalance, reference_id: run.id
      })
    }

    return Response.json({ run_id: run.id, apify_run_id: apifyRunId }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('run-search error:', err)
    if (run?.id) {
      await supabase.from('job_runs').update({
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString(),
      }).eq('id', run.id)
    }
    return Response.json({ error: err.message }, { headers: corsHeaders })
  }
})
