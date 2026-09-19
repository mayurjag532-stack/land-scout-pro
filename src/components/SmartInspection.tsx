import { PropertyRecord } from "../types";
import { autoSignals, beforeYouLeave, evidencePrompts, fieldSnapshot, smartQuestions } from "../utils/fieldIntelligence";

export default function SmartInspection({property,onAnswer,onNotesChange}:{property:PropertyRecord;onAnswer:(id:string,v:string)=>void;onNotesChange:(v:string)=>void}){
 const signals=autoSignals(property.mapIntel), questions=smartQuestions(property), missing=beforeYouLeave(property), evidence=evidencePrompts(property), snapshot=fieldSnapshot(property);
 const answered=questions.filter(q=>(property.ownerAnswers[q.id]||"").trim()).length;
 return <div className="smart-stack">
   <section className="smart-console">
    <div className="smart-head"><div><p className="ps-kicker">Plot Scout intelligence</p><h3>{snapshot.headline}</h3><p>{snapshot.summary}</p></div><div className="smart-count">{snapshot.confidence}</div></div>
    {snapshot.flags.length>0 && <div className="smart-flags">{snapshot.flags.map(x=><span key={x}>{x}</span>)}</div>}
    {signals.length>0 && <div className="signal-grid">{signals.map(s=><div className={`signal ${s.tone}`} key={s.label}><span>{s.label}</span><b>{s.value}</b><small>auto-detected</small></div>)}</div>}
    {signals.length===0 && <div className="auto-wait"><span className="pulse-dot"/>Capture location — Plot Scout will calculate roads, access and surroundings automatically.</div>}
   </section>
   <section className="smart-questions">
    <div className="smart-head compact"><div><p className="ps-kicker">Ground truth only</p><h3>Only what the map cannot know</h3><p>Questions adapt to this site and your previous answers.</p></div><span className="smart-badge">{answered}/{questions.length}</span></div>
    <div className="question-list">{questions.map((q,n)=>{const v=property.ownerAnswers[q.id]||"";const attention=!v&&q.priority==="critical";return <article className={`smart-q ${v?"done":attention?"needs-attention":""}`} key={q.id}><div className="q-index">{v?"✓":String(n+1).padStart(2,"0")}</div><div className="q-body"><div className="q-title-row"><h4>{q.title}</h4>{q.priority==="critical"&&<span className="risk-pill">Priority</span>}</div><p>{q.hint}</p><div className="option-row">{q.options.map(o=><button key={o} onClick={()=>onAnswer(q.id,o)} className={v===o?"selected":""}>{o}</button>)}</div></div></article>})}</div>
    <textarea value={property.notes.site} onChange={e=>onNotesChange(e.target.value)} placeholder="Only add a note if something unusual matters…" rows={2}/>
   </section>
   {evidence.length>0 && <section className="evidence-coach"><div><p className="ps-kicker">Smart evidence</p><h3>Capture only what matters here</h3></div><div className="evidence-prompt-row">{evidence.map(x=><span key={x}>{x}</span>)}</div></section>}
   <section className={`leave-gate ${missing.length===0?"ready":""}`}>
    <div><p className="ps-kicker">Before you leave</p><h3>{missing.length===0?"Field evidence looks complete":"Don’t make a second trip"}</h3><p>{missing.length===0?"Core field checks are captured. Continue to economics and decision.":`${missing.length} useful item${missing.length>1?"s":""} still missing.`}</p></div>
    {missing.length>0 && <div className="leave-items">{missing.map((x,i)=><div key={x}><span>{i+1}</span>{x}</div>)}</div>}
   </section>
 </div>
}
