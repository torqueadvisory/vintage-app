import { supabase } from '../lib/supabaseClient.js'

const BUCKET = 'receipts'
const folder = (userId, vehicleId) => `${userId}/${vehicleId}`

// Receipts need legible TEXT, not just a recognizable picture, so they get a
// larger edge and higher JPEG quality than vehicle photos (1600/0.82). Still
// lands around 300-600KB -- well inside the edge function's 2MB cap.
const MAX_EDGE = 2000
const JPEG_QUALITY = 0.85

export function shrinkReceipt(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the photo.'))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('That file does not look like an image.'))
    }

    img.src = objectUrl
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    // result is "data:image/jpeg;base64,XXXX" -- the API wants only the XXXX
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Could not read the photo.'))
    reader.readAsDataURL(blob)
  })
}

// Sends the receipt image to the scan-receipt edge function, which runs the
// AI extraction server-side (the API key never ships to the browser).
// Returns { vendor, date, total, line_items: [{description, amount}] }.
export async function scanReceipt(blob) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Sign in to scan receipts.')

  const base64 = await blobToBase64(blob)
  const { data, error } = await supabase.functions.invoke('scan-receipt', {
    body: { image: base64, media_type: 'image/jpeg' },
    headers: { Authorization: `Bearer ${token}` },
  })

  if (error) {
    // supabase-js wraps non-2xx responses; surface the function's own message
    // (e.g. "too blurry") instead of a generic transport error where possible.
    let message = 'Could not scan the receipt.'
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch { /* keep the fallback */ }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function uploadReceipt(userId, vehicleId, blob) {
  const path = `${folder(userId, vehicleId)}/${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
}

// The bucket is private (receipts are financial documents), so listing and
// viewing go through the owner's session: RLS scopes both to their folder.
export async function listReceipts(userId, vehicleId) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder(userId, vehicleId), { sortBy: { column: 'name', order: 'desc' } })
  if (error) throw error
  return (data ?? []).filter((f) => f.name.endsWith('.jpg'))
}

export async function getReceiptUrl(userId, vehicleId, fileName) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(`${folder(userId, vehicleId)}/${fileName}`, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

// File names are capture timestamps, so the label needs no database column.
export function receiptLabel(fileName) {
  const ts = parseInt(fileName, 10)
  if (!Number.isFinite(ts)) return 'Receipt'
  return `Receipt · ${new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
