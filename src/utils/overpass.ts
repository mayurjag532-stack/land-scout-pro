import { MapIntel, MapPoi, emptyMapIntel } from "../types";
import { distanceMeters } from "./geo";

// Public Overpass mirrors, tried strictly one after another (never in parallel,
// never retried in a tight loop). If a mirror is rate-limited, overloaded or
// unreachable we move to the next one. The same-origin proxy is the last
// resort: it is only reached when every direct browser call has failed, and
// it forwards the query only (no property data, no storage, no logging).
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
const PROXY_ENDPOINT = "/api/overpass-proxy";

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

type MapIntelErrorKind = "timeout" | "network" | "http" | "invalid" | "cancelled";

class MapIntelError extends Error {
  kind: MapIntelErrorKind;
  status?: number;
  constructor(kind: MapIntelErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.name = "MapIntelError";
  }
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

// Road/highway distance feeds scoring buckets out to 2000m (see scoring.ts),
// so roads keep the full requested radius. Every other category only ever
// needs to answer "is there relevant infrastructure nearby" (a capped count
// in scoring, a top-6 list in the UI) — a much smaller radius answers that
// just as well while cutting the scanned area by roughly 70%, which is the
// dominant cost driver for this query on the free Overpass mirrors.
const POI_RADIUS_CAP = 800;

function buildQuery(lat: number, lng: number, radius: number): string {
  const poiRadius = Math.min(radius, POI_RADIUS_CAP);
  return `[out:json][timeout:15];(
  way(around:${radius},${lat},${lng})[highway];
  nwr(around:${poiRadius},${lat},${lng})[amenity~"^(school|college)$"];
  nwr(around:${poiRadius},${lat},${lng})[leisure~"^(fitness_centre|sports_centre|pitch|stadium)$"];
  nwr(around:${poiRadius},${lat},${lng})[landuse=residential];
  nwr(around:${poiRadius},${lat},${lng})[place~"^(residential|neighbourhood|suburb)$"];
  nwr(around:${poiRadius},${lat},${lng})[amenity~"^(parking|fuel|restaurant|cafe)$"];
  nwr(around:${poiRadius},${lat},${lng})[shop];
  nwr(around:${poiRadius},${lat},${lng})[amenity=bus_station];
  nwr(around:${poiRadius},${lat},${lng})[public_transport~"^(station|platform|stop_position)$"];
  nwr(around:${poiRadius},${lat},${lng})[railway~"^(station|halt|tram_stop|subway_entrance)$"];
  nwr(around:${poiRadius},${lat},${lng})[tourism~"^(attraction|museum|viewpoint|gallery)$"];
  nwr(around:${poiRadius},${lat},${lng})[historic];
);out center tags;`;
}

// Per-attempt abort budget plus an overall ceiling so that walking through
// every mirror can never leave the user staring at a spinner for minutes.
const ATTEMPT_TIMEOUT_MS = 14_000;
const TOTAL_BUDGET_MS = 45_000;
const MIN_ATTEMPT_MS = 3_000;
const BETWEEN_ATTEMPTS_MS = 400;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_PREFIX = "plot-scout:map-intel:v1:";

function cacheKey(lat: number, lng: number, radius: number): string {
  return `${CACHE_PREFIX}${lat.toFixed(4)}:${lng.toFixed(4)}:${Math.round(radius / 100) * 100}`;
}

function readCache(key: string): MapIntel | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; intel: MapIntel };
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
    return parsed.intel;
  } catch { return null; }
}

function writeCache(key: string, intel: MapIntel): void {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), intel }));
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length > 12) keys.slice(0, keys.length - 12).forEach((k) => localStorage.removeItem(k));
  } catch { /* Cache failure must never block field work. */ }
}

function devLog(endpoint: string, outcome: string): void {
  // Development-only diagnostics: which endpoint, and what happened.
  if (import.meta.env.DEV) console.debug(`[map-intel] ${endpoint} -> ${outcome}`);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = window.setTimeout(done, ms);
    function done() { window.clearTimeout(t); signal?.removeEventListener("abort", done); resolve(); }
    signal?.addEventListener("abort", done, { once: true });
  });
}

// One request to one endpoint. Always throws a MapIntelError (or returns data).
async function attempt(url: string, init: RequestInit, timeoutMs: number, externalSignal?: AbortSignal): Promise<OverpassResponse> {
  if (externalSignal?.aborted) throw new MapIntelError("cancelled", "Map analysis cancelled");
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } catch (fetchErr) {
      if (externalSignal?.aborted) throw new MapIntelError("cancelled", "Map analysis cancelled");
      if (timedOut) throw new MapIntelError("timeout", "The map service did not respond in time.");
      // The browser hides the reason (offline / DNS / CORS / blocked) behind a bare TypeError.
      throw new MapIntelError("network", fetchErr instanceof Error ? fetchErr.message : "Request could not be sent.");
    }
    if (!res.ok) throw new MapIntelError("http", `Map service returned status ${res.status}.`, res.status);
    let data: OverpassResponse & { remark?: string };
    try {
      data = (await res.json()) as OverpassResponse & { remark?: string };
    } catch (parseErr) {
      if (externalSignal?.aborted) throw new MapIntelError("cancelled", "Map analysis cancelled");
      if (timedOut) throw new MapIntelError("timeout", "The map service did not respond in time.");
      throw new MapIntelError("invalid", "Map service returned a response that could not be read.");
    }
    if (!data || !Array.isArray(data.elements)) throw new MapIntelError("invalid", "Map service returned an unexpected response.");
    // Overpass answers HTTP 200 with a "runtime error" remark (and partial or empty
    // elements) when a query times out or runs out of memory. That is a failure, not an empty result.
    if (typeof data.remark === "string" && /runtime error|out of memory|timed out/i.test(data.remark)) {
      throw new MapIntelError("http", "Map service was overloaded and returned incomplete data.", 200);
    }
    return data;
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function runQuery(query: string, externalSignal?: AbortSignal): Promise<OverpassResponse> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new MapIntelError("network", "offline");
  }
  const started = Date.now();
  const failures: MapIntelError[] = [];

  const targets: { label: string; url: string; init: RequestInit }[] = [
    ...OVERPASS_ENDPOINTS.map((url) => ({
      label: new URL(url).host,
      url,
      init: {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      } as RequestInit
    })),
    {
      label: "same-origin proxy",
      url: PROXY_ENDPOINT,
      init: {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" }
      }
    }
  ];

  for (let i = 0; i < targets.length; i++) {
    if (externalSignal?.aborted) throw new MapIntelError("cancelled", "Map analysis cancelled");
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < MIN_ATTEMPT_MS) break;
    const target = targets[i];
    try {
      const data = await attempt(target.url, target.init, Math.min(ATTEMPT_TIMEOUT_MS, remaining), externalSignal);
      devLog(target.label, `ok (${data.elements.length} elements)`);
      return data;
    } catch (err) {
      const e = err instanceof MapIntelError ? err : new MapIntelError("network", "Request failed.");
      if (e.kind === "cancelled") throw e;
      devLog(target.label, `${e.kind}${e.status ? ` ${e.status}` : ""}`);
      failures.push(e);
      if (i < targets.length - 1) await sleep(BETWEEN_ATTEMPTS_MS, externalSignal);
    }
  }
  if (externalSignal?.aborted) throw new MapIntelError("cancelled", "Map analysis cancelled");

  // Report the most informative failure: a server that answered badly beats a
  // timeout, which beats "could not connect at all".
  const pick = (k: MapIntelErrorKind) => failures.find((f) => f.kind === k);
  throw pick("http") ?? pick("invalid") ?? pick("timeout") ?? pick("network") ?? new MapIntelError("network", "No map service could be reached.");
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
    roadType: el.tags?.highway,
    source: "OpenStreetMap",
    confidence: el.tags?.name ? "high" : "medium"
  };
}

function cleanPois(items: MapPoi[]): MapPoi[] {
  const out: MapPoi[] = [];
  for (const poi of items) {
    const generic = /^Unnamed location$/i.test(poi.name.trim());
    if (generic) continue;
    const keyName = poi.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const duplicate = out.some((x) => {
      const other = x.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return keyName === other && Math.abs(x.distanceMeters - poi.distanceMeters) < 80;
    });
    if (!duplicate) out.push(poi);
  }
  return out;
}

export async function fetchMapIntel(lat: number, lng: number, radius: number, signal?: AbortSignal, forceRefresh = false): Promise<MapIntel> {
  const key = cacheKey(lat, lng, radius);
  if (!forceRefresh) { const cached = readCache(key); if (cached) return cached; }
  const intel = emptyMapIntel();
  intel.radiusMeters = radius;
  intel.status = "loading";

  try {
    const data = await runQuery(buildQuery(lat, lng, radius), signal);

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
    intel.residential = cleanPois(residential).slice(0, 15);
    intel.sports = cleanPois(sports).slice(0, 15);
    intel.education = cleanPois(education).slice(0, 15);
    intel.access = cleanPois(access).slice(0, 20);
    intel.status = "ok";
    intel.fetchedAt = Date.now();
    writeCache(key, intel);
    return intel;
  } catch (err) {
    // A cancelled run is not a failure: leave the record untouched (the UI ignores aborted results).
    if (err instanceof MapIntelError && err.kind === "cancelled") { intel.status = "not_run"; return intel; }
    // Failed responses are never cached (writeCache only runs on success above).
    intel.status = "failed";
    intel.errorMessage = describeMapIntelError(err);
    return intel;
  }
}

function describeMapIntelError(err: unknown): string {
  // Plain-language messages only: no status codes, hostnames or raw browser errors reach the user.
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (err instanceof MapIntelError) {
    switch (err.kind) {
      case "timeout":
        return "The free map service is responding slowly right now. Try again in a minute.";
      case "http":
        return "The free map service is busy or temporarily unavailable. This is not your connection or your saved data \u2014 try again in a minute.";
      case "invalid":
        return "The map service sent back something Plot Scout couldn\u2019t read. Try again shortly.";
      case "network":
      default:
        return offline
          ? "You appear to be offline. Map analysis needs internet \u2014 your saved location and notes are safe. Retry when you\u2019re back online."
          : "Couldn\u2019t reach the map service. Check your internet connection and retry. Your saved location and notes are unaffected.";
      case "cancelled":
        return "Map analysis was cancelled.";
    }
  }
  return "Map analysis couldn\u2019t complete. Please retry.";
}
