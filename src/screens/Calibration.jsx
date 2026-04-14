import { useRef, useState, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'

// ISO 7810 — every credit/debit/ATM card worldwide = exactly 85.6 mm wide
const CARD_MM = 85.6

export default function Calibration({ navigate, patient }) {
  const camRef = useRef(null)
  const imgRef = useRef(null)

  // ── FIX: ptsRef avoids stale closure on fast mobile taps ─────
  // Bug was: useCallback([pts]) caused second tap to see old pts=[],
  // overwriting the first tap. Now ptsRef always holds latest state.
  const ptsRef   = useRef([])
  const imgNatRef = useRef({ w:1280, h:720 })

  const [step,    setStep]    = useState('intro')
  const [facingMode, setFacingMode] = useState('environment')
  const [imgData, setImgData] = useState(null)
  const [imgNat,  setImgNat]  = useState({ w:1280, h:720 })
  const [pts,     setPts]     = useState([])       // for display only
  const [pxPerMm, setPxPerMm] = useState(null)
  const [tapMsg,  setTapMsg]  = useState('Tap the LEFT edge of the card')
  const [error,   setError]   = useState(null)

  useEffect(() => { imgNatRef.current = imgNat }, [imgNat])

  // ── Capture frame ─────────────────────────────────────────────
  const captureFrame = () => {
    const v = camRef.current?.video
    if (!v || v.readyState < 2) {
      alert('Camera not ready — wait a moment then try again.'); return
    }
    const c = document.createElement('canvas')
    c.width  = v.videoWidth  || 1280
    c.height = v.videoHeight || 720
    c.getContext('2d').drawImage(v, 0, 0)
    ptsRef.current = []
    setPts([]); setError(null)
    setTapMsg('Tap the LEFT edge of the card')
    setImgData(c.toDataURL('image/jpeg', 0.95))
    setStep('tap')
  }

  // ── Core tap handler — reads from refs only (no stale closure) ─
  const processTap = useCallback((clientX, clientY) => {
    const img = imgRef.current
    if (!img) return

    const current = ptsRef.current
    if (current.length >= 2) return

    const rect = img.getBoundingClientRect()
    const nat  = imgNatRef.current

    // Display coords → natural image coords
    const natX = Math.max(0, Math.min(nat.w, (clientX - rect.left)  * (nat.w / rect.width)))
    const natY = Math.max(0, Math.min(nat.h, (clientY - rect.top)   * (nat.h / rect.height)))

    if (current.length === 0) {
      // First tap — left edge
      const next = [{ x:natX, y:natY }]
      ptsRef.current = next
      setPts(next)
      setTapMsg('Now tap the RIGHT edge of the card')
      setError(null)
    } else {
      // Second tap — right edge — compute calibration
      const first  = current[0]
      const dx     = natX - first.x
      const dy     = natY - first.y
      const widthPx = Math.sqrt(dx*dx + dy*dy)

      if (widthPx < 30) {
        setError('Taps too close together. Tap the far RIGHT edge of the card.')
        return
      }

      const ratio = widthPx / CARD_MM

      if (ratio < 0.8 || ratio > 30) {
        setError(`Unusual result (${ratio.toFixed(1)} px/mm). Make sure card is flat, landscape, and fully visible. Tap both outer edges.`)
        ptsRef.current = []
        setPts([])
        setTapMsg('Tap the LEFT edge of the card')
        return
      }

      const next = [first, { x:natX, y:natY }]
      ptsRef.current = next
      setPts(next)
      setPxPerMm(ratio)
      setStep('confirm')
    }
  }, [])  // No deps — everything from refs

  // ── onClick (desktop) ─────────────────────────────────────────
  const handleClick = useCallback((e) => {
    processTap(e.clientX, e.clientY)
  }, [processTap])

  // ── onTouchEnd (mobile — primary handler) ─────────────────────
  // FIX: Use touch events on mobile for accurate coordinates.
  // e.preventDefault() stops the ghost click that would fire processTap twice.
  const handleTouchEnd = useCallback((e) => {
    e.preventDefault()
    const t = e.changedTouches?.[0]
    if (t) processTap(t.clientX, t.clientY)
  }, [processTap])

  const resetTaps = () => {
    ptsRef.current = []
    setPts([]); setError(null)
    setTapMsg('Tap the LEFT edge of the card')
  }

  const retry = () => {
    ptsRef.current = []
    setPts([]); setPxPerMm(null); setImgData(null); setError(null)
    setTapMsg('Tap the LEFT edge of the card')
    setStep('intro')
  }

  return (
    <div className="screen">

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#0D9488,#0F766E)', padding:'48px 20px 20px' }}>
        <button onClick={() => navigate('patient')}
          style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:36, height:36,
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', marginBottom:12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>Step 1 of 4 — Required</div>
        <div style={{ fontSize:22, fontWeight:800, color:'#fff', marginTop:2 }}>Camera Calibration</div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:3 }}>Patient: {patient?.name}</div>
      </div>

      {/* ══════════════════ INTRO ══════════════════ */}
      {step === 'intro' && (
        <>
          <div className="scroll-body">
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:'var(--radius)', padding:'14px 16px', fontSize:13, color:'#1E40AF', lineHeight:1.7 }}>
              <strong>Why this step?</strong> Every phone + distance gives different pixels per mm.
              Card calibration gives <strong>±0.3–0.5 mm accuracy</strong> instead of ±1.5 mm without it.
            </div>

            {/* Card position guide */}
            <div className="card" style={{ padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>Correct Card Position</div>

              {/* Visual guide */}
              <div style={{ background:'#F8FAFC', borderRadius:10, padding:14, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:20 }}>✅</span>
                  <span style={{ fontSize:12, color:'#166534', lineHeight:1.5 }}>Card held <strong>LANDSCAPE</strong> (wide side horizontal) against LEFT cheek, at nose height</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:20 }}>✅</span>
                  <span style={{ fontSize:12, color:'#166534', lineHeight:1.5 }}>Card flat against cheek — <strong>not in front of the chin or mouth</strong></span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:20 }}>✅</span>
                  <span style={{ fontSize:12, color:'#166534', lineHeight:1.5 }}>Entire card visible in frame — both left and right edges must be visible</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:20 }}>❌</span>
                  <span style={{ fontSize:12, color:'#DC2626', lineHeight:1.5 }}>Do NOT hold card vertically (portrait) — it will measure 54 mm not 85.6 mm</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:20 }}>❌</span>
                  <span style={{ fontSize:12, color:'#DC2626', lineHeight:1.5 }}>Do NOT cover the chin or gnathion point — keep card at cheek height only</span>
                </div>
              </div>

              <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>Steps</div>
              {[
                '1. Patient holds any bank card flat against LEFT cheek, at nose height, landscape (wide side horizontal).',
                '2. Entire card must be fully visible — both left and right edges in frame.',
                '3. Hold phone at 75–90 cm. Tap OPEN CAMERA.',
                '4. When card is clearly visible, tap CAPTURE FRAME.',
                '5. On the captured photo: tap the LEFT outer edge, then the RIGHT outer edge.',
              ].map((t, i) => (
                <div key={i} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--teal)', color:'#fff', fontSize:11, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</div>
                  <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, paddingTop:2 }}>{t.slice(3)}</div>
                </div>
              ))}
            </div>

            <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'var(--radius)', padding:'12px 16px', fontSize:12, color:'#166534', lineHeight:1.6 }}>
              💳 Any bank card = exactly <strong>85.6 mm wide</strong> (ISO 7810 standard — worldwide).
            </div>
          </div>

          <div style={{ padding:16, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
            <button className="btn btn-primary" onClick={() => setStep('live')} style={{ borderRadius:14 }}>
              OPEN CAMERA →
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('camera-rest', { pxPerMm:null })} style={{ borderRadius:14, fontSize:12 }}>
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
            videoConstraints={{ facingMode: facingMode, width:{ ideal:3840 }, height:{ ideal:2160 } }}
            style={{ width:'100%', flex:1, objectFit:'cover' }}
            mirrored={false}/>

          {/* Card position guide — at nose/cheek level (middle-right of frame) */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
            {/* Face oval guide */}
            <div style={{ position:'absolute', left:'25%', right:'25%', top:'8%', bottom:'12%',
              border:'1.5px dashed rgba(255,255,255,0.20)', borderRadius:'50%' }}/>
            {/* Card guide at cheek/nose height */}
            <div style={{ position:'absolute', right:'4%', top:'40%', width:'30%', height:38,
              border:'3px dashed rgba(16,185,129,0.95)', borderRadius:4, background:'rgba(16,185,129,0.10)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontSize:10, fontWeight:800, textShadow:'0 1px 3px rgba(0,0,0,0.8)' }}>CARD HERE</span>
            </div>
            {/* Nose level indicator */}
            <div style={{ position:'absolute', left:'4%', right:'4%', top:'calc(40% + 19px)', height:1, borderTop:'1px dashed rgba(16,185,129,0.5)' }}/>
            <div style={{ position:'absolute', left:'4%', top:'calc(40% + 23px)', fontSize:9, color:'rgba(16,185,129,0.9)', fontWeight:700 }}>← Nose / cheek level</div>
          </div>

          {/* Top instruction */}
          <div style={{ position:'absolute', top:0, left:0, right:0, background:'rgba(0,0,0,0.80)', backdropFilter:'blur(4px)', padding:'10px 14px' }}>
            <div style={{ color:'#fff', fontSize:12, fontWeight:800, marginBottom:3 }}>
              📍 Card LANDSCAPE at cheek/nose height — align with green box
            </div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontSize:10 }}>
              Both card edges must be fully visible. Card flat against cheek, NOT covering chin.
            </div>
          </div>

          <div style={{ padding:'12px 16px 24px', background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)' }}>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost" onClick={() => setStep('intro')} style={{ flex:1, borderRadius:12, fontSize:12 }}>← BACK</button>
              <button onClick={()=> setFacingMode(f => f==='environment'?'user':'environment')}
                style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:12, padding:'0 14px', cursor:'pointer', color:'#fff', fontSize:12, fontWeight:700 }}>
                🔄 CAM
              </button>
              <button className="btn btn-primary" onClick={captureFrame} style={{ flex:2, borderRadius:12, fontSize:13 }}>CAPTURE FRAME</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAP SCREEN ══════════════════ */}
      {step === 'tap' && imgData && (
        <div style={{ display:'flex', flexDirection:'column', flex:1 }}>

          {/* Instruction banner */}
          <div style={{ background: pts.length === 0 ? '#F59E0B' : '#10B981', padding:'10px 16px', textAlign:'center' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{tapMsg}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)', marginTop:2 }}>
              {pts.length === 0
                ? '👆 Tap on the LEFT outer edge of the card in the photo'
                : '👆 Now tap on the RIGHT outer edge of the card'}
            </div>
          </div>

          {/* Error with reset button */}
          {error && (
            <div style={{ background:'#FEF2F2', padding:'10px 14px', textAlign:'center', lineHeight:1.5 }}>
              <div style={{ fontSize:12, color:'#DC2626', marginBottom:8 }}>⚠️ {error}</div>
              <button onClick={resetTaps}
                style={{ background:'#DC2626', color:'#fff', border:'none', borderRadius:6, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                RESET — TAP LEFT EDGE AGAIN
              </button>
            </div>
          )}

          {/* Tap count indicator */}
          {!error && (
            <div style={{ background:'rgba(0,0,0,0.85)', padding:'6px 14px', display:'flex', alignItems:'center', gap:10, justifyContent:'center' }}>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <div style={{ width:14, height:14, borderRadius:'50%', background: pts.length >= 1 ? '#10B981' : 'rgba(255,255,255,0.3)', border:'2px solid rgba(255,255,255,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#fff', fontWeight:700 }}>L</div>
                <div style={{ width:30, height:2, background:'rgba(255,255,255,0.2)' }}/>
                <div style={{ width:14, height:14, borderRadius:'50%', background: pts.length >= 2 ? '#3B82F6' : 'rgba(255,255,255,0.3)', border:'2px solid rgba(255,255,255,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#fff', fontWeight:700 }}>R</div>
              </div>
              <span style={{ color:'rgba(255,255,255,0.7)', fontSize:10 }}>
                {pts.length === 0 ? 'Tap LEFT edge first' : pts.length === 1 ? 'Now tap RIGHT edge' : 'Both edges tapped ✓'}
              </span>
            </div>
          )}

          {/* Captured image — tap target */}
          <div style={{ position:'relative', background:'#000', flex:1 }}>
            <img
              ref={imgRef}
              src={imgData}
              alt="Calibration frame — tap card edges"
              style={{ width:'100%', display:'block', touchAction:'none', userSelect:'none', WebkitUserSelect:'none', cursor:'crosshair' }}
              draggable={false}
              onLoad={(e) => {
                const nat = { w: e.target.naturalWidth, h: e.target.naturalHeight }
                setImgNat(nat); imgNatRef.current = nat
              }}
              onClick={handleClick}
              onTouchEnd={handleTouchEnd}
            />

            {/* Tap markers */}
            {pts.map((pt, i) => (
              <div key={i} style={{
                position:'absolute',
                left:  `${(pt.x / imgNat.w) * 100}%`,
                top:   `${(pt.y / imgNat.h) * 100}%`,
                transform:'translate(-50%,-50%)',
                width:40, height:40,
                border:`3px solid ${i===0?'#10B981':'#3B82F6'}`,
                borderRadius:'50%',
                background: i===0?'rgba(16,185,129,0.3)':'rgba(59,130,246,0.3)',
                pointerEvents:'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, fontWeight:900,
                color: i===0?'#fff':'#fff',
                zIndex:10,
                boxShadow:`0 0 0 3px ${i===0?'rgba(16,185,129,0.6)':'rgba(59,130,246,0.6)'}, 0 2px 10px rgba(0,0,0,0.5)`,
              }}>{i===0?'L':'R'}</div>
            ))}

            {/* Line between tap points */}
            {pts.length === 2 && (() => {
              const x1=(pts[0].x/imgNat.w)*100, x2=(pts[1].x/imgNat.w)*100
              const y =(pts[0].y/imgNat.h)*100
              return (
                <div style={{ position:'absolute', left:`${Math.min(x1,x2)}%`, top:`${y}%`,
                  width:`${Math.abs(x2-x1)}%`, height:3, background:'rgba(16,185,129,0.9)',
                  transform:'translateY(-50%)', pointerEvents:'none',
                  boxShadow:'0 0 8px rgba(16,185,129,0.7)' }}/>
              )
            })()}

            {/* Helper text on image */}
            {pts.length === 0 && !error && (
              <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.80)', borderRadius:8, padding:'5px 12px', whiteSpace:'nowrap' }}>
                <span style={{ color:'rgba(255,255,255,0.85)', fontSize:10, fontWeight:600 }}>👆 Tap the LEFT edge of the card in the photo</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding:'12px 16px', background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
            {pts.length > 0 && (
              <button className="btn btn-ghost" onClick={resetTaps} style={{ flex:1, borderRadius:12, fontSize:12 }}>
                RESET TAPS
              </button>
            )}
            <button className="btn btn-outline"
              onClick={() => { ptsRef.current=[]; setPts([]); setError(null); setStep('live') }}
              style={{ flex: pts.length > 0 ? 1 : 2, borderRadius:12, fontSize:12 }}>
              RETAKE PHOTO
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ CONFIRM ══════════════════ */}
      {step === 'confirm' && pxPerMm && (
        <>
          <div className="scroll-body">
            <div className="card" style={{ padding:20, textAlign:'center' }}>
              <div style={{ fontSize:44, marginBottom:10 }}>✅</div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--teal)', marginBottom:8 }}>Calibration successful!</div>
              <div style={{ fontSize:36, fontWeight:900, color:'var(--text)', lineHeight:1 }}>
                {(1/pxPerMm).toFixed(3)}
                <span style={{ fontSize:14, fontWeight:400, color:'var(--text3)', marginLeft:4 }}>mm/px</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:8 }}>
                {pxPerMm.toFixed(2)} px/mm · Card: 85.6 mm
              </div>
            </div>

            {imgData && (
              <div className="card" style={{ overflow:'hidden' }}>
                <div style={{ position:'relative' }}>
                  <img src={imgData} alt="calibration" style={{ width:'100%', display:'block', maxHeight:180, objectFit:'cover' }}/>
                  {pts.length === 2 && (() => {
                    const x1=(pts[0].x/imgNat.w)*100, x2=(pts[1].x/imgNat.w)*100
                    const y=((pts[0].y+pts[1].y)/2/imgNat.h)*100
                    return <div style={{ position:'absolute', left:`${Math.min(x1,x2)}%`, top:`${y}%`, width:`${Math.abs(x2-x1)}%`, height:3, background:'rgba(16,185,129,0.95)', transform:'translateY(-50%)', boxShadow:'0 0 8px rgba(16,185,129,0.8)' }}/>
                  })()}
                  <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.78)', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#fff', fontWeight:700 }}>
                    📐 {pxPerMm.toFixed(2)} px/mm
                  </div>
                </div>
              </div>
            )}

            <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:'var(--radius)', padding:'14px 16px', fontSize:12, color:'#92400E', lineHeight:1.7 }}>
              ⚠️ <strong>Do not change phone distance after this step.</strong> REST and OCCLUSION must be taken at the same distance.
            </div>

            <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'var(--radius)', padding:'12px 16px', fontSize:12, color:'#166534' }}>
              ✅ Expected accuracy with this calibration: <strong>±0.3–0.5 mm</strong>
            </div>
          </div>

          <div style={{ padding:16, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
            <button className="btn btn-primary" onClick={() => navigate('camera-rest', { pxPerMm })} style={{ borderRadius:14 }}>
              PROCEED TO REST SCAN →
            </button>
            <button className="btn btn-outline" onClick={retry} style={{ borderRadius:14 }}>
              REDO CALIBRATION
            </button>
          </div>
        </>
      )}
    </div>
  )
}