import { MapContainer, Marker, Circle, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import { CapturedLocation, MapPoi } from "../types";
import { googleMapsPointUrl } from "../utils/geo";
import { getBasemap } from "../utils/basemap";
import BasemapSwitcher from "./BasemapSwitcher";

// Calm, muted basemap: cartographic clarity without visual noise, so property
// markers, selection and intelligence overlays stay the loudest thing on screen.
export const CALM_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
export const CALM_TILE_URL_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
/* Esri World Imagery — real satellite/aerial tiles, no API key required. */
export const SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
/* Esri reference overlay — boundaries, places and road labels for Hybrid mode. */
export const HYBRID_REF_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
export const CALM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
export const SATELLITE_ATTRIBUTION =
  'Imagery &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics';

/** Returns the basemap URL matching the current theme. */
export function calmTileUrl(): string {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark") {
    return CALM_TILE_URL_DARK;
  }
  return CALM_TILE_URL;
}

// Editorial field marker — forest pin, ivory core. Inline SVG keeps it
// available offline with no extra request.
const propertyIcon = L.divIcon({
  className: "plot-scout-marker",
  html: `<span aria-hidden="true"><svg viewBox="0 0 32 40" width="30" height="38"><path d="M16 1C8.27 1 2 7.27 2 15c0 10.4 14 24 14 24s14-13.6 14-24C30 7.27 23.73 1 16 1Z" fill="#263D30" stroke="#F7F3EC" stroke-width="2"/><circle cx="16" cy="15" r="5" fill="#F7F3EC"/></svg></span>`,
  iconSize: [30, 38],
  iconAnchor: [15, 38]
});

function Recenter({ lat, lng, smooth }: { lat: number; lng: number; smooth?: boolean }) {
  const map = useMap();
  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (smooth && !reduced) map.panTo([lat, lng], { animate: true, duration: 0.56 });
    else map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);
  return null;
}

/** Basemap layer: themed CARTO vector-style tiles, Esri satellite imagery, or
 *  hybrid (imagery + reference labels). Reacts to theme and basemap changes. */
export function ThemeTiles() {
  const map = useMap();
  useEffect(() => {
    const base = L.tileLayer(calmTileUrl(), { attribution: CALM_ATTRIBUTION, maxZoom: 20 });
    const sat = L.tileLayer(SATELLITE_TILE_URL, { attribution: SATELLITE_ATTRIBUTION, maxZoom: 19 });
    const ref = L.tileLayer(HYBRID_REF_URL, { maxZoom: 19 });
    let active: L.TileLayer[] = [];
    const apply = () => {
      const b = getBasemap();
      const dark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
      for (const l of active) map.removeLayer(l);
      if (b === "satellite") {
        sat.addTo(map); active = [sat];
      } else if (b === "hybrid") {
        sat.addTo(map); ref.addTo(map); active = [sat, ref];
      } else {
        base.setUrl(dark ? CALM_TILE_URL_DARK : CALM_TILE_URL);
        base.addTo(map); active = [base];
      }
    };
    apply();
    const onBasemap = () => apply();
    const onTheme = () => { if (getBasemap() === "map") apply(); };
    window.addEventListener("plot-scout-basemap-change", onBasemap);
    window.addEventListener("plot-scout-theme-change", onTheme);
    return () => {
      window.removeEventListener("plot-scout-basemap-change", onBasemap);
      window.removeEventListener("plot-scout-theme-change", onTheme);
      for (const l of active) map.removeLayer(l);
    };
  }, [map]);
  return null;
}

// POI category colours tuned for the light basemap — quiet fills, readable strokes.
export const CATEGORY_COLOR: Record<string, string> = {
  road: "#706E68",
  residential: "#263D30",
  sports: "#B9955A",
  education: "#2E7D4F",
  access: "#8A5F1E"
};

export default function MapView({
  location,
  pois = [],
  recenterKey,
  height = 320,
  interactive = true
}: {
  location: CapturedLocation;
  pois?: MapPoi[];
  recenterKey?: number;
  height?: number;
  interactive?: boolean;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-field-line relative" style={{ height }}>
      <MapContainer
        center={[location.lat, location.lng]}
        zoom={16}
        style={{ height: "100%", width: "100%" }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        attributionControl
      >
        <ThemeTiles />
        <Recenter key={recenterKey} lat={location.lat} lng={location.lng} />
        <Circle
          center={[location.lat, location.lng]}
          radius={location.accuracy ?? 30}
          pathOptions={{ color: "#263D30", weight: 1.5, fillColor: "#263D30", fillOpacity: 0.08 }}
        />
        <Marker position={[location.lat, location.lng]} icon={propertyIcon} keyboard={interactive}>
          <Popup>
            Property location<br />
            <a href={googleMapsPointUrl(location.lat, location.lng)} target="_blank" rel="noreferrer">
              Open in Google Maps
            </a>
          </Popup>
        </Marker>
        {pois.map((poi) => (
          <Circle
            key={poi.id}
            center={[poi.lat, poi.lng]}
            radius={12}
            pathOptions={{
              color: CATEGORY_COLOR[poi.category] ?? "#706E68",
              weight: 1.5,
              fillColor: CATEGORY_COLOR[poi.category] ?? "#706E68",
              fillOpacity: 0.35
            }}
          >
            <Popup>
              <strong>{poi.name}</strong>
              <br />
              {poi.category} &middot; {Math.round(poi.distanceMeters)}m away
            </Popup>
          </Circle>
        ))}
      </MapContainer>
      {interactive && (
        <div className="absolute right-2 bottom-2 z-[500]">
          <BasemapSwitcher />
        </div>
      )}
    </div>
  );
}
