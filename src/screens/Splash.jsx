// src/screens/Splash.jsx
// ─────────────────────────────────────────────────────────────────────────────
// EXACT AT EASE — SPLASH SCREEN (Android Camera Safe)
//
// RULE: Every animation MUST complete before navigate('home') fires.
// Infinite animations = compositor layers that Android doesn't release
// before Camera.jsx mounts = black camera.
//
// All animations finish by 1.6s. Navigate fires at 1.9s.
// Chrome gets 300ms to fully release GPU resources before Camera mounts.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'

// ── Inject keyframes once — idempotent ───────────────────────────────────────
// Only 2 keyframes: sIn (opacity 0→1) and sBar (width 0→100%).
// NO infinite animations. NO transform. NO compositor layers left behind.
const STYLES = `
  @keyframes sIn  { from { opacity:0 } to { opacity:1 } }
  @keyframes sBar { from { width:0%  } to { width:100% } }
`
if (typeof document !== 'undefined' && !document.getElementById('sp-st')) {
  const t = document.createElement('style')
  t.id = 'sp-st'
  t.textContent = STYLES
  document.head.appendChild(t)
}

const PRIMARY   = '#0B3C8C'
const SECONDARY = '#2F80ED'
const GRAD      = `linear-gradient(160deg, ${PRIMARY} 0%, #1553b5 50%, ${SECONDARY} 100%)`

export default function Splash({ navigate }) {

  // All animations finish at 1.6s.
  // Navigate fires at 1.9s — gives Chrome 300ms to release all GPU compositor
  // resources before Calibration / Camera screens mount and need the video layer.
  useEffect(() => {
    const t = setTimeout(() => navigate('home'), 1900)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div style={{
      width:          '100%',
      minHeight:      '100dvh',
      background:     GRAD,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      position:       'relative',
      overflow:       'hidden',
      // Root fade: 0.3s finite — done at 0.3s ✓
      animation:      'sIn 0.3s ease-out',
    }}>

      {/* Decorative orbs — STATIC, no animation at all */}
      <div style={{ position:'absolute', top:-60, right:-60, width:220, height:220, borderRadius:'50%', background:'rgba(86,204,242,0.13)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:-40, left:-50, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', top:'35%', left:-30, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }}/>

      {/* Main content */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', position:'relative', zIndex:1, padding:'0 40px', width:'100%', maxWidth:360 }}>

        {/* Logo card — fade 0.6s delay 0.1s → finishes 0.7s ✓ */}
        <div style={{
          width:96, height:96, borderRadius:24,
          background:'rgba(255,255,255,0.14)',
          border:'1.5px solid rgba(255,255,255,0.22)',
          display:'flex', alignItems:'center', justifyContent:'center',
          marginBottom:28,
          animation:'sIn 0.6s ease-out 0.1s both',
        }}>
          <img
            src="/icon-512.png"
            alt=""
            style={{ width:68, height:68, borderRadius:14, objectFit:'contain', display:'block' }}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>

        {/* App name — fade 0.5s delay 0.3s → finishes 0.8s ✓ */}
        <div style={{
          fontSize:27, fontWeight:700, color:'#fff',
          letterSpacing:'-0.5px', textAlign:'center', lineHeight:1.2,
          marginBottom:8, fontFamily:'var(--font)',
          animation:'sIn 0.5s ease-out 0.3s both',
        }}>
          Exact At Ease
        </div>

        {/* Subtitle — fade 0.5s delay 0.5s → finishes 1.0s ✓ */}
        <div style={{
          fontSize:14, fontWeight:400, color:'rgba(255,255,255,0.78)',
          textAlign:'center', marginBottom:48, fontFamily:'var(--font)',
          animation:'sIn 0.5s ease-out 0.5s both',
        }}>
          Dental Measurement Platform
        </div>

        {/* Progress bar wrapper — fades in at 0.2s */}
        <div style={{
          width:'100%', height:3,
          background:'rgba(255,255,255,0.15)',
          borderRadius:2, overflow:'hidden', marginBottom:14,
          animation:'sIn 0.3s ease-out 0.2s both',
        }}>
          {/* Bar fill — width 0→100% over 1.4s starting 0.2s → finishes 1.6s ✓
              width is a layout property — does NOT create compositor layer */}
          <div style={{
            height:'100%', background:'rgba(255,255,255,0.88)', borderRadius:2,
            animation:'sBar 1.4s ease-in-out 0.2s both',
            width:'0%',
          }}/>
        </div>

        {/* LOADING text — static opacity, no animation */}
        <div style={{
          fontSize:11, color:'rgba(255,255,255,0.50)',
          fontFamily:'var(--font)', fontWeight:600,
          letterSpacing:'1.5px', textTransform:'uppercase',
        }}>
          Loading
        </div>

      </div>

      {/* Version — static */}
      <div style={{
        position:'absolute', bottom:28, left:0, right:0, textAlign:'center',
        fontSize:11, color:'rgba(255,255,255,0.35)',
        fontFamily:'var(--font)', fontWeight:400, letterSpacing:'0.3px',
      }}>
        v2.0 · Clinical Edition
      </div>

    </div>
  )
}