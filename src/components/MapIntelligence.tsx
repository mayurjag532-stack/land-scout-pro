import { useState } from "react";
import { CapturedLocation, MapIntel, MapPoi } from "../types";
import { fetchMapIntel } from "../utils/overpass";
import { formatDistance, googleMapsSearchUrl } from "../utils/geo";
import MapView from "./MapView";

const QUICK_SEARCHES = [
  "Main Roads",
  "Highways",
  "Residential Societies",
  "Schools",
  "Colleges",
  "Gyms",
  "Badminton",
  "Pickleball",
  "Sports Clubs",
  "Turf",
  "Parking",
  "Petrol Pumps",
  "Restaurants",
  "Bus Stop"
];

function PoiList({ title, items, emptyLabel }: { title: string; items: MapPoi[]; emptyLabel: string }) {
  return (
    <div className="mb-4">
      <p className="text-field-text text-sm font-semibold mb-1">{title}</p>
      {items.length === 0 ? (
        <p className="text-field-muted text-xs italic">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 6).map((poi) => (
            <li key={poi.id} className="flex justify-between text-xs text-field-muted bg-field-panel rounded px-2 py-1">
              <span className="text-field-text truncate pr-2">{poi.name}</span>
              <span className="shrink-0">{formatDistance(poi.distanceMeters)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MapIntelligence({
  location,
  intel,
  onIntelUpdated
}: {
  location: CapturedLocation;
  intel: MapIntel;
  onIntelUpdated: (intel: MapIntel) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    const result = await fetchMapIntel(location.lat, location.lng, intel.radiusMeters || 1500);
    onIntelUpdated(result);
    setLoading(false);
  }

  const allPois: MapPoi[] = [
    ...(intel.nearestRoad ? [intel.nearestRoad] : []),
    ...intel.residential,
    ...intel.sports,
    ...intel.education,
    ...intel.access
  ];

  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-base mb-1">🧠 Map Intelligence</h3>
      <p className="text-field-muted text-sm mb-3">
        Auto-checks roads, residential areas, sports/fitness, schools, landmarks, food, parking, fuel and transport around the pin using OpenStreetMap data.
      </p>

      <button
        onClick={runAnalysis}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-field-panel border border-field-accent text-field-accent font-semibold disabled:opacity-60"
      >
        {loading ? "Analysing surroundings\u2026" : intel.status === "ok" ? "Re-run analysis" : "Run map analysis"}
      </button>

      {intel.status === "failed" && (
        <div className="mt-3 bg-field-bad/10 border border-field-bad/40 rounded-lg p-3">
          <p className="text-field-bad text-sm">{intel.errorMessage}</p>
        </div>
      )}

      {intel.status === "ok" && (
        <>
          <div className="mt-4">
            <MapView location={location} pois={allPois} recenterKey={intel.fetchedAt ?? 0} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <div className="bg-field-panel rounded-lg p-3 text-sm">
              <p className="text-field-text font-semibold">Roads</p>
              <p className="text-field-muted text-xs mt-1">
                Nearest mapped road:{" "}
                {intel.nearestRoad ? `${intel.nearestRoad.name} (${formatDistance(intel.nearestRoad.distanceMeters)}, approx. straight-line)` : "None found within search radius"}
              </p>
              <p className="text-field-muted text-xs mt-1">
                Nearest major road:{" "}
                {intel.nearestMajorRoad ? `${intel.nearestMajorRoad.name} (${formatDistance(intel.nearestMajorRoad.distanceMeters)})` : "None mapped within radius"}
              </p>
              <p className="text-field-muted text-xs mt-1">
                Nearest highway/arterial:{" "}
                {intel.nearestHighway ? `${intel.nearestHighway.name} (${formatDistance(intel.nearestHighway.distanceMeters)})` : "No mapped highway within radius \u2014 do not assume none exists, verify on-site."}
              </p>
            </div>

            <PoiList title="Residential / customer catchment" items={intel.residential} emptyLabel="No mapped residential features found within the searched radius." />
            <PoiList title="Sports / fitness" items={intel.sports} emptyLabel="No mapped sports/fitness facilities found within the searched radius." />
            <PoiList title="Schools / colleges" items={intel.education} emptyLabel="No mapped schools/colleges found within the searched radius." />
            <PoiList title="Access / convenience / food / landmarks" items={intel.access} emptyLabel="No mapped parking, fuel, transport, shops, restaurants, cafes or landmarks found within the searched radius." />
          </div>
        </>
      )}

      <div className="mt-4 border-t border-field-line pt-3">
        <p className="text-field-text text-sm font-semibold mb-2">Quick Google Maps search around this pin</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_SEARCHES.map((label) => (
            <a
              key={label}
              href={googleMapsSearchUrl(location.lat, location.lng, label)}
              target="_blank"
              rel="noreferrer"
              className="text-xs bg-field-panel border border-field-line text-field-text rounded-full px-3 py-1.5"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
