// Camera.jsx
import { useEffect, useRef, useState } from 'react'
import Webcam from 'react-webcam'

// ── MediaPipe Face Mesh landmark indices ──────────────────────────
const L_ALAR    = 94    // Left alar base  — subnasale Y midpoint
const R_ALAR    = 323   // Right alar base — subnasale Y midpoint
const CHIN      = 152   // Gnathion / menton (lowest chin point)
const L_EYE     = 33    // Left inner canthus
const R_EYE     = 263   // Right inner canthus
const NASION    = 168   // Nose bridge (display only)
const NOSE_TIP  = 1     // Nose tip (pitch check)
const L_CHEEK   = 234   // Left face edge
const R_CHEEK   = 454   // Right face edge
const FOREHEAD  = 10    // Forehead top
const L_EYE_TOP = 159   // Left upper eyelid
const L_EYE_BOT = 145   // Left lower eyelid
const R_EYE_TOP = 386   // Right upper eyelid
const R_EYE_BOT = 374   // Right lower eyelid

// ── Distance gate — IPD in pixels ────────────────────────────────
// Wide range to accommodate laptop (70px at 90cm) and phone (180px at 50cm)
const IPD_MIN = 60
const IPD_MAX = 500
const IPD_MM  = 63   // Average Indian adult IPD — fallback calibration only

// ── Face orientation thresholds ───────────────────────────────────
const MAX_ROLL     = 5      // degrees — head side tilt
const MAX_YAW      = 0.16   // ratio — head left/right turn
const PITCH_MIN    = 0.025  // ratio — chin too high
const PITCH_MAX    = 0.260  // ratio — chin too low
const MIN_AREA     = 0.010  // fraction of frame — face too small/blocked

// ── Measurement / Kalman settings ────────────────────────────────
// Kalman steady-state P_ss ≈ sqrt(Q × R) = sqrt(0.03 × 0.5) ≈ 0.122
// We lock by STD DEV check, NOT by P threshold (P threshold was the original bug)
const FRAMES_NEEDED = 60    // Minimum frames before checking for lock
const FRAMES_FORCE  = 120   // Force lock after this many frames regardless of SD
const KALMAN_Q      = 0.03  // Process noise — how much real value changes per frame
const KALMAN_R      = 0.50  // Measurement noise — per-frame reading variance
const MM_FLOOR      = 40    // Reject readings below this — anatomically impossible
const MM_CEIL       = 90    // Reject readings above this — anatomically impossible

// ── SD lock thresholds (adaptive) ────────────────────────────────
// With credit card calibration: tight threshold (accurate measurements)
// Without calibration (IPD fallback): looser threshold (inherently noisier)
const SD_WITH_CAL    = 0.60  // mm — lock when SD < this (calibrated mode)
const SD_WITHOUT_CAL = 1.40  // mm — lock when SD < this (IPD fallback mode)

// ── PHASE 3: Per-frame live scaling parameters ──
const PMM_SMOOTH_WINDOW         = 5    // Rolling window for pxPerMm smoothing
const PMM_SMOOTH_WINDOW_GLASSES = 15   // Extended window when glasses detected
const PMM_OUTLIER_THRESHOLD     = 0.08 // Reject frames where pxPerMm deviates >8% from rolling mean
// ── PHASE 4: Best-frame retrospective capture ──
const FRAME_BUF_MAX = 150   // ~30fps × 5 seconds — metadata only (~7.5 KB total)

// ─────────────────────────────────────────────────────────────────
// Kalman 1D optimal filter
// After convergence, reduces per-frame noise by factor of ~K_ss ≈ 0.245
// ─────────────────────────────────────────────────────────────────
class Kalman {
  constructor() { this.Q = KALMAN_Q; this.R = KALMAN_R; this.P = 1.0; this.x = null }
  feed(z) {
    if (this.x === null) { this.x = z; return z }
    this.P += this.Q
    const K = this.P / (this.P + this.R)
    this.x += K * (z - this.x)
    this.P *= (1 - K)
    return this.x
  }
  reset() { this.P = 1.0; this.x = null }
}

// ── Helper math functions ─────────────────────────────────────────
function ipdPx(a, b, W, H)     { return Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) }
function vertPx(yA, yB, H)     { return Math.abs(yA - yB) * H }
function rollDeg(lE, rE, W, H) { return Math.abs(Math.atan2((rE.y - lE.y) * H, (rE.x - lE.x) * W) * 180 / Math.PI) }
function yawRatio(lE, rE, nt)  { const l = Math.abs(nt.x - lE.x), r = Math.abs(rE.x - nt.x); return Math.abs(1 - l / (r || 0.001)) }
function faceArea(lC, rC, fh, ch) { return Math.abs(rC.x - lC.x) * Math.abs(ch.y - fh.y) }
function stdDev(arr) {
  if (arr.length < 2) return 999
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length)
}

// ── Glasses detection ─────────────────────────────────────────────
// FIX: Old threshold 0.18 caused false positives at laptop distance (90cm)
// because face is small → eye gap in pixels is small → ratio below 0.18
// New threshold 0.09 only triggers for genuinely very thick frame glasses.
// FIX: Glasses now show WARNING ONLY — measurement is NOT blocked.
// The dentist sees the warning and can ask patient to remove glasses.
// Blocking all frames was causing 0% progress indefinitely.
function detectGlasses(lm, W, H) {
  const lGap = Math.abs(lm[L_EYE_TOP].y - lm[L_EYE_BOT].y) * H
  const rGap = Math.abs(lm[R_EYE_TOP].y - lm[R_EYE_BOT].y) * H
  const ipd  = ipdPx(lm[L_EYE], lm[R_EYE], W, H)
  // Only fire if BOTH eye gaps are less than 9% of IPD — extremely narrow
  return (lGap / (ipd || 1) < 0.09) && (rGap / (ipd || 1) < 0.09)
}

// ── Chin obstruction detection ────────────────────────────────────
// If gnathion is less than 7% of frame height below subnasale,
// something is blocking the chin (hand, card held wrong, scarf, etc.)
// This DOES block measurement because chin is one of the two endpoints.
function detectChinBlocked(lm) {
  const snY = (lm[L_ALAR].y + lm[R_ALAR].y) / 2
  return (lm[CHIN].y - snY) < 0.07
}

// ─────────────────────────────────────────────────────────────────
// Camera Screen Component
//
// Props:
//   mode             'rest' | 'occ'
//   patient          { name, age, gender, notes }
//   pxPerMm          From credit card calibration (null = IPD fallback)
//   positionBaseline From REST capture — retained in props but position lock removed (PHASE 3)
//   ipdMm            Patient's true IPD in mm from calibration (PHASE 3)
// ─────────────────────────────────────────────────────────────────
export default function Camera({ navigate, mode, patient, pxPerMm, positionBaseline, calibrationResolution, ipdMm }) {
  const camRef    = useRef(null)
  const canvasRef = useRef(null)
  const lmkRef    = useRef(null)
  const rafRef    = useRef(null)

  // All values read inside animation loop must be refs (no stale closures)
  const kalmanRef    = useRef(new Kalman())
  const framesRef    = useRef(0)
  const lockedRef    = useRef(null)
  const pxPerMmRef   = useRef(pxPerMm)
  const baselineRef  = useRef(positionBaseline)
  const calibResRef  = useRef(calibrationResolution)   // PHASE 1
  const ipdMmRef     = useRef(ipdMm)                   // PHASE 3: patient's true IPD for per-frame scaling
  const snapRef      = useRef({ ipdPx: null, noseY: null, faceArea: null })
  const estimatesRef = useRef([])    // Rolling buffer of last 20 Kalman estimates

  // ── PHASE 3: Rolling buffer of recent pxPerMm_live values ──
  // Smooths per-frame scale against landmark jitter.
  // Window expands when glasses detected (more jitter).
  const pmmLiveBufferRef = useRef([])

  // ── FIX 1: Add missing refs for IPD measurement ──
  // PHASE 3: Measure patient's true IPD in mm during first frames of REST
  // Collect IPD_px / pmmCorrected over first 10 valid frames, then lock the mean
  // as the patient's IPD_mm reference. Used for per-frame live scaling thereafter.
  const ipdSamplesRef  = useRef([])
  const ipdMeasuredRef = useRef(null)   // Set once, then stable for session
  // ── PHASE 4: Best-frame metadata buffer ──
  // Stores ~50 bytes per frame × 150 frames = ~7.5 KB total (not images)
  const frameBufRef = useRef([])


  // React state — for UI updates only
  const [loading,   setLoading]   = useState(true)
  const [loadMsg,   setLoadMsg]   = useState('Loading AI model...')
  const [error,     setError]     = useState(null)
  const [capturing, setCapturing] = useState(false)
  const [status,    setStatus]    = useState('none')
  const [pct,       setPct]       = useState(0)
  const [lockedMM,  setLockedMM]  = useState(null)
  const [liveMM,    setLiveMM]    = useState(null)
  const [warnGlass, setWarnGlass] = useState(false)
  const [warnBlock, setWarnBlock] = useState(false)
  const [warnCalib, setWarnCalib] = useState(false)   // PHASE 1: IPD sanity check
  const [ipdMmDisplay, setIpdMmDisplay] = useState(null)   // PHASE 1: live IPD in mm

  const isRest = mode === 'rest'
  const hasCal = pxPerMm != null
  const accent = isRest ? '#0D9488' : '#E91E8C'
  const [facingMode, setFacingMode] = useState('environment')


  // Keep refs in sync with props
  useEffect(() => { pxPerMmRef.current  = pxPerMm        }, [pxPerMm])
  useEffect(() => { baselineRef.current = positionBaseline}, [positionBaseline])
  useEffect(() => { calibResRef.current = calibrationResolution }, [calibrationResolution])   // PHASE 1

  // ── FIX 2: Initialize ipdMeasuredRef from prop (for OCC mode) ──
  useEffect(() => {
    ipdMmRef.current = ipdMm
    // PHASE 3: If ipdMm arrives from parent (OCC mode), treat it as already measured
    if (ipdMm && !ipdMeasuredRef.current) {
      ipdMeasuredRef.current = ipdMm
    }
  }, [ipdMm])

  // ── FIX 5: Reset all measurement state — wipe() handles ipdSamplesRef ──
  function wipe() {
    kalmanRef.current.reset()
    framesRef.current = 0
    estimatesRef.current = []
    pmmLiveBufferRef.current = []   // PHASE 3
    frameBufRef.current = []   // PHASE 4
    // PHASE 3: DO NOT clear ipdMeasuredRef on wipe — once locked for the
    // session, the patient's IPD_mm stays valid. ipdSamplesRef cleared
    // only if measurement hasn't been locked yet (face-lost during collection).
    if (!ipdMeasuredRef.current) {
      ipdSamplesRef.current = []
    }
    lockedRef.current = null
    setLockedMM(null); setLiveMM(null); setPct(0)
  }

  // ── Load MediaPipe FaceLandmarker ─────────────────────────────
  useEffect(() => {
    let dead = false
    async function load() {
      try {
        setLoadMsg('Loading vision library...')
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
        setLoadMsg('Downloading AI model (~5 MB)...')
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        )
        const lmk = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        })
        if (!dead) {
          lmkRef.current = lmk
          setLoading(false)
          requestAnimationFrame(tick)
        }
      } catch {
        if (!dead) {
          setError('AI model load failed. Check internet connection and reload.')
          setLoading(false)
        }
      }
    }
    load()
    return () => { dead = true; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // ── Main detection + measurement loop ────────────────────────
  function tick() {
    const video  = camRef.current?.video
    const canvas = canvasRef.current
    const lmk    = lmkRef.current
    if (!video || !canvas || !lmk || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick); return
    }

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    const W = canvas.width, H = canvas.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)

    // ── Draw guide oval ───────────────────────────────────────
    const gCX = W * 0.5, gCY = H * 0.46, gRX = W * 0.26, gRY = H * 0.38
    ctx.save(); ctx.translate(gCX, gCY); ctx.scale(1, gRY / gRX)
    ctx.beginPath(); ctx.arc(0, 0, gRX, 0, Math.PI * 2); ctx.restore()
    ctx.setLineDash([14, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Align face inside oval', gCX, gCY - gRY - 10); ctx.textAlign = 'start'

    // ── Run MediaPipe face detection ──────────────────────────
    let result
    try { result = lmk.detectForVideo(video, performance.now()) }
    catch { rafRef.current = requestAnimationFrame(tick); return }

    if (!result.faceLandmarks?.length) {
      wipe(); setStatus('none'); setWarnGlass(false); setWarnBlock(false)
      rafRef.current = requestAnimationFrame(tick); return
    }
    const lm = result.faceLandmarks[0]

    // ── Compute subnasale (clinical landmark) ─────────────────
    // True subnasale = midpoint of bilateral alar bases (landmarks 94 + 323)
    // This is ~15mm ABOVE the philtrum (old wrong landmark 164)
    const snX = (lm[L_ALAR].x + lm[R_ALAR].x) / 2
    const snY = (lm[L_ALAR].y + lm[R_ALAR].y) / 2

    // Convert normalized coordinates to pixel coordinates
    const nPx  = { x: snX * W,           y: snY * H }
    const cPx  = { x: lm[CHIN].x * W,    y: lm[CHIN].y * H }
    const lCPx = { x: lm[L_CHEEK].x * W, y: lm[L_CHEEK].y * H }
    const rCPx = { x: lm[R_CHEEK].x * W, y: lm[R_CHEEK].y * H }
    const fhPx = { x: lm[FOREHEAD].x * W,y: lm[FOREHEAD].y * H }
    const nasPx= { x: lm[NASION].x * W,  y: lm[NASION].y * H }

    // ── Face quality validation ───────────────────────────────
    const ipd       = ipdPx(lm[L_EYE], lm[R_EYE], W, H)
    const distStat  = ipd < IPD_MIN ? 'far' : ipd > IPD_MAX ? 'close' : 'ok'
    const badRoll   = rollDeg(lm[L_EYE], lm[R_EYE], W, H) > MAX_ROLL
    const badYaw    = yawRatio(lm[L_EYE], lm[R_EYE], lm[NOSE_TIP]) > MAX_YAW
    const pv        = lm[NOSE_TIP].y - (lm[L_EYE].y + lm[R_EYE].y) / 2
    const badPitch  = pv < PITCH_MIN || pv > PITCH_MAX
    const badArea   = faceArea(lm[L_CHEEK], lm[R_CHEEK], lm[FOREHEAD], lm[CHIN]) < MIN_AREA
    const faceOk    = distStat === 'ok' && !badRoll && !badYaw && !badPitch && !badArea

    // ── Obstruction detection ─────────────────────────────────
    // FIX: Glasses warning fires but does NOT block measurement anymore
    //      Only chin blocking stops measurement (chin is the endpoint)
    const hasGlasses  = detectGlasses(lm, W, H)
    const chinBlocked = detectChinBlocked(lm)
    setWarnGlass(hasGlasses && faceOk)
    setWarnBlock(chinBlocked && faceOk && !hasGlasses)

    // ── PHASE 3: Position lock REMOVED ──
    // Previously required patient to return to exact REST distance for OCC.
    // Per-frame live scaling makes distance irrelevant — scale auto-corrects.
    // Yaw and pitch checks (in face validation) are retained because they
    // protect vertical measurement axis from angular projection error.
    const posOk = true

    // Save current tracking snapshot (stored when REST is captured)
    snapRef.current = {
      ipdPx:    ipd,
      noseY:    snY,
      faceArea: faceArea(lm[L_CHEEK], lm[R_CHEEK], lm[FOREHEAD], lm[CHIN]),
    }

    // ── Determine display status ──────────────────────────────
    let st
    if      (!faceOk && distStat === 'far')   st = 'far'
    else if (!faceOk && distStat === 'close') st = 'close'
    else if (!faceOk && badArea)              st = 'blocked'
    else if (!faceOk && badPitch)             st = 'pitch'
    else if (!faceOk && badRoll)              st = 'roll'
    else if (!faceOk && badYaw)              st = 'yaw'
    else if (lockedRef.current !== null)      st = 'ready'
    else                                      st = 'collecting'
    setStatus(st)

    // Reset if face invalid
    if (!faceOk) { wipe() }

    // ── Measure ───────────────────────────────────────────────
    else if (lockedRef.current === null) {
      // FIX: Glasses no longer block measurement — only chinBlocked does.
      // Glasses warning is informational only. Dentist decides whether to proceed.
      if (!chinBlocked) {
        const vPix  = vertPx(snY, lm[CHIN].y, H)
        const pmm   = pxPerMmRef.current

        // ── PHASE 1: PIXEL-SPACE UNIFICATION (static correction) ──
        // Corrects for resolution drift within a session (camera switch, etc.)
        let pmmCorrected = pmm
        const calibRes = calibResRef.current
        if (pmm && calibRes?.h && H && H !== calibRes.h) {
          // ── PHASE 1 FIX: use HEIGHT ratio, not width ──
          // VDR/VDO is a vertical measurement (vertPx uses H).
          // Scale correction must use the same axis as the measurement.
          // For 16:9 this equals W-ratio, but camera switches or aspect 
          // changes can differ — height is the correct reference.
          const scaleFactor = H / calibRes.h
          pmmCorrected = pmm * scaleFactor
        }

        // ── FIX 3: MEASURE PATIENT'S IPD_MM DURING FIRST FRAMES ──
        // In REST mode, on the first 10 valid frames, collect IPD in mm
        // (using static pmmCorrected) and lock the mean as the patient's
        // true IPD_mm reference. OCC mode inherits this via props.
        if (isRest && pmmCorrected && ipd > 0 && !ipdMeasuredRef.current) {
          const ipdMmSample = ipd / pmmCorrected
          // Accept only anatomically plausible samples
          if (ipdMmSample >= 50 && ipdMmSample <= 80) {
            ipdSamplesRef.current.push(ipdMmSample)
            if (ipdSamplesRef.current.length >= 10) {
              // Lock the mean as patient's IPD_mm
              const mean = ipdSamplesRef.current.reduce((a, b) => a + b, 0) / ipdSamplesRef.current.length
              ipdMeasuredRef.current = parseFloat(mean.toFixed(2))
            }
          }
        }

        // ── PHASE 3: PER-FRAME LIVE SCALE NORMALIZATION ──────────────
        // Once IPD_mm is locked, compute live pxPerMm every frame:
        // pxPerMm_live = IPD_px_live / IPD_mm
        // This makes measurement distance-independent.
        let pmmLive = pmmCorrected
        let usingLiveScale = false
        const patientIpdMmLive = ipdMeasuredRef.current   // FIX 6: renamed to avoid shadowing

        if (patientIpdMmLive && ipd > 0) {
          const pmmFromIpd = ipd / patientIpdMmLive
          const buffer = pmmLiveBufferRef.current

          // Glasses present → use extended smoothing window + tighter outlier rejection
          const windowSize = hasGlasses ? PMM_SMOOTH_WINDOW_GLASSES : PMM_SMOOTH_WINDOW

          // Outlier rejection: reject frames deviating >8% from rolling mean
          let acceptThisFrame = true
          if (buffer.length >= 3) {
            const rollingMean = buffer.reduce((a, b) => a + b, 0) / buffer.length
            const deviation = Math.abs(pmmFromIpd - rollingMean) / rollingMean
            if (deviation > PMM_OUTLIER_THRESHOLD) acceptThisFrame = false
          }

          if (acceptThisFrame) {
            buffer.push(pmmFromIpd)
            if (buffer.length > windowSize) buffer.shift()
          }

          if (buffer.length >= 2) {
            pmmLive = buffer.reduce((a, b) => a + b, 0) / buffer.length
            usingLiveScale = true
          }
        }

        // ── PHASE 1 + 3: IPD SANITY BANNER ──────────────────────────
        // Uses static pmmCorrected for transparency. Variable renamed
        // to avoid shadowing React state of same name. (FIX 6)
        if (pmmCorrected && ipd > 0) {
          const ipdMmValue = ipd / pmmCorrected
          setIpdMmDisplay(parseFloat(ipdMmValue.toFixed(1)))
          setWarnCalib(ipdMmValue < 55 || ipdMmValue > 75)
        } else {
          setWarnCalib(false)
          setIpdMmDisplay(null)
        }

        // ── Final rawMM: live scale (best) → static corrected → IPD fallback ──
        const rawMM = usingLiveScale
          ? (vPix / pmmLive)
          : pmmCorrected
            ? (vPix / pmmCorrected)
            : ((vPix / ipd) * IPD_MM)

        // Reject biologically impossible readings
        if (rawMM >= MM_FLOOR && rawMM <= MM_CEIL) {
          const estimate = kalmanRef.current.feed(rawMM)
          framesRef.current++

          // Rolling buffer of last 20 Kalman estimates for SD check
          estimatesRef.current.push(estimate)
          if (estimatesRef.current.length > 20) estimatesRef.current.shift()

          // Show live reading from frame 5 onwards
          if (framesRef.current >= 5) setLiveMM(parseFloat(estimate.toFixed(1)))
            // ── PHASE 4: Record frame metadata for retrospective capture ──
            frameBufRef.current.push({
              timestamp: performance.now(),
              kalmanValue: estimate,
              kalmanSD: estimatesRef.current.length >= 10 ? stdDev(estimatesRef.current) : 999,
              ipdPx: ipd,
              noseY: snY,
              pitch: pv,
              yaw: yawRatio(lm[L_EYE], lm[R_EYE], lm[NOSE_TIP]),
              roll: rollDeg(lm[L_EYE], lm[R_EYE], W, H),
              faceArea: faceArea(lm[L_CHEEK], lm[R_CHEEK], lm[FOREHEAD], lm[CHIN]),
              pmmLive: usingLiveScale ? pmmLive : (pmmCorrected || null),
            })
            if (frameBufRef.current.length > FRAME_BUF_MAX) frameBufRef.current.shift()

          // Update progress indicator
          setPct(Math.min(100, Math.round(framesRef.current / FRAMES_NEEDED * 100)))

          // ── LOCK CONDITION (All bugs fixed here) ──────────────
          // Bug 1 fixed: Old code used P < 0.09 — P_ss ≈ 0.122, impossible
          // Bug 2 fixed: SD threshold is now adaptive (calibrated vs fallback)
          // Bug 3 fixed: Force lock after FRAMES_FORCE (120) regardless of SD
          //              Prevents infinite waiting when signal is inherently noisy
          if (framesRef.current >= FRAMES_NEEDED) {
            const buf = estimatesRef.current
            if (buf.length >= 10) {
              const sd        = stdDev(buf)
              const threshold = pxPerMmRef.current ? SD_WITH_CAL : SD_WITHOUT_CAL
              const sdOk      = sd < threshold
              const forceLock = framesRef.current >= FRAMES_FORCE

              if (sdOk || forceLock) {
                const locked = parseFloat(estimate.toFixed(1))
                lockedRef.current = locked
                setLockedMM(locked)
                // Status will become 'ready' on next tick
              }
            }
          }
        }
      }
    }

    // ── Draw: face oval with progress ring ────────────────────
    const oCX  = (lCPx.x + rCPx.x) / 2
    const oCY  = fhPx.y + (cPx.y - fhPx.y) * 0.5
    const oRX  = Math.abs(rCPx.x - lCPx.x) * 0.50
    const oRY  = (cPx.y - fhPx.y) * 0.56
    const ovalC = st === 'ready' ? '#10B981' : st === 'collecting' ? accent : '#EF4444'

    ctx.save(); ctx.translate(oCX, oCY); ctx.scale(1, oRY / oRX)
    ctx.beginPath(); ctx.arc(0, 0, oRX, 0, Math.PI * 2); ctx.restore()
    ctx.strokeStyle = ovalC
    ctx.lineWidth   = st === 'ready' ? 3.5 : 2.5
    if (st === 'ready') { ctx.shadowBlur = 18; ctx.shadowColor = '#10B981' }
    ctx.stroke(); ctx.shadowBlur = 0

    // Progress ring around oval during collection
    if (faceOk && posOk && framesRef.current > 0 && lockedRef.current === null) {
      const p = Math.min(1, framesRef.current / FRAMES_NEEDED)
      ctx.save(); ctx.translate(oCX, oCY); ctx.scale(1, oRY / oRX)
      ctx.beginPath(); ctx.arc(0, 0, oRX + 9, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2)
      ctx.restore()
      ctx.strokeStyle = accent; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt'
    }

    // Measurement line + landmarks (only when face valid and chin not blocked)
    if (faceOk && !chinBlocked) {
      // Vertical measurement line from subnasale down to gnathion level
      ctx.beginPath()
      ctx.moveTo(nPx.x, nPx.y)
      ctx.lineTo(nPx.x, cPx.y)
      ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.stroke()

      // Horizontal tick marks at each endpoint
      const tick = (px, py, c) => {
        ctx.beginPath(); ctx.moveTo(px - 12, py); ctx.lineTo(px + 12, py)
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke()
      }
      tick(nPx.x, nPx.y, accent)
      tick(nPx.x, cPx.y, '#42A5F5')

      // Landmark dots — visible reference points for dentist
      const dot = (p, c, r = 5) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = c; ctx.shadowBlur = 12; ctx.shadowColor = c; ctx.fill(); ctx.shadowBlur = 0
        // White center for visibility on any skin tone
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.35, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'; ctx.fill()
      }

      // Eye landmarks (IPD reference points for live scaling)
      const lEyePx = { x: lm[L_EYE].x * W, y: lm[L_EYE].y * H }
      const rEyePx = { x: lm[R_EYE].x * W, y: lm[R_EYE].y * H }
      dot(lEyePx,                   '#FBBF24', 7)   // Left eye — amber
      dot(rEyePx,                   '#FBBF24', 7)   // Right eye — amber

      // Measurement endpoints
      dot(nasPx,                    '#F59E0B', 5)    // Nasion — reference only
      dot(nPx,                      accent,    8)    // Subnasale — TOP measurement point
      dot({ x: nPx.x, y: cPx.y }, '#42A5F5', 8)    // Gnathion — BOTTOM measurement point (chin)

      // Labels
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#fff'
      ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.fillText('L Eye',      lEyePx.x + 10, lEyePx.y - 4)
      ctx.fillText('R Eye',      rEyePx.x + 10, rEyePx.y - 4)
      ctx.fillText('Subnasale',  nPx.x + 14, nPx.y - 5)
      ctx.fillText('Gnathion',   nPx.x + 14, cPx.y + 14)
      ctx.shadowBlur = 0
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  // ── Capture handler ───────────────────────────────────────────
  const doCapture = () => {
    if (status !== 'ready' || capturing || !lockedRef.current) return
    setCapturing(true)
    const video  = camRef.current?.video
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // ── PHASE 4: Best-frame retrospective capture ──
    // Score all frames in the 5-second buffer. Pick the one with
    // the lowest Kalman SD (most stable measurement moment).
    // Use that frame's Kalman value as the measurement.
    // Capture a fresh image NOW for the report photo.
    const buf = frameBufRef.current
    let bestValue = lockedRef.current
    let bestSD = Infinity
    let bestAge = '0.0'

    if (buf.length > 0) {
      const now = performance.now()
      for (const frame of buf) {
        if (frame.kalmanSD < bestSD) {
          bestSD = frame.kalmanSD
          bestValue = parseFloat(frame.kalmanValue.toFixed(1))
          bestAge = ((now - frame.timestamp) / 1000).toFixed(1)
        }
      }
    }

    // Capture fresh image for report photo (current frame, not historical)
    const out = document.createElement('canvas')
    out.width = video.videoWidth; out.height = video.videoHeight
    const ctx = out.getContext('2d')
    ctx.drawImage(video, 0, 0)
    ctx.drawImage(canvas, 0, 0)
    const imageData = out.toDataURL('image/jpeg', 0.85)

    setTimeout(() => {
      if (isRest) {
        navigate('after-rest', {
          imageData,
          vdr: bestValue,
          positionBaseline: { ...snapRef.current },
          measuredIpdMm: ipdMeasuredRef.current,
          bestFrameSD: bestSD !== Infinity ? parseFloat(bestSD.toFixed(3)) : null,
          bestFrameAge: bestAge,
        })
      } else {
        navigate('after-occ', {
          imageData,
          vdo: bestValue,
          bestFrameSD: bestSD !== Infinity ? parseFloat(bestSD.toFixed(3)) : null,
          bestFrameAge: bestAge,
        })
      }
    }, 300)
  }

  // ── Status display config ─────────────────────────────────────
  // NOTE: pct is React state, so STATES is always fresh each render
  const STATES = {
    none:      { txt: 'POSITION YOUR FACE IN THE OVAL',     bg: 'rgba(40,40,40,0.92)',   tip: null },
    far:       { txt: 'MOVE PHONE CLOSER',                  bg: 'rgba(239,68,68,0.92)',  tip: 'Hold phone at arm\'s length (~80 cm). Face must fill the oval.' },
    close:     { txt: 'MOVE PHONE FURTHER AWAY',            bg: 'rgba(239,68,68,0.92)',  tip: 'Too close. Step back until your face fits comfortably in the oval.' },
    blocked:   { txt: 'FACE OBSTRUCTED — CLEAR THE VIEW',   bg: 'rgba(239,68,68,0.92)',  tip: 'Something is covering your face. Remove any obstructions.' },
    pitch:     { txt: 'LOOK STRAIGHT AT THE CAMERA',        bg: 'rgba(245,158,11,0.92)', tip: 'Chin too high or too low. Look directly at the camera lens.' },
    roll:      { txt: 'STRAIGHTEN YOUR HEAD',               bg: 'rgba(245,158,11,0.92)', tip: 'Head tilted sideways. Keep it upright and level.' },
    yaw:       { txt: "FACE FORWARD — DON'T TURN",          bg: 'rgba(245,158,11,0.92)', tip: 'Face turned to one side. Look directly into the camera lens.' },
    collecting:{ txt: `SCANNING — ${pct}% COMPLETE`,        bg: 'rgba(245,158,11,0.92)', tip: null },
    ready:     { txt: 'MEASUREMENT LOCKED — TAP CAPTURE!',  bg: 'rgba(16,185,129,0.92)', tip: null },
  }
  const s       = STATES[status] || STATES.none
  const canCap  = status === 'ready' && !capturing && lockedRef.current !== null
  const showTip = s.tip && !['collecting', 'ready', 'none'].includes(status)

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ width:'100%', height:'100dvh', background:'#0a0a0a', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:20, background:'rgba(0,0,0,0.70)', padding:'44px 16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => navigate('home')} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', letterSpacing:0.5 }}>VDO DENTAL GUIDE</div>
          <div style={{ fontSize:10, marginTop:2, color: hasCal ? '#A7F3D0' : '#FCA5A5' }}>
            {isRest ? 'Step 2 of 4 — REST' : 'Step 3 of 4 — OCCLUSION'}
            {' · '}
            {hasCal ? '📏 Depressor calibrated' : '⚠️ No calibration — IPD fallback'}
          </div>
        </div>
        <button onClick={()=>{ wipe(); setFacingMode(f => f==='environment'?'user':'environment') }}
          style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:36, height:36,
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 7h-3a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="13" r="3"/>
            <path d="M9 7V5M15 7V5"/>
          </svg>
        </button>
      </div>

      {/* ── Camera feed ── */}
      <Webcam ref={camRef} audio={false}
        key={facingMode}
        videoConstraints={{ facingMode: facingMode, width:{ideal:3840}, height:{ideal:2160} }}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
        mirrored={false}/>

      {/* ── Canvas overlay (face oval + landmarks + progress ring) ── */}
      <canvas ref={canvasRef}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}/>

      {/* ── PHASE 1: CALIBRATION SANITY CHECK BANNER ── */}
      {/* Shows if IPD reads outside 55-75mm — likely calibration error.
          Informational only — does NOT block measurement. */}
      {warnCalib && !loading && ipdMmDisplay !== null && (
        <div style={{ position:'absolute', top:90, left:16, right:16, zIndex:23, background:'rgba(220,38,38,0.97)', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
          <span style={{ fontSize:22 }}>📐</span>
          <div>
            <div style={{ color:'#fff', fontSize:12, fontWeight:800 }}>
              CALIBRATION CHECK — IPD READS {ipdMmDisplay} MM
            </div>
            <div style={{ color:'rgba(255,255,255,0.9)', fontSize:10, marginTop:2 }}>
              Expected 55–75 mm. Card calibration may be inaccurate. Consider recalibrating before proceeding.
            </div>
          </div>
        </div>
      )}

      {/* ── GLASSES WARNING BANNER ── */}
      {/* Shows warning but does NOT stop measurement — dentist decides */}
      {warnGlass && !loading && (
        <div style={{ position:'absolute', top:90, left:16, right:16, zIndex:22, background:'rgba(245,158,11,0.97)', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
          <span style={{ fontSize:22 }}>👓</span>
          <div>
            <div style={{ color:'#fff', fontSize:12, fontWeight:800 }}>GLASSES DETECTED — CONSIDER REMOVING</div>
            <div style={{ color:'rgba(255,255,255,0.85)', fontSize:10, marginTop:2 }}>Glasses may affect nose landmark accuracy. Measurement continues — ask patient to remove if possible.</div>
          </div>
        </div>
      )}

      {/* ── CHIN BLOCKED BANNER ── */}
      {/* This DOES stop measurement — chin is the measurement endpoint */}
      {warnBlock && !warnGlass && !loading && (
        <div style={{ position:'absolute', top:90, left:16, right:16, zIndex:22, background:'rgba(239,68,68,0.97)', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
          <span style={{ fontSize:22 }}>✋</span>
          <div>
            <div style={{ color:'#fff', fontSize:12, fontWeight:800 }}>CHIN AREA BLOCKED — MEASUREMENT PAUSED</div>
            <div style={{ color:'rgba(255,255,255,0.85)', fontSize:10, marginTop:2 }}>Something is covering the chin/jaw. Keep hands, cards, and all objects away from the chin area during scanning.</div>
          </div>
        </div>
      )}

      {/* ── Right panel: value + progress + checklist ── */}
      {!loading && (
        <div style={{ position:'absolute', top:96, right:14, zIndex:16, display:'flex', flexDirection:'column', gap:6 }}>

          {/* MM value box */}
          <div style={{ background:'rgba(0,0,0,0.90)', borderRadius:10, padding:'8px 10px', textAlign:'center', minWidth:72,
            border:`2px solid ${status === 'ready' ? '#10B981' : status === 'collecting' ? accent : 'rgba(255,255,255,0.18)'}` }}>
            <div style={{ fontSize:24, fontWeight:900, lineHeight:1,
              color: status === 'ready' ? '#10B981' : status === 'collecting' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)' }}>
              {liveMM ?? '--'}
            </div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', marginTop:2 }}>
              {status === 'ready' ? 'LOCKED ✓' : status === 'collecting' ? 'scanning' : 'mm'}
            </div>
          </div>

          {/* Calibration badge */}
          {hasCal && (
            <div style={{ background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.35)', borderRadius:6, padding:'3px 7px', textAlign:'center' }}>
              <div style={{ fontSize:7, color:'#10B981', fontWeight:700 }}>🪵 CALIBRATED</div>
              {ipdMm && (
                <div style={{ fontSize:6, color:'#10B981', fontWeight:600, marginTop:1 }}>LIVE SCALE</div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {status === 'collecting' && (
            <div style={{ background:'rgba(0,0,0,0.82)', borderRadius:8, padding:'6px 8px', border:`1px solid ${accent}55` }}>
              <div style={{ background:'rgba(255,255,255,0.10)', borderRadius:4, height:7, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:accent, borderRadius:4, transition:'width 0.15s' }}/>
              </div>
              <div style={{ fontSize:8, color:accent, fontWeight:700, textAlign:'center', marginTop:3 }}>{pct}%</div>
            </div>
          )}

          {/* Face quality checklist */}
          {!['collecting', 'ready', 'none', 'far', 'close'].includes(status) && (
            <div style={{ background:'rgba(0,0,0,0.82)', borderRadius:8, padding:'6px 8px', border:'1px solid rgba(255,255,255,0.12)' }}>
              {[
                { l: 'Tilt',    ok: status !== 'roll' },
                { l: 'Turn',    ok: status !== 'yaw' },
                { l: 'Chin',    ok: status !== 'pitch' },
                { l: 'Glasses', ok: !warnGlass },
                { l: 'Clear',   ok: !warnBlock && status !== 'blocked' },
              ].map(({ l, ok }) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background: ok ? '#10B981' : '#EF4444', flexShrink:0 }}/>
                  <span style={{ fontSize:8, color: ok ? '#10B981' : '#EF4444', fontWeight:600 }}>{l}</span>
                </div>
              ))}
            </div>
          )}

          {/* Re-scan button when locked */}
          {status === 'ready' && (
            <button onClick={() => { wipe(); setStatus('none') }}
              style={{ background:'rgba(0,0,0,0.82)', border:`1px solid ${accent}`, borderRadius:7, padding:'5px 8px', color:accent, fontSize:8, fontWeight:700, cursor:'pointer' }}>
              RE-SCAN
            </button>
          )}
        </div>
      )}

      {/* ── Center tip overlay (for non-face-found errors) ── */}
      {!loading && showTip && (
        <div style={{ position:'absolute', top:'52%', left:'50%', transform:'translate(-50%,-50%)', zIndex:18, width:'72%' }}>
          <div style={{ background:'rgba(0,0,0,0.92)', border:`2px solid ${['far','close','blocked'].includes(status) ? '#EF4444' : '#F59E0B'}`, borderRadius:14, padding:'14px 18px', textAlign:'center' }}>
            <div style={{ color:'#fff', fontSize:13, fontWeight:800, marginBottom:6 }}>{s.txt}</div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:11, lineHeight:1.6 }}>{s.tip}</div>
          </div>
        </div>
      )}

      {/* ── "Waiting for stable reading" hint (shown when >100% frames but not locked) ── */}
      {!loading && status === 'collecting' && pct >= 100 && (
        <div style={{ position:'absolute', bottom:190, left:'50%', transform:'translateX(-50%)', zIndex:16, width:'75%' }}>
          <div style={{ background:'rgba(0,0,0,0.85)', borderRadius:10, padding:'8px 14px', textAlign:'center', border:`1px solid ${accent}55` }}>
            <div style={{ color:'#fff', fontSize:11, fontWeight:700 }}>Stabilising measurement...</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:10, marginTop:3 }}>
              {hasCal ? 'Hold still — locks when variation < 0.6 mm' : 'Hold still — locks when variation < 1.4 mm'}
            </div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:9, marginTop:2 }}>
              Auto-locks after {FRAMES_FORCE} frames if reading is stable
            </div>
          </div>
        </div>
      )}

      {/* ── Loading screen ── */}
      {loading && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.93)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, zIndex:30 }}>
          <div className="spinner"/>
          <div style={{ color:'#fff', fontSize:14, fontWeight:500 }}>{loadMsg}</div>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}>First load ~15 seconds</div>
        </div>
      )}

      {/* ── Error screen ── */}
      {error && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.93)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, zIndex:30, padding:24 }}>
          <div style={{ fontSize:40 }}>⚠️</div>
          <div style={{ color:'#fff', fontSize:14, fontWeight:600, textAlign:'center' }}>{error}</div>
          <button className="btn btn-primary" style={{ maxWidth:200 }} onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* ── Status bar ── */}
      {!loading && (
        <div style={{ position:'absolute', bottom:118, left:16, right:16, zIndex:15 }}>
          <div style={{ background:s.bg, borderRadius:10, padding:'9px 14px', display:'flex', alignItems:'center', justifyContent:'center', gap:8, }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff', flexShrink:0 }}/>
            <span style={{ color:'#fff', fontSize:12, fontWeight:700, letterSpacing:0.4 }}>{s.txt}</span>
          </div>
        </div>
      )}

      {/* ── Capture button ── */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:15, background:'rgba(0,0,0,0.75)', padding:'14px 20px 30px' }}>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <div style={{ flex:1, height:3, borderRadius:2, background: isRest ? accent : 'rgba(255,255,255,0.25)' }}/>
          <div style={{ flex:1, height:3, borderRadius:2, background: !isRest ? '#E91E8C' : 'rgba(255,255,255,0.25)' }}/>
        </div>
        <button onClick={doCapture} disabled={!canCap}
          style={{ width:'100%', padding:15, border:'none', borderRadius:14,
            background: canCap ? accent : 'rgba(255,255,255,0.10)',
            color:'#fff', fontFamily:'var(--font)', fontSize:14, fontWeight:800, letterSpacing:1,
            opacity: canCap ? 1 : 0.4,
            cursor: canCap ? 'pointer' : 'default',
            boxShadow: canCap ? `0 4px 22px ${isRest ? 'rgba(13,148,136,0.55)' : 'rgba(233,30,140,0.55)'}` : 'none',
            transition:'all 0.3s' }}>
          {capturing
            ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}><div className="spinner"/>CAPTURING...</span>
            : `CAPTURE ${isRest ? 'REST' : 'OCCLUSION'}`}
        </button>
      </div>
    </div>
  )
}