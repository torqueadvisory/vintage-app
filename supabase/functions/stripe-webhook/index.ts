// Stripe SDK is used only for local webhook-signature verification below
// (pure HMAC, no network call) — it is NOT used for any actual Stripe API
// call. The SDK's own HTTP client fails on this specific edge runtime
// (constructing its request headers throws "not a valid ByteString", a
// runtime-vs-SDK incompatibility unrelated to our code or the API key), so
// every real Stripe API call here goes through plain fetch() instead, via
// stripeRequest() below.
import Stripe from 'npm:stripe@14.25.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function stripeRequest(method: string, path: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Stripe API error (${res.status})`)
  return data
}

async function findProductBySlug(slug: string | undefined) {
  if (!slug) return null
  const { data, error } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle()
  if (error) {
    console.error('product lookup failed:', error)
    return null
  }
  return data
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const product = await findProductBySlug(session.metadata?.product_slug)
      if (!product) {
        console.error('checkout.session.completed: unknown product_slug', session.metadata?.product_slug)
        break
      }

      const customerEmail = session.customer_details?.email ?? session.customer_email ?? ''
      const userId = session.metadata?.supabase_user_id || session.client_reference_id || null

      if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripeRequest('GET', `subscriptions/${session.subscription}`)
        const { error } = await supabase.from('purchases').upsert(
          {
            user_id: userId,
            customer_email: customerEmail,
            product_id: product.id,
            stripe_customer_id:
              typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
            stripe_checkout_session_id: session.id,
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
          },
          { onConflict: 'stripe_checkout_session_id' },
        )
        if (error) console.error('subscription checkout upsert failed:', error)
      } else {
        const { error } = await supabase.from('purchases').upsert(
          {
            user_id: userId,
            customer_email: customerEmail,
            product_id: product.id,
            stripe_customer_id:
              typeof session.customer === 'string' ? session.customer : session.customer?.id,
            stripe_checkout_session_id: session.id,
            status: 'completed',
          },
          { onConflict: 'stripe_checkout_session_id' },
        )
        if (error) console.error('one-time purchase upsert failed:', error)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const { error } = await supabase
        .from('purchases')
        .update({
          status: sub.status,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        })
        .eq('stripe_subscription_id', sub.id)

      if (error) console.error('customer.subscription.updated update failed:', error)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const { error } = await supabase
        .from('purchases')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', sub.id)

      if (error) console.error('customer.subscription.deleted update failed:', error)
      break
    }

    default:
      break
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
