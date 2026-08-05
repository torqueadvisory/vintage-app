import { createClient } from 'npm:@supabase/supabase-js@2'

// Reads a photographed repair/recon receipt and returns structured line items
// the app can drop into a vehicle's recon costs -- after the user reviews them.
// Extraction is never trusted blindly: the client always shows the parsed items
// for confirmation before anything is saved.
//
// The Anthropic call uses plain fetch, not an SDK -- same lesson as Stripe:
// SDK HTTP clients have broken on this edge runtime before, and the REST API
// is a single JSON POST anyway.

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001'

// ~2MB of image after base64 (chars ≈ bytes * 4/3). Client downscales to
// ~2000px JPEG (~300-600KB) so this is generous headroom, not an expectation.
const MAX_BASE64_CHARS = 2_800_000

const supabaseAnon = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
)

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

const EXTRACTION_PROMPT = `You are reading a photo of a vehicle repair shop receipt or invoice for a car dealer's expense tracking.

Extract and return ONLY a JSON object, no other text, with this exact shape:
{
  "vendor": "shop name or null",
  "date": "YYYY-MM-DD or null",
  "line_items": [{ "description": "short item description", "amount": 123.45 }],
  "total": 999.99
}

Rules:
- line_items must together cover the FULL amount the dealer paid, including tax and fees. If tax, shop supplies, or fees appear, include them as their own line items (e.g. "Sales tax").
- Do NOT include subtotal or total rows as line items.
- Merge per-unit quantity math into one line (e.g. "Brake pads x2" with the extended amount).
- Keep descriptions under 40 characters, title-cased, no part numbers unless there is no other description.
- amounts are plain numbers, no currency symbols.
- If the image is not a receipt/invoice, or is too blurry or dark to read amounts reliably, return {"error": "brief reason a person would understand"} instead.`

interface LineItem {
  description: string
  amount: number
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  try {
    // Unlike checkout (which allows guests), scanning is for signed-in
    // subscribers only -- it spends real API money per call.
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: userData } = token ? await supabaseAnon.auth.getUser(token) : { data: { user: null } }
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Sign in to scan receipts.' }), { status: 401, headers })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Receipt scanning is not configured yet. Add items manually for now.' }),
        { status: 503, headers },
      )
    }

    const { image, media_type: mediaType } = await req.json()
    if (typeof image !== 'string' || image.length === 0) {
      return new Response(JSON.stringify({ error: 'No image received.' }), { status: 400, headers })
    }
    if (image.length > MAX_BASE64_CHARS) {
      return new Response(JSON.stringify({ error: 'That photo is too large. Try again.' }), { status: 413, headers })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType === 'image/png' ? 'image/png' : 'image/jpeg',
                  data: image,
                },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('anthropic error', res.status, detail.slice(0, 300))
      return new Response(
        JSON.stringify({ error: 'The scanner had trouble reading that. Try again in a moment.' }),
        { status: 502, headers },
      )
    }

    const data = await res.json()
    const text: string = data?.content?.[0]?.text ?? ''

    // The model is told to return bare JSON, but parse defensively: strip
    // markdown fences and grab the outermost object if there is extra prose.
    let parsed: Record<string, unknown>
    try {
      const cleaned = text.replace(/```(?:json)?/g, '').trim()
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      parsed = JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      console.error('unparseable extraction', text.slice(0, 300))
      return new Response(
        JSON.stringify({ error: 'Could not read that receipt. Try a clearer photo.' }),
        { status: 422, headers },
      )
    }

    if (parsed.error) {
      return new Response(JSON.stringify({ error: String(parsed.error) }), { status: 422, headers })
    }

    const items: LineItem[] = Array.isArray(parsed.line_items)
      ? (parsed.line_items as LineItem[])
          .filter((it) => it && typeof it.description === 'string' && Number.isFinite(Number(it.amount)))
          .map((it) => ({
            description: it.description.slice(0, 60),
            amount: Math.round(Number(it.amount) * 100) / 100,
          }))
      : []

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No line items found on that receipt. Try a clearer photo.' }),
        { status: 422, headers },
      )
    }

    return new Response(
      JSON.stringify({
        vendor: typeof parsed.vendor === 'string' ? parsed.vendor.slice(0, 80) : null,
        date: typeof parsed.date === 'string' ? parsed.date : null,
        total: Number.isFinite(Number(parsed.total)) ? Math.round(Number(parsed.total) * 100) / 100 : null,
        line_items: items,
      }),
      { headers },
    )
  } catch (err) {
    console.error('scan-receipt failed:', err)
    return new Response(JSON.stringify({ error: 'Could not scan the receipt.' }), { status: 500, headers })
  }
})
