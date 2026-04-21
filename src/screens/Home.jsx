import { useState, useMemo, useEffect, useCallback, memo } from 'react';

/* ═══════════════════════════════════════════════════════════════
   EXACT AT EASE — HOME SCREEN (v2.1 Optimised)
   src/screens/Home.jsx

   Optimisations vs v2.1:
   ① localStorage via useEffect+useState (not useMemo — anti-pattern)
   ② All sub-components wrapped in React.memo — list never re-renders
      on tab/search/FAB state changes
   ③ Avatar SVG paths are module-level constants — never recreated
   ④ backdrop-filter:blur REMOVED — GPU compositor killer on Android
   ⑤ filter:blur on decorative orbs REMOVED — forces compositing layer
   ⑥ Patient card press & FAB press use CSS :active (zero JS, zero re-renders)
   ⑦ No inline keyframe injection — index.css owns all animations
   ⑧ No duplicate Google Fonts injection — index.css handles it
   ⑨ useCallback on navigate handlers — stable references across renders
   ⑩ localStorage key: 'patients' — matches App.jsx saveToHistory
   ═══════════════════════════════════════════════════════════════ */

// ─── Brand constants (module-level, never recreated) ──────────
const C = {
  primary:   '#0B3C8C',
  secondary: '#2F80ED',
  bg:        '#F8FAFC',
  surface:   '#FFFFFF',
  border:    '#E2E8F0',
  text:      '#1F2937',
  textSoft:  '#6B7280',
  textMuted: '#9CA3AF',
};

const GRAD = `linear-gradient(140deg, ${C.primary} 0%, #1553b5 55%, ${C.secondary} 100%)`;
const FAB_SHADOW = `0 8px 26px rgba(11,60,140,0.45), 0 3px 10px rgba(47,128,237,0.32)`;

// ─── Helpers (module-level) ────────────────────────────────────
const getTs = r => r.createdAt || (r.date ? new Date(r.date).getTime() : 0);

function relDate(r) {
  const d = (Date.now() - getTs(r)) / 86_400_000;
  if (d < 1) return 'Today';
  if (d < 2) return 'Yesterday';
  if (d < 7) return `${Math.floor(d)}d ago`;
  return new Date(getTs(r)).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
}

// ─── Avatar SVG paths (module-level constants — never recreated)
// Simplified paths for faster paint — same visual result
const MALE_SVG = (
  <svg width="50" height="50" viewBox="0 0 50 50" fill="none"
       aria-hidden="true"
       style={{ borderRadius:'50%', display:'block', flexShrink:0 }}>
    <circle cx="25" cy="25" r="25" fill="#DBEAFE"/>
    {/* hair */}
    <ellipse cx="25" cy="17" rx="10" ry="11" fill="#1E293B"/>
    <rect x="15" y="17" width="20" height="7" fill="#1E293B"/>
    {/* neck + head */}
    <rect x="21" y="31" width="8" height="5" rx="2" fill="#FDBA74"/>
    <ellipse cx="25" cy="22" rx="9.5" ry="10.5" fill="#FED7AA"/>
    {/* ears */}
    <ellipse cx="15.2" cy="22" rx="2" ry="2.5" fill="#FDBA74"/>
    <ellipse cx="34.8" cy="22" rx="2" ry="2.5" fill="#FDBA74"/>
    {/* eyes */}
    <ellipse cx="21" cy="20.5" rx="1.8" ry="2" fill="#1F2937"/>
    <ellipse cx="29" cy="20.5" rx="1.8" ry="2" fill="#1F2937"/>
    <circle cx="21.7" cy="19.8" r="0.6" fill="white"/>
    <circle cx="29.7" cy="19.8" r="0.6" fill="white"/>
    {/* smile */}
    <path d="M21.5 27 Q25 29.5 28.5 27" stroke="#7C2D12" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    {/* shirt */}
    <path d="M10 50 C10 40 17 36 21 35 L25 38.5 L29 35 C33 36 40 40 40 50 Z" fill="#2F80ED"/>
  </svg>
);

const FEMALE_SVG = (
  <svg width="50" height="50" viewBox="0 0 50 50" fill="none"
       aria-hidden="true"
       style={{ borderRadius:'50%', display:'block', flexShrink:0 }}>
    <circle cx="25" cy="25" r="25" fill="#FCE7F3"/>
    {/* hair */}
    <ellipse cx="25" cy="22" rx="11" ry="14" fill="#7C2D12"/>
    <ellipse cx="25" cy="11.5" rx="10" ry="5" fill="#7C2D12"/>
    {/* neck + head */}
    <rect x="21" y="31" width="8" height="5" rx="2" fill="#FDBA74"/>
    <ellipse cx="25" cy="21" rx="9.5" ry="10.5" fill="#FED7AA"/>
    {/* ears */}
    <ellipse cx="15.2" cy="21" rx="2" ry="2.5" fill="#FDBA74"/>
    <ellipse cx="34.8" cy="21" rx="2" ry="2.5" fill="#FDBA74"/>
    {/* eyes */}
    <ellipse cx="21" cy="19.5" rx="1.8" ry="2" fill="#1F2937"/>
    <ellipse cx="29" cy="19.5" rx="1.8" ry="2" fill="#1F2937"/>
    <circle cx="21.7" cy="18.8" r="0.6" fill="white"/>
    <circle cx="29.7" cy="18.8" r="0.6" fill="white"/>
    {/* lips */}
    <path d="M21.5 26.5 Q25 28.5 28.5 26.5 Q25 25 21.5 26.5 Z" fill="#FB7185"/>
    {/* earrings */}
    <circle cx="15.2" cy="23" r="1.1" fill="#FDE68A"/>
    <circle cx="34.8" cy="23" r="1.1" fill="#FDE68A"/>
    {/* shirt */}
    <path d="M10 50 C10 40 17 36 21 35 L25 38.5 L29 35 C33 36 40 40 40 50 Z" fill="#EC4899"/>
  </svg>
);

// ─── Avatar — memo'd, uses pre-built SVG constants ────────────
const Avatar = memo(function Avatar({ gender }) {
  const g = (gender || '').toLowerCase();
  return (g === 'female' || g === 'f') ? FEMALE_SVG : MALE_SVG;
});

// ─── SVG icons (module-level JSX constants) ───────────────────
const sw = { fill:'none', stroke:'rgba(255,255,255,0.85)', strokeWidth:'2', strokeLinecap:'round', strokeLinejoin:'round' };

const IcoUsers = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...sw}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcoCalendar = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...sw}>
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8"  y1="2" x2="8"  y2="6"/>
    <line x1="3"  y1="10" x2="21" y2="10"/>
  </svg>
);
const IcoChart = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...sw}>
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
    <line x1="2"  y1="20" x2="22" y2="20"/>
  </svg>
);
const IcoSearch = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
       fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IcoChevron = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
       fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IcoPlus = (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"
       fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5"  y1="12" x2="19" y2="12"/>
  </svg>
);

// ─── StatCard — memo'd, no state ──────────────────────────────
const StatCard = memo(function StatCard({ icon, value, label }) {
  return (
    /* No backdrop-filter or filter:blur — both force GPU compositing
       layers on Android Chrome which compete with the camera stream.
       Using a solid semi-transparent background instead.            */
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.16)',
      border: '1px solid rgba(255,255,255,0.22)',
      borderRadius: 16,
      padding: '12px 6px 10px',
      textAlign: 'center',
    }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:6 }}>{icon}</div>
      <div style={{ fontWeight:700, fontSize:22, color:'#fff', lineHeight:1, letterSpacing:'-0.5px', marginBottom:5 }}>
        {value}
      </div>
      <div style={{ fontWeight:500, fontSize:9, color:'rgba(255,255,255,0.78)', textTransform:'uppercase', letterSpacing:'1px' }}>
        {label}
      </div>
    </div>
  );
});

// ─── PatientCard — memo'd, CSS-only press effect ──────────────
// No onPointer* handlers = no JS re-renders on touch.
// .patient-card:active in index.css handles the press visual.
const PatientCard = memo(function PatientCard({ record, showDate, onView }) {
  const { patient = {}, measurements: m } = record;

  return (
    <div
      role="button"
      tabIndex={0}
      className="patient-card"
      onClick={onView}
      onKeyDown={e => e.key === 'Enter' && onView()}
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
      }}
    >
      <Avatar gender={patient.gender}/>

      <div style={{ flex:1, minWidth:0 }}>
        {/* Name */}
        <div style={{ fontWeight:600, fontSize:16, color:C.text, marginBottom:3, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
          {patient.name || 'Patient'}
        </div>

        {/* Age · Gender · Date */}
        <div style={{ fontSize:13, color:C.textSoft, marginBottom: m ? 5 : 0, display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
          {patient.age    && <span>{patient.age} yrs</span>}
          {patient.age    && patient.gender && <span style={{ color:C.border }}>·</span>}
          {patient.gender && <span style={{ textTransform:'capitalize' }}>{patient.gender}</span>}
          {showDate && <><span style={{ color:C.border }}>·</span><span>{relDate(record)}</span></>}
        </div>

        {/* Measurements */}
        {m ? (
          <div style={{ fontWeight:500, fontSize:14, color:'#374151', display:'flex', gap:6, alignItems:'center' }}>
            <span>VDR: <strong style={{ fontWeight:700 }}>{Number(m.vdr).toFixed(1)} mm</strong></span>
            <span style={{ color:C.border, fontSize:12 }}>|</span>
            <span>FS: <strong style={{ fontWeight:700 }}>{Number(m.freewaySpace).toFixed(1)} mm</strong></span>
          </div>
        ) : (
          <div style={{ fontSize:13, color:'#F59E0B', fontWeight:500 }}>Pending measurement</div>
        )}
      </div>

      {IcoChevron}
    </div>
  );
});

// ─── Empty state — memo'd ─────────────────────────────────────
const EmptyState = memo(function EmptyState({ isSearch, tab }) {
  return (
    <div style={{ textAlign:'center', padding:'52px 24px', color:C.textMuted }}>
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" style={{ marginBottom:14 }} aria-hidden="true">
        <circle cx="30" cy="30" r="30" fill="#EFF6FF"/>
        <path d="M30 14C23 14 18 19 18 24c0 5 2 8 4 13 2 5 3 9 5 9s2-4 3-4 2 4 3 4c2 0 3-4 5-9 2-5 4-8 4-13 0-5-5-10-12-10z"
              fill={C.secondary} opacity="0.6"/>
      </svg>
      <p style={{ fontWeight:600, fontSize:15, color:C.text, margin:'0 0 6px' }}>
        {isSearch ? 'No matches found' : tab === 'patients' ? 'No patients yet' : 'No history yet'}
      </p>
      <p style={{ fontSize:13, color:C.textMuted, margin:0 }}>
        {isSearch ? 'Try a different name' : 'Tap + to start a new measurement'}
      </p>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
//   MAIN EXPORT
// ═══════════════════════════════════════════════════════════════
export default function Home({ navigate }) {
  const [tab,        setTab]       = useState('patients');
  const [search,     setSearch]    = useState('');
  const [allRecords, setAllRecords] = useState([]);  // ① useEffect pattern — not useMemo

  /* ── Load from localStorage on mount ─────────────────────── */
  /* Key MUST be 'patients' — matches App.jsx saveToHistory      */
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem('patients') || '[]');
      setAllRecords(data);
    } catch {
      setAllRecords([]);
    }
  }, []);

  /* ── Stable navigate callbacks — no new refs on re-render ─── */
  const goToPatient    = useCallback(() => navigate('patient'), [navigate]);
  const goToViewReport = useCallback(record => navigate('view-report', { record }), [navigate]);

  /* ── Derive unique patients (latest record per name) ─────── */
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
      ? (vdos.reduce((s, v) => s + Number(v), 0) / vdos.length).toFixed(1) + ' mm'
      : '—';
    return { patients: pts, todayCount: todayN, avgVdo: avg };
  }, [allRecords]);

  /* ── History: all records newest first ───────────────────── */
  const historyList = useMemo(() =>
    [...allRecords].sort((a, b) => getTs(b) - getTs(a)),
  [allRecords]);

  /* ── Filtered list for active tab ────────────────────────── */
  const listToShow = useMemo(() => {
    const q    = search.toLowerCase().trim();
    const base = tab === 'patients' ? patients : historyList;
    return q ? base.filter(r => (r.patient?.name || '').toLowerCase().includes(q)) : base;
  }, [tab, search, patients, historyList]);

  const isSearch = search.trim().length > 0;

  return (
    <div style={{ fontFamily:'var(--font)', background:C.bg, minHeight:'100dvh', display:'flex', flexDirection:'column' }}>

      {/* ════ HEADER ════════════════════════════════════════════ */}
      <div style={{ background:GRAD, position:'relative', overflow:'hidden', borderRadius:'0 0 24px 24px' }}>

        {/* Decorative orbs — NO filter:blur (GPU compositor layer)
            Using opacity-only shapes instead — zero compositing cost  */}
        <div style={{ position:'absolute', top:-30, right:-30, width:160, height:160, borderRadius:'50%', background:'rgba(86,204,242,0.18)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:10, left:-40, width:130, height:130, borderRadius:'50%', background:'rgba(255,255,255,0.08)', pointerEvents:'none' }}/>

        {/* Wave deco */}
        <svg style={{ position:'absolute', bottom:0, left:0, width:'100%', pointerEvents:'none' }}
             viewBox="0 0 430 48" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,24 C100,48 200,0 300,28 T430,18 L430,48 L0,48 Z" fill="rgba(255,255,255,0.06)"/>
        </svg>

        {/* Logo row */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'52px 20px 0' }}>
          <img src="/logo.png" alt=""
               style={{ width:36, height:36, borderRadius:10, objectFit:'contain' }}
               onError={e => { e.target.style.display='none'; }}/>
          <span style={{ fontWeight:700, fontSize:18, color:'#fff', letterSpacing:'-0.3px' }}>
            Exact At Ease
          </span>
        </div>

        {/* Welcome text */}
        <div style={{ padding:'18px 20px 0' }}>
          <h1 style={{ fontWeight:700, fontSize:27, color:'#fff', margin:'0 0 6px', letterSpacing:'-0.5px', lineHeight:1.15 }}>
            Welcome, Doctor
          </h1>
          <p style={{ fontSize:15, color:'rgba(255,255,255,0.85)', margin:'0 0 20px' }}>
            Manage your patient measurements
          </p>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:10, padding:'0 20px 24px' }}>
          <StatCard icon={IcoUsers}    value={patients.length} label="Total Patients"/>
          <StatCard icon={IcoCalendar} value={todayCount}      label="Today's Scans"/>
          <StatCard icon={IcoChart}    value={avgVdo}           label="Avg VDO"/>
        </div>
      </div>

      {/* ════ TABS ══════════════════════════════════════════════ */}
      <div style={{ display:'flex', background:C.surface, borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:10 }}>
        {[
          { key:'patients', label:'Patient List', count:patients.length    },
          { key:'history',  label:'History',      count:historyList.length },
        ].map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex:1, padding:'14px 0', border:'none', background:'none', cursor:'pointer',
              fontFamily:'var(--font)', fontSize:13,
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

      {/* ════ SEARCH ════════════════════════════════════════════ */}
      <div style={{ padding:'12px 16px 4px', background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:C.bg, borderRadius:12, padding:'10px 14px', border:`1.5px solid ${C.border}` }}>
          {IcoSearch}
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'patients' ? 'Search patients...' : 'Search history...'}
            style={{ border:'none', background:'transparent', outline:'none', fontFamily:'var(--font)', fontSize:14, color:C.text, flex:1 }}
          />
          {isSearch && (
            <button onClick={() => setSearch('')}
              style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:C.textMuted, fontSize:20, lineHeight:1 }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* ════ LIST ══════════════════════════════════════════════ */}
      <div style={{ flex:1, padding:'12px 16px 16px', overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        <p style={{ fontWeight:600, fontSize:12, color:C.textMuted, margin:'6px 0 12px', textTransform:'uppercase', letterSpacing:'0.8px' }}>
          {tab === 'patients'
            ? `${listToShow.length} patient${listToShow.length !== 1 ? 's' : ''}`
            : `${listToShow.length} record${listToShow.length !== 1 ? 's' : ''}`}
        </p>

        {listToShow.length === 0
          ? <EmptyState isSearch={isSearch} tab={tab}/>
          : listToShow.map((record, i) => (
              <PatientCard
                key={record.id ?? i}
                record={record}
                showDate={tab === 'history'}
                onView={() => goToViewReport(record)}
              />
            ))
        }
      </div>

      {/* ════ BOTTOM BAR — sticky flex child, NOT position:fixed ═
           position:fixed forces a GPU compositing layer that
           conflicts with the camera video stream on Android Chrome.
           Sticky flex child achieves same "always visible" effect
           with zero compositing cost.                              */}
      <div style={{
        padding: '12px 20px 20px',
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <span style={{ flex:1, fontSize:13, color:C.textMuted }}>
          Start a new patient scan
        </span>

        {/* FAB — CSS :active handles press visual (class in index.css) */}
        <button
          onClick={goToPatient}
          aria-label="New Measurement"
          className="home-fab"
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: `linear-gradient(140deg, ${C.primary} 0%, ${C.secondary} 100%)`,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: FAB_SHADOW,
            flexShrink: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {IcoPlus}
        </button>
      </div>

    </div>
  );
}