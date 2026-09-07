import { PropertyRecord, Score, CHECKLIST_ITEMS } from "../types";

// This score is a rough field-signal indicator built only from the user's
// own checklist answers and OSM map data. It is NOT a valuation and is
// never presented as one - see explanation strings below.
export function computeScore(property: PropertyRecord): Score {
  const explanation: string[] = [];

  const checklistIds = CHECKLIST_ITEMS.map((c) => c.id);
  const answered = checklistIds.filter((id) => property.checklist[id] !== null && property.checklist[id] !== undefined);
  const yesCount = checklistIds.filter((id) => property.checklist[id] === true).length;
  const checklistCompleteness = checklistIds.length ? answered.length / checklistIds.length : 0;
  const checklistYesRatio = answered.length ? yesCount / answered.length : 0;

  // LOCATION (0-20): based on nearest road + highway proximity signal
  let location = 0;
  const intel = property.mapIntel;
  if (intel.status === "ok") {
    if (intel.nearestRoad) {
      location += 8;
      explanation.push(`Nearest mapped road found ${Math.round(intel.nearestRoad.distanceMeters)}m away (+8)`);
    } else {
      explanation.push("No mapped road found nearby (+0 location base)");
    }
    if (intel.nearestMajorRoad) {
      location += 7;
      explanation.push(`Major road within search radius (+7)`);
    }
    if (intel.nearestHighway) {
      location += 5;
      explanation.push(`Highway/arterial within search radius (+5)`);
    }
  } else {
    explanation.push("Map intelligence not run/failed - location score incomplete");
  }

  // ACCESS (0-15): parking, fuel, transport nearby + checklist car-friendly + road width
  let access = 0;
  if (intel.status === "ok" && intel.access.length > 0) {
    access += Math.min(8, intel.access.length);
    explanation.push(`${intel.access.length} access-related points mapped nearby (+${Math.min(8, intel.access.length)})`);
  }
  if (property.checklist["approach_car_friendly"] === true) {
    access += 4;
    explanation.push("Checklist: approach road car-friendly (+4)");
  }
  if (property.price.roadWidthFt && property.price.roadWidthFt >= 20) {
    access += 3;
    explanation.push(`Road width ${property.price.roadWidthFt}ft (+3)`);
  }
  access = Math.min(15, access);

  // CUSTOMER CATCHMENT (0-20): residential density from map + checklist
  let catchment = 0;
  if (intel.status === "ok") {
    const resScore = Math.min(12, intel.residential.length);
    catchment += resScore;
    explanation.push(`${intel.residential.length} residential features mapped nearby (+${resScore})`);
  }
  if (property.checklist["residential_catchment"] === true) {
    catchment += 5;
    explanation.push("Checklist: residential customer catchment confirmed (+5)");
  }
  if (property.checklist["area_active"] === true) {
    catchment += 3;
    explanation.push("Checklist: area feels active (+3)");
  }
  catchment = Math.min(20, catchment);

  // SPORTS ECOSYSTEM (0-15): existing sports/fitness activity nearby
  let sportsEcosystem = 0;
  if (intel.status === "ok") {
    const sportsScore = Math.min(10, intel.sports.length * 2);
    sportsEcosystem += sportsScore;
    if (intel.sports.length > 0) {
      explanation.push(`${intel.sports.length} sports/fitness features mapped nearby (+${sportsScore})`);
    }
  }
  if (property.checklist["sports_activity_nearby"] === true) {
    sportsEcosystem += 5;
    explanation.push("Checklist: sports/gym/turf/badminton activity nearby (+5)");
  }
  sportsEcosystem = Math.min(15, sportsEcosystem);

  // SITE PRACTICALITY (0-20): checklist yes-ratio on physical site items
  const physicalItems = [
    "plot_size_target",
    "plot_shape_ok",
    "land_flat",
    "no_waterlogging",
    "no_nala_issue",
    "parking_practical",
    "electricity_accessible",
    "water_available",
    "area_safe_evening",
    "commercially_practical"
  ];
  const physicalAnswered = physicalItems.filter(
    (id) => property.checklist[id] !== null && property.checklist[id] !== undefined
  );
  const physicalYes = physicalItems.filter((id) => property.checklist[id] === true).length;
  const sitePracticality = physicalAnswered.length
    ? Math.round((physicalYes / physicalItems.length) * 20)
    : 0;
  if (physicalAnswered.length > 0) {
    explanation.push(`Site checklist: ${physicalYes}/${physicalItems.length} physical items confirmed (+${sitePracticality})`);
  } else {
    explanation.push("Site checklist not filled yet (+0 site practicality)");
  }

  // PRICE DATA COMPLETENESS (0-10)
  const priceFields = [
    property.price.quotedPrice,
    property.price.areaSqft || property.price.areaGuntha,
    property.price.roadWidthFt,
    property.price.mainRoadDistanceM
  ];
  const priceFilled = priceFields.filter((v) => v !== null && v !== undefined).length;
  const priceDataCompleteness = Math.round((priceFilled / priceFields.length) * 10);
  explanation.push(`Price/property data ${priceFilled}/${priceFields.length} fields filled (+${priceDataCompleteness})`);

  const total = Math.round(
    location + access + catchment + sportsEcosystem + sitePracticality + priceDataCompleteness
  );

  let status: Score["status"] = "UNDECIDED";
  const hasEnoughData = checklistCompleteness > 0.3 && intel.status === "ok";
  if (!hasEnoughData) {
    status = "UNDECIDED";
    explanation.push("Not enough checklist/map data yet to call this Strong/Investigate/Reject.");
  } else if (total >= 65 && checklistYesRatio >= 0.6) {
    status = "STRONG";
  } else if (total >= 40) {
    status = "INVESTIGATE";
  } else {
    status = "REJECT";
  }

  return {
    total,
    breakdown: { location, access, catchment, sportsEcosystem, sitePracticality, priceDataCompleteness },
    status,
    explanation
  };
}
