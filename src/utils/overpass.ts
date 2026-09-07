import { MapIntel, MapPoi, emptyMapIntel } from "../types";
import { distanceMeters } from "./geo";

// Public Overpass mirrors. We try the first, then fall back if it fails
// (rate limits / downtime are common on the free instance).
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const MAJOR_HIGHWAY_TYPES = new Set(["motorway", "trunk", "primary"]);
const MAJOR_ROAD_TYPES = new Set(["motorway", "trunk", "primary", "secondary"]);
const ROAD_TYPES = [
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
  "living_street",
  "service"
];

function buildQuery(lat: number, lng: number, radius: number): string {
  return `[out:json][timeout:25];(
  way(around:${radius},${lat},${lng})[highway];
  nwr(around:${radius},${lat},${lng})[amenity~"^(school|college)$"];
  nwr(around:${radius},${lat},${lng})[leisure~"^(fitness_centre|sports_centre|pitch|stadium)$"];
  nwr(around:${radius},${lat},${lng})[sport~"^(badminton|pickleball)$"];
  nwr(around:${radius},${lat},${lng})[landuse=residential];
  nwr(around:${radius},${lat},${lng})[place~"^(residential|neighbourhood|suburb)$"];
  nwr(around:${radius},${lat},${lng})[building~"^(residential|apartments)$"];
  nwr(around:${radius},${lat},${lng})[amenity~"^(parking|fuel|restaurant|cafe)$"];
  nwr(around:${radius},${lat},${lng})[shop];
  nwr(around:${radius},${lat},${lng})[highway~"^(bus_stop|platform)$"];
  nwr(around:${radius},${lat},${lng})[amenity=bus_station];
  nwr(around:${radius},${lat},${lng})[public_transport~"^(station|platform|stop_position)$"];
  nwr(around:${radius},${lat},${lng})[railway~"^(station|halt|tram_stop|subway_entrance)$"];
  nwr(around:${radius},${lat},${lng})[tourism~"^(attraction|museum|viewpoint|gallery)$"];
  nwr(around:${radius},${lat},${lng})[historic];
);out center tags;`;
}

async function runQuery(query: string): Promise<OverpassResponse> {
  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
      return (await res.json()) as OverpassResponse;
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  throw lastError ?? new Error("All Overpass endpoints failed");
}

function elementLatLng(el: OverpassElement): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function toPoi(el: OverpassElement, lat: number, lng: number, category: string, name: string): MapPoi | null {
  const pos = elementLatLng(el);
  if (!pos) return null;
  return {
    id: `${el.type}/${el.id}`,
    name,
    category,
    lat: pos.lat,
    lng: pos.lng,
    distanceMeters: distanceMeters(lat, lng, pos.lat, pos.lng),
    roadType: el.tags?.highway
  };
}

export async function fetchMapIntel(lat: number, lng: number, radius: number): Promise<MapIntel> {
  const intel = emptyMapIntel();
  intel.radiusMeters = radius;
  intel.status = "loading";

  try {
    const data = await runQuery(buildQuery(lat, lng, radius));

    const roads: MapPoi[] = [];
    const residential: MapPoi[] = [];
    const sports: MapPoi[] = [];
    const education: MapPoi[] = [];
    const access: MapPoi[] = [];

    for (const el of data.elements) {
      const tags = el.tags ?? {};
      const name =
        tags.name ||
        tags["addr:street"] ||
        (tags.highway ? `Unnamed ${tags.highway.replace(/_/g, " ")} road` : "Unnamed location");

      if (tags.highway && ROAD_TYPES.includes(tags.highway)) {
        const poi = toPoi(el, lat, lng, "road", name);
        if (poi) roads.push(poi);
        continue;
      }
      if (tags.amenity === "school" || tags.amenity === "college") {
        const poi = toPoi(el, lat, lng, "education", name || (tags.amenity === "school" ? "School" : "College"));
        if (poi) education.push(poi);
        continue;
      }
      if (
        tags.leisure === "fitness_centre" ||
        tags.sport === "badminton" ||
        tags.sport === "pickleball" ||
        tags.leisure === "sports_centre" ||
        tags.leisure === "pitch" ||
        tags.leisure === "stadium"
      ) {
        const poi = toPoi(el, lat, lng, "sports", name || "Sports facility");
        if (poi) sports.push(poi);
        continue;
      }
      if (tags.landuse === "residential" || tags.building === "residential" || tags.building === "apartments") {
        const poi = toPoi(el, lat, lng, "residential", name || "Residential area");
        if (poi) residential.push(poi);
        continue;
      }
      if (
        tags.amenity === "parking" ||
        tags.amenity === "fuel" ||
        tags.shop ||
        tags.highway === "bus_stop" ||
        tags.amenity === "bus_station" ||
        tags.amenity === "restaurant" ||
        tags.amenity === "cafe" ||
        tags.tourism === "attraction" ||
        tags.tourism === "museum" ||
        tags.tourism === "viewpoint" ||
        tags.historic ||
        tags.railway === "station" ||
        tags.railway === "halt" ||
        tags.public_transport === "station"
      ) {
        const cat =
          tags.amenity === "parking"
            ? "Parking"
            : tags.amenity === "fuel"
            ? "Petrol pump"
            : tags.amenity === "restaurant"
            ? "Restaurant"
            : tags.amenity === "cafe"
            ? "Cafe"
            : tags.tourism === "attraction" || tags.tourism === "museum" || tags.tourism === "viewpoint" || tags.historic
            ? "Landmark / point of interest"
            : tags.railway === "station" || tags.railway === "halt"
            ? "Train station"
            : tags.public_transport === "station" || tags.highway === "bus_stop" || tags.amenity === "bus_station"
            ? "Public transport"
            : "Shop / commercial";
        const poi = toPoi(el, lat, lng, "access", name || cat);
        if (poi) access.push({ ...poi, category: cat });
        continue;
      }
    }

    roads.sort((a, b) => a.distanceMeters - b.distanceMeters);
    residential.sort((a, b) => a.distanceMeters - b.distanceMeters);
    sports.sort((a, b) => a.distanceMeters - b.distanceMeters);
    education.sort((a, b) => a.distanceMeters - b.distanceMeters);
    access.sort((a, b) => a.distanceMeters - b.distanceMeters);

    intel.nearestRoad = roads[0] ?? null;
    intel.nearestMajorRoad = roads.find((r) => r.roadType && MAJOR_ROAD_TYPES.has(r.roadType)) ?? null;
    intel.nearestHighway = roads.find((r) => r.roadType && MAJOR_HIGHWAY_TYPES.has(r.roadType)) ?? null;
    intel.residential = residential.slice(0, 15);
    intel.sports = sports.slice(0, 15);
    intel.education = education.slice(0, 15);
    intel.access = access.slice(0, 20);
    intel.status = "ok";
    intel.fetchedAt = Date.now();
    return intel;
  } catch (err) {
    intel.status = "failed";
    intel.errorMessage =
      err instanceof Error
        ? `Map intelligence lookup failed: ${err.message}. Check internet connection and retry.`
        : "Map intelligence lookup failed. Check internet connection and retry.";
    return intel;
  }
}
