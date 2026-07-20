import { useCallback, useEffect, useState } from 'react'
import InventoryList from './components/InventoryList.jsx'
import VehicleForm from './components/VehicleForm.jsx'
import Auth from './components/Auth.jsx'
import Billing from './components/Billing.jsx'
import Settings from './components/Settings.jsx'
import { supabase } from './lib/supabaseClient.js'
import { listVehicles, createVehicle, updateVehicle, deleteVehicle } from './api/vehicles.js'
import { uploadVehiclePhoto, removeVehiclePhoto } from './api/photos.js'
import { getActiveSubscription } from './api/subscription.js'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [subscription, setSubscription] = useState(undefined)
  const [checkingOut, setCheckingOut] = useState(false)
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState('list')
  const [editingId, setEditingId] = useState(null)
  const [logoVersion, setLogoVersion] = useState(() => Date.now())
  const [photoVersion, setPhotoVersion] = useState(() => Date.now())

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  const fetchSubscription = useCallback(() => {
    return getActiveSubscription()
      .then(setSubscription)
      .catch((err) => {
        setError(err.message)
        setSubscription(null)
      })
  }, [])

  useEffect(() => {
    if (!session) {
      setSubscription(undefined)
      return
    }
    fetchSubscription()
  }, [session, fetchSubscription])

  useEffect(() => {
    if (!session) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') !== 'success') return

    const url = new URL(window.location.href)
    url.searchParams.delete('checkout')
    window.history.replaceState({}, '', url)

    setCheckingOut(true)
    let attempts = 0
    const maxAttempts = 8
    const interval = setInterval(async () => {
      attempts += 1
      const sub = await getActiveSubscription().catch(() => null)
      if (sub) {
        setSubscription(sub)
        setCheckingOut(false)
        clearInterval(interval)
      } else if (attempts >= maxAttempts) {
        setCheckingOut(false)
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [session])

  useEffect(() => {
    if (!session || !subscription) {
      setVehicles([])
      return
    }
    setLoading(true)
    setError('')
    listVehicles()
      .then(setVehicles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session, subscription])

  const openAdd = () => {
    setEditingId(null)
    setView('form')
  }

  const openEdit = (id) => {
    setEditingId(id)
    setView('form')
  }

  const closeForm = () => {
    setView('list')
    setEditingId(null)
  }

  const openSettings = () => setView('settings')

  const closeSettings = () => {
    setView('list')
    setLogoVersion(Date.now())
  }

  const handleSave = async (vehicle, photoAction) => {
    const exists = vehicles.some((v) => v.id === vehicle.id)
    const saved = exists ? await updateVehicle(vehicle) : await createVehicle(vehicle)
    setVehicles((prev) => (exists ? prev.map((v) => (v.id === saved.id ? saved : v)) : [saved, ...prev]))

    // The photo is secondary to the vehicle record: a failed upload should
    // never lose the save itself, so it's handled after and non-fatally.
    if (photoAction) {
      try {
        if (photoAction.type === 'set') {
          await uploadVehiclePhoto(session.user.id, saved.id, photoAction.blob)
        } else if (photoAction.type === 'remove') {
          await removeVehiclePhoto(session.user.id, saved.id)
        }
        setPhotoVersion(Date.now())
      } catch {
        setError('Vehicle saved, but the photo could not be uploaded. Open it and try the photo again.')
      }
    }
    closeForm()
  }

  const handleDelete = async (id) => {
    await deleteVehicle(id)
    // best-effort: a leftover photo for a deleted vehicle is invisible anyway
    removeVehiclePhoto(session.user.id, id).catch(() => {})
    setVehicles((prev) => prev.filter((v) => v.id !== id))
    closeForm()
  }

  const handleLogout = () => supabase.auth.signOut()

  if (session === undefined) {
    return null
  }

  if (!session) {
    return <Auth />
  }

  if (subscription === undefined) {
    return null
  }

  if (!subscription) {
    return (
      <Billing onLogout={handleLogout} onRefresh={fetchSubscription} checkingOut={checkingOut} error={error} />
    )
  }

  const editingVehicle = editingId ? vehicles.find((v) => v.id === editingId) : null

  if (view === 'form') {
    return (
      <VehicleForm
        initialVehicle={editingVehicle}
        onSave={handleSave}
        onCancel={closeForm}
        onDelete={handleDelete}
        userId={session.user.id}
        photoVersion={photoVersion}
      />
    )
  }

  if (view === 'settings') {
    return <Settings userId={session.user.id} onClose={closeSettings} />
  }

  return (
    <InventoryList
      vehicles={vehicles}
      onSelect={openEdit}
      onAdd={openAdd}
      onLogout={handleLogout}
      onOpenSettings={openSettings}
      userId={session.user.id}
      logoVersion={logoVersion}
      photoVersion={photoVersion}
      loading={loading}
      error={error}
    />
  )
}
