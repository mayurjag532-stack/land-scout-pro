import { useState } from "react";
import { OpportunityLead, applyLocationVerification, isSafeSourceUrl, normalizeOpportunityLead } from "../leads";
import { StatusTag, Tone } from "./ui/StatusTag";

const STATUS_TONE: Record<OpportunityLead["status"],Tone>={INBOX:"neutral",UNVERIFIED:"warn",LOCATION_CONFLICT:"bad",READY_FOR_REVIEW:"good",PROMOTED:"good",REJECTED:"bad"};
export default function LeadInbox({leads,onDelete,onUpdate,embedded=false}:{leads:OpportunityLead[];onDelete:(id:string)=>void;onUpdate?:(lead:OpportunityLead)=>Promise<void>;embedded?:boolean}){
 const [open,setOpen]=useState<string|null>(null); const [verifying,setVerifying]=useState<string|null>(null); const [verifyMsg,setVerifyMsg]=useState<Record<string,string>>({});
 async function verifyLead(l:OpportunityLead){
  if(!l.sourceUrl){setVerifyMsg(m=>({...m,[l.id]:"No source URL available."}));return;}
  setVerifying(l.id); setVerifyMsg(m=>({...m,[l.id]:"Checking public source evidence..."}));
  try{
   const r=await fetch("/api/verify-lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:l.sourceUrl,title:l.sharedTitle,text:l.sharedText})});
   const d=await r.json(); if(!r.ok) throw new Error(d?.error||`Verify ${r.status}`);
   const now=Date.now();
   const evidence=[...l.evidence,{id:`ev_${now}_verify`,kind:"verification_snapshot" as const,value:JSON.stringify(d),capturedAt:now,sourceUrl:l.sourceUrl}];
   let next=normalizeOpportunityLead({...l,evidence,updatedAt:now});
   if(d?.location && Object.values(d.location).some(Boolean)) next=applyLocationVerification(next,d.location);
   if(onUpdate) await onUpdate(next);
   const parts=[d?.sourceReachable?"source reachable":"source limited",d?.saleIntent?"sale signal found":"sale signal not proven",d?.locationEstablished?"location clues found":"location not established"];
   setVerifyMsg(m=>({...m,[l.id]:parts.join(" - ")}));
  }catch(e:any){setVerifyMsg(m=>({...m,[l.id]:`Verification stopped safely: ${e?.message||"Unknown error"}`}));}finally{setVerifying(null);}
 }
 return <div className={embedded?"space-y-4":"px-4 pt-4 pb-24 max-w-xl mx-auto space-y-4"}>
  <section><p className="text-[11px] uppercase tracking-[.18em] text-field-muted">Opportunity Radar</p><div className="flex items-end justify-between gap-3 mt-1"><div><h2 className="text-2xl font-semibold tracking-tight">Lead Inbox</h2><p className="text-sm text-field-muted mt-1">Captured evidence first. Nothing here is actionable until verified.</p></div><span className="text-xs border border-field-line rounded-full px-2.5 py-1 text-field-muted">{leads.length} leads</span></div></section>
  <div className="rounded-xl border border-field-warn/30 bg-field-card p-3 text-sm"><span className="font-semibold text-field-warn">Safety gate:</span> <span className="text-field-muted">No verified location - no opportunity score - no promotion.</span></div>
  {leads.length===0?<div className="rounded-2xl border border-field-line bg-field-card p-6 text-center"><p className="font-medium">No captured leads yet</p><p className="text-sm text-field-muted mt-2">Share an Instagram/property post to Plot Scout or run Radar discovery.</p></div>:leads.map(l=>{const expanded=open===l.id;const tone=STATUS_TONE[l.status];const linkSafe=isSafeSourceUrl(l.sourceUrl);return <article key={l.id} className="rounded-2xl border border-field-line bg-field-card overflow-hidden">
   <button onClick={()=>setOpen(expanded?null:l.id)} className="w-full text-left p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><p className="font-semibold truncate">{l.sharedTitle||l.sourceUrl||"Shared property lead"}</p>{l.source==="instagram_share"&&<span className="text-[9px] rounded-full border border-field-accent/30 px-2 py-0.5 text-field-accent">INSTAGRAM</span>}{typeof l.distanceKm==="number"&&<span className="text-[9px] rounded-full border border-field-line px-2 py-0.5 text-field-muted">{l.distanceKm<1?`${Math.round(l.distanceKm*1000)} m away`:`${l.distanceKm.toFixed(1)} km away`}</span>}</div><p className="text-xs text-field-muted mt-1">{new Date(l.createdAt).toLocaleString()}</p></div><StatusTag tone={tone} label={l.status.replace(/_/g," ")}/></div>{l.sharedText&&<p className="text-sm text-field-muted mt-3 line-clamp-2">{l.sharedText}</p>}</button>
   {expanded&&<div className="border-t border-field-line p-4 space-y-3">{linkSafe&&<div><p className="text-[10px] uppercase tracking-wider text-field-muted">Source URL</p><a href={l.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-field-accent break-all underline">{l.sourceUrl}</a></div>}
    <div className="flex gap-2"><button disabled={verifying===l.id||!linkSafe} onClick={()=>verifyLead(l)} className="rounded-lg border border-field-accent bg-field-accent/10 text-field-accent px-3 py-2 text-xs font-semibold">{verifying===l.id?"Verifying...":"Verify lead"}</button><button onClick={()=>onDelete(l.id)} className="rounded-lg border border-field-line px-3 py-2 text-xs text-field-bad">Delete lead</button></div>
    {verifyMsg[l.id]&&<p className="text-xs text-field-muted">{verifyMsg[l.id]}</p>}
    <div><p className="text-[10px] uppercase tracking-wider text-field-muted">Provenance ledger</p><div className="mt-2 space-y-2">{l.evidence.map(e=><div key={e.id} className="rounded-lg border border-field-line p-2"><p className="text-[10px] text-field-muted uppercase">{e.kind.replace(/_/g," ")}</p><p className="text-xs mt-1 break-words line-clamp-4">{e.value}</p></div>)}</div></div>
    <div className="rounded-lg border border-field-line p-3 space-y-1.5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">Location Verification Gate</p><StatusTag tone={tone} label={l.verification.status.replace(/_/g," ")}/></div><p className="text-xs text-field-muted">{l.verification.humanReadableReason}</p></div>
   </div>}
  </article>})}
 </div>;
}
