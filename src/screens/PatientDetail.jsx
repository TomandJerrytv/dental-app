import { useState } from 'react'

export default function PatientDetail({ navigate }) {
  const [form,   setForm]   = useState({ name:'', age:'', gender:'', notes:'' })
  const [errors, setErrors] = useState({})

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]:'' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())                              e.name   = 'Full name is required'
    if (!form.age || isNaN(form.age) || +form.age < 1) e.age    = 'Enter valid age'
    if (!form.gender)                                   e.gender = 'Please select gender'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleStart = () => {
    if (!validate()) return
    // ✅ FIX: was navigate('camera-rest') — now correctly goes to Calibration first
    navigate('calibration', { patient: form })
  }

  return (
    <div className="screen">
      <div style={{ background:'linear-gradient(135deg,#0D9488,#0F766E)', padding:'48px 20px 24px' }}>
        <button onClick={()=>navigate('home')} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', marginBottom:14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>New Patient</div>
        <div style={{ fontSize:22, fontWeight:800, color:'#fff', marginTop:3 }}>Patient Information</div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:4 }}>Step 1 of 4 — Enter details before camera scan</div>
      </div>

      <div className="scroll-body">
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:16 }}>Personal Information</div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            <div className="field">
              <label className="field-label">Full Name</label>
              <input className="field-input" placeholder="Patient full name" value={form.name} onChange={e=>set('name',e.target.value)}/>
              {errors.name && <span style={{ fontSize:11, color:'var(--danger)' }}>{errors.name}</span>}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="field">
                <label className="field-label">Age</label>
                <input className="field-input" placeholder="Age" type="number" min="1" max="120" value={form.age} onChange={e=>set('age',e.target.value)}/>
                {errors.age && <span style={{ fontSize:11, color:'var(--danger)' }}>{errors.age}</span>}
              </div>
              <div className="field">
                <label className="field-label">Gender</label>
                <select className="field-input" value={form.gender} onChange={e=>set('gender',e.target.value)}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
                {errors.gender && <span style={{ fontSize:11, color:'var(--danger)' }}>{errors.gender}</span>}
              </div>
            </div>

            <div className="field">
              <label className="field-label">Treatment Notes (optional)</label>
              <textarea className="field-input" placeholder="Any relevant clinical notes..." value={form.notes} onChange={e=>set('notes',e.target.value)} rows={3} style={{ resize:'none' }}/>
            </div>
          </div>
        </div>

        {/* Pre-scan checklist */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:12 }}>Before you begin</div>
          {[
            { icon:'👓', text:'Ask patient to remove glasses — glasses interfere with nose landmark detection' },
            { icon:'💆', text:'Patient should sit upright, face forward, in good lighting' },
            { icon:'💳', text:'Keep a credit/debit card ready — needed for camera calibration' },
            { icon:'📏', text:'Maintain consistent distance throughout the scan (75–90 cm)' },
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:12, marginBottom:10, alignItems:'flex-start' }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
              <span style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Flow preview */}
        <div style={{ background:'var(--teal-light)', borderRadius:'var(--radius)', padding:'12px 16px', fontSize:11, color:'var(--teal-dark)', lineHeight:1.8 }}>
          <strong>Scan flow:</strong> Patient Info → Camera Calibration → REST scan → OCCLUSION scan → Results
        </div>
      </div>

      <div style={{ padding:16, background:'var(--surface)', borderTop:'1px solid var(--border)' }}>
        <button className="btn btn-primary" onClick={handleStart} style={{ borderRadius:14, letterSpacing:0.8 }}>
          NEXT: CALIBRATE CAMERA →
        </button>
      </div>
    </div>
  )
}