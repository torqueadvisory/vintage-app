const NHTSA_ENDPOINT = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended'

export class VinDecodeError extends Error {}

export async function decodeVin(vin) {
  const cleanVin = vin.trim().toUpperCase()
  if (cleanVin.length !== 17) {
    throw new VinDecodeError('VIN must be 17 characters')
  }

  const url = `${NHTSA_ENDPOINT}/${encodeURIComponent(cleanVin)}?format=json`
  const res = await fetch(url)
  if (!res.ok) {
    throw new VinDecodeError(`NHTSA lookup failed (${res.status})`)
  }

  const data = await res.json()
  const result = data?.Results?.[0]
  if (!result) {
    throw new VinDecodeError('No decode result returned')
  }

  const errorCode = result.ErrorCode || ''
  if (errorCode && !errorCode.split(',').map((c) => c.trim()).every((c) => c === '0')) {
    const codes = errorCode.split(',').map((c) => c.trim())
    if (!codes.includes('0') && result.ErrorText) {
      throw new VinDecodeError(result.ErrorText.split('.')[0] || 'VIN could not be decoded')
    }
  }

  return {
    vin: cleanVin,
    year: result.ModelYear || '',
    make: result.Make || '',
    model: result.Model || '',
    trim: result.Trim || result.Series || '',
    engine: [result.DisplacementL && `${Number(result.DisplacementL).toFixed(1)}L`, result.EngineCylinders && `${result.EngineCylinders}-cyl`, result.FuelTypePrimary]
      .filter(Boolean)
      .join(' '),
    bodyClass: result.BodyClass || '',
    driveType: result.DriveType || '',
    transmission: result.TransmissionStyle || '',
  }
}
