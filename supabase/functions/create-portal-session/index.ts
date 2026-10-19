import { createClient } from 'npm:@supabase/supabase-js@2'

// Opens a Stripe Customer Portal session for the signed-in subscriber, so they
// can cancel, change their card, or download invoices entirely self-serve.
// Online-cancellation is a legal requirement for subscriptions sold online
// (ROSCA; Cal. Bus. & Prof. Code 17602), not just good manners.
//
// Stripe is called with plain fetch, not the SDK -- the SDK's HTTP client
// breaks on this edge runtime (see create-checkout-session for the history).

async function stripeRequest(method: string, path: string, body?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
  }
  if (body) init.body = new URLSearchParams(body).toString()

  const res = await fetch(`https://api.stripe.com/v1/${path}`, init)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `Stripe API error (${res.status})`)
  }
  return data
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const ALLOWED_ORIGINS = [
  'https://torqueadvisorygroup.com',
  'https://www.torqueadvisorygroup.com',
  'https://vintage-tracker.netlify.app',
]

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Sign in first.' }), { status: 401, headers })
    }

    // A client scoped to the caller's own session: RLS on `purchases` decides
    // what they can see, so no service-role key is needed here.
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: userData } = await supabaseUser.auth.getUser(token)
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Sign in first.' }), { status: 401, headers })
    }

    const { data: purchase, error: lookupError } = await supabaseUser
      .from('purchases')
      .select('stripe_customer_id, products!inner(product_type)')
      .eq('products.product_type', 'subscription')
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!purchase?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No subscription found for this account.' }),
        { status: 404, headers },
      )
    }

    const { return_url: returnUrl } = await req.json().catch(() => ({}))
    const session = await stripeRequest('POST', 'billing_portal/sessions', {
      customer: purchase.stripe_customer_id,
      return_url:
        typeof returnUrl === 'string' && ALLOWED_ORIGINS.some((o) => returnUrl.startsWith(o))
          ? returnUrl
          : 'https://vintage-tracker.netlify.app',
    })

    return new Response(JSON.stringify({ url: session.url }), { headers })
  } catch (err) {
    console.error('create-portal-session failed:', err)
    return new Response(
      JSON.stringify({ error: 'Could not open billing management. Try again in a moment.' }),
      { status: 500, headers },
    )
  }
})
