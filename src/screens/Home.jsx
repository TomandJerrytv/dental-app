import { useState, useEffect } from 'react'

const COLORS = [
  { bg:'#CCFBF1', color:'#0F766E' },
  { bg:'#FCE4EC', color:'#C2185B' },
  { bg:'#E0E7FF', color:'#3730A3' },
  { bg:'#FEF9C3', color:'#854D0E' },
  { bg:'#F3E8FF', color:'#7E22CE' },
]

function initials(name) {
  return (name||'P').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
}

function fsStatus(fs) {
  if (fs >= 2 && fs <= 4) return { label:'Normal',   cls:'badge-success' }
  if (fs < 2)             return { label:'Low FS',   cls:'badge-warning' }
  return                         { label:'High FS',  cls:'badge-warning' }
}

export default function Home({ navigate }) {
  const [history,    setHistory]    = useState([])
  const [search,     setSearch]     = useState('')
  const [tab,        setTab]        = useState('history')
  const [todayCount, setTodayCount] = useState(0)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('patients') || '[]')
    setHistory(saved)
    const today = new Date().toDateString()
    setTodayCount(saved.filter(r => new Date(r.date).toDateString() === today).length)
  }, [])

  const filtered = history.filter(r =>
    (r.patient?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="screen">

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#0D9488 0%,#0F766E 100%)', padding:'48px 20px 24px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }}/>
        <div style={{ position:'absolute', bottom:-30, left:-20, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative' }}>
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>VDO Dental Guide</div>
            <div style={{ fontSize:28, fontWeight:800, color:'#fff', letterSpacing:-0.5 }}>Welcome</div>
          </div>
          <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2C9 2 7 4 7 7c0 2 1.5 4 3 4.5V18a2 2 0 004 0v-6.5c1.5-.5 3-2.5 3-4.5 0-3-2-5-5-5z"/>
            </svg>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:18, position:'relative' }}>
          {[
            { n: history.length, l:'Total Patients' },
            { n: todayCount,     l:"Today's Scans"  },
            { n: history.length > 0 ? '98%' : '--', l:'Accuracy' },
          ].map((s,i) => (
            <div key={i} style={{ flex:1, background:'rgba(255,255,255,0.15)', borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:800, color:'#fff' }}>{s.n}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.75)', textTransform:'uppercase', letterSpacing:0.3, marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', display:'flex' }}>
        {[['list','Patient List'],['history','History']].map(([key,label]) => (
          <button key={key} onClick={()=>setTab(key)} style={{
            flex:1, padding:'13px 0', border:'none', background:'transparent',
            fontFamily:'var(--font)', fontSize:13, fontWeight:700, cursor:'pointer',
            color: tab===key ? 'var(--teal)' : 'var(--text3)',
            borderBottom: tab===key ? '2.5px solid var(--teal)' : '2.5px solid transparent',
            transition:'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding:'12px 16px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg)', borderRadius:10, padding:'10px 14px', border:'1.5px solid var(--border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search patients..."
            style={{ border:'none', background:'transparent', outline:'none', fontFamily:'var(--font)', fontSize:14, color:'var(--text)', flex:1 }}
          />
        </div>
      </div>

      {/* List */}
      <div className="scroll-body">
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 20px', color:'var(--text3)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🦷</div>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--text2)', marginBottom:6 }}>No records yet</div>
            <div style={{ fontSize:13 }}>Tap the button below to start</div>
          </div>
        ) : filtered.map((r,i) => {
          const col    = COLORS[i % COLORS.length]
          const status = r.measurements ? fsStatus(r.measurements.freewaySpace) : null
          return (
            <div key={r.id} className="card fade-up" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:col.bg, color:col.color, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 }}>
                {initials(r.patient?.name)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:2 }}>{r.patient?.name || 'Patient'}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>
                  {formatDate(r.date)}
                  {r.measurements && ` · VDR ${r.measurements.vdr}mm · FS ${r.measurements.freewaySpace}mm`}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                {status && <span className={`badge ${status.cls}`}>{status.label}</span>}
                <button
                  onClick={() => navigate('view-report', { record: r })}
                  style={{ background:'var(--teal-light)', color:'var(--teal-dark)', border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer' }}
                >
                  View Report
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom button */}
      <div style={{ padding:'16px', background:'var(--surface)', borderTop:'1px solid var(--border)' }}>
        <button className="btn btn-primary" onClick={()=>navigate('patient')} style={{ borderRadius:14, fontSize:13, letterSpacing:0.8 }}>
          + NEW MEASUREMENT
        </button>
      </div>
    </div>
  )
}