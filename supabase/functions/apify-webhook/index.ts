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
      await checkAndCompleteRun(supabase, runId)
      return new Response('ok', { status: 200 })
    }

    // Log available fields once per run so we can confirm the actor's actual
    // description field name from function logs if the guesses below are wrong.
    if (items.length > 0) {
      console.log('Sample dataset item keys:', Object.keys(items[0]))
    }

    console.log(`Run ${runId}: Apify dataset returned ${items.length} raw items`)

    // Insert job results
    const toInsert = items
      .map((item: any) => ({ ...item, _resolvedCompany: item.company ?? item.companyName ?? item.company_name ?? '' }))
      .filter((item: any) => item.title && item._resolvedCompany)
      .map((item: any) => ({
        run_id: runId,
        user_id: run.user_id,
        // If the actor tags each item with its real source (relevant for the
        // dedicated "All Platforms" actor, which may pull from more than one
        // site per run), preserve that; otherwise fall back to the run's
        // platform tag, matching single-source actor behavior. Lowercased —
        // the multiplatform actor tags items "LinkedIn"/"Naukri" (Title Case),
        // which doesn't match the search_platform enum's lowercase values and
        // would otherwise fail the entire batch insert.
        platform: (item.platform ?? item.source ?? platform).toLowerCase(),
        title: item.title ?? '',
        company: item._resolvedCompany,
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

    console.log(`Run ${runId}: inserting ${toInsert.length} of ${items.length} items after title/company filtering`)

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('job_results').insert(toInsert)
      if (insertError) throw new Error(`job_results insert failed: ${insertError.message}`)
    }

    await checkAndCompleteRun(supabase, runId)
    return new Response('ok', { status: 200 })

  } catch (err: any) {
    console.error('apify-webhook error:', err)
    await supabase.from('job_runs').update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() }).eq('id', runId)
    return new Response('error', { status: 500 })
  }
})

async function checkAndCompleteRun(supabase: any, runId: string) {
  const { count } = await supabase.from('job_results').select('id', { count: 'exact' }).eq('run_id', runId)

  // Get current run
  const { data: run } = await supabase.from('job_runs').select('*').eq('id', runId).single()
  if (!run) return

  // Every platform — including "all", which now calls its own single
  // dedicated multi-platform actor — fires exactly one webhook per run, so
  // there's nothing to wait on beyond that one call completing.
  await supabase.from('job_runs').update({
    status: 'completed',
    result_count: count ?? 0,
    completed_at: new Date().toISOString(),
  }).eq('id', runId)
}
