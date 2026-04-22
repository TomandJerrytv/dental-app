// src/screens/Splash.jsx
// ─────────────────────────────────────────────────────────────────────────────
// EXACT AT EASE — SPLASH SCREEN (GPU-Safe)
//
// CRITICAL ANDROID RULES (do not violate — breaks camera on subsequent screens):
//   ✗ NO transform animations  — creates GPU compositor layers that linger
//   ✗ NO will-change           — same compositor layer problem
//   ✗ NO filter:blur           — compositor layer conflict with video stream
//   ✗ NO backdrop-filter       — same
//   ✗ NO position:fixed        — same
//   ✓ opacity animations ONLY  — safe, no compositor layer created
//   ✓ background + border animations — safe
//
// This splash navigates to 'home' after 2.2 seconds.
// All animations complete within 2 seconds so there is NO animation still
// running when the navigate() call fires — Android reclaims resources cleanly.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'

// ── Keyframe injection — opacity only, never transform ────────────────────────
// Injected once at module evaluation, never recreated.
// Using a style tag instead of index.css so this file is fully self-contained.
const SPLASH_STYLES = `
  @keyframes splashFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes splashLogoIn {
    0%   { opacity: 0; }
    30%  { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes splashTitleIn {
    0%   { opacity: 0; }
    50%  { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes splashSubIn {
    0%   { opacity: 0; }
    60%  { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes splashBarFill {
    0%   { opacity: 0.4; width: 0%; }
    10%  { opacity: 1;   width: 0%; }
    85%  { opacity: 1;   width: 100%; }
    100% { opacity: 1;   width: 100%; }
  }
  @keyframes splashDotPulse {
    0%,100% { opacity: 0.3; }
    50%     { opacity: 1;   }
  }
`

// Inject styles once — idempotent
if (typeof document !== 'undefined' && !document.getElementById('splash-styles')) {
  const tag = document.createElement('style')
  tag.id = 'splash-styles'
  tag.textContent = SPLASH_STYLES
  document.head.appendChild(tag)
}

// ── Brand colors (module-level) ───────────────────────────────────────────────
const PRIMARY   = '#0B3C8C'
const SECONDARY = '#2F80ED'
const GRAD      = `linear-gradient(160deg, ${PRIMARY} 0%, #1553b5 50%, ${SECONDARY} 100%)`

// ─────────────────────────────────────────────────────────────────────────────
export default function Splash({ navigate }) {

  // Navigate to home after 2.2s — all animations finish at 2.0s
  // so there is NO running animation when navigate fires.
  // Android reclaims GPU resources cleanly before camera screens mount.
  useEffect(() => {
    const timer = setTimeout(() => navigate('home'), 2200)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div style={{
      width:           '100%',
      minHeight:       '100dvh',
      background:      GRAD,
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      position:        'relative',  // NOT fixed — no compositor layer
      overflow:        'hidden',
      animation:       'splashFadeIn 0.35s ease-out',
    }}>

      {/* ── Decorative circles — opacity only, NO filter:blur ──────────────── */}
      {/* These are purely visual. No animations on them — static opacity. */}
      <div style={{
        position:     'absolute',
        top:          -60,
        right:        -60,
        width:        220,
        height:       220,
        borderRadius: '50%',
        background:   'rgba(86,204,242,0.14)',
        pointerEvents:'none',
      }}/>
      <div style={{
        position:     'absolute',
        bottom:       -40,
        left:         -50,
        width:        180,
        height:       180,
        borderRadius: '50%',
        background:   'rgba(255,255,255,0.07)',
        pointerEvents:'none',
      }}/>
      <div style={{
        position:     'absolute',
        top:          '30%',
        left:         -30,
        width:        100,
        height:       100,
        borderRadius: '50%',
        background:   'rgba(255,255,255,0.05)',
        pointerEvents:'none',
      }}/>

      {/* ── Main content column ───────────────────────────────────────────── */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           0,
        position:      'relative',
        zIndex:        1,
        padding:       '0 40px',
        width:         '100%',
        maxWidth:      360,
      }}>

        {/* Logo card — fades in, NO transform/scale animation */}
        <div style={{
          width:        100,
          height:       100,
          borderRadius: 26,
          background:   'rgba(255,255,255,0.14)',
          border:       '1.5px solid rgba(255,255,255,0.22)',
          display:      'flex',
          alignItems:   'center',
          justifyContent:'center',
          marginBottom: 28,
          animation:    'splashLogoIn 0.9s ease-out forwards',
          opacity:      0,         // start hidden, animation reveals
        }}>
          <img
            src="/icon-512.png"
            alt="Exact At Ease"
            style={{
              width:       70,
              height:      70,
              borderRadius:14,
              objectFit:  'contain',
              display:    'block',
            }}
            onError={e => {
              // Fallback: show tooth SVG if icon missing
              e.target.style.display = 'none'
              e.target.parentNode.innerHTML = `
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <path d="M28 6C22 6 17 9 14 14 11 19 11 24 13 28 15 32 16 36 16 40 16 44 18 48 20 48 22 48 23 44 24 41 25 38 26.5 36 28 36 29.5 36 31 38 32 41 33 44 34 48 36 48 38 48 40 44 40 40 40 36 41 32 43 28 45 24 45 19 42 14 39 9 34 6 28 6Z" fill="rgba(255,255,255,0.9)"/>
                  <circle cx="22" cy="20" r="3" fill="rgba(11,60,140,0.6)"/>
                  <circle cx="34" cy="20" r="3" fill="rgba(11,60,140,0.6)"/>
                </svg>
              `
            }}
          />
        </div>

        {/* App name */}
        <div style={{
          fontSize:       28,
          fontWeight:     700,
          color:          '#fff',
          letterSpacing:  '-0.5px',
          textAlign:      'center',
          lineHeight:     1.2,
          marginBottom:   8,
          fontFamily:     'var(--font)',
          animation:      'splashTitleIn 1.1s ease-out forwards',
          opacity:        0,
        }}>
          Exact At Ease
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize:      14,
          fontWeight:    400,
          color:         'rgba(255,255,255,0.78)',
          textAlign:     'center',
          marginBottom:  48,
          fontFamily:    'var(--font)',
          letterSpacing: '0.3px',
          animation:     'splashSubIn 1.3s ease-out forwards',
          opacity:       0,
        }}>
          Dental Measurement Platform
        </div>

        {/* Loading bar — opacity + width animation only, no transform */}
        <div style={{
          width:        '100%',
          height:       3,
          background:   'rgba(255,255,255,0.15)',
          borderRadius: 2,
          overflow:     'hidden',
          marginBottom: 12,
        }}>
          <div style={{
            height:       '100%',
            background:   'rgba(255,255,255,0.88)',
            borderRadius: 2,
            // width animates from 0→100% — this is a layout property, NOT a compositor trigger
            animation:    'splashBarFill 2.0s ease-in-out forwards',
            opacity:      0,
            width:        '0%',
          }}/>
        </div>

        {/* Loading dots */}
        <div style={{
          display:       'flex',
          alignItems:    'center',
          gap:           8,
          marginBottom:  12,
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width:          5,
              height:         5,
              borderRadius:   '50%',
              background:     'rgba(255,255,255,0.7)',
              animation:      `splashDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}/>
          ))}
          <span style={{
            fontSize:    11,
            color:       'rgba(255,255,255,0.65)',
            fontFamily:  'var(--font)',
            fontWeight:  500,
            letterSpacing:'0.8px',
            textTransform:'uppercase',
            marginLeft:  4,
          }}>
            Loading
          </span>
        </div>

      </div>

      {/* Version stamp — bottom of screen */}
      <div style={{
        position:    'absolute',
        bottom:      28,
        left:        0,
        right:       0,
        textAlign:   'center',
        fontSize:    11,
        color:       'rgba(255,255,255,0.40)',
        fontFamily:  'var(--font)',
        fontWeight:  400,
        letterSpacing:'0.3px',
        animation:   'splashSubIn 1.5s ease-out forwards',
        opacity:     0,
      }}>
        v2.0 · Clinical Edition
      </div>

    </div>
  )
}