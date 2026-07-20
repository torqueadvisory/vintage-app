import { useCallback, useMemo, useRef, useState } from 'react'
import VinScanner from './VinScanner.jsx'
import { decodeVin, VinDecodeError } from '../api/nhtsa.js'
import { getPhotoUrl, shrinkPhoto } from '../api/photos.js'
import {
  reconTotal,
  totalInvestment,
  grossProfit,
  profitMarginPct,
  daysInInventory,
  formatCurrency,
  formatPct,
} from '../utils/calculations.js'

const todayISO = () => new Date().toISOString().slice(0, 10)

function emptyVehicle() {
  return {
    id: crypto.randomUUID(),
    vin: '',
    year: '',
    make: '',
    model: '',
    trim: '',
    engine: '',
    purchasePrice: '',
    mileage: '',
    acquisitionDate: todayISO(),
    reconItems: [],
    sellingPrice: '',
    soldDate: '',
  }
}

export default function VehicleForm({ initialVehicle, onSave, onCancel, onDelete, userId, photoVersion }) {
  const [vehicle, setVehicle] = useState(initialVehicle || emptyVehicle())
  const [scannerOpen, setScannerOpen] = useState(false)
  const [decoding, setDecoding] = useState(false)
  const [decodeError, setDecodeError] = useState('')
  const [decoded, setDecoded] = useState(Boolean(initialVehicle?.make))

  // Photo state. `photoAction` is what gets handed to onSave alongside the
  // vehicle: null (leave as is), {type:'set', blob} or {type:'remove'}.
  // `hasExistingPhoto` is discovered by the <img> loading or erroring, since
  // photo existence is derived (no DB column) exactly like the dealer logo.
  const [photoAction, setPhotoAction] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [hasExistingPhoto, setHasExistingPhoto] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const photoInputRef = useRef(null)

  const handlePhotoPick = async (file) => {
    if (!file) return
    setPhotoBusy(true)
    setPhotoError('')
    try {
      const blob = await shrinkPhoto(file)
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoPreview(URL.createObjectURL(blob))
      setPhotoAction({ type: 'set', blob })
    } catch (err) {
      setPhotoError(err.message || 'Could not read that photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const handlePhotoRemove = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview('')
    setPhotoAction(hasExistingPhoto ? { type: 'remove' } : null)
    setHasExistingPhoto(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const [existingFailed, setExistingFailed] = useState(false)
  const showExisting =
    Boolean(initialVehicle) && !existingFailed && !photoPreview && photoAction?.type !== 'remove'
  const photoShown = Boolean(photoPreview) || (showExisting && hasExistingPhoto)

  const update = (field, value) => setVehicle((v) => ({ ...v, [field]: value }))

  const runDecode = useCallback(async (vin) => {
    setDecoding(true)
    setDecodeError('')
    try {
      const info = await decodeVin(vin)
      setVehicle((v) => ({ ...v, ...info }))
      setDecoded(true)
    } catch (err) {
      setDecoded(false)
      setDecodeError(err instanceof VinDecodeError ? err.message : 'Could not decode VIN.')
    } finally {
      setDecoding(false)
    }
  }, [])

  const handleVinChange = (raw) => {
    const vin = raw.toUpperCase().slice(0, 17)
    update('vin', vin)
    setDecoded(false)
    if (vin.length === 17) runDecode(vin)
  }

  const handleScanDetect = useCallback((vin) => {
    setScannerOpen(false)
    update('vin', vin)
    runDecode(vin)
  }, [runDecode])

  const addReconItem = () => {
    update('reconItems', [...vehicle.reconItems, { id: crypto.randomUUID(), description: '', cost: '' }])
  }

  const updateReconItem = (id, field, value) => {
    update(
      'reconItems',
      vehicle.reconItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
  }

  const removeReconItem = (id) => {
    update('reconItems', vehicle.reconItems.filter((item) => item.id !== id))
  }

  const totals = useMemo(
    () => ({
      recon: reconTotal(vehicle.reconItems),
      investment: totalInvestment(vehicle),
      profit: grossProfit(vehicle),
      margin: profitMarginPct(vehicle),
      days: daysInInventory(vehicle),
    }),
    [vehicle],
  )

  const canSave = vehicle.vin.length === 17 && vehicle.purchasePrice !== '' && vehicle.acquisitionDate

  const profitClass = totals.profit == null ? '' : totals.profit >= 0 ? 'profit-positive' : 'profit-negative'

  return (
    <div className="screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Back">
          ‹
        </button>
        <h1>{initialVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h1>
        <span />
      </header>

      <div className="screen-body">
        <section className="card">
          <label className="field-label" htmlFor="vin">VIN</label>
          <div className="vin-row">
            <input
              id="vin"
              className="input vin-input"
              value={vehicle.vin}
              onChange={(e) => handleVinChange(e.target.value)}
              placeholder="17-character VIN"
              maxLength={17}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="button" className="btn btn-primary btn-compact" onClick={() => setScannerOpen(true)}>
              Scan
            </button>
          </div>
          {decoding && <p className="hint">Decoding VIN…</p>}
          {decodeError && <p className="hint hint-error">{decodeError}</p>}
          {decoded && !decoding && (
            <div className="decoded-info">
              <strong>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </strong>
              <span>{[vehicle.trim, vehicle.engine].filter(Boolean).join(' · ')}</span>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">Photo</h2>
            <div className="photo-actions">
              <button
                type="button"
                className="link-btn"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
              >
                {photoBusy ? 'Preparing…' : photoShown ? 'Change Photo' : '+ Add Photo'}
              </button>
              {photoShown && (
                <button type="button" className="link-btn link-btn-danger" onClick={handlePhotoRemove}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handlePhotoPick(e.target.files?.[0])}
          />
          {photoPreview && <img src={photoPreview} alt="Vehicle" className="photo-preview" />}
          {!photoPreview && showExisting && (
            <img
              src={`${getPhotoUrl(userId, vehicle.id)}?v=${photoVersion}`}
              alt="Vehicle"
              className="photo-preview"
              style={hasExistingPhoto ? undefined : { display: 'none' }}
              onLoad={() => setHasExistingPhoto(true)}
              onError={() => setExistingFailed(true)}
            />
          )}
          {!photoShown && !photoBusy && (
            <p className="hint">Snap the unit so it&apos;s easy to spot in your inventory list.</p>
          )}
          {photoError && <p className="hint hint-error">{photoError}</p>}
        </section>

        <section className="card">
          <h2 className="card-title">Acquisition</h2>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="purchasePrice">Purchase Price</label>
              <input
                id="purchasePrice"
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                value={vehicle.purchasePrice}
                onChange={(e) => update('purchasePrice', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="mileage">Mileage</label>
              <input
                id="mileage"
                className="input"
                type="number"
                inputMode="numeric"
                min="0"
                value={vehicle.mileage}
                onChange={(e) => update('mileage', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="acquisitionDate">Acquisition Date</label>
              <input
                id="acquisitionDate"
                className="input"
                type="date"
                value={vehicle.acquisitionDate}
                onChange={(e) => update('acquisitionDate', e.target.value)}
              />
            </div>
            <div className="field" />
          </div>
        </section>

        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">Repair / Recon Items</h2>
            <button type="button" className="link-btn" onClick={addReconItem}>+ Add item</button>
          </div>
          {vehicle.reconItems.length === 0 && <p className="hint">No recon items yet.</p>}
          {vehicle.reconItems.map((item) => (
            <div className="recon-row" key={item.id}>
              <input
                className="input recon-desc"
                value={item.description}
                onChange={(e) => updateReconItem(item.id, 'description', e.target.value)}
                placeholder="Description (e.g. brakes)"
              />
              <input
                className="input recon-cost"
                type="number"
                inputMode="decimal"
                min="0"
                value={item.cost}
                onChange={(e) => updateReconItem(item.id, 'cost', e.target.value)}
                placeholder="$0"
              />
              <button
                type="button"
                className="icon-btn icon-btn-remove"
                onClick={() => removeReconItem(item.id)}
                aria-label="Remove item"
              >
                ×
              </button>
            </div>
          ))}
          {vehicle.reconItems.length > 0 && (
            <p className="recon-total">Recon total: {formatCurrency(totals.recon)}</p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Sale</h2>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="sellingPrice">Selling Price</label>
              <input
                id="sellingPrice"
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                value={vehicle.sellingPrice}
                onChange={(e) => update('sellingPrice', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="soldDate">Sold Date</label>
              <input
                id="soldDate"
                className="input"
                type="date"
                value={vehicle.soldDate}
                onChange={(e) => update('soldDate', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className={`card summary-card ${profitClass}`}>
          <h2 className="card-title">Live Summary</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Total Investment</span>
              <span className="summary-value">{formatCurrency(totals.investment)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Gross Profit / Loss</span>
              <span className="summary-value">{formatCurrency(totals.profit)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Profit Margin</span>
              <span className="summary-value">{formatPct(totals.margin)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Days in Inventory</span>
              <span className="summary-value">{totals.days ?? '—'}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="screen-footer">
        {initialVehicle && (
          <button type="button" className="btn btn-danger" onClick={() => onDelete(vehicle.id)}>
            Delete
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!canSave}
          onClick={() => onSave(vehicle, photoAction)}
        >
          Save Vehicle
        </button>
      </div>

      {scannerOpen && (
        <VinScanner onDetect={handleScanDetect} onClose={() => setScannerOpen(false)} />
      )}
    </div>
  )
}
