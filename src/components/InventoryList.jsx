import { useMemo, useState } from 'react'
import {
  totalInvestment,
  grossProfit,
  daysInInventory,
  isSold,
  formatCurrency,
} from '../utils/calculations.js'
import { exportVehiclesToCsv } from '../utils/export.js'
import { getLogoUrl } from '../api/logo.js'
import { getPhotoUrl } from '../api/photos.js'

function HeaderLogo({ userId, logoVersion }) {
  const [failed, setFailed] = useState(false)

  if (failed) return 'VINtage'
  return (
    <img
      src={`${getLogoUrl(userId)}?v=${logoVersion}`}
      alt="Dealership logo"
      className="header-logo"
      onError={() => setFailed(true)}
    />
  )
}

function VehicleThumb({ userId, vehicleId, photoVersion }) {
  const [failed, setFailed] = useState(false)

  // No photo uploaded (or it failed to load): a quiet placeholder keeps every
  // row the same shape so the list stays scannable.
  if (failed) {
    return (
      <span className="vehicle-thumb vehicle-thumb-fallback" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
          <path d="M4 11h16a1 1 0 0 1 1 1v4h-2.5" />
          <path d="M3 12v4h2.5" />
          <circle cx="7.5" cy="16" r="1.8" />
          <circle cx="16.5" cy="16" r="1.8" />
          <path d="M9.3 16h5.4" />
        </svg>
      </span>
    )
  }

  return (
    <img
      src={`${getPhotoUrl(userId, vehicleId)}?v=${photoVersion}`}
      alt=""
      className="vehicle-thumb"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function VehicleCard({ vehicle, onSelect, userId, photoVersion }) {
  const profit = grossProfit(vehicle)
  const sold = isSold(vehicle)
  const days = daysInInventory(vehicle)
  const profitClass = profit == null ? '' : profit >= 0 ? 'card-profit' : 'card-loss'

  return (
    <button type="button" className={`vehicle-card ${profitClass}`} onClick={() => onSelect(vehicle.id)}>
      <VehicleThumb userId={userId} vehicleId={vehicle.id} photoVersion={photoVersion} />
      <div className="vehicle-card-body">
        <div className="vehicle-card-top">
          <div>
            <div className="vehicle-card-title">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </div>
            <div className="vehicle-card-sub">
              {[
                vehicle.trim,
                vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} mi` : '',
                vehicle.vin?.slice(-6),
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <span className={`status-badge ${sold ? 'status-sold' : 'status-active'}`}>
            {sold ? 'Sold' : 'Active'}
          </span>
        </div>
        <div className="vehicle-card-stats">
          <span>{formatCurrency(totalInvestment(vehicle))} invested</span>
          <span>{days ?? '—'} days</span>
          {profit != null && (
            <span className="vehicle-card-profit">
              {profit >= 0 ? '+' : ''}
              {formatCurrency(profit)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function InventoryList({
  vehicles,
  onSelect,
  onAdd,
  onLogout,
  onOpenSettings,
  userId,
  logoVersion,
  photoVersion,
  loading,
  error,
}) {
  const { active, sold } = useMemo(() => {
    const activeList = vehicles.filter((v) => !isSold(v))
    const soldList = vehicles.filter((v) => isSold(v))
    activeList.sort((a, b) => (daysInInventory(b) ?? 0) - (daysInInventory(a) ?? 0))
    soldList.sort((a, b) => new Date(b.soldDate) - new Date(a.soldDate))
    return { active: activeList, sold: soldList }
  }, [vehicles])

  return (
    <div className="screen">
      <header className="screen-header">
        <div className="header-actions">
          <button type="button" className="header-btn" onClick={onOpenSettings} aria-label="Settings">
            ⚙
          </button>
          <button type="button" className="header-btn" onClick={onLogout}>
            Log Out
          </button>
        </div>
        <h1>
          <HeaderLogo userId={userId} logoVersion={logoVersion} />
        </h1>
        <button type="button" className="btn btn-primary btn-compact" onClick={onAdd}>
          + Add
        </button>
      </header>

      <div className="screen-body">
        {loading && <p className="hint">Loading your inventory…</p>}
        {error && <p className="hint hint-error">{error}</p>}

        {!loading && vehicles.length === 0 && (
          <div className="empty-state">
            <p>No vehicles yet.</p>
            <button type="button" className="btn btn-primary" onClick={onAdd}>
              Scan your first VIN
            </button>
          </div>
        )}

        {vehicles.length > 0 && (
          <div className="export-row">
            <button type="button" className="link-btn" onClick={() => exportVehiclesToCsv(vehicles)}>
              Export to Excel
            </button>
          </div>
        )}

        {active.length > 0 && (
          <section>
            <h2 className="section-title">Active ({active.length})</h2>
            <div className="vehicle-list">
              {active.map((v) => (
                <VehicleCard key={v.id} vehicle={v} onSelect={onSelect} userId={userId} photoVersion={photoVersion} />
              ))}
            </div>
          </section>
        )}

        {sold.length > 0 && (
          <section>
            <h2 className="section-title">Sold ({sold.length})</h2>
            <div className="vehicle-list">
              {sold.map((v) => (
                <VehicleCard key={v.id} vehicle={v} onSelect={onSelect} userId={userId} photoVersion={photoVersion} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
