import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import torqueLogo from '../assets/torque-advisory-logo.png'
import vintageLogo from '../assets/vintage-logo.png'

export default function Auth() {
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isSignUp = mode === 'signUp'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { data, error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (isSignUp && !data.session) {
      setMessage('Check your email to confirm your account, then log in.')
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>VINtage</h1>
        <span />
      </header>

      <div className="screen-body">
        <div className="auth-logo">
          <img src={vintageLogo} alt="VINtage" />
        </div>

        <form className="card" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div style={{ height: 12 }} />

          <label className="field-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <p className="hint hint-error">{error}</p>}
          {message && <p className="hint">{message}</p>}

          <div style={{ height: 16 }} />

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>

          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(isSignUp ? 'signIn' : 'signUp')
              setError('')
              setMessage('')
            }}
            style={{ marginTop: 12 }}
          >
            {isSignUp ? 'Already have an account? Log in' : 'New here? Create an account'}
          </button>
        </form>

        <p className="powered-by">
          <img src={torqueLogo} alt="Torque Advisory Group" />
          Powered by Torque Advisory Group
        </p>
      </div>
    </div>
  )
}
