import { useState, useMemo, useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════
   EXACT AT EASE — HOME SCREEN (v2.1)
   src/screens/Home.jsx
   Props: { navigate(screen, payload) }
   localStorage key: 'dental_records'
   Changes from v2.0:
     • Font → Inter 400/500/600/700 (injected at runtime)
     • 3rd stat card: Needs Review → Avg VDO mm
     • Avatars: illustrated faces with skin, hair, eyes, smile
     • Status badges REMOVED from patient cards
     • FAB moved bottom-left → bottom-RIGHT
     • FAB: ripple wave + pulse ring on press, then navigate
     • Zero className dependencies — 100% inline styles
   ═══════════════════════════════════════════════════════════════ */

// ─── Brand palette ────────────────────────────────────────────
const C = {
  primary:   '#0B3C8C',
  secondary: '#2F80ED',
  accent:    '#56CCF2',
  bg:        '#F8FAFC',
  surface:   '#FFFFFF',
  border:    '#E2E8F0',
  text:      '#1F2937',
  textSoft:  '#6B7280',
  textMuted: '#9CA3AF',
};

// ─── Inject Inter font once ───────────────────────────────────
function useInterFont() {
  useEffect(() => {
    if (document.getElementById('eae-inter')) return;
    const l = document.createElement('link');
    l.id   = 'eae-inter';
    l.rel  = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }, []);
}

// ─── Inject FAB animation keyframes once ─────────────────────
const KEYFRAMES = `
@keyframes eae-ripple {
  0%   { transform: scale(0.4); opacity: 0.75; }
  100% { transform: scale(3.4); opacity: 0;    }
}
@keyframes eae-pulse {
  0%   { box-shadow: 0 0 0 0    rgba(47,128,237,0.60); }
  70%  { box-shadow: 0 0 0 18px rgba(47,128,237,0);    }
  100% { box-shadow: 0 0 0 0    rgba(47,128,237,0);    }
}
`;
function useKeyframes() {
  useEffect(() => {
    if (document.getElementById('eae-kf')) return;
    const s = document.createElement('style');
    s.id          = 'eae-kf';
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
  }, []);
}

// ─── Helpers ──────────────────────────────────────────────────
const getTs = r => r.createdAt || (r.date ? new Date(r.date).getTime() : 0);

function relDate(r) {
  const d = (Date.now() - getTs(r)) / 86_400_000;
  if (d < 1) return 'Today';
  if (d < 2) return 'Yesterday';
  if (d < 7) return `${Math.floor(d)}d ago`;
  return new Date(getTs(r)).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
}

// ─── Illustrated avatar — MALE ────────────────────────────────
function AvatarMale({ size = 50 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none"
         style={{ borderRadius:'50%', display:'block', flexShrink:0 }}>
      <circle cx="25" cy="25" r="25" fill="#DBEAFE"/>
      {/* hair */}
      <ellipse cx="25" cy="17" rx="10" ry="11" fill="#1E293B"/>
      <rect    x="15" y="17"  width="20" height="7" fill="#1E293B"/>
      {/* neck */}
      <rect x="21" y="31" width="8" height="5" rx="2" fill="#FDBA74"/>
      {/* head */}
      <ellipse cx="25" cy="22" rx="9.5" ry="10.5" fill="#FED7AA"/>
      {/* ears */}
      <ellipse cx="15.2" cy="22" rx="2" ry="2.5" fill="#FDBA74"/>
      <ellipse cx="34.8" cy="22" rx="2" ry="2.5" fill="#FDBA74"/>
      {/* brows */}
      <path d="M19.5 17 Q21.5 16 23 17"   stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M27   17 Q28.5 16 30.5 17" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      {/* eyes */}
      <ellipse cx="21" cy="20.5" rx="1.8" ry="2" fill="#1F2937"/>
      <ellipse cx="29" cy="20.5" rx="1.8" ry="2" fill="#1F2937"/>
      <circle  cx="21.7" cy="19.8" r="0.6" fill="white"/>
      <circle  cx="29.7" cy="19.8" r="0.6" fill="white"/>
      {/* nose */}
      <path d="M24.5 22 L23.5 25 Q25 25.8 26.5 25 L25.5 22" fill="#FDBA74" stroke="#F97316" strokeWidth="0.35"/>
      {/* smile */}
      <path d="M21.5 27 Q25 29.5 28.5 27" stroke="#7C2D12" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      {/* shirt */}
      <path d="M10 50 C10 40 17 36 21 35 L25 38.5 L29 35 C33 36 40 40 40 50 Z" fill="#2F80ED"/>
      <path d="M21 35 L25 40 L29 35" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Illustrated avatar — FEMALE ─────────────────────────────
function AvatarFemale({ size = 50 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none"
         style={{ borderRadius:'50%', display:'block', flexShrink:0 }}>
      <circle cx="25" cy="25" r="25" fill="#FCE7F3"/>
      {/* hair back */}
      <ellipse cx="25" cy="22" rx="11" ry="14" fill="#7C2D12"/>
      {/* neck */}
      <rect x="21" y="31" width="8" height="5" rx="2" fill="#FDBA74"/>
      {/* head */}
      <ellipse cx="25" cy="21" rx="9.5" ry="10.5" fill="#FED7AA"/>
      {/* ears */}
      <ellipse cx="15.2" cy="21" rx="2" ry="2.5" fill="#FDBA74"/>
      <ellipse cx="34.8" cy="21" rx="2" ry="2.5" fill="#FDBA74"/>
      {/* hair top */}
      <ellipse cx="25" cy="11.5" rx="10" ry="5" fill="#7C2D12"/>
      <path d="M15 12 Q14 18 15.5 22" fill="#7C2D12"/>
      <path d="M35 12 Q36 18 34.5 22" fill="#7C2D12"/>
      {/* brows */}
      <path d="M19.5 16 Q21.5 15 23 16"   stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M27   16 Q28.5 15 30.5 16" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      {/* eyes */}
      <ellipse cx="21" cy="19.5" rx="1.8" ry="2" fill="#1F2937"/>
      <ellipse cx="29" cy="19.5" rx="1.8" ry="2" fill="#1F2937"/>
      <circle  cx="21.7" cy="18.8" r="0.6" fill="white"/>
      <circle  cx="29.7" cy="18.8" r="0.6" fill="white"/>
      {/* lashes */}
      <path d="M19.5 17.5 L18.6 16.7 M21 17.2 L21 16.2 M22.5 17.5 L23.2 16.7" stroke="#1F2937" strokeWidth="0.6" strokeLinecap="round"/>
      <path d="M27.5 17.5 L26.8 16.7 M29 17.2 L29 16.2 M30.5 17.5 L31.2 16.7" stroke="#1F2937" strokeWidth="0.6" strokeLinecap="round"/>
      {/* nose */}
      <path d="M24.5 21 L23.5 24 Q25 24.8 26.5 24 L25.5 21" fill="#FDBA74" stroke="#F97316" strokeWidth="0.3"/>
      {/* lips */}
      <path d="M21.5 26.5 Q23 25.5 25 26 Q27 25.5 28.5 26.5 Q27 28.5 25 28 Q23 28.5 21.5 26.5 Z" fill="#FB7185"/>
      <path d="M21.5 26.5 Q25 26 28.5 26.5" stroke="#E11D48" strokeWidth="0.5" fill="none"/>
      {/* earrings */}
      <circle cx="15.2" cy="23" r="1.1" fill="#FDE68A"/>
      <circle cx="34.8" cy="23" r="1.1" fill="#FDE68A"/>
      {/* shirt */}
      <path d="M10 50 C10 40 17 36 21 35 L25 38.5 L29 35 C33 36 40 40 40 50 Z" fill="#EC4899"/>
      <path d="M21 35 L25 40 L29 35" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Avatar({ gender, size = 50 }) {
  const g = (gender || '').toLowerCase();
  return (g === 'female' || g === 'f') ? <AvatarFemale size={size}/> : <AvatarMale size={size}/>;
}

// ─── SVG icons ────────────────────────────────────────────────
const w = { stroke:'rgba(255,255,255,0.85)', strokeWidth:'2', strokeLinecap:'round', strokeLinejoin:'round', fill:'none' };

const IcoUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...w}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcoCalendar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...w}>
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8"  y1="2" x2="8"  y2="6"/>
    <line x1="3"  y1="10" x2="21" y2="10"/>
  </svg>
);
const IcoChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...w}>
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
    <line x1="2"  y1="20" x2="22" y2="20"/>
  </svg>
);
const IcoSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IcoChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IcoPlus = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
       stroke="white" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5"  y1="12" x2="19" y2="12"/>
  </svg>
);

// ─── Stat card ────────────────────────────────────────────────
function StatCard({ icon, value, label }) {
  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.14)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.22)',
      borderRadius: 16,
      padding: '12px 6px 10px',
      textAlign: 'center',
    }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:6 }}>{icon}</div>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        fontSize: 23,
        color: '#fff',
        lineHeight: 1,
        letterSpacing: '-0.5px',
        marginBottom: 6,
      }}>{value}</div>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        fontSize: 9,
        color: 'rgba(255,255,255,0.78)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        lineHeight: 1.35,
      }}>{label}</div>
    </div>
  );
}

// ─── Patient row card ─────────────────────────────────────────
function PatientCard({ record, showDate, onClick }) {
  const { patient = {}, measurements: m } = record;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onPointerDown={e  => { e.currentTarget.style.transform='scale(0.985)'; e.currentTarget.style.boxShadow='0 1px 4px rgba(11,60,140,0.07)'; }}
      onPointerUp={e    => { e.currentTarget.style.transform='scale(1)';     e.currentTarget.style.boxShadow='0 2px 10px rgba(11,60,140,0.08)'; }}
      onPointerLeave={e => { e.currentTarget.style.transform='scale(1)';     e.currentTarget.style.boxShadow='0 2px 10px rgba(11,60,140,0.08)'; }}
      style={{
        background: C.surface,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        boxShadow: '0 2px 10px rgba(11,60,140,0.08)',
        padding: '14px 16px',
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Avatar gender={patient.gender} size={50}/>

      <div style={{ flex:1, minWidth:0 }}>
        {/* name */}
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: 16,
          color: C.text,
          marginBottom: 3,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}>
          {patient.name || 'Patient'}
        </div>

        {/* age · gender · date */}
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: 13,
          color: C.textSoft,
          marginBottom: m ? 5 : 0,
          display: 'flex',
          gap: 5,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {patient.age    && <span>{patient.age} yrs</span>}
          {patient.age    && patient.gender && <span style={{ color:C.border }}>·</span>}
          {patient.gender && <span style={{ textTransform:'capitalize' }}>{patient.gender}</span>}
          {showDate && <>
            <span style={{ color:C.border }}>·</span>
            <span>{relDate(record)}</span>
          </>}
        </div>

        {/* measurements */}
        {m ? (
          <div style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 14,
            color: '#374151',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}>
            <span>VDR: <strong style={{ fontWeight:600 }}>{Number(m.vdr).toFixed(1)} mm</strong></span>
            <span style={{ color:C.border, fontSize:12 }}>|</span>
            <span>FS: <strong style={{ fontWeight:600 }}>{Number(m.freewaySpace).toFixed(1)} mm</strong></span>
          </div>
        ) : (
          <div style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 13,
            color: '#F59E0B',
          }}>Pending measurement</div>
        )}
      </div>

      <IcoChevron/>
    </div>
  );
}

// ─── FAB — bottom right, ripple + pulse on press ──────────────
function Fab({ onPress }) {
  const [ripple,   setRipple]   = useState(false);
  const [pressing, setPressing] = useState(false);
  const [pulsing,  setPulsing]  = useState(false);
  const timer = useRef(null);

  const handleClick = () => {
    // reset then re-trigger so double-taps also animate
    setRipple(false);
    setPulsing(false);
    requestAnimationFrame(() => {
      setRipple(true);
      setPulsing(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setRipple(false);
        setPulsing(false);
        onPress();
      }, 480);
    });
  };

  return (
    <button
      onClick={handleClick}
      onPointerDown={() => setPressing(true)}
      onPointerUp={()   => setPressing(false)}
      onPointerLeave={()=> setPressing(false)}
      aria-label="New Measurement"
      style={{
        position: 'fixed',
        bottom: 28,
        right: 24,
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: `linear-gradient(140deg, ${C.primary} 0%, ${C.secondary} 100%)`,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        // shadow: collapses on press, pulses on click
        boxShadow: pressing
          ? '0 3px 10px rgba(11,60,140,0.28)'
          : '0 8px 26px rgba(11,60,140,0.45), 0 3px 10px rgba(47,128,237,0.32)',
        transform: pressing ? 'scale(0.91)' : 'scale(1)',
        transition: 'transform 0.13s ease, box-shadow 0.13s ease',
        animation: pulsing ? 'eae-pulse 0.52s ease-out' : 'none',
        WebkitTapHighlightColor: 'transparent',
        zIndex: 100,
      }}
    >
      {/* ripple wave */}
      {ripple && (
        <span style={{
          position: 'absolute',
          inset: 0,
          margin: 'auto',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.42)',
          animation: 'eae-ripple 0.48s ease-out forwards',
          pointerEvents: 'none',
        }}/>
      )}
      <IcoPlus/>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//   MAIN EXPORT
// ═══════════════════════════════════════════════════════════════
export default function Home({ navigate }) {
  useInterFont();
  useKeyframes();

  const [tab,    setTab]    = useState('patients');
  const [search, setSearch] = useState('');

  /* load */
  const allRecords = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('dental_records') || '[]'); }
    catch { return []; }
  }, []);

  /* stats */
  const { patients, todayCount, avgVdo } = useMemo(() => {
    const map = {};
    allRecords.forEach(r => {
      const key = (r.patient?.name || '').toLowerCase().trim();
      if (!key) return;
      if (!map[key] || getTs(r) > getTs(map[key])) map[key] = r;
    });
    const pts = Object.values(map).sort((a, b) =>
      (a.patient?.name || '').localeCompare(b.patient?.name || '', 'en', { sensitivity:'base' })
    );
    const today  = new Date().toDateString();
    const todayN = allRecords.filter(r => new Date(getTs(r)).toDateString() === today).length;
    const vdos   = allRecords.filter(r => r.measurements?.vdo).map(r => r.measurements.vdo);
    const avg    = vdos.length
      ? (vdos.reduce((s, v) => s + v, 0) / vdos.length).toFixed(1) + ' mm'
      : '—';
    return { patients: pts, todayCount: todayN, avgVdo: avg };
  }, [allRecords]);

  const historyList = useMemo(() =>
    [...allRecords].sort((a, b) => getTs(b) - getTs(a)),
  [allRecords]);

  const listToShow = useMemo(() => {
    const q    = search.toLowerCase().trim();
    const base = tab === 'patients' ? patients : historyList;
    return q ? base.filter(r => (r.patient?.name || '').toLowerCase().includes(q)) : base;
  }, [tab, search, patients, historyList]);

  return (
    <div style={{
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      background: C.bg,
      minHeight: '100vh',
      maxWidth: 430,
      margin: '0 auto',
      position: 'relative',
      overflowX: 'hidden',
    }}>

      {/* ════ HEADER ════════════════════════════════════════ */}
      <div style={{
        background: `linear-gradient(140deg, ${C.primary} 0%, #1553b5 55%, ${C.secondary} 100%)`,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0 0 24px 24px',
      }}>
        {/* orbs */}
        <div style={{ position:'absolute', top:-30, right:-30, width:160, height:160, borderRadius:'50%', background:'rgba(86,204,242,0.22)', filter:'blur(40px)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:10, left:-40, width:130, height:130, borderRadius:'50%', background:'rgba(255,255,255,0.10)', filter:'blur(32px)', pointerEvents:'none' }}/>
        {/* wave deco */}
        <svg style={{ position:'absolute', bottom:0, left:0, width:'100%', pointerEvents:'none' }} viewBox="0 0 430 48" preserveAspectRatio="none">
          <path d="M0,24 C100,48 200,0 300,28 T430,18 L430,48 L0,48 Z" fill="rgba(255,255,255,0.06)"/>
        </svg>

        {/* logo row */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'48px 20px 0' }}>
          <img src="/logo.png" alt="Exact At Ease"
               style={{ width:36, height:36, borderRadius:10, objectFit:'contain' }}
               onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}/>
          <div style={{ display:'none', width:36, height:36, borderRadius:10,
                        background:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v16l4-4h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
            </svg>
          </div>
          <span style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:18, color:'#fff', letterSpacing:'-0.3px' }}>
            Exact At Ease
          </span>
        </div>

        {/* welcome text */}
        <div style={{ padding:'18px 20px 0' }}>
          <h1 style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 27,
            color: '#fff', margin: '0 0 6px', letterSpacing: '-0.5px', lineHeight: 1.15,
          }}>
            Welcome, Doctor
          </h1>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 15,
            color: 'rgba(255,255,255,0.85)', margin: '0 0 20px',
          }}>
            Manage your patient measurements
          </p>
        </div>

        {/* 3 stat cards */}
        <div style={{ display:'flex', gap:10, padding:'0 20px 24px' }}>
          <StatCard icon={<IcoUsers/>}    value={patients.length} label="Total Patients"/>
          <StatCard icon={<IcoCalendar/>} value={todayCount}      label="Today's Scans"/>
          <StatCard icon={<IcoChart/>}    value={avgVdo}           label="Avg VDO"/>
        </div>
      </div>

      {/* ════ TABS ══════════════════════════════════════════ */}
      <div style={{
        display:'flex', background:C.surface,
        borderBottom:`1px solid ${C.border}`,
        position:'sticky', top:0, zIndex:10,
      }}>
        {[
          { key:'patients', label:'Patient List', count:patients.length },
          { key:'history',  label:'History',      count:historyList.length },
        ].map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex:1, padding:'14px 0', border:'none', background:'none', cursor:'pointer',
              fontFamily:'Inter, sans-serif', fontSize:13,
              fontWeight: active ? 700 : 500,
              color: active ? C.primary : C.textMuted,
              borderBottom: active ? `2.5px solid ${C.primary}` : '2.5px solid transparent',
              transition:'color 0.18s, border-color 0.18s',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
              {t.label}
              <span style={{
                fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999,
                background: active ? `${C.primary}16` : `${C.textMuted}14`,
                color: active ? C.primary : C.textMuted,
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* ════ SEARCH ════════════════════════════════════════ */}
      <div style={{ padding:'12px 16px 4px', background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          background:C.bg, borderRadius:12, padding:'10px 14px',
          border:`1.5px solid ${C.border}`,
        }}>
          <IcoSearch/>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'patients' ? 'Search patients...' : 'Search history...'}
            style={{
              border:'none', background:'transparent', outline:'none',
              fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:14,
              color:C.text, flex:1,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                       color:C.textMuted, fontSize:18, lineHeight:1, fontWeight:300 }}>×</button>
          )}
        </div>
      </div>

      {/* ════ LIST ══════════════════════════════════════════ */}
      <div style={{ padding:'12px 16px 110px' }}>
        <p style={{
          fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:13,
          color:C.textMuted, margin:'6px 0 12px',
          textTransform:'uppercase', letterSpacing:'0.8px',
        }}>
          {tab === 'patients'
            ? `${listToShow.length} patient${listToShow.length !== 1 ? 's' : ''}`
            : `${listToShow.length} record${listToShow.length !== 1 ? 's' : ''}`}
        </p>

        {listToShow.length === 0 ? (
          <div style={{ textAlign:'center', padding:'52px 24px', color:C.textMuted }}>
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" style={{ marginBottom:14 }}>
              <circle cx="30" cy="30" r="30" fill="#EFF6FF"/>
              <path d="M30 14C23 14 18 19 18 24c0 5 2 8 4 13 2 5 3 9 5 9s2-4 3-4 2 4 3 4c2 0 3-4 5-9 2-5 4-8 4-13 0-5-5-10-12-10z"
                    fill={C.secondary} opacity="0.6"/>
            </svg>
            <p style={{ fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:15, color:C.text, margin:'0 0 6px' }}>
              {search ? 'No matches found' : tab === 'patients' ? 'No patients yet' : 'No history yet'}
            </p>
            <p style={{ fontFamily:'Inter, sans-serif', fontSize:13, color:C.textMuted, margin:0 }}>
              {search ? 'Try a different name' : 'Tap + to start a new measurement'}
            </p>
          </div>
        ) : listToShow.map((record, i) => (
          <PatientCard
            key={record.id ?? i}
            record={record}
            showDate={tab === 'history'}
            onClick={() => navigate('view-report', { record })}
          />
        ))}
      </div>

      {/* ════ FAB — bottom RIGHT ════════════════════════════ */}
      <Fab onPress={() => navigate('patient')}/>

    </div>
  );
}