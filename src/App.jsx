import { useState } from 'react'
import Home          from './screens/Home'
import PatientDetail from './screens/PatientDetail'
import Calibration   from './screens/Calibration'
import Camera        from './screens/Camera'
import AfterCapture  from './screens/AfterCapture'
import Results       from './screens/Results'
import PdfReport     from './screens/PdfReport'
import ViewReport    from './screens/ViewReport'

export default function App() {
  const [screen,           setScreen]           = useState('home')
  const [patient,          setPatient]           = useState(null)

  // Credit card calibration scale — pixels per mm for this session/device/distance
  // null = no calibration done (will use IPD fallback, less accurate)
  const [pxPerMm,          setPxPerMm]           = useState(null)

  // Position baseline stored after REST capture.
  // Used to enforce same camera distance/position during OCC capture.
  // This prevents VDO > VDR caused by patient or phone moving between shots.
  const [positionBaseline, setPositionBaseline]  = useState(null)

  const [restCapture,      setRestCapture]       = useState(null)
  const [occCapture,       setOccCapture]        = useState(null)
  const [selectedRecord,   setSelectedRecord]    = useState(null)

  const navigate = (to, data) => {
    // ── Patient detail → reset session state for new patient ─────
    if (to === 'patient') {
      setPatient(null)
      setPxPerMm(null)
      setPositionBaseline(null)
      setRestCapture(null)
      setOccCapture(null)
    }

    // ── PatientDetail → Calibration: store patient ───────────────
    if (to === 'calibration' && data?.patient) {
      setPatient(data.patient)
    }

    // ── Calibration → camera-rest: store calibration scale ───────
    // data.pxPerMm is null if user skipped calibration (IPD fallback)
    if (to === 'camera-rest') {
      if (data?.pxPerMm !== undefined) setPxPerMm(data.pxPerMm)
    }

    // ── REST capture complete: store result + position baseline ───
    if (to === 'after-rest' && data) {
      setRestCapture(data)
      // positionBaseline = { ipdPx, noseY, faceArea } at moment of REST capture
      // This is passed to Camera OCC so it can enforce same position
      if (data.positionBaseline) setPositionBaseline(data.positionBaseline)
    }

    // ── OCC capture complete ──────────────────────────────────────
    if (to === 'after-occ' && data) {
      setOccCapture(data)
    }

    // ── View saved record ─────────────────────────────────────────
    if (to === 'view-report' && data?.record) {
      setSelectedRecord(data.record)
    }

    setScreen(to)
  }

  const saveToHistory = () => {
    const vdr = restCapture?.vdr
    const vdo = occCapture?.vdo
    const freewaySpace = parseFloat((vdr - vdo).toFixed(1))

    // Guard: never save clinically impossible record
    if (!vdr || !vdo || freewaySpace < 1) {
      alert('Cannot save: Freeway Space must be at least 1 mm.\nPlease re-take the occlusion measurement.')
      setScreen('camera-occ')
      return
    }

    const record = {
      id:         Date.now(),
      date:       new Date().toISOString(),
      patient,
      measurements: { vdr, vdo, freewaySpace },
      restImage:  restCapture?.imageData,
      occImage:   occCapture?.imageData,
      calibrated: pxPerMm != null,
      pxPerMm,
    }

    const existing = JSON.parse(localStorage.getItem('patients') || '[]')
    existing.unshift(record)
    localStorage.setItem('patients', JSON.stringify(existing))
    setScreen('home')
  }

  const measurements = restCapture && occCapture ? {
    vdr:          restCapture.vdr,
    vdo:          occCapture.vdo,
    freewaySpace: parseFloat((restCapture.vdr - occCapture.vdo).toFixed(1)),
    restImage:    restCapture.imageData,
    occImage:     occCapture.imageData,
  } : null

  return (
    <>
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
        />
      )}

      {screen === 'after-rest'  && (
        <AfterCapture
          navigate={navigate}
          capture={restCapture}
          mode="rest"
          patient={patient}
        />
      )}
      {/* AfterCapture OCC receives vdr so it can validate freeway space */}
      {screen === 'after-occ'   && (
        <AfterCapture
          navigate={navigate}
          capture={occCapture}
          mode="occ"
          patient={patient}
          vdr={restCapture?.vdr}
        />
      )}

      {screen === 'results'     && <Results    navigate={navigate} measurements={measurements} patient={patient} onSave={saveToHistory} />}
      {screen === 'pdf'         && <PdfReport  navigate={navigate} measurements={measurements} patient={patient} onSave={saveToHistory} />}
      {screen === 'view-report' && <ViewReport navigate={navigate} record={selectedRecord} />}
    </>
  )
}