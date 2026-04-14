export default function ViewReport({ navigate, record }) {
  if (!record) return null
  const { patient, measurements, restImage, occImage, date } = record
  const ok = measurements?.freewaySpace >= 2 && measurements?.freewaySpace <= 4

  return (
    <div className="screen">
      <div style={{ background:'linear-gradient(135deg,#0D9488,#0F766E)', padding:'48px 20px 24px' }}>
        <button onClick={() => navigate('home')} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', marginBottom:14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>Patient Report</div>
        <div style={{ fontSize:22, fontWeight:800, color:'#fff', marginTop:3 }}>{patient?.name}</div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginTop:4 }}>{new Date(date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</div>
      </div>

      <div className="scroll-body">
        {/* Images */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[{label:'REST', img:restImage, val:measurements?.vdr, key:'VDR'}, {label:'OCCLUSION', img:occImage, val:measurements?.vdo, key:'VDO'}].map(p => (
            <div key={p.label} className="card" style={{ overflow:'hidden' }}>
              <div style={{ height:100, background:'#000', position:'relative' }}>
                {p.img ? <img src={p.img} alt={p.label} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <div style={{ width:'100%', height:'100%', background:'#eee', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#aaa' }}>No image</div>}
                <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.5)', padding:'3px 8px' }}>
                  <div style={{ fontSize:8, color:'#fff', fontWeight:700 }}>{p.label}</div>
                </div>
              </div>
              <div style={{ padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase' }}>{p.key}</div>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>{p.val}<span style={{ fontSize:10, color:'var(--text3)', marginLeft:2 }}>mm</span></div>
              </div>
            </div>
          ))}
        </div>

        {/* Measurements */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>Measurement Summary</div>
          {[['VDR (Rest)', `${measurements?.vdr} mm`], ['VDO (Occlusion)', `${measurements?.vdo} mm`]].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:700 }}>{v}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0' }}>
            <span style={{ fontSize:12, color:'var(--text3)' }}>Freeway Space</span>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:700 }}>{measurements?.freewaySpace} mm</span>
              <span className={ok ? 'badge badge-success' : 'badge badge-warning'}>{ok ? 'Normal' : 'Review'}</span>
            </div>
          </div>
        </div>

        {/* Grade */}
        <div style={{ background: ok ? 'var(--teal-light)' : '#FEF3C7', borderRadius:'var(--radius)', padding:'14px 16px', display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ fontSize:24, flexShrink:0 }}>{ok ? '✅' : '⚠️'}</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color: ok ? 'var(--teal-dark)' : '#92400E' }}>Clinical Grade: {ok ? 'ACCURATE' : 'REVIEW'}</div>
            <div style={{ fontSize:11, color: ok ? 'var(--teal)' : '#B45309', marginTop:2 }}>
              {ok ? 'Freeway space within normal range (2–4mm).' : `Freeway space ${measurements?.freewaySpace < 2 ? 'below' : 'above'} normal. Clinical review recommended.`}
            </div>
          </div>
        </div>

        {/* Patient info */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>Patient Details</div>
          {[['Name', patient?.name], ['Age', patient?.age], ['Gender', patient?.gender], ['Notes', patient?.notes || '—']].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{l}</span>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--text)', maxWidth:'60%', textAlign:'right' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}