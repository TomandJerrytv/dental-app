//App.jsx
import { useState } from 'react'
import Home          from './screens/Home'
import PatientDetail from './screens/PatientDetail'
import Calibration   from './screens/Calibration'
import Camera        from './screens/Camera'
import AfterCapture  from './screens/AfterCapture'
import Results       from './screens/Results'
import PdfReport     from './screens/PdfReport'
import ViewReport    from './screens/ViewReport'
import Splash from './screens/Splash.jsx'


// PHASE 4.2: Compute median of array
function getMedian(arr) {
  if (!arr || arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : parseFloat(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1))
}


export default function App() {
  const [screen,           setScreen]           = useState('splash')
  const [patient,          setPatient]           = useState(null)

  // PHASE 1: video resolution used during calibration — used by Camera.jsx 
  // to scale pxPerMm if live video resolution differs (device/browser variance)
  const [pxPerMm,          setPxPerMm]           = useState(null)
  const [calibrationResolution, setCalibrationResolution] = useState(null)

  // PHASE 3: Patient's true IPD in mm, computed at calibration time.
  // Used by Camera for per-frame live scaling: pxPerMm_live = IPD_px_live / ipdMm
  const [ipdMm, setIpdMm] = useState(null)

  // Position baseline stored after REST capture.
  // Used to enforce same camera distance/position during OCC capture.
  // This prevents VDO > VDR caused by patient or phone moving between shots.
  const [positionBaseline, setPositionBaseline]  = useState(null)

  // PHASE 4.2: Triple-capture arrays — median of 3 for accuracy
  const [restCaptures,     setRestCaptures]      = useState([])
  const [occCaptures,      setOccCaptures]       = useState([])
  const [selectedRecord,   setSelectedRecord]    = useState(null)

  const navigate = (to, data) => {
    // ── Patient detail → reset session state for new patient ─────
    if (to === 'patient') {
      setPatient(null)
      setPxPerMm(null)
      setCalibrationResolution(null)   // PHASE 1
      setIpdMm(null)                    // PHASE 3
      setPositionBaseline(null)
      setRestCaptures([])
      setOccCaptures([])
    }

    // ── PatientDetail → Calibration: store patient ───────────────
    if (to === 'calibration' && data?.patient) {
      setPatient(data.patient)
    }

    // ── Calibration → camera-rest: store calibration scale ───────
    // data.pxPerMm is null if user skipped calibration (IPD fallback)
    if (to === 'camera-rest') {
      if (data?.pxPerMm !== undefined) setPxPerMm(data.pxPerMm)
      if (data?.calibrationResolution !== undefined) setCalibrationResolution(data.calibrationResolution)   // PHASE 1
    }

    // PHASE 4.2: If navigating to camera-rest with reset flag, clear previous captures
    if (to === 'camera-rest' && data?.resetCaptures) {
      setRestCaptures([])
    }
    if (to === 'camera-occ' && data?.resetCaptures) {
      setOccCaptures([])
    }
    
    // ── PHASE 3: Camera REST reports back the patient's measured IPD_mm ──
    // This is measured from first 10 valid frames (more accurate than single-image).
    // Stored at session level so Camera OCC can reuse it for live scaling.
    if (to === 'after-rest' && data?.measuredIpdMm !== undefined) {
      setIpdMm(data.measuredIpdMm)
    }

    // ── REST capture complete: append to captures array ───
    if (to === 'after-rest' && data) {
      setRestCaptures(prev => [...prev, data])
      if (data.positionBaseline) setPositionBaseline(data.positionBaseline)
    }

    // ── OCC capture complete ──────────────────────────────────────
    if (to === 'after-occ' && data) {
      setOccCaptures(prev => [...prev, data])
    }

    // ── View saved record ─────────────────────────────────────────
    if (to === 'view-report' && data?.record) {
      setSelectedRecord(data.record)
    }

    setScreen(to)
  }

  const saveToHistory = () => {
    // PHASE 4.2: Use median of all captures
    const vdr = getMedian(restCaptures.map(c => c.vdr))
    const vdo = getMedian(occCaptures.map(c => c.vdo))
    if (!vdr || !vdo) return

    const freewaySpace = parseFloat((vdr - vdo).toFixed(1))

    if (freewaySpace < 1) {
      alert('Cannot save: Freeway Space must be at least 1 mm.\nPlease re-take the occlusion measurement.')
      setScreen('camera-occ')
      return
    }

    const record = {
      id:         Date.now(),
      date:       new Date().toISOString(),
      patient,
      measurements: {
        vdr,
        vdo,
        freewaySpace,
        restValues: restCaptures.map(c => c.vdr),    // PHASE 4.2: store all captures
        occValues:  occCaptures.map(c => c.vdo),
      },
      restImage:  restCaptures[restCaptures.length - 1]?.imageData,
      occImage:   occCaptures[occCaptures.length - 1]?.imageData,
      calibrated: pxPerMm != null,
      pxPerMm,
    }

    const existing = JSON.parse(localStorage.getItem('patients') || '[]')
    existing.unshift(record)
    localStorage.setItem('patients', JSON.stringify(existing))
    setScreen('home')
  }

  const restMedian = getMedian(restCaptures.map(c => c.vdr))
  const occMedian  = getMedian(occCaptures.map(c => c.vdo))

  const measurements = restCaptures.length > 0 && occCaptures.length > 0 && restMedian && occMedian ? {
    vdr:          restMedian,
    vdo:          occMedian,
    freewaySpace: parseFloat((restMedian - occMedian).toFixed(1)),
    restImage:    restCaptures[restCaptures.length - 1]?.imageData,
    occImage:     occCaptures[occCaptures.length - 1]?.imageData,
    restValues:   restCaptures.map(c => c.vdr),
    occValues:    occCaptures.map(c => c.vdo),
  } : null

  return (
    <>
       {screen === 'splash'      && <Splash        navigate={navigate} />} 
      {screen === 'home'        && <Home          navigate={navigate} />}
      {screen === 'patient'     && <PatientDetail navigate={navigate} />}
      {screen === 'calibration' && <Calibration   navigate={navigate} patient={patient} />}

      {/* Camera receives pxPerMm from calibration for accurate measurement */}
      {screen === 'camera-rest' && (
        <Camera
          navigate={navigate}
          mode="rest"
          patient={patient}
          pxPerMm={pxPerMm}
          positionBaseline={null}     // No baseline needed for REST
          calibrationResolution={calibrationResolution}   // PHASE 1
          ipdMm={ipdMm}               // PHASE 3
        />
      )}
      {/* Camera OCC receives positionBaseline to enforce same distance as REST */}
      {screen === 'camera-occ' && (
        <Camera
          navigate={navigate}
          mode="occ"
          patient={patient}
          pxPerMm={pxPerMm}
          positionBaseline={positionBaseline}
          calibrationResolution={calibrationResolution}   // PHASE 1
          ipdMm={ipdMm}               // PHASE 3
        />
      )}

      {screen === 'after-rest'  && (
        <AfterCapture
          navigate={navigate}
          capture={restCaptures[restCaptures.length - 1]}
          captures={restCaptures}
          mode="rest"
          patient={patient}
        />
      )}
      {screen === 'after-occ'   && (
        <AfterCapture
          navigate={navigate}
          capture={occCaptures[occCaptures.length - 1]}
          captures={occCaptures}
          mode="occ"
          patient={patient}
          vdr={restMedian}
        />
      )}

      {screen === 'results'     && <Results    navigate={navigate} measurements={measurements} patient={patient} onSave={saveToHistory} />}
      {screen === 'pdf'         && <PdfReport  navigate={navigate} measurements={measurements} patient={patient} onSave={saveToHistory} />}
      {screen === 'view-report' && <ViewReport navigate={navigate} record={selectedRecord} />}
    </>
  )
}