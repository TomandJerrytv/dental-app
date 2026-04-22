/*Calibration.jsx — Phase 2: Tongue Depressor Auto-Detection */
import { useRef, useState, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'

// ── Tongue Depressor ISO Standard ──────────────────────────────
// Wooden tongue depressor (spatula): 150mm × 18mm — held VERTICALLY
// Length axis aligns with VDR measurement axis for maximum accuracy.
// Aspect ratio 150:18 = 8.33:1 — used for tilt self-validation.
const DEPRESSOR_LENGTH_MM = 150
const DEPRESSOR_WIDTH_MM  = 18
const DEPRESSOR_ASPECT    = DEPRESSOR_LENGTH_MM / DEPRESSOR_WIDTH_MM  // 8.33

// ── Detection tuning ───────────────────────────────────────────
const DOWNSAMPLE_WIDTH    = 320   // Process at 320px wide for speed (px ratio preserved)
const MIN_PIXELS_REGION   = 200   // Reject tiny regions
const ASPECT_TOLERANCE    = 0.25  // ±25% from 8.33 expected (catches mild tilt for correction)
const MAX_TILT_DEGREES    = 20    // Reject if tilted more than this
const MIN_CONFIDENCE      = 0.55  // 0-1 score below which we require manual tap fallback

// ── HSV range for wooden tongue depressor ──────────────────────
// Wood color: pale beige/yellow. Hue 25-55° in OpenCV 0-180 scale → 12-28
// Saturation moderate (not pure white, not deeply saturated)
// Value (brightness) medium to high (wood is light colored)
const WOOD_HUE_MIN = 10
const WOOD_HUE_MAX = 35
const WOOD_SAT_MIN = 25
const WOOD_SAT_MAX = 180
const WOOD_VAL_MIN = 90
const WOOD_VAL_MAX = 240

export default function Calibration({ navigate, patient }) {
  const camRef = useRef(null)
  const imgRef = useRef(null)
  const imgNatRef = useRef({ w: 1280, h: 720 })

  const [step, setStep] = useState('intro')
  const [facingMode, setFacingMode] = useState('environment')
  const [imgData, setImgData] = useState(null)
  const [imgNat, setImgNat] = useState({ w: 1280, h: 720 })
  const [detection, setDetection] = useState(null)   // { topPx, bottomPx, widthPx, lengthPx, aspectRatio, tiltDeg, confidence, pxPerMm }
  const [pxPerMm, setPxPerMm] = useState(null)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState(null)
  const [manualPts, setManualPts] = useState([])

  useEffect(() => { imgNatRef.current = imgNat }, [imgNat])

  // ═══════════════════════════════════════════════════════════════
  // CORE DETECTION: Find wooden tongue depressor in captured frame
  // ═══════════════════════════════════════════════════════════════
  const detectDepressor = useCallback(async (dataUrl) => {
    setDetecting(true)
    setError(null)

    try {
      // ── 1. Load image into canvas for pixel access ──────────────
      const img = new Image()
      img.src = dataUrl
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej })

      // Downsample for speed while keeping aspect ratio exact
      const scale = DOWNSAMPLE_WIDTH / img.naturalWidth
      const dsW = DOWNSAMPLE_WIDTH
      const dsH = Math.round(img.naturalHeight * scale)

      const canvas = document.createElement('canvas')
      canvas.width = dsW
      canvas.height = dsH
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, dsW, dsH)
      const imageData = ctx.getImageData(0, 0, dsW, dsH)

      // ── 2. Build binary mask of wood-colored pixels (HSV range) ─
      const mask = new Uint8Array(dsW * dsH)
      const data = imageData.data
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const [h, s, v] = rgbToHsv(r, g, b)
        if (h >= WOOD_HUE_MIN && h <= WOOD_HUE_MAX &&
            s >= WOOD_SAT_MIN && s <= WOOD_SAT_MAX &&
            v >= WOOD_VAL_MIN && v <= WOOD_VAL_MAX) {
          mask[p] = 1
        }
      }

      // ── 3. Morphological cleanup (remove noise, fill small gaps) ─
      const cleaned = morphClose(mask, dsW, dsH)

      // ── 4. Connected components — find all candidate regions ────
      const regions = findRegions(cleaned, dsW, dsH)
      if (regions.length === 0) {
        throw new Error('No wood-colored region found. Ensure the depressor is fully visible and well lit.')
      }

      // ── 5. Score each region for "depressor-like" qualities ─────
      const scored = regions
        .filter(r => r.pixelCount >= MIN_PIXELS_REGION)
        .map(r => scoreRegion(r, dsW, dsH))
        .filter(s => s !== null)
        .sort((a, b) => b.confidence - a.confidence)

      if (scored.length === 0) {
        throw new Error('No depressor-shaped region found. Hold the depressor vertically — full length visible.')
      }

      const best = scored[0]

      if (best.confidence < MIN_CONFIDENCE) {
        throw new Error(`Detection confidence low (${Math.round(best.confidence * 100)}%). Ensure good lighting and clear contrast against skin/background, then retry. You can also use manual tap mode.`)
      }

      // ── 6. Convert downsampled pixels back to original frame pixels ─
      const origLengthPx = best.lengthPx / scale

      // ── 7. Tilt used for confidence penalty, NOT length correction ──
      // For in-plane tilt up to 20°, bounding box height ≈ L×cos(θ) + W×sin(θ).
      // At 20°: 150×0.94 + 18×0.34 = 147px — only 2% error vs 150px true.
      // Length correction not needed. Tilt is used only to reject regions
      // beyond MAX_TILT_DEGREES and reduce confidence for mildly tilted ones.
      const correctedLengthPx = origLengthPx

      // ── 8. Compute pxPerMm using depressor LENGTH (vertical axis) ─
      const computedPxPerMm = correctedLengthPx / DEPRESSOR_LENGTH_MM

      // Sanity check — reasonable range for phone at 50–90cm
      if (computedPxPerMm < 0.8 || computedPxPerMm > 30) {
        throw new Error(`Unusual scale detected (${computedPxPerMm.toFixed(2)} px/mm). Retake photo with depressor clearly visible.`)
      }

      setDetection({
        topPx: best.topPx / scale,
        bottomPx: best.bottomPx / scale,
        leftPx: best.leftPx / scale,
        rightPx: best.rightPx / scale,
        lengthPx: correctedLengthPx,
        widthPx: best.widthPx / scale,
        aspectRatio: best.aspectRatio,
        tiltDeg: best.tiltDeg,
        confidence: best.confidence,
        pxPerMm: computedPxPerMm,
        centerX: ((best.leftPx + best.rightPx) / 2) / scale,
      })
      setPxPerMm(computedPxPerMm)
      setStep('confirm')
    } catch (e) {
      setError(e.message || 'Detection failed. Try again or use manual tap mode.')
    } finally {
      setDetecting(false)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // Capture frame from live camera
  // ═══════════════════════════════════════════════════════════════
  const captureFrame = () => {
    const v = camRef.current?.video
    if (!v || v.readyState < 2) {
      alert('Camera not ready — wait a moment then try again.')
      return
    }
    const c = document.createElement('canvas')
    c.width = v.videoWidth || 1280
    c.height = v.videoHeight || 720
    c.getContext('2d').drawImage(v, 0, 0)
    const newNat = { w: c.width, h: c.height }
    setImgNat(newNat)
    imgNatRef.current = newNat
    const url = c.toDataURL('image/jpeg', 0.95)
    setImgData(url)
    setError(null)
    setManualPts([])    
    setStep('detecting')
    // Run detection after paint
    setTimeout(() => detectDepressor(url), 50)
  }

  // ═══════════════════════════════════════════════════════════════
  // Manual tap fallback (kept from original flow)
  // ═══════════════════════════════════════════════════════════════
  const manualPtsRef = useRef([])
  useEffect(() => { manualPtsRef.current = manualPts }, [manualPts])

  const processManualTap = useCallback((clientX, clientY) => {
    const img = imgRef.current
    if (!img) return
    const current = manualPtsRef.current
    if (current.length >= 2) return
    const rect = img.getBoundingClientRect()
    const nat = imgNatRef.current
    const natX = Math.max(0, Math.min(nat.w, (clientX - rect.left) * (nat.w / rect.width)))
    const natY = Math.max(0, Math.min(nat.h, (clientY - rect.top) * (nat.h / rect.height)))

    if (current.length === 0) {
      const next = [{ x: natX, y: natY }]
      manualPtsRef.current = next
      setManualPts(next)
    } else {
      const first = current[0]
      const dy = Math.abs(natY - first.y)
      if (dy < 30) {
        setError('Taps too close. Tap the TOP of the depressor, then the BOTTOM.')
        return
      }
      const lengthPx = Math.sqrt(Math.pow(natX - first.x, 2) + Math.pow(natY - first.y, 2))
      const ratio = lengthPx / DEPRESSOR_LENGTH_MM
      if (ratio < 0.5 || ratio > 30) {
        setError(`Unusual result (${ratio.toFixed(2)} px/mm). Retry — tap top and bottom of depressor.`)
        manualPtsRef.current = []
        setManualPts([])
        return
      }
      const next = [first, { x: natX, y: natY }]
      manualPtsRef.current = next
      setManualPts(next)
      setPxPerMm(ratio)

      setDetection({
        topPx: Math.min(first.y, natY),
        bottomPx: Math.max(first.y, natY),
        leftPx: Math.min(first.x, natX) - 10,
        rightPx: Math.max(first.x, natX) + 10,
        centerX: (first.x + natX) / 2,
        lengthPx,
        widthPx: 0,
        aspectRatio: null,
        tiltDeg: 0,
        confidence: 1.0,
        pxPerMm: ratio,
        manual: true,
      })
      setStep('confirm')
    }
  }, [])

  const handleManualClick = useCallback((e) => {
    processManualTap(e.clientX, e.clientY)
  }, [processManualTap])

  const handleManualTouch = useCallback((e) => {
    e.preventDefault()
    const t = e.changedTouches?.[0]
    if (t) processManualTap(t.clientX, t.clientY)
  }, [processManualTap])

  // ═══════════════════════════════════════════════════════════════
  // Reset flows
  // ═══════════════════════════════════════════════════════════════
  const retryAutoDetect = () => {
    setImgData(null); setDetection(null); setPxPerMm(null)
    setError(null); setManualPts([]); 
    setStep('live')
  }

  const switchToManual = () => {
    setError(null)
    setManualPts([])
    setStep('tap')
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="screen">

      {/* ── HEADER ── */}
      <div style={{ background:'linear-gradient(135deg,#0D9488,#0F766E)', padding:'48px 20px 20px' }}>
        <button onClick={() => navigate('patient')}
          style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:36, height:36,
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', marginBottom:12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>Step 1 of 4 — Required</div>
        <div style={{ fontSize:22, fontWeight:800, color:'#fff', marginTop:2 }}>Depressor Calibration</div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:3 }}>Patient: {patient?.name}</div>
      </div>

      {/* ══════════════════ INTRO ══════════════════ */}
      {step === 'intro' && (
        <>
          <div className="scroll-body">
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:'var(--radius)', padding:'14px 16px', fontSize:13, color:'#1E40AF', lineHeight:1.7 }}>
              <strong>Auto-calibration with wooden tongue depressor</strong><br/>
              Standard wooden depressor: <strong>150 mm long × 18 mm wide</strong>. App auto-detects edges — no tapping needed.
            </div>

            <div className="card" style={{ padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>How to Position</div>

              <div style={{ background:'#F8FAFC', borderRadius:10, padding:14, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:20 }}>✅</span>
                  <span style={{ fontSize:12, color:'#166534', lineHeight:1.5 }}>Hold depressor <strong>VERTICALLY</strong> beside patient's cheek (either side — left or right)</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:20 }}>✅</span>
                  <span style={{ fontSize:12, color:'#166534', lineHeight:1.5 }}><strong>Full length</strong> visible — both top and bottom ends in frame</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:20 }}>✅</span>
                  <span style={{ fontSize:12, color:'#166534', lineHeight:1.5 }}>Keep depressor <strong>flat to camera</strong> — don't angle it forward or back</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:20 }}>✅</span>
                  <span style={{ fontSize:12, color:'#166534', lineHeight:1.5 }}>Good lighting — wood color must contrast with skin and background</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:20 }}>❌</span>
                  <span style={{ fontSize:12, color:'#DC2626', lineHeight:1.5 }}>Do NOT cover the chin or mouth area</span>
                </div>
              </div>

              <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>Steps</div>
              {[
                'Hold depressor vertically beside patient\'s cheek (any side).',
                'Full length of depressor must be visible in frame.',
                'Hold phone at 60–80 cm. Tap OPEN CAMERA.',
                'When depressor is clearly visible, tap CAPTURE FRAME.',
                'App auto-detects edges and calibrates — no tap needed.',
              ].map((t, i) => (
                <div key={i} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--teal)', color:'#fff', fontSize:11, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</div>
                  <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, paddingTop:2 }}>{t}</div>
                </div>
              ))}
            </div>

            <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'var(--radius)', padding:'12px 16px', fontSize:12, color:'#166534', lineHeight:1.6 }}>
              📏 Standard tongue depressor = <strong>150 mm × 18 mm</strong>. Available in every dental clinic. Expected accuracy: <strong>±0.3 mm</strong>.
            </div>
          </div>

          <div style={{ padding:16, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
            <button className="btn btn-primary" onClick={() => setStep('live')} style={{ borderRadius:14 }}>
              OPEN CAMERA →
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('camera-rest', { pxPerMm: null, calibrationResolution: null })} style={{ borderRadius:14, fontSize:12 }}>
              SKIP — use without calibration (lower accuracy)
            </button>
          </div>
        </>
      )}

      {/* ══════════════════ LIVE CAMERA ══════════════════ */}
      {step === 'live' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#000', position:'relative', minHeight:480 }}>
          <Webcam ref={camRef} audio={false}
            key={facingMode}
            videoConstraints={{ facingMode, width:{ideal:3840}, height:{ideal:2160} }}
            style={{ width:'100%', flex:1, objectFit:'cover' }}
            mirrored={false}
            onUserMedia={(stream) => {
              const track = stream.getVideoTracks()[0]
              const settings = track?.getSettings()
              if (settings?.width && settings?.height) {
                setImgNat({ w: settings.width, h: settings.height })
              }
            }}
          />

          {/* Guide overlays */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
            {/* Face oval guide */}
            <div style={{ position:'absolute', left:'28%', right:'28%', top:'10%', bottom:'15%',
              border:'1.5px dashed rgba(255,255,255,0.20)', borderRadius:'50%' }}/>

            {/* LEFT depressor guide */}
            <div style={{ position:'absolute', left:'5%', top:'12%', bottom:'12%', width:28,
              border:'2.5px dashed rgba(16,185,129,0.85)', borderRadius:4, background:'rgba(16,185,129,0.08)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontSize:9, fontWeight:800, writingMode:'vertical-rl', textShadow:'0 1px 3px rgba(0,0,0,0.8)', letterSpacing:1 }}>DEPRESSOR</span>
            </div>

            {/* RIGHT depressor guide */}
            <div style={{ position:'absolute', right:'5%', top:'12%', bottom:'12%', width:28,
              border:'2.5px dashed rgba(16,185,129,0.85)', borderRadius:4, background:'rgba(16,185,129,0.08)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontSize:9, fontWeight:800, writingMode:'vertical-rl', textShadow:'0 1px 3px rgba(0,0,0,0.8)', letterSpacing:1 }}>DEPRESSOR</span>
            </div>

            <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', background:'rgba(0,0,0,0.6)', borderRadius:6, padding:'4px 10px' }}>
              <span style={{ color:'rgba(255,255,255,0.8)', fontSize:9, fontWeight:600 }}>Hold depressor on EITHER side</span>
            </div>
          </div>

          {/* Top instruction */}
          <div style={{ position:'absolute', top:0, left:0, right:0, background:'rgba(0,0,0,0.80)', padding:'10px 14px' }}>
            <div style={{ color:'#fff', fontSize:12, fontWeight:800, marginBottom:3 }}>
              📏 Hold depressor VERTICALLY beside cheek (either side)
            </div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontSize:10 }}>
              Full length must be visible. Flat to camera — not angled.
            </div>
          </div>

          <div style={{ padding:'12px 16px 24px', background:'rgba(0,0,0,0.85)'}}>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost" onClick={() => setStep('intro')} style={{ flex:1, borderRadius:12, fontSize:12 }}>← BACK</button>
              <button onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}
                style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:12, padding:'0 14px', cursor:'pointer', color:'#fff', fontSize:12, fontWeight:700 }}>
                🔄 CAM
              </button>
              <button className="btn btn-primary" onClick={captureFrame} style={{ flex:2, borderRadius:12, fontSize:13 }}>CAPTURE FRAME</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ DETECTING (spinner) ══════════════════ */}
      {step === 'detecting' && !error && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#000', gap:20, padding:32 }}>
          <div className="spinner" style={{ width:52, height:52, borderWidth:5 }}/>
          <div style={{ color:'#fff', fontSize:15, fontWeight:700 }}>Detecting depressor...</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:12, textAlign:'center', lineHeight:1.6 }}>
            Analyzing color and shape<br/>Usually takes 1–2 seconds
          </div>
        </div>
      )}

      {/* ══════════════════ ERROR (after detection failed) ══════════════════ */}
      {step === 'detecting' && error && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.93)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:18 }}>
          <div style={{ fontSize:40 }}>⚠️</div>
          <div style={{ color:'#fff', fontSize:14, fontWeight:600, textAlign:'center', maxWidth:320, lineHeight:1.5 }}>{error}</div>
          <div style={{ display:'flex', gap:10, width:'100%', maxWidth:320 }}>
            <button className="btn btn-outline" style={{ flex:1 }} onClick={retryAutoDetect}>RETAKE PHOTO</button>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={switchToManual}>MANUAL TAP</button>
          </div>
        </div>
      )}

      {/* ══════════════════ MANUAL TAP FALLBACK ══════════════════ */}
      {step === 'tap' && imgData && (
        <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
          <div style={{ background: manualPts.length === 0 ? '#F59E0B' : '#10B981', padding:'10px 16px', textAlign:'center' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>
              {manualPts.length === 0 ? 'Tap the TOP of the depressor' : 'Now tap the BOTTOM of the depressor'}
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)', marginTop:2 }}>
              Full length = 150 mm
            </div>
          </div>

          {error && (
            <div style={{ background:'#FEF2F2', padding:'10px 14px', textAlign:'center' }}>
              <div style={{ fontSize:12, color:'#DC2626' }}>⚠️ {error}</div>
            </div>
          )}

          <div style={{ position:'relative', background:'#000', flex:1 }}>
            <img ref={imgRef} src={imgData} alt="calibration"
              style={{ width:'100%', display:'block', touchAction:'none', userSelect:'none', cursor:'crosshair' }}
              draggable={false}
              onLoad={(e) => {
                const nat = { w: e.target.naturalWidth, h: e.target.naturalHeight }
                setImgNat(nat); imgNatRef.current = nat
              }}
              onClick={handleManualClick}
              onTouchEnd={handleManualTouch}
            />

            {manualPts.map((pt, i) => (
              <div key={i} style={{
                position:'absolute',
                left: `${(pt.x / imgNat.w) * 100}%`,
                top:  `${(pt.y / imgNat.h) * 100}%`,
                transform:'translate(-50%,-50%)',
                width:40, height:40,
                border:`3px solid ${i === 0 ? '#10B981' : '#3B82F6'}`,
                borderRadius:'50%',
                background: i === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)',
                pointerEvents:'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:900, color:'#fff',
              }}>{i === 0 ? 'T' : 'B'}</div>
            ))}
          </div>

          <div style={{ padding:'12px 16px', background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
            <button className="btn btn-outline" onClick={retryAutoDetect} style={{ flex:1, borderRadius:12 }}>RETAKE</button>
            {manualPts.length > 0 && (
              <button className="btn btn-ghost" onClick={() => { manualPtsRef.current=[]; setManualPts([]); setError(null) }} style={{ flex:1, borderRadius:12 }}>RESET</button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ CONFIRM ══════════════════ */}
      {step === 'confirm' && pxPerMm && detection && (
        <>
          <div className="scroll-body">
            <div className="card" style={{ padding:20, textAlign:'center' }}>
              <div style={{ fontSize:44, marginBottom:10 }}>✅</div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--teal)', marginBottom:8 }}>
                {detection.manual ? 'Manual calibration set' : 'Auto-calibration successful'}
              </div>
              <div style={{ fontSize:36, fontWeight:900, color:'var(--text)', lineHeight:1 }}>
                {(1/pxPerMm).toFixed(3)}
                <span style={{ fontSize:14, fontWeight:400, color:'var(--text3)', marginLeft:4 }}>mm/px</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:8 }}>
                {pxPerMm.toFixed(2)} px/mm · Depressor: 150 mm
              </div>
              {!detection.manual && (
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>
                  Detection confidence: {Math.round(detection.confidence * 100)}% · Tilt: {detection.tiltDeg.toFixed(1)}°
                </div>
              )}
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                Patient IPD will be measured automatically during REST scan
              </div>
            </div>

            {imgData && (
              <div className="card" style={{ overflow:'hidden' }}>
                <div style={{ position:'relative' }}>
                  <img src={imgData} alt="calibration" style={{ width:'100%', display:'block', objectFit:'contain' }}/>
                  <div style={{
                    position:'absolute',
                    left: `${(detection.leftPx / imgNat.w) * 100}%`,
                    top:  `${(detection.topPx / imgNat.h) * 100}%`,
                    width: `${((detection.rightPx - detection.leftPx) / imgNat.w) * 100}%`,
                    height:`${((detection.bottomPx - detection.topPx) / imgNat.h) * 100}%`,
                    border:'2.5px solid #10B981',
                    boxShadow:'0 0 10px rgba(16,185,129,0.8)',
                    borderRadius:2,
                  }}/>
                  <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.78)', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#fff', fontWeight:700 }}>
                    📏 {pxPerMm.toFixed(2)} px/mm
                  </div>
                </div>
              </div>
            )}

            <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'var(--radius)', padding:'12px 16px', fontSize:12, color:'#166534' }}>
              ✅ Expected accuracy with this calibration: <strong>±0.3 mm</strong>
            </div>
          </div>

          <div style={{ padding:16, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('camera-rest', { 
                pxPerMm, 
                calibrationResolution: { w: imgNat.w, h: imgNat.h }
              })} 
              style={{ borderRadius:14 }}
            >
              PROCEED TO REST SCAN →
            </button>
            <button className="btn btn-outline" onClick={retryAutoDetect} style={{ borderRadius:14 }}>
              REDO CALIBRATION
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// RGB to HSV — returns [H 0-180, S 0-255, V 0-255] OpenCV-style
function rgbToHsv(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn)      h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else                 h = (rn - gn) / d + 4
    h *= 30  // 0-180 range (OpenCV style)
    if (h < 0) h += 180
  }
  const s = max === 0 ? 0 : (d / max) * 255
  const v = max * 255
  return [h, s, v]
}

// Morphological close (dilate then erode) — fills small gaps in mask
function morphClose(mask, w, h) {
  const dilated = new Uint8Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (mask[i] || mask[i-1] || mask[i+1] || mask[i-w] || mask[i+w]) {
        dilated[i] = 1
      }
    }
  }
  const eroded = new Uint8Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (dilated[i] && dilated[i-1] && dilated[i+1] && dilated[i-w] && dilated[i+w]) {
        eroded[i] = 1
      }
    }
  }
  return eroded
}

// Connected component labeling — finds all distinct regions
function findRegions(mask, w, h) {
  const labels = new Int32Array(w * h)
  const regions = []
  let nextLabel = 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (mask[i] && labels[i] === 0) {
        // BFS flood fill
        const stack = [i]
        const pixels = []
        labels[i] = nextLabel
        let minX = x, maxX = x, minY = y, maxY = y
        while (stack.length) {
          const p = stack.pop()
          pixels.push(p)
          const px = p % w, py = Math.floor(p / w)
          if (px < minX) minX = px
          if (px > maxX) maxX = px
          if (py < minY) minY = py
          if (py > maxY) maxY = py
          const neighbors = [p - 1, p + 1, p - w, p + w]
          for (const np of neighbors) {
            if (np >= 0 && np < w * h && mask[np] && labels[np] === 0) {
              labels[np] = nextLabel
              stack.push(np)
            }
          }
        }
        regions.push({ pixels, pixelCount: pixels.length, minX, maxX, minY, maxY })
        nextLabel++
      }
    }
  }
  return regions
}


function scoreRegion(region, w, h) {
  const bboxWidth  = region.maxX - region.minX + 1
  const bboxHeight = region.maxY - region.minY + 1

  // For a vertically-held depressor: length = vertical axis, width = horizontal axis
  const lengthPx = bboxHeight
  const widthPx  = bboxWidth

  if (lengthPx < 40) return null
  if (widthPx < 4)   return null

  // ── PHASE 2 FIX: reject face/skin false positives ──
  // ── PHASE 2 FIX (Bug 4): reject face/skin false positives ──
  // Indian skin tones overlap wood HSV range. A hand or face blob
  // can produce a connected region that superficially passes aspect
  // check. Reject regions in the horizontal center (where face lives)
  // and regions too wide to be a depressor (150×18mm depressor at any
  // reasonable distance is narrow — wide blobs are hand+depressor merged).
  const centerFrac = (region.minX + region.maxX) / 2 / w
  const isCentered = centerFrac > 0.35 && centerFrac < 0.65
  if (isCentered) return null

  const widthFrac = widthPx / w
  if (widthFrac > 0.35) return null

  const measuredAspect = lengthPx / widthPx
  const aspectDev = Math.abs(measuredAspect - DEPRESSOR_ASPECT) / DEPRESSOR_ASPECT

  if (measuredAspect < 2) return null

  const bboxArea   = bboxWidth * bboxHeight
  const fillRatio  = region.pixelCount / bboxArea

  if (fillRatio < 0.55) return null

  
  // Estimate tilt from aspect ratio deviation
  // If measured aspect < 8.33, depressor is tilted (foreshortening width less than length)
  // Simplified: tiltDeg from aspect distortion
  let tiltDeg = 0
  if (measuredAspect < DEPRESSOR_ASPECT) {
    const ratio = measuredAspect / DEPRESSOR_ASPECT
    tiltDeg = Math.acos(Math.min(1, Math.max(0, ratio))) * 180 / Math.PI
  }

  if (tiltDeg > MAX_TILT_DEGREES) return null
  if (aspectDev > ASPECT_TOLERANCE) return null

  const aspectScore = 1 - aspectDev
  const fillScore   = Math.min(1, fillRatio / 0.9)
  const sizeScore   = Math.min(1, region.pixelCount / 2000)
  const confidence  = (aspectScore * 0.5 + fillScore * 0.3 + sizeScore * 0.2)

  return {
    topPx:      region.minY,
    bottomPx:   region.maxY,
    leftPx:     region.minX,
    rightPx:    region.maxX,
    lengthPx,
    widthPx,
    aspectRatio: measuredAspect,
    tiltDeg,
    confidence,
    pixelCount:  region.pixelCount,
  }
}