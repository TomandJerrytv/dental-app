// AfterCapture.jsx — Phase 4.2: Triple-capture median + Phase 5.1: Session baseline
// Key features:
// 1. Shows current capture + all previous captures in this set
// 2. Up to 3 captures per mode — "CAPTURE AGAIN" until 3, then proceed
// 3. Flags spread > 2mm as inconsistent
// 4. For OCC: validates VDO < VDR (freeway space ≥ 1mm)
// 5. Shows Indian population clinical range context
// 6. Session baseline comparison against historical records

import { useMemo } from 'react'

const MAX_CAPTURES = 3
const SPREAD_WARN_MM = 2

function getMedian(arr) {
  if (!arr || arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : parseFloat(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1))
}

export default function AfterCapture({ navigate, capture, captures = [], mode, patient, vdr }) {
  const isRest = mode === 'rest'
  const value  = isRest ? capture?.vdr : capture?.vdo
  const label  = isRest ? 'VDR' : 'VDO'

  // ── PHASE 4.2: Multi-capture data ─────────────────────────────
  const captureCount = captures.length
  const allValues = captures.map(c => isRest ? c.vdr : c.vdo).filter(v => v != null)
  const median = getMedian(allValues)
  const spread = allValues.length >= 2
    ? parseFloat((Math.max(...allValues) - Math.min(...allValues)).toFixed(1))
    : 0
  const spreadWarn = spread > SPREAD_WARN_MM
  const canCaptureMore = captureCount < MAX_CAPTURES
  const hasEnoughCaptures = captureCount >= 1  // minimum 1 to proceed

  // Use median for clinical checks when available, otherwise single value
  const clinicalValue = median || value

  // ── VDO validation against VDR ────────────────────────────────
  const freewaySpace = (!isRest && vdr && clinicalValue) ? parseFloat((vdr - clinicalValue).toFixed(1)) : null
  const vdoTooHigh   = freewaySpace !== null && freewaySpace < 1
  const vdoNegative  = freewaySpace !== null && freewaySpace < 0
  //const fsWarning    = freewaySpace !== null && freewaySpace < 2
  const fsNormal     = freewaySpace !== null && freewaySpace >= 2 && freewaySpace <= 4

  // ── PHASE 5.1: Session baseline comparison ────────────────────
  const baseline = useMemo(() => {
    if (!patient?.name || !clinicalValue) return null
    try {
      const records = JSON.parse(localStorage.getItem('patients') || '[]')
      const patientName = patient.name.trim().toLowerCase()
      const history = records.filter(r =>
        r.patient?.name?.trim().toLowerCase() === patientName
      )
      if (history.length === 0) return null

      // Get historical values for this measurement type
      const histValues = history
        .map(r => isRest ? r.measurements?.vdr : r.measurements?.vdo)
        .filter(v => v != null && v > 0)
        .slice(0, 5)  // last 5 records max

      if (histValues.length === 0) return null

      const histMean = parseFloat((histValues.reduce((a, b) => a + b, 0) / histValues.length).toFixed(1))
      const deviation = parseFloat(Math.abs(clinicalValue - histMean).toFixed(1))

      return {
        mean: histMean,
        count: histValues.length,
        values: histValues,
        deviation,
        warn: deviation > 3,
      }
    } catch { return null }
  }, [patient?.name, clinicalValue, isRest])

  // ── Indian population clinical range ──────────────────────────
  const gender = patient?.gender?.toLowerCase()
  const getRange = () => {
    if (!clinicalValue) return null
    // REST ranges are ~2-4mm higher than OCC (freeway space)
    if (gender === 'male') return isRest
      ? { min: 54, max: 74, typMin: 60, typMax: 67, typical: '60–67 mm', mean: 63.4 }
      : { min: 52, max: 72, typMin: 58, typMax: 65, typical: '58–65 mm', mean: 61.4 }
    if (gender === 'female') return isRest
      ? { min: 48, max: 69, typMin: 55, typMax: 62, typical: '55–62 mm', mean: 58.7 }
      : { min: 46, max: 67, typMin: 53, typMax: 60, typical: '53–60 mm', mean: 56.7 }
    return isRest
      ? { min: 48, max: 74, typMin: 55, typMax: 67, typical: '55–67 mm', mean: 61.0 }
      : { min: 46, max: 72, typMin: 53, typMax: 65, typical: '53–65 mm', mean: 59.0 }
  }
  const range = getRange()
  const outOfRange = range && clinicalValue && (clinicalValue < range.min || clinicalValue > range.max)

  return (
    <div className="screen">

      {/* Header */}
      <div style={{ background: isRest
        ? 'linear-gradient(135deg,#0D9488,#0F766E)'
        : 'linear-gradient(135deg,#E91E8C,#C2185B)',
        padding:'48px 20px 24px' }}>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>
            {isRest ? 'REST Captured!' : 'OCCLUSION Captured!'} ({captureCount} of {MAX_CAPTURES})
          </div>
        </div>

        <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
          {capture?.imageData && (
            <div style={{ width:60, height:74, borderRadius:8, overflow:'hidden', border:'2px solid rgba(255,255,255,0.3)', flexShrink:0 }}>
              <img src={capture.imageData} alt="cap" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
          )}
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:0.5 }}>
              Vertical Dimension — {isRest ? 'REST (VDR)' : 'OCCLUSION (VDO)'}
            </div>
            <div style={{ fontSize:36, fontWeight:900, color:'#fff', lineHeight:1, marginTop:4 }}>
              {value} <span style={{ fontSize:14, fontWeight:500 }}>mm</span>
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginTop:4 }}>
              Patient: {patient?.name}
              {!isRest && vdr ? ` · VDR: ${vdr} mm` : ''}
            </div>
          </div>
        </div>

        {/* Freeway space preview for occlusion */}
        {!isRest && freewaySpace !== null && (
          <div style={{ marginTop:12, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.8)' }}>Calculated Freeway Space</div>
            <div style={{ fontSize:16, fontWeight:800, color: fsNormal ? '#A7F3D0' : vdoNegative ? '#FCA5A5' : '#FDE68A' }}>
              {freewaySpace} mm
            </div>
          </div>
        )}
      </div>

      <div className="scroll-body">

        {/* ── PHASE 4.2: All captures summary ────────────────── */}
        {allValues.length >= 2 && (
          <div className="card" style={{ padding:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>
              Capture Summary — {label}
            </div>

            {/* Individual values */}
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              {allValues.map((v, i) => (
                <div key={i} style={{
                  flex:1, textAlign:'center', padding:'8px 4px',
                  background: i === allValues.length - 1 ? 'var(--teal-light)' : 'var(--bg)',
                  borderRadius:8, border: i === allValues.length - 1 ? '1.5px solid var(--teal)' : '1px solid var(--border)',
                }}>
                  <div style={{ fontSize:8, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>#{i+1}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--text)' }}>{v}</div>
                  <div style={{ fontSize:8, color:'var(--text3)' }}>mm</div>
                </div>
              ))}
            </div>

            {/* Median + spread */}
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1, background:'var(--bg)', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                <div style={{ fontSize:8, color:'var(--text3)', fontWeight:600, textTransform:'uppercase' }}>Median</div>
                <div style={{ fontSize:18, fontWeight:900, color:'var(--teal)' }}>{median} mm</div>
              </div>
              <div style={{ flex:1, background: spreadWarn ? '#FEF3C7' : 'var(--bg)', borderRadius:8, padding:'8px 10px', textAlign:'center',
                border: spreadWarn ? '1.5px solid #F59E0B' : 'none' }}>
                <div style={{ fontSize:8, color: spreadWarn ? '#92400E' : 'var(--text3)', fontWeight:600, textTransform:'uppercase' }}>Spread</div>
                <div style={{ fontSize:18, fontWeight:900, color: spreadWarn ? '#F59E0B' : 'var(--text2)' }}>{spread} mm</div>
              </div>
            </div>

            {/* Spread warning */}
            {spreadWarn && (
              <div style={{ marginTop:10, background:'#FEF3C7', borderRadius:8, padding:'8px 12px', fontSize:11, color:'#92400E', lineHeight:1.5 }}>
                ⚠️ Spread exceeds {SPREAD_WARN_MM} mm — readings are inconsistent. Consider capturing again or recalibrating.
              </div>
            )}
          </div>
        )}

        {/* ── PHASE 5.1: Session baseline comparison ─────────── */}
        {baseline && (
          <div style={{
            background: baseline.warn ? '#FEF3C7' : '#EFF6FF',
            border: `1.5px solid ${baseline.warn ? '#F59E0B' : '#BFDBFE'}`,
            borderRadius:'var(--radius)', padding:'12px 16px'
          }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
              <div style={{ fontSize:20, flexShrink:0 }}>{baseline.warn ? '⚠️' : 'ℹ️'}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color: baseline.warn ? '#92400E' : '#1E40AF', marginBottom:3 }}>
                  {baseline.warn
                    ? `Differs from history by ${baseline.deviation} mm`
                    : 'Consistent with previous readings'}
                </div>
                <div style={{ fontSize:11, color: baseline.warn ? '#78350F' : '#3B82F6', lineHeight:1.5 }}>
                  Previous {label} average: {baseline.mean} mm (from {baseline.count} record{baseline.count > 1 ? 's' : ''}).
                  Current: {clinicalValue} mm.
                  {baseline.warn && ' Please verify patient position and recalibrate if needed.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CRITICAL ERROR: VDO > VDR ──────────────────────── */}
        {vdoNegative && (
          <div style={{ background:'#FEF2F2', border:'2px solid #EF4444', borderRadius:'var(--radius)', padding:'16px' }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ fontSize:28, flexShrink:0 }}>🚫</div>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:'#DC2626', marginBottom:4 }}>
                  VDO CANNOT BE LARGER THAN VDR
                </div>
                <div style={{ fontSize:12, color:'#7F1D1D', lineHeight:1.6 }}>
                  <strong>VDO ({clinicalValue} mm) &gt; VDR ({vdr} mm)</strong> is clinically impossible.
                  When teeth are in contact, the jaw is HIGHER than at rest — so VDO must always be smaller than VDR.
                </div>
                <div style={{ marginTop:8, fontSize:11, color:'#991B1B' }}>
                  Possible causes: moved closer to camera during occlusion, or bite position was not fully clenched.
                  Please re-take the occlusion scan.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── WARNING: Freeway space < 1mm but not negative ───── */}
        {vdoTooHigh && !vdoNegative && (
          <div style={{ background:'#FEF3C7', border:'2px solid #F59E0B', borderRadius:'var(--radius)', padding:'14px 16px' }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ fontSize:24, flexShrink:0 }}>⚠️</div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:'#92400E', marginBottom:4 }}>
                  FREEWAY SPACE TOO LOW ({freewaySpace} mm)
                </div>
                <div style={{ fontSize:12, color:'#78350F', lineHeight:1.5 }}>
                  Clinically, freeway space should be 2–4 mm (minimum 1 mm).
                  This reading suggests the occlusion scan may need to be re-taken.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── OK: Freeway space looks correct ─────────────────── */}
        {fsNormal && (
          <div style={{ background:'var(--teal-light)', border:'1.5px solid var(--teal)', borderRadius:'var(--radius)', padding:'12px 16px', display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ fontSize:22 }}>✅</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--teal-dark)' }}>Freeway Space: {freewaySpace} mm — Normal</div>
              <div style={{ fontSize:11, color:'var(--teal)', marginTop:2 }}>Within the normal clinical range of 2–4 mm.</div>
            </div>
          </div>
        )}

        {/* Next step instruction for REST */}
        {isRest && !canCaptureMore && (
          <div style={{ background:'var(--teal-light)', borderRadius:'var(--radius)', padding:'16px', display:'flex', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'var(--teal)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2C9 2 7 4 7 7c0 2 1.5 4 3 4.5V18a2 2 0 004 0v-6.5c1.5-.5 3-2.5 3-4.5 0-3-2-5-5-5z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--teal-dark)', marginBottom:4 }}>Next: Capture Occlusion</div>
              <div style={{ fontSize:12, color:'var(--teal)', lineHeight:1.6 }}>
                Ask patient to bring teeth together (back molars clenched). Then tap "Take Occlusion".
              </div>
            </div>
          </div>
        )}

        {/* Indian population clinical range info */}
        {range && clinicalValue && (
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)', padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>
              Indian Population Reference — {label}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ flex:1, position:'relative', height:8, background:'var(--border)', borderRadius:4 }}>
                <div style={{ position:'absolute', left:`${((range.typMin - range.min) / (range.max - range.min)) * 100}%`, right:`${100 - ((range.typMax - range.min) / (range.max - range.min)) * 100}%`, height:'100%', background:'#CCFBF1', borderRadius:4 }}/>
                <div style={{ position:'absolute', left:`${Math.min(100, Math.max(0, ((clinicalValue - range.min) / (range.max - range.min)) * 100))}%`, top:-3, width:3, height:14, background: outOfRange ? '#EF4444' : 'var(--teal)', borderRadius:2, transform:'translateX(-50%)' }}/>
              </div>
              <div style={{ fontSize:12, fontWeight:700, color: outOfRange ? 'var(--danger)' : 'var(--teal)', minWidth:40 }}>
                {clinicalValue} mm
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text3)' }}>
              <span>Min {range.min} mm</span>
              <span>Typical {range.typical} ({gender || 'all'})</span>
              <span>Max {range.max} mm</span>
            </div>
            {outOfRange && (
              <div style={{ marginTop:8, fontSize:11, color:'#DC2626', fontWeight:600 }}>
                ⚠️ Value outside Indian population range. Verify patient position and re-scan if needed.
              </div>
            )}
          </div>
        )}

        {/* Captured image */}
        {capture?.imageData && (
          <div className="card" style={{ overflow:'hidden' }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:0.5 }}>
              Captured Frame #{captureCount} — {label}: {value} mm
            </div>
            <div style={{ position:'relative' }}>
              <img src={capture.imageData} alt="captured" style={{ width:'100%', display:'block', maxHeight:240, objectFit:'cover' }}/>
              <div style={{ position:'absolute', bottom:10, left:10, background:'rgba(0,0,0,0.7)', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#fff', fontWeight:700 }}>
                {label}: {value} mm
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div style={{ padding:16, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>

        {/* Block VIEW RESULTS if VDO >= VDR */}
        {!isRest && vdoTooHigh ? (
          <>
            <div style={{ background:'#FEF2F2', borderRadius:10, padding:'10px 14px', textAlign:'center', fontSize:12, color:'#DC2626', fontWeight:600 }}>
              Must re-take occlusion — freeway space must be ≥ 1 mm
            </div>
            <button className="btn btn-primary" onClick={() => navigate('camera-occ', { resetCaptures: true })}
              style={{ borderRadius:14, background:'#E91E8C', boxShadow:'0 4px 14px rgba(233,30,140,0.35)' }}>
              RE-TAKE ALL OCCLUSION CAPTURES
            </button>
          </>
        ) : (
          <>
            {/* PHASE 4.2: Capture again or proceed */}
            {canCaptureMore && (
              <button className="btn btn-outline"
                onClick={() => isRest ? navigate('camera-rest') : navigate('camera-occ')}
                style={{ borderRadius:14, borderColor: isRest ? 'var(--teal)' : '#E91E8C', color: isRest ? 'var(--teal)' : '#E91E8C' }}>
                CAPTURE AGAIN ({captureCount}/{MAX_CAPTURES})
                {spreadWarn ? ' — RECOMMENDED' : ''}
              </button>
            )}

            {/* Proceed button */}
            {hasEnoughCaptures && (
              <button className="btn btn-primary"
                onClick={() => isRest ? navigate('camera-occ') : navigate('results')}
                style={{ borderRadius:14, background: isRest ? 'var(--teal)' : '#E91E8C',
                  boxShadow: isRest ? '0 4px 14px rgba(13,148,136,0.35)' : '0 4px 14px rgba(233,30,140,0.35)' }}>
                {isRest
                  ? (captureCount < MAX_CAPTURES ? `PROCEED WITH ${captureCount} CAPTURE${captureCount > 1 ? 'S' : ''} →` : 'TAKE OCCLUSION →')
                  : (captureCount < MAX_CAPTURES ? `PROCEED WITH ${captureCount} CAPTURE${captureCount > 1 ? 'S' : ''} →` : 'VIEW RESULTS →')}
              </button>
            )}
          </>
        )}

        {/* Re-take all button */}
        <button className="btn btn-ghost"
          onClick={() => isRest
            ? navigate('camera-rest', { resetCaptures: true })
            : navigate('camera-occ', { resetCaptures: true })}
          style={{ borderRadius:14, fontSize:12 }}>
          START {isRest ? 'REST' : 'OCCLUSION'} OVER (clear all captures)
        </button>
      </div>
    </div>
  )
}