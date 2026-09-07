export type LocationSource = "gps" | "maps_url" | "manual";

export interface CapturedLocation {
  lat: number;
  lng: number;
  accuracy: number | null; // metres, null if unknown (e.g. pasted link)
  timestamp: number;
  source: LocationSource;
}

export interface MapPoi {
  id: string;
  name: string;
  category: string; // e.g. "school", "gym", "residential", "road"
  lat: number;
  lng: number;
  distanceMeters: number;
  roadType?: string; // for roads: e.g. "residential", "primary", "trunk"
}

export type MapIntelStatus = "not_run" | "loading" | "ok" | "partial" | "failed";

export interface MapIntel {
  status: MapIntelStatus;
  fetchedAt: number | null;
  radiusMeters: number;
  nearestRoad: MapPoi | null;
  nearestMajorRoad: MapPoi | null;
  nearestHighway: MapPoi | null;
  residential: MapPoi[];
  sports: MapPoi[];
  education: MapPoi[];
  access: MapPoi[]; // parking, petrol pumps, landmarks, commercial, transport
  errorMessage: string | null;
}

export const CHECKLIST_ITEMS: { id: string; label: string }[] = [
  { id: "main_road_practical", label: "Main road / highway location practical" },
  { id: "approach_car_friendly", label: "Approach road is car-friendly" },
  { id: "plot_size_target", label: "Plot approximately 3\u20134 guntha target" },
  { id: "plot_shape_ok", label: "Plot shape is reasonably rectangular/square" },
  { id: "land_flat", label: "Land is reasonably flat" },
  { id: "no_waterlogging", label: "No obvious waterlogging" },
  { id: "no_nala_issue", label: "No obvious nala/problem area" },
  { id: "parking_practical", label: "Parking appears practical" },
  { id: "electricity_accessible", label: "Electricity appears accessible" },
  { id: "water_available", label: "Water appears practically available" },
  { id: "residential_catchment", label: "Nearby residential customer catchment" },
  { id: "sports_activity_nearby", label: "Nearby sports/gym/turf/badminton activity" },
  { id: "area_active", label: "Area feels active" },
  { id: "area_safe_evening", label: "Area feels reasonably safe in evening" },
  { id: "commercially_practical", label: "Overall location feels commercially practical" }
];

export type ChecklistState = Record<string, boolean | null>; // null = not answered

export const OWNER_QUESTIONS: { id: string; text: string }[] = [
  { id: "q_own_property", text: "Ye land aapki own property hai?" },
  { id: "q_gat_survey_no", text: "Gat Number / Survey Number kya hai?" },
  { id: "q_exact_area", text: "Exact area kitna hai?" },
  { id: "q_712_papers", text: "7/12 aur property papers available hain?" },
  { id: "q_na_or_agri", text: "Land NA hai ya agricultural?" },
  { id: "q_current_zone", text: "Current zone kya hai?" },
  { id: "q_road_legal", text: "Road papers mein legally show hota hai?" },
  { id: "q_loan_dispute", text: "Loan, mortgage ya legal dispute toh nahi?" },
  { id: "q_final_price", text: "Final price expectation kya hai?" },
  { id: "q_extra_charges", text: "Registration / brokerage / other charges alag hain?" }
];

export type OwnerAnswers = Record<string, string>;

export type PhotoCategory =
  | "front_road"
  | "plot"
  | "left_side"
  | "right_side"
  | "rear"
  | "surrounding"
  | "access_road"
  | "documents";

export interface PropertyPhoto {
  id: string;
  category: PhotoCategory;
  dataUrl: string;
  addedAt: number;
}

export interface PriceData {
  quotedPrice: number | null;
  askingPrice: number | null;
  areaSqft: number | null;
  areaGuntha: number | null;
  roadWidthFt: number | null;
  mainRoadDistanceM: number | null;
}

export type PropertyStatus = "STRONG" | "INVESTIGATE" | "REJECT" | "UNDECIDED";

export interface ScoreBreakdown {
  location: number;
  access: number;
  catchment: number;
  sportsEcosystem: number;
  sitePracticality: number;
  priceDataCompleteness: number;
}

export interface Score {
  total: number; // 0-100
  breakdown: ScoreBreakdown;
  status: PropertyStatus;
  explanation: string[];
}

export interface PropertyRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  location: CapturedLocation | null;
  mapIntel: MapIntel;
  checklist: ChecklistState;
  ownerAnswers: OwnerAnswers;
  price: PriceData;
  notes: {
    site: string;
    owner: string;
    general: string;
  };
  photos: PropertyPhoto[];
  finalStatus: PropertyStatus;
  followUp: string;
}

export function emptyMapIntel(): MapIntel {
  return {
    status: "not_run",
    fetchedAt: null,
    radiusMeters: 1500,
    nearestRoad: null,
    nearestMajorRoad: null,
    nearestHighway: null,
    residential: [],
    sports: [],
    education: [],
    access: [],
    errorMessage: null
  };
}

export function emptyPrice(): PriceData {
  return {
    quotedPrice: null,
    askingPrice: null,
    areaSqft: null,
    areaGuntha: null,
    roadWidthFt: null,
    mainRoadDistanceM: null
  };
}

export function newProperty(name: string): PropertyRecord {
  const now = Date.now();
  return {
    id: `prop_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: name || "Untitled Property",
    createdAt: now,
    updatedAt: now,
    location: null,
    mapIntel: emptyMapIntel(),
    checklist: {},
    ownerAnswers: {},
    price: emptyPrice(),
    notes: { site: "", owner: "", general: "" },
    photos: [],
    finalStatus: "UNDECIDED",
    followUp: ""
  };
}
