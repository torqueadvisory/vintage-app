import { supabase } from '../lib/supabaseClient.js'

function emptyToNull(value) {
  return value === '' || value == null ? null : value
}

function toDb(vehicle) {
  return {
    id: vehicle.id,
    vin: vehicle.vin,
    stock_number: emptyToNull(typeof vehicle.stockNumber === 'string' ? vehicle.stockNumber.trim() : vehicle.stockNumber),
    year: vehicle.year ? Number(vehicle.year) || null : null,
    make: vehicle.make || null,
    model: vehicle.model || null,
    trim: vehicle.trim || null,
    engine: vehicle.engine || null,
    body_class: vehicle.bodyClass || null,
    drive_type: vehicle.driveType || null,
    transmission: vehicle.transmission || null,
    purchase_price: Number(vehicle.purchasePrice) || 0,
    mileage: emptyToNull(vehicle.mileage) == null ? null : Math.round(Number(vehicle.mileage)) || null,
    acquisition_date: vehicle.acquisitionDate,
    recon_items: (vehicle.reconItems || []).map((item) => ({
      id: item.id,
      description: item.description,
      cost: Number(item.cost) || 0,
    })),
    selling_price: emptyToNull(vehicle.sellingPrice) == null ? null : Number(vehicle.sellingPrice),
    sold_date: emptyToNull(vehicle.soldDate),
  }
}

function fromDb(row) {
  return {
    id: row.id,
    vin: row.vin,
    stockNumber: row.stock_number || '',
    year: row.year != null ? String(row.year) : '',
    make: row.make || '',
    model: row.model || '',
    trim: row.trim || '',
    engine: row.engine || '',
    bodyClass: row.body_class || '',
    driveType: row.drive_type || '',
    transmission: row.transmission || '',
    purchasePrice: row.purchase_price != null ? String(row.purchase_price) : '',
    mileage: row.mileage != null ? String(row.mileage) : '',
    acquisitionDate: row.acquisition_date || '',
    reconItems: (row.recon_items || []).map((item) => ({
      id: item.id,
      description: item.description || '',
      cost: item.cost != null ? String(item.cost) : '',
    })),
    sellingPrice: row.selling_price != null ? String(row.selling_price) : '',
    soldDate: row.sold_date || '',
  }
}

export async function listVehicles() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDb)
}

export async function createVehicle(vehicle) {
  const { data, error } = await supabase.from('vehicles').insert(toDb(vehicle)).select().single()
  if (error) throw error
  return fromDb(data)
}

export async function updateVehicle(vehicle) {
  const { data, error } = await supabase
    .from('vehicles')
    .update(toDb(vehicle))
    .eq('id', vehicle.id)
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function deleteVehicle(id) {
  const { error } = await supabase.from('vehicles').delete().eq('id', id)
  if (error) throw error
}
