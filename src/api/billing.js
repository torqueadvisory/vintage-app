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
