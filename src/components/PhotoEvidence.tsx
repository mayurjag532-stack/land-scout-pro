import { useRef, useState } from "react";
import { PhotoCategory, PropertyPhoto } from "../types";

const CATEGORIES: { id: PhotoCategory; label: string }[] = [
  { id: "front_road", label: "Front road" }, { id: "plot", label: "Plot" },
  { id: "left_side", label: "Left side" }, { id: "right_side", label: "Right side" },
  { id: "rear", label: "Rear" }, { id: "surrounding", label: "Surroundings" },
  { id: "access_road", label: "Access road" }, { id: "documents", label: "Documents" }
];
const MAX_DIMENSION=1600, JPEG_QUALITY=.78;
function resizeImage(file:File):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error("Could not read photo file."));r.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error("Could not decode photo."));img.onload=()=>{let {width,height}=img;if(width>MAX_DIMENSION||height>MAX_DIMENSION){const scale=MAX_DIMENSION/Math.max(width,height);width=Math.round(width*scale);height=Math.round(height*scale);}const c=document.createElement("canvas");c.width=width;c.height=height;const ctx=c.getContext("2d");if(!ctx)return reject(new Error("Image processing is not supported on this device."));ctx.drawImage(img,0,0,width,height);resolve(c.toDataURL("image/jpeg",JPEG_QUALITY));};img.src=r.result as string;};r.readAsDataURL(file);});}

function XIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function CameraEmptyIcon() { return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.2a1 1 0 0 0 .9-.5l.6-1a1 1 0 0 1 .9-.5h4.8a1 1 0 0 1 .9.5l.6 1a1 1 0 0 0 .9.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.2" /></svg>; }

export default function PhotoEvidence({photos,onAdd,onRemove,onUpdate}:{photos:PropertyPhoto[];onAdd:(p:PropertyPhoto)=>void;onRemove:(id:string)=>void;onUpdate?:(id:string,patch:Partial<PropertyPhoto>)=>void;}){
 const [activeCategory,setActiveCategory]=useState<PhotoCategory>("plot"),[error,setError]=useState(""),[busy,setBusy]=useState(false); const inputRef=useRef<HTMLInputElement>(null);
 async function handleFiles(e:React.ChangeEvent<HTMLInputElement>){const files=Array.from(e.target.files||[]);if(!files.length)return;setError("");setBusy(true);try{for(const file of files){const dataUrl=await resizeImage(file);onAdd({id:`photo_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,category:activeCategory,dataUrl,addedAt:Date.now(),caption:""});}}catch(err){setError(err instanceof Error?err.message:"Could not add evidence.");}finally{setBusy(false);if(inputRef.current)inputRef.current.value="";}}
 const grouped=CATEGORIES.map(c=>({...c,count:photos.filter(p=>p.category===c.id).length}));
 const coveredCategories=grouped.filter(c=>c.count>0).length;
 return <section className="bg-field-card border border-field-line rounded-xl p-4">
   <div className="flex items-start justify-between gap-3 mb-3">
     <div><p className="text-[11px] uppercase tracking-[.16em] text-field-muted">Evidence vault</p><h3 className="text-field-text font-semibold text-[16px] mt-0.5">Site photos & documents</h3><p className="text-field-muted text-xs mt-1">Private on this device · compressed for reliable field storage.</p></div>
     <div className="text-right shrink-0">
       <span className="text-xs text-field-text border border-field-line rounded-full px-2.5 py-1 tabular-nums">{photos.length} items</span>
       <p className="text-field-muted text-[10px] mt-1.5">{coveredCategories}/{CATEGORIES.length} categories</p>
     </div>
   </div>
   <div className="flex gap-2 overflow-x-auto pb-2">{grouped.map(c=><button key={c.id} onClick={()=>setActiveCategory(c.id)} className={`text-xs rounded-full px-3 py-1.5 border whitespace-nowrap ${activeCategory===c.id?"bg-field-accent text-field-bg border-field-accent":c.count?"bg-field-panel text-field-muted border-field-line":"bg-transparent text-field-muted border-dashed border-field-line"}`}>{c.label}{c.count?` · ${c.count}`:""}</button>)}</div>
   <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" id="evidence-input"/>
   <label htmlFor="evidence-input" className={`block w-full text-center py-3 rounded-xl border border-field-accent font-medium cursor-pointer ${busy?"opacity-50 pointer-events-none":"bg-field-panel text-field-accent"}`}>{busy?"Processing evidence…":`Add ${CATEGORIES.find(c=>c.id===activeCategory)?.label}`}</label>
   {error&&<p className="text-field-bad text-xs mt-2">{error}</p>}
   {photos.length>0?<div className="grid grid-cols-2 gap-3 mt-4">{photos.map(p=><article key={p.id} className="bg-field-panel border border-field-line rounded-xl overflow-hidden"><div className="relative"><img src={p.dataUrl} loading="lazy" decoding="async" className="w-full aspect-[4/3] object-cover"/><button onClick={()=>{if(confirm("Remove this evidence item?"))onRemove(p.id)}} className="absolute top-2 right-2 bg-black/70 hover:bg-black/85 text-white rounded-full w-8 h-8 grid place-items-center" aria-label="Remove evidence"><XIcon/></button><span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] rounded-full px-2 py-1">{CATEGORIES.find(c=>c.id===p.category)?.label}</span></div><div className="p-2.5"><input value={p.caption||""} onChange={e=>onUpdate?.(p.id,{caption:e.target.value})} placeholder="Add a short caption…" className="w-full bg-transparent border-b border-field-line text-xs text-field-text py-1.5"/><p className="text-[10px] text-field-muted mt-1.5">{new Date(p.addedAt).toLocaleString()}</p></div></article>)}</div>:<div className="mt-4 rounded-xl border border-dashed border-field-line p-6 text-center"><div className="w-10 h-10 mx-auto rounded-full bg-field-panel border border-field-line grid place-items-center text-field-accent"><CameraEmptyIcon/></div><p className="text-sm text-field-muted mt-3">No evidence captured yet.</p><p className="text-xs text-field-muted mt-1">Capture access, plot edges, surroundings and relevant documents.</p></div>}
 </section>;
}
