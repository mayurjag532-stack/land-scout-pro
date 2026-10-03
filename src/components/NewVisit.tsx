import { useEffect, useRef, useState } from "react";
import { PropertyRecord, CapturedLocation, MapIntel, PriceData, PropertyPhoto, PropertyStatus } from "../types";
import { saveProperty } from "../db";
import PropertyHeader from "./PropertyHeader";
import SpatialHero from "./SpatialHero";
import LocationCapture from "./LocationCapture";
import PropertyIdentityPanel from "./PropertyIdentity";
import ParcelIntelligencePanel from "./ParcelIntelligence";
import MapIntelligence from "./MapIntelligence";
import SmartInspection from "./SmartInspection";
import PriceDataPanel from "./PriceData";
import PhotoEvidence from "./PhotoEvidence";
import NotesPanel from "./Notes";
import FinalStatusPanel from "./FinalStatus";
import { visitSectionStates, sectionStateLabel } from "../utils/visitState";
import { canUse, Plan, PLAN_META } from "../entitlements";
import { BuyerProfile } from "../personalization";
import BuyerFitPanel from "./BuyerFitPanel";


export default function NewVisit({
  initial,
  onBack,
  plan,
  buyerProfile
}: {
  initial: PropertyRecord;
  onBack: () => void;
  plan: Plan;
  buyerProfile: BuyerProfile;
}) {
  const [property, setProperty] = useState<PropertyRecord>(initial);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave on every change, debounced, so nothing is lost if the browser closes.
  useEffect(() => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveProperty(property);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property]);

  async function leaveVisit() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      setSaveState("saving");
      await saveProperty(property);
      setSaveState("saved");
      onBack();
    } catch {
      setSaveState("error");
      if (confirm("The latest changes could not be saved. Leave this visit anyway?")) onBack();
    }
  }

  function update(patch: Partial<PropertyRecord>) {
    setProperty((p) => ({ ...p, ...patch }));
  }

  const sections = visitSectionStates(property);
  const prevSectionStates = useRef<Record<string, string>>({});
  const [justReady, setJustReady] = useState<Set<string>>(new Set());
  useEffect(() => {
    const becameReady = sections.filter((s) => s.state === "READY" && prevSectionStates.current[s.id] && prevSectionStates.current[s.id] !== "READY").map((s) => s.id);
    prevSectionStates.current = Object.fromEntries(sections.map((s) => [s.id, s.state]));
    if (becameReady.length === 0) return;
    setJustReady((prev) => new Set([...prev, ...becameReady]));
    const t = window.setTimeout(() => {
      setJustReady((prev) => { const next = new Set(prev); becameReady.forEach((id) => next.delete(id)); return next; });
    }, 700);
    return () => window.clearTimeout(t);
  }, [sections]);
  return (
    <div className="pb-16">
      <PropertyHeader property={property} onNameChange={(name) => update({ name })} onBack={leaveVisit} />
      <div className="ps-shell">
        <SpatialHero property={property} saveState={saveState} />
        <div className="ps-workspace">
          <aside className="ps-rail"><p className="ps-kicker px-3 pt-2 pb-3">Visit navigator</p>{sections.map((section,i)=><a key={section.id} href={`#${section.id}`} title={sectionStateLabel[section.state]} className={justReady.has(section.id)?"ps-just-ready":""}><span className="ps-rail-index">{i+1}</span><span className={`ps-dot ps-state-${section.state.toLowerCase().replace("_","-")}`}/><span className="flex-1">{section.label}</span><small className="ps-rail-state">{sectionStateLabel[section.state]}</small></a>)}</aside>
          <main className="ps-content">
            <section id="identity" className="ps-section ps-stagger" style={{ animationDelay: "0ms" }}><div className="ps-section-label"><span className="ps-section-num">01</span><span className="ps-section-title">Property identity</span></div><PropertyIdentityPanel identity={property.identity} onChange={(identity) => update({ identity })} /><ParcelIntelligencePanel identity={property.identity} fieldLocation={property.location} value={property.parcelIntel} onChange={(parcelIntel) => update({ parcelIntel })} /></section>
            <section id="location" className="ps-section ps-stagger" style={{ animationDelay: "40ms" }}><div className="ps-section-label"><span className="ps-section-num">02</span><span className="ps-section-title">Position & surroundings</span></div><LocationCapture location={property.location} onCaptured={(location: CapturedLocation) => update({ location })} />
            {property.location && (canUse(plan,"map_intelligence") ? <MapIntelligence location={property.location} intel={property.mapIntel} onIntelUpdated={(mapIntel: MapIntel) => update({ mapIntel })} /> : <div className="bg-field-card border border-field-line rounded-xl p-5 mt-4"><div className="flex items-start justify-between gap-3"><div><p className="text-field-text font-semibold">Map Intelligence</p><p className="text-field-muted text-xs mt-1">Nearby roads, access and mapped activity.</p></div><span className="tier-lock">{PLAN_META.ADVANCED.name}</span></div></div>)}</section>
            <section id="ground" className="ps-section ps-stagger" style={{ animationDelay: "80ms" }}><div className="ps-section-label"><span className="ps-section-num">03</span><span className="ps-section-title">Smart field inspection</span></div><SmartInspection property={property} onAnswer={(id, value) => update({ ownerAnswers: { ...property.ownerAnswers, [id]: value } })} onNotesChange={(site) => update({ notes: { ...property.notes, site } })}/></section>
            <section id="economics" className="ps-section ps-stagger" style={{ animationDelay: "120ms" }}><div className="ps-section-label"><span className="ps-section-num">04</span><span className="ps-section-title">Deal economics</span></div><PriceDataPanel price={property.price} onChange={(price: PriceData) => update({ price })}/></section>
            <section id="evidence" className="ps-section ps-stagger" style={{ animationDelay: "160ms" }}><div className="ps-section-label"><span className="ps-section-num">05</span><span className="ps-section-title">Evidence vault</span></div><PhotoEvidence photos={property.photos} onAdd={(photo: PropertyPhoto) => update({ photos: [...property.photos, photo] })} onRemove={(id) => update({ photos: property.photos.filter((p) => p.id !== id) })} onUpdate={(id, patch) => update({ photos: property.photos.map((p) => p.id === id ? { ...p, ...patch } : p) })}/><div className="mt-4"><NotesPanel owner={property.notes.owner} general={property.notes.general} onOwnerChange={(owner) => update({ notes: { ...property.notes, owner } })} onGeneralChange={(general) => update({ notes: { ...property.notes, general } })}/></div></section>
            <section id="decision" className="ps-section ps-stagger" style={{ animationDelay: "200ms" }}><div className="ps-section-label"><span className="ps-section-num">06</span><span className="ps-section-title">Decision room</span></div><BuyerFitPanel property={property} profile={buyerProfile}/><FinalStatusPanel property={property} onStatusChange={(finalStatus: PropertyStatus) => update({ finalStatus })} onFollowUpChange={(followUp) => update({ followUp })}/></section>
          </main>
        </div>
      </div>
    </div>
  )
}
