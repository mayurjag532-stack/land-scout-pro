import { useEffect, useRef, useState } from "react";
import { PropertyRecord, CapturedLocation, MapIntel, PriceData, PropertyPhoto, PropertyStatus } from "../types";
import { saveProperty } from "../db";
import PropertyHeader from "./PropertyHeader";
import LocationCapture from "./LocationCapture";
import MapIntelligence from "./MapIntelligence";
import SiteChecklist from "./SiteChecklist";
import OwnerQuestionsPanel from "./OwnerQuestions";
import PriceDataPanel from "./PriceData";
import PhotoEvidence from "./PhotoEvidence";
import NotesPanel from "./Notes";
import FinalStatusPanel from "./FinalStatus";

export default function NewVisit({
  initial,
  onBack
}: {
  initial: PropertyRecord;
  onBack: () => void;
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

  function update(patch: Partial<PropertyRecord>) {
    setProperty((p) => ({ ...p, ...patch }));
  }

  return (
    <div className="pb-10">
      <PropertyHeader property={property} onNameChange={(name) => update({ name })} onBack={onBack} />

      <div className="px-4 py-4 space-y-4 max-w-xl mx-auto">
        <div className="flex justify-end">
          <span className="text-[11px] text-field-muted">
            {saveState === "saving" && "Saving..."}
            {saveState === "saved" && "All changes saved on this device"}
            {saveState === "error" && "Save failed - check device storage"}
          </span>
        </div>

        <LocationCapture
          location={property.location}
          onCaptured={(location: CapturedLocation) => update({ location })}
        />

        {property.location && (
          <MapIntelligence
            location={property.location}
            intel={property.mapIntel}
            onIntelUpdated={(mapIntel: MapIntel) => update({ mapIntel })}
          />
        )}

        <SiteChecklist
          checklist={property.checklist}
          onChange={(id, value) => update({ checklist: { ...property.checklist, [id]: value } })}
          notes={property.notes.site}
          onNotesChange={(site) => update({ notes: { ...property.notes, site } })}
        />

        <OwnerQuestionsPanel
          answers={property.ownerAnswers}
          onChange={(id, value) => update({ ownerAnswers: { ...property.ownerAnswers, [id]: value } })}
          notes={property.notes.owner}
          onNotesChange={(owner) => update({ notes: { ...property.notes, owner } })}
        />

        <PriceDataPanel price={property.price} onChange={(price: PriceData) => update({ price })} />

        <PhotoEvidence
          photos={property.photos}
          onAdd={(photo: PropertyPhoto) => update({ photos: [...property.photos, photo] })}
          onRemove={(id) => update({ photos: property.photos.filter((p) => p.id !== id) })}
        />

        <NotesPanel general={property.notes.general} onGeneralChange={(general) => update({ notes: { ...property.notes, general } })} />

        <FinalStatusPanel
          property={property}
          onStatusChange={(finalStatus: PropertyStatus) => update({ finalStatus })}
          onFollowUpChange={(followUp) => update({ followUp })}
        />
      </div>
    </div>
  );
}
