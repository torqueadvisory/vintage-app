import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import torqueLogo from '../assets/torque-advisory-logo.png'
import vintageLogo from '../assets/vintage-logo.png'
import lotSunset from '../assets/lot-sunset.jpg'

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
    <div className="auth-screen" style={{ backgroundImage: `url(${lotSunset})` }}>
      <div className="auth-overlay" />
      <div className="auth-content">
        <div className="auth-top">
          <div className="auth-logoplate">
            <img src={vintageLogo} alt="VINtage" />
          </div>
          <p className="auth-tag">Know your true profit on every unit.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="auth-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="auth-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="auth-input"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <p className="auth-hint auth-hint-error">{error}</p>}
          {message && <p className="auth-hint">{message}</p>}

          <button type="submit" className="btn btn-primary btn-block auth-btn" disabled={loading}>
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>

          <button
            type="button"
            className="auth-alt"
            onClick={() => {
              setMode(isSignUp ? 'signIn' : 'signUp')
              setError('')
              setMessage('')
            }}
          >
            {isSignUp ? 'Already have an account? Log in' : 'New here? Create an account'}
          </button>
        </form>

        <p className="auth-powered">
          <span className="auth-tplate"><img src={torqueLogo} alt="" /></span>
          Powered by Torque Advisory Group
        </p>
      </div>
    </div>
  )
}
