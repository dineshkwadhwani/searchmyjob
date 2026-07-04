import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

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

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json({ error: 'Missing payment verification fields' }, { headers: corsHeaders })
    }

    // Razorpay signs order_id|payment_id with the Key Secret. Verifying this
    // server-side proves the payment genuinely happened — the client can't
    // forge a valid signature without knowing the secret.
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const expectedSignature = createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')
    if (expectedSignature !== razorpay_signature) {
      return Response.json({ error: 'Payment signature verification failed' }, { headers: corsHeaders })
    }

    const { data: order } = await supabase.from('razorpay_orders').select('*')
      .eq('razorpay_order_id', razorpay_order_id).eq('user_id', user.id).single()
    if (!order) return Response.json({ error: 'Order not found' }, { headers: corsHeaders })

    if (order.status === 'paid') {
      return Response.json({ success: true }, { headers: corsHeaders })
    }

    const { data: profile } = await supabase.from('profiles').select('wallet_credits').eq('id', user.id).single()
    const newBalance = (profile?.wallet_credits ?? 0) + order.credits_to_add

    await supabase.from('profiles').update({ wallet_credits: newBalance }).eq('id', user.id)
    await supabase.from('credit_ledger').insert({
      user_id: user.id,
      type: 'topup',
      amount: order.credits_to_add,
      balance_after: newBalance,
      reference_id: razorpay_order_id,
      note: `Razorpay payment ${razorpay_payment_id}`,
    })
    await supabase.from('razorpay_orders').update({
      status: 'paid',
      razorpay_payment_id,
      confirmed_at: new Date().toISOString(),
    }).eq('razorpay_order_id', razorpay_order_id)

    return Response.json({ success: true }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('verify-razorpay-payment error:', err)
    return Response.json({ error: err.message }, { headers: corsHeaders })
  }
})
