import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Fallbacks only — the source of truth is the actor_config table, editable
// from the Super Admin "Actor Configuration" page without a deployment.
const DEFAULT_ACTORS: Record<string, string> = {
  linkedin: 'dineshwadhwani/linkedin-jobs-scraper',
  naukri:   'dineshwadhwani/naukri-job-scrapper',
  indeed:   'dineshwadhwani/indeed-job-scrapper',
  all:      'dineshwadhwani/multiplatform-job-scrapper',
}

const NAUKRI_TIME_MAP: Record<string, string> = {
  r86400: '1', r172800: '2', r604800: '7', r1296000: '15'
}

// Indeed's actor only supports 1/3/7/14-day windows (no exact 2 or 15 day
// option) — round UP to the next-widest bucket so we never under-collect
// recent listings just because the exact day count isn't offered.
const INDEED_TIME_MAP: Record<string, string> = {
  r86400: '1', r172800: '3', r604800: '7', r1296000: '14'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Turn a raw Apify error into a message the user can actually act on.
// Falls back to an optimistic "check your account" message for anything
// we can't confidently classify, rather than showing raw API text.
function classifyApifyError(status: number, data: any): string {
  const raw = data?.error?.message ?? ''
  const isFundsIssue = status === 402 || /credit|insufficient|payment|fund|balance|exceeded.*usage|out of/i.test(raw)
  if (isFundsIssue) {
    return 'Your Apify account appears to be out of funds. Please check your Apify account balance and add credit, then try again.'
  }
  return `We couldn't start your search via Apify. Please check your Apify account budget and that your API key hasn't expired, then try again.${raw ? ` (Apify said: ${raw})` : ''}`
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
    const searchFeature = features?.find((f: any) => f.feature === 'search')
    const allPlatformFeature = features?.find((f: any) => f.feature === 'all_platforms')
    const indeedFeature = features?.find((f: any) => f.feature === 'indeed')

    if (config.platform === 'all' && allPlatformFeature && !allPlatformFeature.is_enabled) {
      return Response.json({ error: 'Searching all platforms at once is currently disabled' }, { headers: corsHeaders })
    }
    if (config.platform === 'indeed' && indeedFeature && !indeedFeature.is_enabled) {
      return Response.json({ error: 'Searching Indeed is currently disabled' }, { headers: corsHeaders })
    }

    let totalCost = searchFeature?.credit_cost ?? 0
    if (config.platform === 'all') totalCost += allPlatformFeature?.credit_cost ?? 0
    if (config.platform === 'indeed') totalCost += indeedFeature?.credit_cost ?? 0
    if ((config.platform === 'all' || config.platform === 'indeed') && profile.wallet_credits < totalCost) {
      return Response.json({ error: `Insufficient credits. Need ${totalCost}, have ${profile.wallet_credits}` }, { headers: corsHeaders })
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

    // Actor IDs come from actor_config (Super Admin → Actor Configuration),
    // falling back to hardcoded defaults only if a row is somehow missing.
    const { data: actorRows } = await supabase.from('actor_config').select('*')
    function actorFor(platform: string): string {
      return actorRows?.find((a: any) => a.platform === platform)?.actor_id ?? DEFAULT_ACTORS[platform]
    }

    // Every platform — including "all", which now calls its own dedicated
    // multi-platform actor rather than orchestrating LinkedIn + Naukri calls
    // and merging — is a single actor call.
    const baseFields = {
      roles: config.job_titles,
      skills: config.skills ?? [],
      locations: config.locations,
    }
    const inputByPlatform: Record<string, object> = {
      linkedin: { ...baseFields, timeFrame: config.time_frame },
      naukri:   { ...baseFields, timeFrame: NAUKRI_TIME_MAP[config.time_frame] ?? '1' },
      indeed:   { ...baseFields, timeFrame: INDEED_TIME_MAP[config.time_frame] ?? '1', maxJobs: 100 },
      // Best-guess input shape for the dedicated "All Platforms" actor —
      // its exact contract hasn't been confirmed against real output yet.
      all:      { ...baseFields, timeFrame: config.time_frame },
    }

    async function startActor(actorId: string, input: object, platform: string): Promise<string> {
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
      if (!res.ok) throw new Error(classifyApifyError(res.status, data))
      return data.data.id
    }

    const apifyRunId = await startActor(actorFor(config.platform), inputByPlatform[config.platform], config.platform)

    // Update run with the apify ID
    await supabase.from('job_runs').update({
      apify_run_id: apifyRunId,
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
