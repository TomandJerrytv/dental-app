import { useState, memo } from 'react'

/* ═══════════════════════════════════════════════════════════════
   EXACT AT EASE — PATIENT DETAIL (v2.1 Optimised)
   src/screens/PatientDetail.jsx
   Props: { navigate(screen, payload) }

   Optimisations vs v2.1:
   ① useInterFont() REMOVED — index.css owns font loading
   ② filter:blur on orbs REMOVED — GPU compositing layer killer
   ③ backdrop-filter on back button REMOVED — same issue
   ④ position:fixed CTA → sticky flex child — fixes camera conflict
   ⑤ onPointerDown/Up/Leave on CTA → CSS .btn:active (zero JS)
   ⑥ focusedField state REMOVED — index.css .field-input:focus
      handles border + glow with zero JS re-renders
   ⑦ inputStyle() function → module-level constant BASE_INPUT
   ⑧ checklist array → module-level constant (never recreated)
   ⑨ borderFor() function → eliminated (CSS handles focus)
   ⑩ Field + StepDots wrapped in React.memo
   All form logic, validation, navigation unchanged.
   ═══════════════════════════════════════════════════════════════ */

// ─── Brand (module-level, never recreated) ────────────────────
const C = {
  primary:    '#0B3C8C',
  secondary:  '#2F80ED',
  bg:         '#F8FAFC',
  surface:    '#FFFFFF',
  border:     '#E2E8F0',
  text:       '#1F2937',
  textSoft:   '#6B7280',
  textMuted:  '#9CA3AF',
  danger:     '#EF4444',
  dangerSoft: '#FEE2E2',
}
const GRAD = `linear-gradient(140deg, ${C.primary} 0%, #1553b5 55%, ${C.secondary} 100%)`

// ─── Base input style (module-level constant) ─────────────────
// index.css .field-input:focus handles border-color + box-shadow
// Only error state needs JS override — everything else is CSS
const BASE_INPUT = {
  fontFamily: 'var(--font)',
  fontWeight: 400,
  fontSize: 15,
  color: C.text,
  borderRadius: 12,
  padding: '13px 14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
  appearance: 'none',
  WebkitAppearance: 'none',
}

// ─── Checklist items (module-level — never recreated) ─────────
const CHECKLIST = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke={C.secondary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h2M22 12h-2M4 12a4 4 0 0 0 4 4h1a4 4 0 0 0 4-4 4 4 0 0 0 4 4h1a4 4 0 0 0 4-4"/>
        <path d="M4 12a4 4 0 0 1 4-4h1a4 4 0 0 1 4 4 4 4 0 0 1 4-4h1a4 4 0 0 1 4 4"/>
      </svg>
    ),
    title: 'Remove glasses',
    desc:  'Ask patient to remove glasses — they interfere with eye landmark detection',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke={C.secondary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
    title: 'Upright posture',
    desc:  'Patient sits straight, face forward, in good even lighting — avoid backlight',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke={C.secondary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="10" y="2" width="4" height="20" rx="2"/>
        <line x1="8"  y1="6"  x2="16" y2="6"/>
        <line x1="8"  y1="18" x2="16" y2="18"/>
      </svg>
    ),
    title: 'Tongue depressor ready',
    desc:  "Assistant holds wooden tongue depressor vertically beside patient's cheek",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke={C.secondary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h18v10H3z" rx="1"/>
        <line x1="7"  y1="7" x2="7"  y2="11"/>
        <line x1="11" y1="7" x2="11" y2="10"/>
        <line x1="15" y1="7" x2="15" y2="11"/>
        <line x1="19" y1="7" x2="19" y2="10"/>
      </svg>
    ),
    title: 'Phone distance',
    desc:  'Keep phone 60–80 cm from patient face throughout the entire scan',
  },
]

const SCAN_STEPS = ['Patient Info', 'Calibration', 'REST Scan', 'OCC Scan', 'Results']

// ─── Field wrapper — memo'd ───────────────────────────────────
const Field = memo(function Field({ label, error, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{
        fontFamily: 'var(--font)',
        fontWeight: 600,
        fontSize: 12,
        color: C.textSoft,
        textTransform: 'uppercase',
        letterSpacing: '0.7px',
      }}>
        {label}
      </label>
      {children}
      {error && (
        <span style={{ fontFamily:'var(--font)', fontSize:12, fontWeight:500, color:C.danger, display:'flex', alignItems:'center', gap:4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke={C.danger} strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8"  x2="12"   y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </span>
      )}
    </div>
  )
})

// ─── Step dots — memo'd ───────────────────────────────────────
const StepDots = memo(function StepDots({ current = 1, total = 4 }) {
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width:  i + 1 === current ? 20 : 6,
          height: 6,
          borderRadius: 3,
          background: i + 1 === current ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
          transition: 'width 0.2s ease',
        }}/>
      ))}
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════
//   MAIN EXPORT
// ═══════════════════════════════════════════════════════════════
export default function PatientDetail({ navigate }) {
  const [form,   setForm]   = useState({ name:'', age:'', gender:'', notes:'' })
  const [errors, setErrors] = useState({})

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]:'' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())                               e.name   = 'Full name is required'
    if (!form.age || isNaN(form.age) || +form.age < 1)  e.age    = 'Enter a valid age'
    if (!form.gender)                                    e.gender = 'Please select gender'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleStart = () => {
    if (!validate()) return
    // ✅ Navigates to calibration (not camera-rest) — correct v2.0 flow
    navigate('calibration', { patient: form })
  }

  return (
    <div style={{ fontFamily:'var(--font)', background:C.bg, minHeight:'100dvh', display:'flex', flexDirection:'column' }}>

      {/* ════ HEADER ════════════════════════════════════════════ */}
      <div style={{
        background: GRAD,
        padding: '48px 20px 28px',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0 0 24px 24px',
        flexShrink: 0,
      }}>
        {/* Decorative orbs — NO filter:blur (GPU compositor layer)
            Opacity-only shapes — zero compositing cost             */}
        <div style={{ position:'absolute', top:-30, right:-30, width:150, height:150, borderRadius:'50%', background:'rgba(86,204,242,0.18)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:0, left:-30, width:110, height:110, borderRadius:'50%', background:'rgba(255,255,255,0.08)', pointerEvents:'none' }}/>

        {/* Wave deco */}
        <svg style={{ position:'absolute', bottom:0, left:0, width:'100%', pointerEvents:'none' }}
             viewBox="0 0 430 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,20 C100,40 200,0 300,24 T430,14 L430,40 L0,40 Z" fill="rgba(255,255,255,0.06)"/>
        </svg>

        {/* Back button — NO backdrop-filter (GPU compositing layer) */}
        <button
          onClick={() => navigate('home')}
          aria-label="Back to home"
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '50%',
            width: 38, height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            marginBottom: 18,
            position: 'relative',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* Title block */}
        <div style={{ position:'relative' }}>
          <div style={{ fontWeight:500, fontSize:11, color:'rgba(255,255,255,0.78)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:6 }}>
            New Patient
          </div>
          <h1 style={{ fontWeight:700, fontSize:26, color:'#fff', margin:'0 0 8px', letterSpacing:'-0.4px', lineHeight:1.15 }}>
            Patient Information
          </h1>
          <StepDots current={1} total={4}/>
          <div style={{ fontWeight:400, fontSize:13, color:'rgba(255,255,255,0.72)', marginTop:8 }}>
            Step 1 of 4 — Enter details before camera scan
          </div>
        </div>
      </div>

      {/* ════ SCROLL BODY ════════════════════════════════════════ */}
      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'20px 16px 16px' }}>

        {/* ── Personal information card ── */}
        <div style={{ background:C.surface, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:'0 2px 12px rgba(11,60,140,0.07)', padding:'20px 18px', marginBottom:14 }}>

          {/* Section heading */}
          <div style={{ fontWeight:700, fontSize:11, color:C.secondary, textTransform:'uppercase', letterSpacing:'0.9px', marginBottom:18, display:'flex', alignItems:'center', gap:7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke={C.secondary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            Personal Information
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Full name
                className="field-input" → CSS handles :focus border + glow
                No focusedField state needed at all                        */}
            <Field label="Full Name" error={errors.name}>
              <input
                className="field-input"
                placeholder="Patient full name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                style={{
                  ...BASE_INPUT,
                  background: errors.name ? C.dangerSoft : C.bg,
                  borderColor: errors.name ? C.danger : undefined,
                  border: `1.5px solid ${errors.name ? C.danger : C.border}`,
                }}
              />
            </Field>

            {/* Age + Gender row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

              <Field label="Age" error={errors.age}>
                <input
                  className="field-input"
                  placeholder="Years"
                  type="number"
                  min="1"
                  max="120"
                  inputMode="numeric"
                  value={form.age}
                  onChange={e => set('age', e.target.value)}
                  style={{
                    ...BASE_INPUT,
                    background: errors.age ? C.dangerSoft : C.bg,
                    border: `1.5px solid ${errors.age ? C.danger : C.border}`,
                  }}
                />
              </Field>

              <Field label="Gender" error={errors.gender}>
                <div style={{ position:'relative' }}>
                  <select
                    className="field-input"
                    value={form.gender}
                    onChange={e => set('gender', e.target.value)}
                    style={{
                      ...BASE_INPUT,
                      background: errors.gender ? C.dangerSoft : C.bg,
                      border: `1.5px solid ${errors.gender ? C.danger : C.border}`,
                      paddingRight: 36,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {/* Custom chevron */}
                  <svg style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}
                       width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke={C.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </Field>

            </div>

            {/* Treatment notes */}
            <Field label="Treatment Notes (optional)">
              <textarea
                className="field-input"
                placeholder="Any relevant clinical notes..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                style={{
                  ...BASE_INPUT,
                  border: `1.5px solid ${C.border}`,
                  resize: 'none',
                  lineHeight: 1.6,
                }}
              />
            </Field>

          </div>
        </div>

        {/* ── Before you begin card ── */}
        <div style={{ background:C.surface, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:'0 2px 12px rgba(11,60,140,0.07)', padding:'20px 18px', marginBottom:14 }}>

          <div style={{ fontWeight:700, fontSize:11, color:C.secondary, textTransform:'uppercase', letterSpacing:'0.9px', marginBottom:16, display:'flex', alignItems:'center', gap:7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke={C.secondary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8"  x2="12"   y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Before You Begin
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* CHECKLIST is module-level — never recreated on re-render */}
            {CHECKLIST.map((item, i) => (
              <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'12px 14px', background:'#F0F7FF', borderRadius:12, border:'1px solid #DBEAFE' }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'#fff', border:'1px solid #BFDBFE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 1px 4px rgba(47,128,237,0.10)' }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:C.primary, marginBottom:3 }}>
                    {item.title}
                  </div>
                  <div style={{ fontWeight:400, fontSize:12, color:C.textSoft, lineHeight:1.55 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scan flow banner ── */}
        <div style={{ background:`linear-gradient(135deg, rgba(11,60,140,0.07) 0%, rgba(47,128,237,0.06) 100%)`, border:`1px solid rgba(47,128,237,0.20)`, borderRadius:14, padding:'14px 16px' }}>
          <div style={{ fontWeight:600, fontSize:11, color:C.primary, textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:10 }}>
            Scan Flow
          </div>
          <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap' }}>
            {/* SCAN_STEPS is module-level — never recreated */}
            {SCAN_STEPS.map((step, i, arr) => (
              <span key={i} style={{ display:'flex', alignItems:'center' }}>
                <span style={{
                  fontWeight: i === 0 ? 700 : 500,
                  fontSize: 11,
                  color: i === 0 ? C.secondary : C.textSoft,
                  background: i === 0 ? 'rgba(47,128,237,0.12)' : 'transparent',
                  padding: i === 0 ? '3px 8px' : '3px 4px',
                  borderRadius: 6,
                }}>
                  {step}
                </span>
                {i < arr.length - 1 && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                )}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* ════ STICKY BOTTOM CTA — flex child, NOT position:fixed ══
           position:fixed forces GPU compositing layer that conflicts
           with the camera video stream on Android Chrome.
           Sticky flex child = same "always visible" with zero cost. */}
      <div style={{ padding:'14px 16px 24px', background:C.surface, borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
        {/* className="btn btn-primary" → CSS .btn:active handles
            scale + opacity press effect with zero JS re-renders     */}
        <button
          className="btn btn-primary"
          onClick={handleStart}
          style={{ borderRadius:16, fontSize:15, letterSpacing:'0.5px', gap:10 }}
        >
          Next: Calibrate Camera
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

    </div>
  )
}