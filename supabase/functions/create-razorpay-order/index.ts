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

    const { amount_paise, credits } = await req.json()
    if (!amount_paise || !credits) return Response.json({ error: 'amount_paise and credits required' }, { headers: corsHeaders })

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const credentials = btoa(`${keyId}:${keySecret}`)

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount_paise, currency: 'INR', receipt: `credits_${user.id}_${Date.now()}` })
    })

    const order = await orderRes.json()
    if (!orderRes.ok) throw new Error(order?.error?.description ?? 'RazorPay order creation failed')

    // Store order in DB
    await supabase.from('razorpay_orders').insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      amount_paise,
      credits_to_add: credits,
      status: 'created',
    })

    return Response.json({ razorpay_order_id: order.id }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('create-razorpay-order error:', err)
    return Response.json({ error: err.message }, { headers: corsHeaders })
  }
})
