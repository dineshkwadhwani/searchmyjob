import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature')
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!

    // Verify signature
    const expectedSig = createHmac('sha256', secret).update(body).digest('hex')
    if (expectedSig !== signature) {
      return new Response('Invalid signature', { status: 400 })
    }

    const event = JSON.parse(body)
    if (event.event !== 'payment.captured') return new Response('ok', { status: 200 })

    const payment = event.payload.payment.entity
    const orderId = payment.order_id

    // Find the order
    const { data: order } = await supabase.from('razorpay_orders').select('*').eq('razorpay_order_id', orderId).single()
    if (!order || order.status === 'paid') return new Response('ok', { status: 200 })

    // Add credits to user
    const { data: profile } = await supabase.from('profiles').select('wallet_credits').eq('id', order.user_id).single()
    const newBalance = (profile?.wallet_credits ?? 0) + order.credits_to_add

    await supabase.from('profiles').update({ wallet_credits: newBalance }).eq('id', order.user_id)
    await supabase.from('credit_ledger').insert({
      user_id: order.user_id,
      type: 'topup',
      amount: order.credits_to_add,
      balance_after: newBalance,
      reference_id: orderId,
      note: `Razorpay payment ${payment.id}`,
    })
    await supabase.from('razorpay_orders').update({
      status: 'paid',
      razorpay_payment_id: payment.id,
      confirmed_at: new Date().toISOString(),
    }).eq('razorpay_order_id', orderId)

    return new Response('ok', { status: 200 })

  } catch (err: any) {
    console.error('razorpay-webhook error:', err)
    return new Response('error', { status: 500 })
  }
})
