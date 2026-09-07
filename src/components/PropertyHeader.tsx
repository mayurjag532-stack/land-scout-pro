import { PropertyRecord } from "../types";
import { googleMapsPointUrl } from "../utils/geo";
import { exportPropertyJson, exportPropertyCsv, printPropertyReport } from "../utils/export";

export default function PropertyHeader({
  property,
  onNameChange,
  onBack
}: {
  property: PropertyRecord;
  onNameChange: (name: string) => void;
  onBack: () => void;
}) {
  async function share() {
    const loc = property.location;
    const text = `${property.name}${loc ? ` - ${googleMapsPointUrl(loc.lat, loc.lng)}` : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: property.name, text });
      } catch {
        // user cancelled share sheet - no action needed
      }
    } else if (loc) {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard (share not supported on this browser).");
    }
  }

  return (
    <div className="sticky top-0 z-10 bg-field-bg/95 backdrop-blur border-b border-field-line px-4 py-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-field-muted text-sm px-2 py-1" aria-label="Back">
          ← Back
        </button>
        <input
          value={property.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="flex-1 bg-transparent text-field-text font-semibold text-lg outline-none"
        />
      </div>
      <div className="flex gap-2 mt-2 overflow-x-auto">
        {property.location && (
          <>
            <a
              href={googleMapsPointUrl(property.location.lat, property.location.lng)}
              target="_blank"
              rel="noreferrer"
              className="text-xs bg-field-panel border border-field-line text-field-text rounded-full px-3 py-1.5 whitespace-nowrap"
            >
              Open in Google Maps
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(`${property.location!.lat},${property.location!.lng}`)}
              className="text-xs bg-field-panel border border-field-line text-field-text rounded-full px-3 py-1.5 whitespace-nowrap"
            >
              Copy coordinates
            </button>
            <button onClick={share} className="text-xs bg-field-panel border border-field-line text-field-text rounded-full px-3 py-1.5 whitespace-nowrap">
              Share
            </button>
          </>
        )}
        <button
          onClick={() => exportPropertyJson(property)}
          className="text-xs bg-field-panel border border-field-line text-field-text rounded-full px-3 py-1.5 whitespace-nowrap"
        >
          Export JSON
        </button>
        <button
          onClick={() => exportPropertyCsv(property)}
          className="text-xs bg-field-panel border border-field-line text-field-text rounded-full px-3 py-1.5 whitespace-nowrap"
        >
          Export CSV
        </button>
        <button
          onClick={() => printPropertyReport(property)}
          className="text-xs bg-field-panel border border-field-line text-field-text rounded-full px-3 py-1.5 whitespace-nowrap"
        >
          Print report
        </button>
      </div>
    </div>
  );
}
