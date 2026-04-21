import { useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════════
   EXACT AT EASE — SPLASH SCREEN
   src/screens/Splash.jsx
   Props: { navigate(screen) }
   Auto-navigates to 'home' after 2.4 s.
   Zero className dependencies — 100% inline styles.
   ═══════════════════════════════════════════════════════════════ */

const KEYFRAMES = `
@keyframes eae-logo-drop {
  0%   { opacity: 0; transform: translateY(-28px) scale(0.88); }
  60%  { opacity: 1; transform: translateY(4px)   scale(1.03); }
  100% { opacity: 1; transform: translateY(0)     scale(1);    }
}
@keyframes eae-fade-up {
  0%   { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0);    }
}
@keyframes eae-bar-grow {
  0%   { width: 0%; }
  100% { width: 100%; }
}
@keyframes eae-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes eae-pulse-ring {
  0%   { transform: scale(0.92); opacity: 0.5; }
  50%  { transform: scale(1.08); opacity: 0.15; }
  100% { transform: scale(0.92); opacity: 0.5; }
}
`

function useStyles() {
  useEffect(() => {
    if (document.getElementById('eae-splash-kf')) return
    const s = document.createElement('style')
    s.id = 'eae-splash-kf'
    s.textContent = KEYFRAMES
    document.head.appendChild(s)
  }, [])
}

export default function Splash({ navigate }) {
  useStyles()
  const done = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (!done.current) { done.current = true; navigate('home') }
    }, 2400)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0B3C8C 0%, #1553b5 45%, #2F80ED 100%)',
        zIndex: 9999,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ── decorative blur orbs ── */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 220, height: 220, borderRadius: '50%',
        background: 'rgba(86,204,242,0.25)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', bottom: -60, left: -60,
        width: 200, height: 200, borderRadius: '50%',
        background: 'rgba(255,255,255,0.10)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', top: '40%', left: '15%',
        width: 100, height: 100, borderRadius: '50%',
        background: 'rgba(86,204,242,0.10)',
        filter: 'blur(24px)', pointerEvents: 'none',
      }}/>

      {/* ── pulse ring behind logo ── */}
      <div style={{
        position: 'absolute',
        width: 180, height: 180,
        borderRadius: '50%',
        border: '2px solid rgba(86,204,242,0.28)',
        animation: 'eae-pulse-ring 2.4s ease-in-out infinite',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute',
        width: 220, height: 220,
        borderRadius: '50%',
        border: '1.5px solid rgba(86,204,242,0.14)',
        animation: 'eae-pulse-ring 2.4s ease-in-out 0.4s infinite',
        pointerEvents: 'none',
      }}/>

      {/* ── logo container ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        animation: 'eae-logo-drop 0.72s cubic-bezier(0.34,1.56,0.64,1) 0.1s both',
      }}>
        {/* logo image */}
        <div style={{
          width: 130,
          height: 130,
          borderRadius: 32,
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1.5px solid rgba(255,255,255,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 48px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.25)',
          marginBottom: 28,
          overflow: 'hidden',
        }}>
          <img
            src="/icon-512.png"
            alt="Exact At Ease"
            style={{
              width: 108,
              height: 108,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.18))',
            }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
          {/* SVG fallback — shown only if logo.png is missing */}
          <div style={{ display: 'none', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              {/* face silhouette */}
              <path d="M28 68 C28 68 20 60 18 50 C16 40 18 30 24 24 C30 18 36 16 40 16 C44 16 50 18 56 24"
                    stroke="rgba(255,255,255,0.9)" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <path d="M24 24 C20 30 18 38 20 46 C22 54 26 62 28 68"
                    stroke="rgba(255,255,255,0.9)" strokeWidth="3" strokeLinecap="round" fill="none"/>
              {/* ruler line */}
              <line x1="40" y1="10" x2="40" y2="72" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="40" cy="10" r="4" fill="white"/>
              <circle cx="40" cy="72" r="4" fill="white"/>
              {/* tick marks */}
              {[18,26,34,42,50,58,66].map((y, i) => (
                <line key={i} x1="40" y1={y} x2={i % 2 === 0 ? 50 : 46} y2={y}
                      stroke="rgba(255,255,255,0.75)" strokeWidth="1.8" strokeLinecap="round"/>
              ))}
              {/* E letter hint */}
              <text x="54" y="44" fill="rgba(255,255,255,0.85)" fontSize="26" fontWeight="900"
                    fontFamily="Inter, sans-serif">E</text>
            </svg>
          </div>
        </div>

        {/* app name */}
        <div style={{
          animation: 'eae-fade-up 0.55s ease-out 0.55s both',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontWeight: 700,
            fontSize: 30,
            color: '#fff',
            letterSpacing: '-0.6px',
            margin: 0,
            lineHeight: 1.1,
          }}>
            Exact At Ease
          </h1>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: 14,
            color: 'rgba(255,255,255,0.72)',
            marginTop: 8,
            letterSpacing: '0.2px',
          }}>
            Dental Measurement Platform
          </p>
        </div>
      </div>

      {/* ── loading bar ── */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 160,
        animation: 'eae-fade-up 0.4s ease-out 0.8s both',
      }}>
        <div style={{
          width: '100%',
          height: 3,
          background: 'rgba(255,255,255,0.18)',
          borderRadius: 99,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            borderRadius: 99,
            background: 'linear-gradient(90deg, rgba(86,204,242,0.7) 0%, #fff 50%, rgba(86,204,242,0.7) 100%)',
            backgroundSize: '200% auto',
            animation: 'eae-bar-grow 2s ease-out 0.3s both, eae-shimmer 1.4s linear 0.3s infinite',
          }}/>
        </div>
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: 11,
          color: 'rgba(255,255,255,0.55)',
          textAlign: 'center',
          marginTop: 10,
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          Loading…
        </p>
      </div>

      {/* ── version stamp ── */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        fontSize: 10,
        color: 'rgba(255,255,255,0.30)',
        letterSpacing: '0.5px',
        animation: 'eae-fade-up 0.4s ease-out 1s both',
      }}>
        v2.0 · Clinical Edition
      </div>

    </div>
  )
}