import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { key } = await req.json()
    if (!key) return Response.json({ valid: false, error: 'Key required' }, { headers: corsHeaders })

    const res = await fetch('https://api.apify.com/v2/users/me', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      return Response.json({ valid: false, error: `Apify rejected the key (HTTP ${res.status})` }, { headers: corsHeaders })
    }

    const data = await res.json()
    return Response.json({ valid: true, username: data?.data?.username }, { headers: corsHeaders })

  } catch (err: any) {
    return Response.json({ valid: false, error: err.message }, { headers: corsHeaders })
  }
})
