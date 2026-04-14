import { useState } from 'react'
import jsPDF from 'jspdf'

export default function PdfReport({ navigate, measurements, patient, onSave }) {
  const [generating, setGenerating] = useState(false)
  const { vdr, vdo, freewaySpace, restImage, occImage } = measurements || {}
  const ok      = freewaySpace>=2&&freewaySpace<=4
  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
  const timeStr = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})

  const handlePDF = async () => {
    setGenerating(true)
    try {
      const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
      const W=210, m=14

      // Header
      pdf.setFillColor(13,148,136); pdf.rect(0,0,W,32,'F')
      pdf.setFillColor(233,30,140); pdf.rect(0,32,W,3,'F')
      pdf.setFont('helvetica','bold'); pdf.setFontSize(20); pdf.setTextColor(255,255,255)
      pdf.text('DentoMeasure',m,14)
      pdf.setFontSize(9); pdf.setFont('helvetica','normal')
      pdf.text('VDO Assessment Report · Clinical Edition',m,22)
      pdf.text(`${dateStr} ${timeStr}`,W-m,22,{align:'right'})

      let y=44

      // Patient box
      pdf.setFillColor(240,255,253); pdf.roundedRect(m,y,W-m*2,36,4,4,'F')
      pdf.setDrawColor(13,148,136); pdf.setLineWidth(0.5); pdf.roundedRect(m,y,W-m*2,36,4,4,'S')
      pdf.setFont('helvetica','bold'); pdf.setFontSize(8); pdf.setTextColor(15,118,110)
      pdf.text('PATIENT INFORMATION',m+6,y+8)
      pdf.setFontSize(12); pdf.setTextColor(15,23,42)
      pdf.text(patient?.name||'Unknown',m+6,y+18)
      pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.setTextColor(71,85,105)
      pdf.text(`Age: ${patient?.age||'--'} · Gender: ${patient?.gender||'--'}`,m+6,y+27)
      pdf.text(`Date: ${dateStr} · Time: ${timeStr}`,W-m-6,y+27,{align:'right'})
      y+=44

      // Images
      pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.setTextColor(71,85,105)
      pdf.text('CAPTURED IMAGES',m,y+5); y+=10
      const iW=(W-m*2-6)/2, iH=48
      if(restImage){ try{ pdf.addImage(restImage,'JPEG',m,y,iW,iH); pdf.setFontSize(7); pdf.setTextColor(255,255,255); pdf.text('REST',m+2,y+iH-2) }catch(e){} }
      else { pdf.setFillColor(240,240,240); pdf.rect(m,y,iW,iH,'F'); pdf.setTextColor(150,150,150); pdf.setFontSize(8); pdf.text('REST',m+iW/2,y+iH/2,{align:'center'}) }
      const x2=m+iW+6
      if(occImage){ try{ pdf.addImage(occImage,'JPEG',x2,y,iW,iH); pdf.setFontSize(7); pdf.setTextColor(255,255,255); pdf.text('OCCLUSION',x2+2,y+iH-2) }catch(e){} }
      else { pdf.setFillColor(240,240,240); pdf.rect(x2,y,iW,iH,'F'); pdf.setTextColor(150,150,150); pdf.setFontSize(8); pdf.text('OCCLUSION',x2+iW/2,y+iH/2,{align:'center'}) }
      y+=iH+10

      // Measurements table
      pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.setTextColor(71,85,105)
      pdf.text('MEASUREMENT SUMMARY',m,y+5); y+=10
      const rows=[
        { label:'VDR (Vertical Dimension at Rest)',      val:`${vdr} mm`,         status:null },
        { label:'VDO (Vertical Dimension at Occlusion)', val:`${vdo} mm`,         status:null },
        { label:'Freeway Space (VDR − VDO)',             val:`${freewaySpace} mm`,status:ok?'NORMAL':'REVIEW' },
      ]
      rows.forEach((row,i) => {
        pdf.setFillColor(...(i%2===0?[248,255,254]:[255,255,255]))
        pdf.rect(m,y,W-m*2,12,'F')
        pdf.setDrawColor(226,232,240); pdf.setLineWidth(0.3); pdf.line(m,y+12,W-m,y+12)
        pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(71,85,105)
        pdf.text(row.label,m+4,y+8)
        pdf.setFont('helvetica','bold'); pdf.setTextColor(15,23,42)
        pdf.text(row.val,W-m-(row.status?30:6),y+8,{align:'right'})
        if(row.status){
          const c=ok?[16,185,129]:[245,158,11]
          pdf.setFillColor(...c); pdf.roundedRect(W-m-26,y+2,22,8,3,3,'F')
          pdf.setFontSize(6); pdf.setTextColor(255,255,255)
          pdf.text(row.status,W-m-15,y+7.5,{align:'center'})
        }
        y+=12
      })
      y+=10

      // Grade
      const gc=ok?[13,148,136]:[245,158,11]
      pdf.setFillColor(...gc); pdf.roundedRect(m,y,50,18,4,4,'F')
      pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(255,255,255)
      pdf.text('CLINICAL GRADE:',m+5,y+7); pdf.setFontSize(9)
      pdf.text(ok?'ACCURATE':'REVIEW',m+5,y+14)
      pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.5)
      pdf.line(W-m-50,y+18,W-m,y+18)
      pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.setTextColor(150,150,150)
      pdf.text('Doctor Signature',W-m-50,y+24)
      y+=32

      if(patient?.notes){
        pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.setTextColor(71,85,105)
        pdf.text('CLINICAL NOTES',m,y); y+=6
        pdf.setFont('helvetica','normal'); pdf.setTextColor(15,23,42)
        pdf.text(patient.notes,m,y,{maxWidth:W-m*2})
      }

      // Footer
      pdf.setFillColor(13,148,136); pdf.rect(0,282,W,15,'F')
      pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(255,255,255)
      pdf.text('DentoMeasure · Clinical Edition',m,291)
      pdf.setFont('helvetica','normal')
      pdf.text('For clinical reference only · Not a diagnostic tool',W-m,291,{align:'right'})

      const name=`DentoMeasure_${(patient?.name||'Patient').replace(/\s+/g,'_')}_${now.toISOString().slice(0,10)}.pdf`
      pdf.save(name)
    } catch(e) {
      alert('PDF generation failed. Try again.')
      console.error(e)
    }
    setGenerating(false)
  }

  return (
    <div className="screen">
      <div style={{ background:'linear-gradient(135deg,#0D9488,#0F766E)', padding:'48px 20px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={()=>navigate('results')} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>VDO Assessment Report</div>
          <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginTop:2 }}>PDF Preview</div>
        </div>
        <div style={{ width:36 }}/>
      </div>

      <div className="scroll-body">
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ background:'linear-gradient(135deg,#0D9488,#0F766E)', padding:'14px 18px' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'#fff' }}>DentoMeasure</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', marginTop:2 }}>VDO Assessment Report</div>
          </div>
          <div style={{ height:3, background:'linear-gradient(90deg,#0D9488,#E91E8C)' }}/>
          <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:0 }}>

            <div style={{ background:'var(--teal-light)', borderRadius:8, padding:'10px 12px', marginBottom:14, border:'1px solid rgba(13,148,136,0.2)' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--teal-dark)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Patient</div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>{patient?.name}</div>
                  <div style={{ fontSize:10, color:'var(--text2)' }}>Age: {patient?.age} · {patient?.gender}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:'var(--text2)' }}>{dateStr}</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>{timeStr}</div>
                </div>
              </div>
            </div>

            <div style={{ fontSize:9, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Captured Images</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
              {[{label:'REST',img:restImage},{label:'OCCLUSION',img:occImage}].map(p=>(
                <div key={p.label} style={{ borderRadius:8, overflow:'hidden', border:'1px solid var(--border)', position:'relative' }}>
                  {p.img ? <img src={p.img} alt={p.label} style={{ width:'100%', height:80, objectFit:'cover', display:'block' }}/> : <div style={{ width:'100%', height:80, background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#aaa' }}>No image</div>}
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.55)', padding:'3px 6px' }}>
                    <div style={{ fontSize:8, color:'#fff', fontWeight:700 }}>{p.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize:9, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Measurement Summary</div>
            {[['VDR (Rest)',`${vdr} mm`],['VDO (Occlusion)',`${vdo} mm`]].map(([l,v])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{v}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0' }}>
              <span style={{ fontSize:12, color:'var(--text3)' }}>Freeway Space</span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{freewaySpace} mm</span>
                <span className={ok?'badge badge-success':'badge badge-warning'}>{ok?'NORMAL':'REVIEW'}</span>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
              <div style={{ background:ok?'var(--teal)':'var(--warning)', color:'#fff', borderRadius:8, padding:'6px 12px' }}>
                <div style={{ fontSize:7, opacity:0.8 }}>CLINICAL GRADE</div>
                <div style={{ fontSize:12, fontWeight:800 }}>{ok?'ACCURATE':'REVIEW'}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:9, color:'var(--text3)' }}>Doctor Signature</div>
                <div style={{ marginTop:16, paddingTop:4, borderTop:'1px solid var(--border)', minWidth:100 }}></div>
              </div>
            </div>

            {patient?.notes && (
              <div style={{ marginTop:12, padding:'10px 12px', background:'var(--bg)', borderRadius:8, fontSize:11, color:'var(--text2)', lineHeight:1.6 }}>
                <span style={{ fontWeight:700, fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.4 }}>Notes: </span>{patient.notes}
              </div>
            )}
            <div style={{ marginTop:14, textAlign:'center', fontSize:9, color:'var(--text3)' }}>For clinical reference only · Not a diagnostic tool</div>
          </div>
        </div>
      </div>

      <div style={{ padding:16, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
        <button className="btn btn-primary" onClick={handlePDF} disabled={generating} style={{ borderRadius:14 }}>
          {generating ? <><div className="spinner"/>GENERATING...</> : '📄 SHARE PDF'}
        </button>
        <button className="btn btn-ghost" onClick={onSave} style={{ borderRadius:14, fontSize:13 }}>SAVE TO HISTORY</button>
      </div>
    </div>
  )
}
