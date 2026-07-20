import { createClient } from 'npm:@supabase/supabase-js@2'

// The Stripe Node SDK's own HTTP client fails on this specific edge runtime
// (constructing its request headers throws "not a valid ByteString", a
// runtime-vs-SDK incompatibility unrelated to our code or the API key), so
// this calls Stripe's REST API directly with plain fetch() instead.
async function stripeRequest(method: string, path: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Stripe API error (${res.status})`)
  return data
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Same allow-list as create-checkout-session — see that file for rationale.
// Localhost/LAN allowance removed at go-live (2026-07-17).
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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Build the "Licensed to ..." line stamped into the footer of each sold copy.
// This is a deterrent, not DRM: the file is still a plain download, but every
// copy visibly carries the buyer's own email, which discourages a dealer from
// passing it around to other rooftops. Replaces the invisible
// <!--LICENSE_WATERMARK--> comment already present in the stored file.
function watermarkHtml(html: string, email: string | undefined) {
  const buyer = email ? escapeHtml(email) : 'a verified purchaser'
  const date = new Date().toISOString().slice(0, 10)
  const line =
    `<span class="foot-license">Licensed to ${buyer} &middot; ` +
    `Single-rooftop use &middot; Purchased ${date}</span>`
  return html.replace('<!--LICENSE_WATERMARK-->', line)
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  try {
    const { session_id } = await req.json()
    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers,
      })
    }

    // Retrieving the session server-side and checking payment_status is the
    // actual security check here — a guest never has a Supabase account or
    // token, so the Stripe session id itself (only known to someone who just
    // completed a real payment) is what proves they're allowed the file.
    const session = await stripeRequest('GET', `checkout/sessions/${session_id}`)
    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ error: 'Payment not completed' }), {
        status: 402,
        headers,
      })
    }

    const buyerEmail: string | undefined =
      session.customer_details?.email ?? session.customer_email ?? undefined

    const productSlug = session.metadata?.product_slug
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('name, slug, storage_path')
      .eq('slug', productSlug)
      .maybeSingle()

    if (productError || !product?.storage_path) {
      return new Response(JSON.stringify({ error: 'No download available for this product' }), {
        status: 404,
        headers,
      })
    }

    // Name the download after the product slug rather than the stored filename
    // -- every product is stored as `<slug>/index.html`, so the stored name
    // would hand every buyer an "index.html". The slug is unique and already
    // filename-safe.
    // NOTE: bucket id is 'digital-Products' (capital P) -- that's how it was
    // created in the Storage UI, and bucket ids are case-sensitive and cannot
    // be renamed, so the code matches it exactly rather than the reverse.
    const ext = (product.storage_path.split('.').pop() || 'html').toLowerCase()
    const filename = `${product.slug}.${ext}`
    const isHtml = ext === 'html' || ext === 'htm'

    // Binary products (the .xlsx analyzer) cannot take the watermark: it works
    // by string-replacing a comment in HTML text, which would corrupt a zip
    // container like an xlsx. Those are handed over as a short-lived signed URL
    // instead, and `licensed` tells the page not to claim a stamp that isn't
    // there. Access control is the same either way -- the bucket is private,
    // and we only get here after Stripe confirms the session was paid.
    if (!isHtml) {
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from('digital-Products')
        .createSignedUrl(product.storage_path, 3600, { download: filename })

      if (signError || !signed) {
        console.error('signed URL creation failed:', signError)
        return new Response(JSON.stringify({ error: 'Could not prepare download' }), {
          status: 500,
          headers,
        })
      }

      return new Response(
        JSON.stringify({ url: signed.signedUrl, filename, name: product.name, licensed: false }),
        { headers },
      )
    }

    // HTML products: stamp the buyer's info in server-side, so the
    // un-watermarked master never leaves Storage.
    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from('digital-Products')
      .download(product.storage_path)

    if (downloadError || !file) {
      console.error('file download failed:', downloadError)
      return new Response(JSON.stringify({ error: 'Could not prepare download' }), {
        status: 500,
        headers,
      })
    }

    const html = watermarkHtml(await file.text(), buyerEmail)

    return new Response(
      JSON.stringify({ html, filename, name: product.name, licensed: true }),
      { headers },
    )
  } catch (err) {
    console.error('get-download-link failed:', err)
    return new Response(JSON.stringify({ error: 'Could not create download link' }), {
      status: 500,
      headers,
    })
  }
})
