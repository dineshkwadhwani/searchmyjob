import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Source of truth for pricing — must mirror CREDIT_PACKAGES in src/lib/constants.ts.
// Never trust amount/credits supplied by the client; look them up here instead.
const CREDIT_PACKAGES: Record<string, { credits: number; amountPaise: number }> = {
  explorer:  { credits: 10,  amountPaise: 10000 },
  seeker:    { credits: 25,  amountPaise: 23750 },
  contender: { credits: 50,  amountPaise: 45000 },
  achiever:  { credits: 100, amountPaise: 85000 },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders })

    const { data: walletFeature } = await supabase.from('feature_config').select('is_enabled').eq('feature', 'wallet').single()
    if (walletFeature && !walletFeature.is_enabled) {
      return Response.json({ error: 'Credit top-ups are temporarily unavailable. Please try again later.' }, { headers: corsHeaders })
    }

    const { package: packageId } = await req.json()
    const pkg = CREDIT_PACKAGES[packageId]
    if (!pkg) return Response.json({ error: 'Unknown credit package' }, { headers: corsHeaders })

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const credentials = btoa(`${keyId}:${keySecret}`)

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: pkg.amountPaise, currency: 'INR', receipt: `c_${Date.now()}_${user.id.slice(0, 8)}` })
    })

    const order = await orderRes.json()
    if (!orderRes.ok) throw new Error(order?.error?.description ?? 'RazorPay order creation failed')

    // Store order in DB
    await supabase.from('razorpay_orders').insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      amount_paise: pkg.amountPaise,
      credits_to_add: pkg.credits,
      status: 'created',
    })

    return Response.json({ razorpay_order_id: order.id, amount_paise: pkg.amountPaise }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('create-razorpay-order error:', err)
    return Response.json({ error: err.message }, { headers: corsHeaders })
  }
})
