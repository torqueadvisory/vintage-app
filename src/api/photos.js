import { supabase } from '../lib/supabaseClient.js'

const BUCKET = 'vehicle-photos'
const photoPath = (userId, vehicleId) => `${userId}/${vehicleId}.jpg`

export function getPhotoUrl(userId, vehicleId) {
  return supabase.storage.from(BUCKET).getPublicUrl(photoPath(userId, vehicleId)).data.publicUrl
}

export async function uploadVehiclePhoto(userId, vehicleId, blob) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(photoPath(userId, vehicleId), blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
}

export async function removeVehiclePhoto(userId, vehicleId) {
  const { error } = await supabase.storage.from(BUCKET).remove([photoPath(userId, vehicleId)])
  if (error) throw error
}

// Phone camera photos are 3-5MB; uploaded raw they'd chew through storage and
// make the inventory list crawl on lot Wi-Fi. Downscale on-device to a size
// that still looks crisp on screen (~200-400KB JPEG) before anything uploads.
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

export function shrinkPhoto(file) {
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
