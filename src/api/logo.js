import { supabase } from '../lib/supabaseClient.js'

const BUCKET = 'dealer-logos'
const logoPath = (userId) => `${userId}/logo`

export function getLogoUrl(userId) {
  return supabase.storage.from(BUCKET).getPublicUrl(logoPath(userId)).data.publicUrl
}

export async function uploadLogo(userId, file) {
  const { error } = await supabase.storage.from(BUCKET).upload(logoPath(userId), file, { upsert: true })
  if (error) throw error
}

export async function removeLogo(userId) {
  const { error } = await supabase.storage.from(BUCKET).remove([logoPath(userId)])
  if (error) throw error
}
