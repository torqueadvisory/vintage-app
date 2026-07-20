import { createClient } from 'npm:@supabase/supabase-js@2'

// The Stripe Node SDK's own HTTP client fails on this specific edge runtime
// (constructing its request headers throws "not a valid ByteString", a
// runtime-vs-SDK incompatibility unrelated to any of our code or the API
// key). Calling Stripe's REST API directly with plain fetch() sidesteps the
// SDK's HTTP layer entirely and works fine, so that's what every Stripe call
// in this project's Edge Functions does instead of using the SDK client.
function flattenToParams(obj: Record<string, unknown>, params = new URLSearchParams(), prefix = ''): URLSearchParams {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue
    const paramKey = prefix ? `${prefix}[${key}]` : key
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === 'object') {
          flattenToParams(item as Record<string, unknown>, params, `${paramKey}[${i}]`)
        } else {
          params.append(`${paramKey}[${i}]`, String(item))
        }
      })
    } else if (typeof value === 'object') {
      flattenToParams(value as Record<string, unknown>, params, paramKey)
    } else {
      params.append(paramKey, String(value))
    }
  }
  return params
}

async function stripeRequest(method: string, path: string, body?: Record<string, unknown>) {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
  }
  if (body) init.body = flattenToParams(body).toString()

  const res = await fetch(`https://api.stripe.com/v1/${path}`, init)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `Stripe API error (${res.status})`)
  }
  return data
}

// Service-role client: needed because `products` has RLS enabled with no
// client policies at all (see supabase/migrations/) — only this function is
// meant to ever read the product catalog.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Anon-key client, used only to verify a caller-supplied access token when
// present (guest calls from the marketing site won't send one at all).
const supabaseAnon = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
)

// Production origins allowed to call this function directly from a browser.
// The localhost/LAN allowance used during development was removed at go-live
// (2026-07-17) -- re-add temporarily if local checkout testing is ever needed.
const ALLOWED_ORIGINS = [
  'https://torqueadvisorygroup.com',
  'https://www.torqueadvisorygroup.com',
  'https://vintage-tracker.netlify.app',
]

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false
  return ALLOWED_ORIGINS.includes(origin)
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : 'null',
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
    const { product_slug, success_url, cancel_url, email } = await req.json()

    if (!product_slug || !success_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: 'product_slug, success_url, and cancel_url are required' }),
        { status: 400, headers },
      )
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('slug', product_slug)
      .eq('is_active', true)
      .maybeSingle()

    if (productError || !product) {
      return new Response(JSON.stringify({ error: 'Unknown or inactive product' }), {
        status: 404,
        headers,
      })
    }

    let userId: string | null = null
    let userEmail: string | undefined
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '')
      const { data } = await supabaseAnon.auth.getUser(token)
      if (data.user) {
        userId = data.user.id
        userEmail = data.user.email ?? undefined
      }
    }

    if (product.requires_account && !userId) {
      return new Response(JSON.stringify({ error: 'This product requires an account' }), {
        status: 401,
        headers,
      })
    }

    const metadata = {
      product_slug,
      supabase_user_id: userId ?? '',
    }

    const session = await stripeRequest('POST', 'checkout/sessions', {
      mode: product.product_type === 'subscription' ? 'subscription' : 'payment',
      line_items: [{ price: product.stripe_price_id, quantity: 1 }],
      success_url,
      cancel_url,
      customer_email: userEmail ?? email ?? undefined,
      metadata,
      ...(product.product_type === 'subscription'
        ? { subscription_data: { trial_period_days: 14, metadata } }
        : {}),
    })

    return new Response(JSON.stringify({ url: session.url }), { headers })
  } catch (err) {
    console.error('create-checkout-session failed:', err)
    return new Response(JSON.stringify({ error: 'Could not create checkout session' }), {
      status: 500,
      headers,
    })
  }
})
