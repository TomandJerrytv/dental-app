import { useState } from 'react'

function Gauge({ value }) {
  const clamp = v => Math.min(Math.max(v,0),8)
  const pct   = clamp(value)/8
  const angle = -150 + pct*300
  const rad   = deg => deg*Math.PI/180
  const arc   = (cx,cy,r,s,e) => {
    const x1=cx+r*Math.cos(rad(s)),y1=cy+r*Math.sin(rad(s))
    const x2=cx+r*Math.cos(rad(e)),y2=cy+r*Math.sin(rad(e))
    return `M${x1} ${y1} A${r} ${r} 0 ${e-s>180?1:0} 1 ${x2} ${y2}`
  }
  const ok = value>=2&&value<=4
  const nx = 100+72*0.75*Math.cos(rad(angle))
  const ny = 100+72*0.75*Math.sin(rad(angle))
  return (
    <svg viewBox="0 0 200 130" style={{ width:'100%', maxWidth:220 }}>
      <path d={arc(100,100,72,-150,150)} fill="none" stroke="#E2E8F0" strokeWidth="14" strokeLinecap="round"/>
      <path d={arc(100,100,72,-150+(2/8)*300,-150+(4/8)*300)} fill="none" stroke="#CCFBF1" strokeWidth="14" strokeLinecap="round"/>
      <path d={arc(100,100,72,-150,angle)} fill="none" stroke={ok?'#0D9488':'#F59E0B'} strokeWidth="14" strokeLinecap="round"/>
      <line x1="100" y1="100" x2={nx} y2={ny} stroke={ok?'#0D9488':'#F59E0B'} strokeWidth="3" strokeLinecap="round"/>
      <circle cx="100" cy="100" r="6" fill={ok?'#0D9488':'#F59E0B'}/>
      <text x="28"  y="120" fontSize="9" fill="#94A3B8" textAnchor="middle">0mm</text>
      <text x="172" y="120" fontSize="9" fill="#94A3B8" textAnchor="middle">8mm</text>
      <text x="100" y="82"  fontSize="8" fill="#94A3B8" textAnchor="middle">2–4mm normal</text>
    </svg>
  )
}

export default function Results({ navigate, measurements, patient, onSave }) {
  const [tab, setTab] = useState('rest')
  if (!measurements) return (
    <div className="screen" style={{ alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>
        <div style={{ fontSize:48 }}>📊</div>
        <div style={{ marginTop:12, fontWeight:700 }}>No measurements yet</div>
        <button className="btn btn-primary" style={{ marginTop:20, maxWidth:200 }} onClick={()=>navigate('home')}>Go Home</button>
      </div>
    </div>
  )

  const { vdr, vdo, freewaySpace, restImage, occImage } = measurements
  const ok = freewaySpace>=2&&freewaySpace<=4

  return (
    <div className="screen">
      <div style={{ background:'var(--surface)', padding:'44px 20px 16px', borderBottom:'1px solid var(--border)' }}>
        <button onClick={()=>navigate('home')} style={{ background:'var(--bg)', border:'none', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginBottom:10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize:22, fontWeight:800, color:'var(--text)' }}>RESULTS</div>
        <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{patient?.name} · {new Date().toLocaleDateString()}</div>
      </div>

      {/* Tab switcher */}
      <div style={{ padding:'12px 16px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ background:'var(--bg)', borderRadius:10, padding:4, display:'flex', gap:4 }}>
          {[['rest','REST'],['occ','OCCLUSION']].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{
              flex:1, padding:'10px', border:'none', borderRadius:8, cursor:'pointer',
              fontFamily:'var(--font)', fontSize:12, fontWeight:700,
              background: tab===key ? 'var(--teal)' : 'transparent',
              color: tab===key ? '#fff' : 'var(--text3)',
              transition:'all 0.2s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div className="scroll-body">
        {/* Images */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[{label:'REST',img:restImage,val:vdr,key:'vdr'},{label:'OCCLUSION',img:occImage,val:vdo,key:'vdo'}].map(p=>(
            <div key={p.key} className="card" style={{ overflow:'hidden', opacity:tab==='rest'&&p.key==='vdo'?0.5:tab==='occ'&&p.key==='vdr'?0.5:1, transition:'opacity 0.3s' }}>
              <div style={{ height:100, background:'#000', overflow:'hidden', position:'relative' }}>
                {p.img ? <img src={p.img} alt={p.label} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <div style={{ width:'100%', height:'100%', background:'#eee', display:'flex', alignItems:'center', justifyContent:'center', color:'#aaa', fontSize:10 }}>No image</div>}
                <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.5)', padding:'3px 8px' }}>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.8)', fontWeight:700, textTransform:'uppercase' }}>CAPTURED {p.label}</div>
                </div>
              </div>
              <div style={{ padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.4 }}>{p.key.toUpperCase()}</div>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--text)', lineHeight:1 }}>{p.val}<span style={{ fontSize:10, color:'var(--text3)', marginLeft:2 }}>mm</span></div>
              </div>
            </div>
          ))}
        </div>

        {/* Gauge */}
        <div className="card" style={{ padding:16, textAlign:'center' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Freeway Space</div>
          <div style={{ display:'flex', justifyContent:'center' }}><Gauge value={freewaySpace}/></div>
          <div style={{ fontSize:32, fontWeight:900, color:ok?'var(--success)':'var(--warning)', lineHeight:1, marginTop:-8 }}>{freewaySpace}mm</div>
          <div style={{ marginTop:8 }}>
            <span className={ok?'badge badge-success':'badge badge-warning'} style={{ fontSize:12, padding:'5px 14px' }}>
              FREEWAY SPACE: {freewaySpace}mm
            </span>
          </div>
        </div>

        {/* Grade */}
        <div style={{ background:ok?'var(--teal-light)':'#FEF3C7', borderRadius:'var(--radius)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:ok?'var(--teal)':'var(--warning)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
            {ok?'✅':'⚠️'}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:ok?'var(--teal-dark)':'#92400E' }}>
              Clinical Grade: {ok?'ACCURATE':'REVIEW'}
            </div>
            <div style={{ fontSize:11, color:ok?'var(--teal)':'#B45309', marginTop:2, lineHeight:1.5 }}>
              {ok ? 'Freeway space within normal clinical range (2–4mm).' : `Freeway space ${freewaySpace<2?'below':'above'} normal range. Clinical review recommended.`}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:16, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
        <button className="btn btn-primary" onClick={()=>navigate('pdf')} style={{ borderRadius:14 }}>GENERATE PDF REPORT</button>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <button className="btn btn-ghost" onClick={onSave} style={{ borderRadius:12, fontSize:12 }}>SAVE TO HISTORY</button>
          <button className="btn btn-outline" onClick={()=>navigate('camera-rest')} style={{ borderRadius:12, fontSize:12 }}>NEW SCAN</button>
        </div>
      </div>
    </div>
  )
}