import { useEffect, useRef, useState } from "react";
import { PropertyRecord, CapturedLocation, MapIntel, PriceData, PropertyPhoto, PropertyStatus } from "../types";
import { saveProperty } from "../db";
import PropertyHeader from "./PropertyHeader";
import LocationCapture from "./LocationCapture";
import PropertyIdentityPanel from "./PropertyIdentity";
import ParcelIntelligencePanel from "./ParcelIntelligence";
import MapIntelligence from "./MapIntelligence";
import SmartInspection from "./SmartInspection";
import PriceDataPanel from "./PriceData";
import PhotoEvidence from "./PhotoEvidence";
import NotesPanel from "./Notes";
import FinalStatusPanel from "./FinalStatus";
import { visitCompletion, visitSectionStates, sectionStateLabel } from "../utils/visitState";
import { canUse, Plan, PLAN_META } from "../entitlements";
import { BuyerProfile } from "../personalization";
import BuyerFitPanel from "./BuyerFitPanel";
import { computeScore } from "../utils/scoring";
import { beforeTokenDecision } from "../utils/decision";
import { DecisionTag, decisionTone } from "./ui/StatusTag";
import { ScoreRing } from "./ui/ScoreRing";

function ChecklistIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 7 1.5 1.5L8 6M4 14l1.5 1.5L8 13" /><path d="M11 7h9M11 14h9" /></svg>; }
function PinIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>; }
function CameraIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.2a1 1 0 0 0 .9-.5l.6-1a1 1 0 0 1 .9-.5h4.8a1 1 0 0 1 .9.5l.6 1a1 1 0 0 0 .9.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.2" /></svg>; }
function WarnIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a1.8 1.8 0 0 0 1.5 2.7h17.4a1.8 1.8 0 0 0 1.5-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>; }

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

  const completion = visitCompletion(property);
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
  const score = computeScore(property);
  const decision = beforeTokenDecision(property);
  const tone = decisionTone(decision.id);

  return (
    <div className="pb-16">
      <PropertyHeader property={property} onNameChange={(name) => update({ name })} onBack={leaveVisit} />
      <div className="ps-shell">
        <section className="ps-hero">
          <div className="relative z-10 flex items-start justify-between gap-5">
            <div><p className="ps-kicker">Field intelligence dossier</p><h1 className="ps-title">{property.name}</h1><p className="ps-sub">A decision workspace for what you see, verify and negotiate on the ground.</p></div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <DecisionTag id={decision.id} label={decision.shortLabel} />
                <p className="text-field-muted text-[11px] mt-1.5">Confidence {score.confidence}</p>
              </div>
              <ScoreRing value={score.total} tone={tone} size={56} strokeWidth={5} />
            </div>
          </div>
          <div className="ps-statgrid relative z-10">
            <div className="ps-stat"><span className="ps-stat-icon"><ChecklistIcon /></span><b>{completion}%</b><span>Visit complete</span></div>
            <div className="ps-stat"><span className="ps-stat-icon"><PinIcon /></span><b>{property.location ? "Locked" : "Pending"}</b><span>Location</span></div>
            <div className="ps-stat"><span className="ps-stat-icon"><CameraIcon /></span><b>{property.photos.length}</b><span>Evidence items</span></div>
            <div className="ps-stat"><span className={`ps-stat-icon ${score.criticalFlags.length ? "text-field-bad" : ""}`}><WarnIcon /></span><b className={score.criticalFlags.length ? "text-field-bad" : ""}>{score.criticalFlags.length || "None"}</b><span>Critical flags</span></div>
          </div>
          <div className="relative z-10 flex items-center gap-2 mt-3">
            <span className={`w-1.5 h-1.5 rounded-full ${saveState === "saved" ? "bg-field-good" : saveState === "saving" ? "bg-field-accent" : saveState === "error" ? "bg-field-bad" : "bg-field-muted"}`} />
            <p className="text-field-muted text-[11px]">{saveState === "saved" ? "Saved to this device" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed — will retry" : "Stored locally"}</p>
          </div>
        </section>
        <div className="ps-workspace">
          <aside className="ps-rail"><p className="ps-kicker px-3 pt-2 pb-3">Visit navigator</p>{sections.map((section,i)=><a key={section.id} href={`#${section.id}`} title={sectionStateLabel[section.state]} className={justReady.has(section.id)?"ps-just-ready":""}><span className="ps-rail-index">{i+1}</span><span className={`ps-dot ps-state-${section.state.toLowerCase().replace("_","-")}`}/><span className="flex-1">{section.label}</span><small className="ps-rail-state">{sectionStateLabel[section.state]}</small></a>)}</aside>
          <main className="ps-content">
            <section id="identity" className="ps-section"><div className="ps-section-label">01 · Property identity</div><PropertyIdentityPanel identity={property.identity} onChange={(identity) => update({ identity })} /><ParcelIntelligencePanel identity={property.identity} fieldLocation={property.location} value={property.parcelIntel} onChange={(parcelIntel) => update({ parcelIntel })} /></section>
            <section id="location" className="ps-section"><div className="ps-section-label">02 · Position & surroundings</div><LocationCapture location={property.location} onCaptured={(location: CapturedLocation) => update({ location })} />
            {property.location && (canUse(plan,"map_intelligence") ? <MapIntelligence location={property.location} intel={property.mapIntel} onIntelUpdated={(mapIntel: MapIntel) => update({ mapIntel })} /> : <div className="bg-field-card border border-field-line rounded-xl p-5 mt-4"><div className="flex items-start justify-between gap-3"><div><p className="text-field-text font-semibold">Map Intelligence</p><p className="text-field-muted text-xs mt-1">Nearby roads, access and mapped activity.</p></div><span className="tier-lock">{PLAN_META.ADVANCED.name}</span></div></div>)}</section>
            <section id="ground" className="ps-section"><div className="ps-section-label">03 · Smart field inspection</div><SmartInspection property={property} onAnswer={(id, value) => update({ ownerAnswers: { ...property.ownerAnswers, [id]: value } })} onNotesChange={(site) => update({ notes: { ...property.notes, site } })}/></section>
            <section id="economics" className="ps-section"><div className="ps-section-label">04 · Deal economics</div><PriceDataPanel price={property.price} onChange={(price: PriceData) => update({ price })}/></section>
            <section id="evidence" className="ps-section"><div className="ps-section-label">05 · Evidence vault</div><PhotoEvidence photos={property.photos} onAdd={(photo: PropertyPhoto) => update({ photos: [...property.photos, photo] })} onRemove={(id) => update({ photos: property.photos.filter((p) => p.id !== id) })} onUpdate={(id, patch) => update({ photos: property.photos.map((p) => p.id === id ? { ...p, ...patch } : p) })}/><div className="mt-4"><NotesPanel owner={property.notes.owner} general={property.notes.general} onOwnerChange={(owner) => update({ notes: { ...property.notes, owner } })} onGeneralChange={(general) => update({ notes: { ...property.notes, general } })}/></div></section>
            <section id="decision" className="ps-section"><div className="ps-section-label">06 · Decision room</div><BuyerFitPanel property={property} profile={buyerProfile}/><FinalStatusPanel property={property} onStatusChange={(finalStatus: PropertyStatus) => update({ finalStatus })} onFollowUpChange={(followUp) => update({ followUp })}/></section>
          </main>
        </div>
      </div>
    </div>
  )
}
