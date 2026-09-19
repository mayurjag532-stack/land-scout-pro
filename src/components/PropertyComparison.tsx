import { PropertyRecord } from "../types";
import { computeScore } from "../utils/scoring";
import { economics } from "../utils/economics";
import { SignalTag } from "./ui/StatusTag";

const STATUS_LABEL: Record<string, string> = { STRONG: "Strong", INVESTIGATE: "Investigate", REJECT: "Reject", UNDECIDED: "Undecided" };
const money=(n:number|null|undefined)=>n==null?"—":`₹${Math.round(n).toLocaleString("en-IN")}`;
const value=(n:number|null|undefined,suffix="")=>n==null?"—":`${Number(n.toFixed(2)).toLocaleString("en-IN")}${suffix}`;

export default function PropertyComparison({properties,onClose}:{properties:PropertyRecord[];onClose:()=>void}){
 const enriched=properties.map(p=>({p,s:computeScore(p),e:economics(p.price)}));
 const withPrice=enriched.filter(x=>x.e.perSqft); const bestPrice=withPrice.length?[...withPrice].sort((a,b)=>(a.e.perSqft||Infinity)-(b.e.perSqft||Infinity))[0].p.id:null;
 const bestScore=[...enriched].sort((a,b)=>b.s.total-a.s.total)[0]?.p.id;
 const bestAccess=[...enriched].filter(x=>x.p.price.mainRoadDistanceM!=null).sort((a,b)=>(a.p.price.mainRoadDistanceM??Infinity)-(b.p.price.mainRoadDistanceM??Infinity))[0]?.p.id;
 const mostEvidence=[...enriched].sort((a,b)=>b.s.breakdown.evidence-a.s.breakdown.evidence)[0]?.p.id;
 const rows=[
  ["Decision",(x:any)=><span className="inline-flex flex-col items-start gap-1"><SignalTag status={x.s.status} label={STATUS_LABEL[x.s.status]}/><span className="text-field-muted text-[10px]">Confidence {x.s.confidence}</span></span>],["Site signal",(x:any)=>`${x.s.total}/100`],["Effective price",(x:any)=>money(x.e.effectivePrice)],["Total acquisition",(x:any)=>money(x.e.totalAcquisition)],["Area",(x:any)=>`${value(x.e.areaGuntha," guntha")} · ${value(x.e.areaSqft," sq ft")}`],["₹ / sq ft",(x:any)=>money(x.e.perSqft)],["₹ / guntha",(x:any)=>money(x.e.perGuntha)],["Road width",(x:any)=>value(x.p.price.roadWidthFt," ft")],["Main-road distance",(x:any)=>value(x.p.price.mainRoadDistanceM," m")],["Location",(x:any)=>`${x.s.breakdown.location}/15`],["Access",(x:any)=>`${x.s.breakdown.access}/15`],["Infrastructure",(x:any)=>`${x.s.breakdown.infrastructure}/15`],["Site condition",(x:any)=>`${x.s.breakdown.siteCondition}/15`],["Evidence",(x:any)=>`${x.s.breakdown.evidence}/10 · ${x.p.photos.length} photos`],["Legal readiness",(x:any)=>`${x.s.breakdown.legalReadiness}/10`],["Critical flags",(x:any)=>x.s.criticalFlags.length?`${x.s.criticalFlags.length} flag(s)`:"None recorded"]
 ];
 const callouts=[{label:"Best overall signal",id:bestScore},{label:"Lowest observed ₹/sq ft",id:bestPrice},{label:"Closest recorded main road",id:bestAccess},{label:"Strongest evidence set",id:mostEvidence}].filter(x=>x.id);
 return <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-3"><section className="bg-field-card border border-field-line rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
  <header className="sticky top-0 bg-field-card/95 backdrop-blur border-b border-field-line p-4 flex justify-between items-start gap-3 z-10"><div><p className="text-[11px] uppercase tracking-[.16em] text-field-muted">Decision workspace</p><h3 className="text-field-text font-semibold text-lg">Property comparison</h3><p className="text-field-muted text-xs mt-1">Observed data only. Legal and market verification remain independent.</p></div><button onClick={onClose} className="text-field-muted border border-field-line rounded-lg px-3">Close</button></header>
  <div className="p-4"><div className="grid sm:grid-cols-2 gap-2 mb-4">{callouts.map(c=><div key={c.label} className="bg-field-panel border border-field-line rounded-xl p-3"><p className="text-[10px] uppercase tracking-[.12em] text-field-muted">{c.label}</p><p className="text-sm text-field-text font-medium mt-1">{properties.find(p=>p.id===c.id)?.name}</p></div>)}</div>
  <div className="overflow-x-auto border border-field-line rounded-xl"><table className="w-full text-xs border-collapse min-w-[620px]"><thead><tr className="bg-field-panel"><th className="text-left text-field-muted p-3">Metric</th>{properties.map(p=><th key={p.id} className="text-left text-field-text p-3 min-w-[160px]">{p.name}</th>)}</tr></thead><tbody>{rows.map(([label,get]:any)=><tr key={label} className="border-t border-field-line"><td className="text-field-muted p-3 whitespace-nowrap">{label}</td>{enriched.map(x=><td key={x.p.id} className="text-field-text p-3 align-top">{get(x)}</td>)}</tr>)}</tbody></table></div>
  <p className="text-[11px] text-field-muted mt-4">Callouts rank only the information recorded in Plot Scout. They are not investment recommendations or legal conclusions.</p></div>
 </section></div>;
}
