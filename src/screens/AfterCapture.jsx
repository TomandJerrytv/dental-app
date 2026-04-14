// AfterCapture.jsx
// Key additions:
// 1. For occlusion mode: receives vdr prop and validates VDO < VDR
// 2. Shows Indian population clinical range context
// 3. Blocks "VIEW RESULTS" if VDO >= VDR (clinically impossible)

export default function AfterCapture({ navigate, capture, mode, patient, vdr }) {
  const isRest = mode === 'rest'
  const value  = isRest ? capture?.vdr : capture?.vdo
  const label  = isRest ? 'VDR' : 'VDO'

  // ── VDO validation against VDR ────────────────────────────────
  // Clinical fact: VDR must ALWAYS be > VDO (freeway space must be positive).
  // Minimum clinical freeway space = 1 mm (Indian population reference).
  // Normal range: 2–4 mm.
  const freewaySpace = (!isRest && vdr && value) ? parseFloat((vdr - value).toFixed(1)) : null
  const vdoTooHigh   = freewaySpace !== null && freewaySpace < 1    // VDO >= VDR or within 1mm
  const vdoNegative  = freewaySpace !== null && freewaySpace < 0    // VDO > VDR (impossible)
  const fsWarning    = freewaySpace !== null && freewaySpace < 2    // fs < 2mm = low
  const fsNormal     = freewaySpace !== null && freewaySpace >= 2 && freewaySpace <= 4

  // ── Indian population clinical range check ────────────────────
  const gender = patient?.gender?.toLowerCase()
  const getRange = () => {
    if (!value) return null
    if (gender === 'male')   return { min: 52, max: 72, typical: '58–65 mm', mean: 61.4 }
    if (gender === 'female') return { min: 46, max: 67, typical: '53–60 mm', mean: 56.7 }
    return { min: 46, max: 72, typical: '53–65 mm', mean: 59.0 }  // unknown gender — use combined
  }
  const range = getRange()
  const outOfRange = range && value && (value < range.min || value > range.max)

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
            {isRest ? 'REST Captured!' : 'OCCLUSION Captured!'}
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
                  <strong>VDO ({value} mm) &gt; VDR ({vdr} mm)</strong> is clinically impossible.
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
                  This reading suggests the occlusion scan was captured with the face too close to the camera,
                  or the teeth were not fully closed. Recommend re-taking occlusion scan.
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
        {isRest && (
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
        {range && value && (
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)', padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>
              Indian Population Reference — {label}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              {/* Simple range bar */}
              <div style={{ flex:1, position:'relative', height:8, background:'var(--border)', borderRadius:4 }}>
                {/* Normal range highlight */}
                <div style={{ position:'absolute', left:`${((range.typical.split('–')[0] - range.min) / (range.max - range.min)) * 100}%`, right:`${100 - ((parseInt(range.typical.split('–')[1]) - range.min) / (range.max - range.min)) * 100}%`, height:'100%', background:'#CCFBF1', borderRadius:4 }}/>
                {/* Current value marker */}
                <div style={{ position:'absolute', left:`${Math.min(100, Math.max(0, ((value - range.min) / (range.max - range.min)) * 100))}%`, top:-3, width:3, height:14, background: outOfRange ? '#EF4444' : 'var(--teal)', borderRadius:2, transform:'translateX(-50%)' }}/>
              </div>
              <div style={{ fontSize:12, fontWeight:700, color: outOfRange ? 'var(--danger)' : 'var(--teal)', minWidth:40 }}>
                {value} mm
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
              Captured Frame — {label}: {value} mm
            </div>
            <div style={{ position:'relative' }}>
              <img src={capture.imageData} alt="captured" style={{ width:'100%', display:'block', maxHeight:240, objectFit:'cover' }}/>
              <div style={{ position:'absolute', bottom:10, left:10, background:'rgba(0,0,0,0.7)', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#fff', fontWeight:700 }}>
                {label}: {value} mm
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:0.5 }}>
          Confirm {isRest ? 'REST' : 'OCCLUSION'} Capture
        </div>
      </div>

      {/* Bottom actions */}
      <div style={{ padding:16, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>

        {/* Block VIEW RESULTS if VDO >= VDR */}
        {!isRest && vdoTooHigh ? (
          <>
            <div style={{ background:'#FEF2F2', borderRadius:10, padding:'10px 14px', textAlign:'center', fontSize:12, color:'#DC2626', fontWeight:600 }}>
              Must re-take occlusion — freeway space must be ≥ 1 mm
            </div>
            <button className="btn btn-primary" onClick={() => navigate('camera-occ')}
              style={{ borderRadius:14, background:'#E91E8C', boxShadow:'0 4px 14px rgba(233,30,140,0.35)' }}>
              RE-TAKE OCCLUSION
            </button>
          </>
        ) : (
          <button className="btn btn-primary"
            onClick={() => isRest ? navigate('camera-occ') : navigate('results')}
            style={{ borderRadius:14, background: isRest ? 'var(--teal)' : '#E91E8C', boxShadow: isRest ? '0 4px 14px rgba(13,148,136,0.35)' : '0 4px 14px rgba(233,30,140,0.35)' }}>
            {isRest ? 'TAKE OCCLUSION →' : 'VIEW RESULTS →'}
          </button>
        )}

        <button className="btn btn-outline"
          onClick={() => isRest ? navigate('camera-rest') : navigate('camera-occ')}
          style={{ borderRadius:14, borderColor: isRest ? 'var(--teal)' : '#E91E8C', color: isRest ? 'var(--teal)' : '#E91E8C' }}>
          RE-TAKE {isRest ? 'REST' : 'OCCLUSION'}
        </button>
      </div>
    </div>
  )
}