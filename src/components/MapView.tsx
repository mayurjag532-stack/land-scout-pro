import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import { CapturedLocation, MapPoi } from "../types";
import { googleMapsPointUrl } from "../utils/geo";

// Inline SVG avoids a separate marker-image request and keeps the field marker available offline.
const propertyIcon = L.divIcon({
  className: "plot-scout-marker",
  html: `<span aria-hidden="true"><svg viewBox="0 0 32 40" width="32" height="40"><path d="M16 1C8.27 1 2 7.27 2 15c0 10.4 14 24 14 24s14-13.6 14-24C30 7.27 23.73 1 16 1Z" fill="#F1F3F5" stroke="#0A0C0F" stroke-width="2"/><circle cx="16" cy="15" r="5" fill="#0A0C0F"/></svg></span>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);
  return null;
}

const CATEGORY_COLOR: Record<string, string> = {
  road: "#8B929C",
  residential: "#5EA8FF",
  sports: "#C77DFF",
  education: "#3FBD82",
  access: "#E0A937"
};

export default function MapView({
  location,
  pois = [],
  recenterKey
}: {
  location: CapturedLocation;
  pois?: MapPoi[];
  recenterKey?: number;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-field-line" style={{ height: 320 }}>
      <MapContainer center={[location.lat, location.lng]} zoom={16} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter key={recenterKey} lat={location.lat} lng={location.lng} />
        <Circle
          center={[location.lat, location.lng]}
          radius={location.accuracy ?? 30}
          pathOptions={{ color: "#5EA8FF", fillOpacity: 0.12 }}
        />
        <Marker position={[location.lat, location.lng]} icon={propertyIcon}>
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
            pathOptions={{ color: CATEGORY_COLOR[poi.category] ?? "#8B929C", fillOpacity: 0.7 }}
          >
            <Popup>
              <strong>{poi.name}</strong>
              <br />
              {poi.category} &middot; {Math.round(poi.distanceMeters)}m away
            </Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
