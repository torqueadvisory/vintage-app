export function reconTotal(reconItems = []) {
  return reconItems.reduce((sum, item) => sum + (Number(item.cost) || 0), 0)
}

export function totalInvestment(vehicle) {
  return (Number(vehicle.purchasePrice) || 0) + reconTotal(vehicle.reconItems)
}

export function grossProfit(vehicle) {
  if (vehicle.sellingPrice === '' || vehicle.sellingPrice == null) return null
  return (Number(vehicle.sellingPrice) || 0) - totalInvestment(vehicle)
}

export function profitMarginPct(vehicle) {
  const price = Number(vehicle.sellingPrice)
  if (!price) return null
  const profit = grossProfit(vehicle)
  if (profit == null) return null
  return (profit / price) * 100
}

function parseLocalDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function daysInInventory(vehicle) {
  if (!vehicle.acquisitionDate) return null
  const start = parseLocalDate(vehicle.acquisitionDate)
  const end = vehicle.soldDate ? parseLocalDate(vehicle.soldDate) : new Date().setHours(0, 0, 0, 0)
  const diffMs = end - start
  return Math.max(0, Math.round(diffMs / 86400000))
}

export function isSold(vehicle) {
  return Boolean(vehicle.soldDate)
}

export function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function formatPct(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}%`
}
