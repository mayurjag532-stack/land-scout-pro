import { lazy, Suspense, useEffect, useState } from "react";
import { PropertyRecord, newProperty } from "./types";
import { getPropertySummaries, getProperty, deleteProperty, getOpportunityLeads, saveOpportunityLead, deleteOpportunityLead } from "./db";
import { OpportunityLead, newSharedLead } from "./leads";
import OpportunityRadar from "./components/OpportunityRadar";
import PropertyList from "./components/PropertyList";
import { getPlan, PLAN_META, Plan, syncTrustedEntitlements } from "./entitlements";
import { BuyerProfile, getBuyerProfile } from "./personalization";
const NewVisit = lazy(() => import("./components/NewVisit"));
const Settings = lazy(() => import("./components/Settings"));

type Tab = "new" | "list" | "leads" | "settings";

function Mark({ kind }: { kind: "new" | "list" | "leads" | "settings" }) {
  if (kind === "new") return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>;
  if (kind === "list") return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 9h7M8.5 13h7M8.5 17h5"/></svg>;
  if (kind === "leads") return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 18V8l8-4 8 4v10"/><path d="M7 18h10M9 14l3-3 3 3"/></svg>;
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6.2L14.7 4h-4L10.4 6.2a8 8 0 0 0-1.5.9l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.5.9l.3 2.2h4l.3-2.2a8 8 0 0 0 1.5-.9l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/></svg>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("list");
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [leads, setLeads] = useState<OpportunityLead[]>([]);
  const [activeProperty, setActiveProperty] = useState<PropertyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [plan,setPlanState]=useState<Plan>(()=>getPlan());
  const [storageError, setStorageError] = useState<string | null>(null);
  const [buyerProfile,setBuyerProfile]=useState<BuyerProfile>(()=>getBuyerProfile());

  async function refresh() { setProperties(await getPropertySummaries()); }
  async function refreshLeads() { setLeads(await getOpportunityLeads()); }
  useEffect(() => { Promise.all([refresh(), refreshLeads(), syncTrustedEntitlements()]).then(([, ,p])=>setPlanState(p)).finally(() => setLoaded(true)); }, []);
  useEffect(()=>{const h=(e:Event)=>setBuyerProfile((e as CustomEvent).detail?.profile||getBuyerProfile());window.addEventListener("plot-scout-profile-change",h);return()=>window.removeEventListener("plot-scout-profile-change",h);},[]);
  useEffect(()=>{const h=(e:Event)=>setPlanState((e as CustomEvent).detail?.plan||getPlan());window.addEventListener("plot-scout-plan-change",h);return()=>window.removeEventListener("plot-scout-plan-change",h);},[]);
  useEffect(() => {
    const h = (e: Event) => setStorageError((e as CustomEvent).detail?.message || "Local storage encountered a problem.");
    window.addEventListener("plot-scout-storage-error", h);
    return () => window.removeEventListener("plot-scout-storage-error", h);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("share-target") !== "1") return;
    const input = { title: q.get("title") || "", text: q.get("text") || "", url: q.get("url") || "" };
    if (!input.title && !input.text && !input.url) return;
    (async () => {
      // Check IndexedDB directly (not React state, which may not have loaded yet) so
      // sharing the same link twice never creates a duplicate lead.
      const existing = await getOpportunityLeads();
      const lead = newSharedLead(input);
      const alreadyCaptured = lead.sourceUrl && existing.some((l) => l.sourceUrl === lead.sourceUrl);
      if (!alreadyCaptured) await saveOpportunityLead(lead);
      await refreshLeads();
      setTab("leads");
      history.replaceState({}, "", window.location.pathname);
    })();
  }, []);
  async function removeLead(id:string) { await deleteOpportunityLead(id); await refreshLeads(); }
  function startNewVisit() { setActiveProperty(newProperty(`Visit ${new Date().toLocaleDateString()}`)); setTab("new"); }
  async function openProperty(id: string) { const p = await getProperty(id); if (p) { setActiveProperty(p); setTab("new"); } }
  function backFromVisit() { setActiveProperty(null); refresh(); setTab("list"); }
  async function removeProperty(id:string) { await deleteProperty(id); await refresh(); }

  if (!loaded) return <div className="min-h-screen bg-field-bg text-field-text"><header className="px-5 pt-5 pb-2 max-w-xl mx-auto"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl border border-field-line bg-field-card flex items-center justify-center text-field-accent font-semibold">P</div><div className="space-y-2"><div className="skeleton h-2.5 w-32"/><div className="skeleton h-4 w-24"/></div></div></header><main className="px-4 py-4 max-w-xl mx-auto space-y-3"><div className="skeleton h-11 w-full"/><div className="skeleton h-28 w-full"/><div className="skeleton h-28 w-full"/></main></div>;

  return <div className="min-h-screen bg-field-bg text-field-text">
    {storageError && <div role="alert" className="sticky top-0 z-50 bg-field-bad text-field-bg px-4 py-3 text-sm"><div className="max-w-xl mx-auto flex gap-3 items-start"><span className="flex-1">{storageError}</span><button className="font-semibold" onClick={() => setStorageError(null)} aria-label="Dismiss storage warning">Dismiss</button></div></div>}
    {tab !== "new" && <header className="px-5 pt-5 pb-2 max-w-xl mx-auto"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl border border-field-line bg-field-card flex items-center justify-center text-field-accent font-semibold tracking-tight">P</div><div className="min-w-0 flex-1"><p className="text-[11px] uppercase tracking-[.18em] text-field-muted">Private field intelligence</p><div className="flex items-center gap-2"><h1 className="text-[17px] font-semibold tracking-tight">Plot Scout</h1><span className="text-[9px] uppercase tracking-[.12em] text-field-accent border border-field-accent/30 rounded-full px-2 py-0.5">{PLAN_META[plan].name}</span></div></div>
      <nav className="hidden md:flex items-center gap-1 shrink-0">
        <button onClick={startNewVisit} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-field-muted hover:bg-field-card hover:text-field-text"><Mark kind="new"/>New visit</button>
        <button onClick={() => setTab("list")} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium ${tab === "list" ? "bg-field-card text-field-accent" : "text-field-muted hover:bg-field-card hover:text-field-text"}`}><Mark kind="list"/>Properties</button>
        <button onClick={() => setTab("leads")} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium ${tab === "leads" ? "bg-field-card text-field-accent" : "text-field-muted hover:bg-field-card hover:text-field-text"}`}><Mark kind="leads"/>Radar</button>
        <button onClick={() => setTab("settings")} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium ${tab === "settings" ? "bg-field-card text-field-accent" : "text-field-muted hover:bg-field-card hover:text-field-text"}`}><Mark kind="settings"/>Settings</button>
      </nav>
    </div></header>}
    {tab === "new" && activeProperty && <Suspense fallback={<div className="px-4 py-8 max-w-xl mx-auto"><div className="skeleton h-32 w-full"/></div>}><NewVisit initial={activeProperty} onBack={backFromVisit} plan={plan} buyerProfile={buyerProfile} /></Suspense>}
    {tab === "list" && <PropertyList properties={properties} onOpen={openProperty} onNew={startNewVisit} plan={plan} onDelete={removeProperty} />}
    {tab === "leads" && <OpportunityRadar leads={leads} onDelete={removeLead} onDiscovered={async (lead)=>{await saveOpportunityLead(lead);await refreshLeads();}} onUpdate={async (lead)=>{await saveOpportunityLead(lead);await refreshLeads();}} />}
    {tab === "settings" && <Suspense fallback={<div className="px-4 py-8 max-w-xl mx-auto"><div className="skeleton h-32 w-full"/></div>}><Settings properties={properties} onDataChanged={refresh} buyerProfile={buyerProfile} /></Suspense>}
    {tab !== "new" && <nav className="fixed bottom-0 left-0 right-0 z-20 bg-field-card/95 backdrop-blur-xl border-t border-field-line safe-bottom md:hidden"><div className="max-w-xl mx-auto grid grid-cols-4 px-2">
      <button onClick={startNewVisit} className="py-2.5 flex flex-col items-center gap-1 text-field-muted"><Mark kind="new"/><span className="text-[11px] font-medium">New visit</span></button>
      <button onClick={() => setTab("list")} className={`py-2.5 flex flex-col items-center gap-1 ${tab === "list" ? "text-field-accent" : "text-field-muted"}`}><Mark kind="list"/><span className="text-[11px] font-medium">Properties</span></button>
      <button onClick={() => setTab("leads")} className={`py-2.5 flex flex-col items-center gap-1 ${tab === "leads" ? "text-field-accent" : "text-field-muted"}`}><Mark kind="leads"/><span className="text-[11px] font-medium">Radar</span></button>
      <button onClick={() => setTab("settings")} className={`py-2.5 flex flex-col items-center gap-1 ${tab === "settings" ? "text-field-accent" : "text-field-muted"}`}><Mark kind="settings"/><span className="text-[11px] font-medium">Settings</span></button>
    </div></nav>}
  </div>;
}

