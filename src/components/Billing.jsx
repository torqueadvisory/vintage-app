import { useState } from 'react'
import { startCheckout } from '../api/billing.js'

export default function Billing({ onLogout, onRefresh, checkingOut, error }) {
  const [starting, setStarting] = useState('')
  const [startError, setStartError] = useState('')

  const handleStart = async (slug) => {
    setStarting(slug)
    setStartError('')
    try {
      await startCheckout(slug)
    } catch (err) {
      setStartError(err.message)
      setStarting('')
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button type="button" className="header-btn" onClick={onLogout}>
          Log Out
        </button>
        <h1>VINtage</h1>
        <span />
      </header>

      <div className="screen-body">
        {error && <p className="hint hint-error">{error}</p>}
        {startError && <p className="hint hint-error">{startError}</p>}

        {checkingOut ? (
          <section className="card">
            <p className="hint">Finishing setup, this can take a few seconds…</p>
            <button type="button" className="btn btn-secondary btn-block" onClick={onRefresh}>
              Refresh
            </button>
          </section>
        ) : (
          <section className="card">
            <h2 className="card-title">Choose a Plan</h2>
            <p className="hint">Start with a 14-day free trial. Cancel anytime.</p>

            <div className="plan-options">
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={Boolean(starting)}
                onClick={() => handleStart('vintage-monthly')}
              >
                {starting === 'vintage-monthly' ? 'Redirecting…' : 'Start Monthly — $50/mo'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={Boolean(starting)}
                onClick={() => handleStart('vintage-annual')}
              >
                {starting === 'vintage-annual' ? 'Redirecting…' : 'Start Annual — $480/yr'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
