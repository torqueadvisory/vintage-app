import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

export default function VinScanner({ onDetect, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128])
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 })
    let cancelled = false

    if (videoRef.current) {
      videoRef.current.muted = true
    }

    reader
      .decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result) => {
          if (cancelled || !result) return
          const text = result.getText().trim().toUpperCase()
          if (/^[A-HJ-NPR-Z0-9]{17}$/.test(text)) {
            onDetect(text)
          }
        },
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop()
        } else {
          controlsRef.current = controls
        }
      })
      .catch(() => {
        if (!cancelled) setError('Camera unavailable. Check permissions or use manual entry.')
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [onDetect])

  return (
    <div className="scanner-overlay">
      <div className="scanner-frame">
        <video ref={videoRef} className="scanner-video" muted playsInline autoPlay />
        <div className="scanner-dim scanner-dim-top" />
        <div className="scanner-dim scanner-dim-bottom" />
        <div className="scanner-dim scanner-dim-left" />
        <div className="scanner-dim scanner-dim-right" />
        <div className="scanner-reticle" />
      </div>
      <p className="scanner-hint">
        {error || 'Point your camera at the VIN barcode (driver-side door jamb or windshield).'}
      </p>
      <button type="button" className="btn btn-secondary" onClick={onClose}>
        Cancel
      </button>
    </div>
  )
}
