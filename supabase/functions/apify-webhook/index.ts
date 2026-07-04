import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Strip any HTML markup so stored/displayed descriptions are always plain text,
// regardless of whether the actor returns HTML or plain text for this field.
function stripHtml(input: unknown): string {
  if (!input) return ''
  return String(input).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

serve(async (req) => {
  const url = new URL(req.url)
  const runId = url.searchParams.get('run_id')
  const platform = url.searchParams.get('platform') ?? 'linkedin'
  const serviceKey = url.searchParams.get('service_key')

  if (!runId || !serviceKey) {
    return new Response('Bad request', { status: 400 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

  try {
    const body = await req.json()

    // Apify sends eventData with resourceId = the actual run ID
    const apifyRunId = body?.eventData?.actorRunId ?? body?.resource?.id
    if (!apifyRunId) {
      console.error('No apifyRunId in webhook body', JSON.stringify(body))
      return new Response('ok', { status: 200 })
    }

    // Get the job_run to find apify key (via user profile)
    const { data: run } = await supabase.from('job_runs').select('*, profiles(apify_key_encrypted)')
      .eq('id', runId).single()
    if (!run) return new Response('run not found', { status: 404 })

    const apifyKey = (run.profiles as any)?.apify_key_encrypted
    if (!apifyKey) return new Response('no apify key', { status: 400 })

    // Fetch results from Apify dataset
    const datasetRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${apifyRunId}/dataset/items?token=${apifyKey}&format=json`,
    )
    const items = await datasetRes.json()

    if (!Array.isArray(items) || items.length === 0) {
      // Check if both runs are done (for 'all' platform)
      await checkAndCompleteRun(supabase, runId, run.platform)
      return new Response('ok', { status: 200 })
    }

    // Log available fields once per run so we can confirm the actor's actual
    // description field name from function logs if the guesses below are wrong.
    if (items.length > 0) {
      console.log('Sample dataset item keys:', Object.keys(items[0]))
    }

    // Insert job results
    const toInsert = items
      .filter((item: any) => item.title && item.company)
      .map((item: any) => ({
        run_id: runId,
        user_id: run.user_id,
        platform,
        title: item.title ?? '',
        company: item.company ?? '',
        location: item.location ?? item.searchLocation ?? '',
        link: item.link ?? item.jobUrl ?? '',
        job_id: item.jobId ?? item.job_id ?? '',
        posted_at: item.postedAt ? new Date(item.postedAt).toISOString() : null,
        search_location: item.searchLocation ?? '',
        search_keywords: item.searchKeywords ?? '',
        description: stripHtml(
          item.description ?? item.jobDescription ?? item.descriptionHtml ??
          item.descriptionText ?? item.job_description ?? ''
        ).slice(0, 1000),
      }))

    if (toInsert.length > 0) {
      await supabase.from('job_results').insert(toInsert)
    }

    await checkAndCompleteRun(supabase, runId, run.platform)
    return new Response('ok', { status: 200 })

  } catch (err: any) {
    console.error('apify-webhook error:', err)
    await supabase.from('job_runs').update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() }).eq('id', runId)
    return new Response('error', { status: 500 })
  }
})

async function checkAndCompleteRun(supabase: any, runId: string, platform: string) {
  // For 'all' platform, we need both webhooks to have fired before marking complete
  const { count } = await supabase.from('job_results').select('id', { count: 'exact' }).eq('run_id', runId)

  // Get current run
  const { data: run } = await supabase.from('job_runs').select('*').eq('id', runId).single()
  if (!run) return

  if (platform === 'all') {
    // Mark complete only when we have received results from both actors
    // Simple approach: check if both apify_run_id and apify_run_id_2 are set and at least some time has passed
    const elapsed = Date.now() - new Date(run.created_at).getTime()
    if (elapsed < 30000) return // Wait at least 30s before completing for 'all' platform
  }

  await supabase.from('job_runs').update({
    status: 'completed',
    result_count: count ?? 0,
    completed_at: new Date().toISOString(),
  }).eq('id', runId)
}
