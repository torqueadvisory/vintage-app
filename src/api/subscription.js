import { supabase } from '../lib/supabaseClient.js'

// 'demo' is a manually-granted status (never touched by the Stripe webhook,
// which only ever matches existing rows by stripe_subscription_id) for
// permanently-free demo accounts. See supabase/migrations/.
const ACTIVE_STATUSES = ['active', 'trialing', 'demo']

export async function getActiveSubscription() {
  // Ordered + limited to the single newest row before .maybeSingle(), so this
  // stays safe even if a user ends up with more than one matching purchases
  // row (e.g. retried checkouts during testing, or a genuine resubscribe
  // after a cancellation) -- .maybeSingle() alone throws on 2+ rows.
  const { data, error } = await supabase
    .from('purchases')
    .select('*, products!inner(product_type)')
    .eq('products.product_type', 'subscription')
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}
