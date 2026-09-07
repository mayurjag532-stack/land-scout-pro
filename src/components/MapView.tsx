import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import { CapturedLocation, MapPoi } from "../types";
import { googleMapsPointUrl } from "../utils/geo";

// Default Leaflet marker icons don't resolve correctly under bundlers -
// point them at the CDN copies (leaflet.css is also loaded from the CDN).
const propertyIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);
  return null;
}

const CATEGORY_COLOR: Record<string, string> = {
  road: "#9AB0A0",
  residential: "#7CB88F",
  sports: "#E0B24B",
  education: "#5CAE7A",
  access: "#D96C5A"
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
          pathOptions={{ color: "#7CB88F", fillOpacity: 0.1 }}
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
            pathOptions={{ color: CATEGORY_COLOR[poi.category] ?? "#9AB0A0", fillOpacity: 0.7 }}
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
