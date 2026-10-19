import { useState } from 'react'
import { getLogoUrl, uploadLogo, removeLogo } from '../api/logo.js'
import { openBillingPortal } from '../api/billing.js'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_SIZE = 3 * 1024 * 1024

export default function Settings({ userId, onClose }) {
  const [preview, setPreview] = useState(() => `${getLogoUrl(userId)}?v=${Date.now()}`)
  const [failed, setFailed] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [portalBusy, setPortalBusy] = useState(false)
  const [portalError, setPortalError] = useState('')

  const handlePortal = async () => {
    setPortalBusy(true)
    setPortalError('')
    try {
      await openBillingPortal() // navigates away on success
    } catch (err) {
      setPortalError(err.message)
      setPortalBusy(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a PNG, JPEG, or WebP image.')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('Please choose an image under 3MB.')
      return
    }

    setUploading(true)
    setError('')
    try {
      await uploadLogo(userId, file)
      setPreview(`${getLogoUrl(userId)}?v=${Date.now()}`)
      setFailed(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setUploading(true)
    setError('')
    try {
      await removeLogo(userId)
      setFailed(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button type="button" className="header-btn" onClick={onClose}>
          Back
        </button>
        <h1>Settings</h1>
        <span />
      </header>

      <div className="screen-body">
        <section className="card">
          <h2 className="card-title">Dealership Logo</h2>

          {preview && !failed ? (
            <img
              src={preview}
              alt="Your dealership logo"
              className="logo-preview"
              onError={() => setFailed(true)}
            />
          ) : (
            <p className="hint">No logo uploaded yet.</p>
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
            disabled={uploading}
          />

          {error && <p className="hint hint-error">{error}</p>}

          <div style={{ height: 16 }} />

          <button type="button" className="btn btn-danger btn-block" onClick={handleRemove} disabled={uploading}>
            Remove Logo
          </button>
        </section>

        <section className="card">
          <h2 className="card-title">Subscription</h2>
          <p className="hint">
            Cancel anytime, update your card, or download invoices. Changes take
            effect through Stripe immediately.
          </p>
          <button type="button" className="btn btn-secondary btn-block" onClick={handlePortal} disabled={portalBusy}>
            {portalBusy ? 'Opening…' : 'Manage Subscription'}
          </button>
          {portalError && <p className="hint hint-error">{portalError}</p>}
        </section>
      </div>
    </div>
  )
}
