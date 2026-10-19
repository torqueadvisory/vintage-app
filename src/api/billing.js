import { supabase } from '../lib/supabaseClient.js'

export async function startCheckout(productSlug) {
  const successUrl = `${window.location.origin}${window.location.pathname}?checkout=success`
  const cancelUrl = `${window.location.origin}${window.location.pathname}?checkout=cancelled`

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { product_slug: productSlug, success_url: successUrl, cancel_url: cancelUrl },
  })

  if (error) throw error
  if (!data?.url) throw new Error('No checkout URL returned')

  window.location.href = data.url
}

// Stripe's hosted Customer Portal: cancel, change card, download invoices.
// Self-serve online cancellation is legally required for subscriptions sold
// online, so this must always be reachable from inside the app.
export async function openBillingPortal() {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Sign in first.')

  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: { return_url: `${window.location.origin}${window.location.pathname}` },
    headers: { Authorization: `Bearer ${token}` },
  })

  if (error) {
    let message = 'Could not open billing management.'
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch { /* keep the fallback */ }
    throw new Error(message)
  }
  if (!data?.url) throw new Error('No portal URL returned')

  window.location.href = data.url
}
