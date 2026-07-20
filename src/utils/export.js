import {
  totalInvestment,
  grossProfit,
  profitMarginPct,
  daysInInventory,
  isSold,
  reconTotal,
} from './calculations.js'

const COLUMNS = [
  { header: 'VIN', value: (v) => v.vin },
  { header: 'Year', value: (v) => v.year },
  { header: 'Make', value: (v) => v.make },
  { header: 'Model', value: (v) => v.model },
  { header: 'Trim', value: (v) => v.trim },
  { header: 'Engine', value: (v) => v.engine },
  { header: 'Mileage', value: (v) => (v.mileage === '' || v.mileage == null ? '' : Number(v.mileage)) },
  { header: 'Status', value: (v) => (isSold(v) ? 'Sold' : 'Active') },
  { header: 'Purchase Price', value: (v) => Number(v.purchasePrice) || 0 },
  { header: 'Acquisition Date', value: (v) => v.acquisitionDate },
  { header: 'Recon Total', value: (v) => reconTotal(v.reconItems) },
  { header: 'Total Investment', value: (v) => totalInvestment(v) },
  {
    header: 'Selling Price',
    value: (v) => (v.sellingPrice === '' || v.sellingPrice == null ? '' : Number(v.sellingPrice)),
  },
  { header: 'Sold Date', value: (v) => v.soldDate || '' },
  { header: 'Gross Profit', value: (v) => grossProfit(v) ?? '' },
  {
    header: 'Profit Margin %',
    value: (v) => {
      const m = profitMarginPct(v)
      return m == null ? '' : Number(m.toFixed(1))
    },
  },
  { header: 'Days in Inventory', value: (v) => daysInInventory(v) ?? '' },
]

function csvEscape(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportVehiclesToCsv(vehicles) {
  const header = COLUMNS.map((c) => csvEscape(c.header)).join(',')
  const rows = vehicles.map((v) => COLUMNS.map((c) => csvEscape(c.value(v))).join(','))
  const csv = '﻿' + [header, ...rows].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `vintage-inventory-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
