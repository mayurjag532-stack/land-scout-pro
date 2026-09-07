import { PropertyRecord, CHECKLIST_ITEMS, OWNER_QUESTIONS } from "../types";
import { computeScore } from "./scoring";
import { googleMapsPointUrl } from "./geo";

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportPropertyJson(property: PropertyRecord) {
  downloadBlob(
    `${property.name.replace(/\s+/g, "_")}_${property.id}.json`,
    JSON.stringify(property, null, 2),
    "application/json"
  );
}

export function exportAllJson(properties: PropertyRecord[]) {
  downloadBlob("land_scout_pro_all_properties.json", JSON.stringify(properties, null, 2), "application/json");
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportPropertyCsv(property: PropertyRecord) {
  exportCsvFile([property], `${property.name.replace(/\s+/g, "_")}_${property.id}.csv`);
}

function exportCsvFile(properties: PropertyRecord[], filename: string) {
  const headers = [
    "id",
    "name",
    "createdAt",
    "lat",
    "lng",
    "gpsAccuracyM",
    "quotedPrice",
    "askingPrice",
    "areaSqft",
    "areaGuntha",
    "pricePerSqft",
    "pricePerGuntha",
    "roadWidthFt",
    "mainRoadDistanceM",
    "score",
    "status",
    "followUp"
  ];
  const rows = properties.map((p) => {
    const score = computeScore(p);
    const pricePerSqft =
      p.price.quotedPrice && p.price.areaSqft ? (p.price.quotedPrice / p.price.areaSqft).toFixed(2) : "";
    const pricePerGuntha =
      p.price.quotedPrice && p.price.areaGuntha ? (p.price.quotedPrice / p.price.areaGuntha).toFixed(2) : "";
    return [
      p.id,
      p.name,
      new Date(p.createdAt).toISOString(),
      p.location?.lat ?? "",
      p.location?.lng ?? "",
      p.location?.accuracy ?? "",
      p.price.quotedPrice ?? "",
      p.price.askingPrice ?? "",
      p.price.areaSqft ?? "",
      p.price.areaGuntha ?? "",
      pricePerSqft,
      pricePerGuntha,
      p.price.roadWidthFt ?? "",
      p.price.mainRoadDistanceM ?? "",
      score.total,
      p.finalStatus,
      p.followUp
    ]
      .map(csvEscape)
      .join(",");
  });
  downloadBlob(filename, [headers.join(","), ...rows].join("\n"), "text/csv");
}

export function exportAllCsv(properties: PropertyRecord[]) {
  exportCsvFile(properties, "land_scout_pro_all_properties.csv");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPrintableReportHtml(property: PropertyRecord): string {
  const score = computeScore(property);
  const loc = property.location;
  const checklistRows = CHECKLIST_ITEMS.map((item) => {
    const val = property.checklist[item.id];
    const mark = val === true ? "Yes" : val === false ? "No" : "\u2014";
    return `<tr><td>${item.label}</td><td>${mark}</td></tr>`;
  }).join("");
  const ownerRows = OWNER_QUESTIONS.map((q) => {
    const a = property.ownerAnswers[q.id] || "\u2014";
    return `<tr><td>${q.text}</td><td>${escapeHtml(a)}</td></tr>`;
  }).join("");
  const mapsLink = loc ? googleMapsPointUrl(loc.lat, loc.lng) : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(property.name)} - Property Report</title>
<style>
  body{font-family:Arial,sans-serif;color:#222;padding:24px;max-width:800px;margin:0 auto;}
  h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px;}
  h2{font-size:16px;margin-top:24px;border-bottom:1px solid #999;padding-bottom:4px;}
  table{width:100%;border-collapse:collapse;margin-top:8px;}
  td{padding:4px 8px;border-bottom:1px solid #eee;font-size:13px;vertical-align:top;}
  .meta{color:#555;font-size:13px;}
  .score{font-size:20px;font-weight:bold;}
  .disclaimer{margin-top:24px;font-size:11px;color:#777;border-top:1px solid #ccc;padding-top:8px;}
  @media print{body{padding:0;}}
</style></head><body>
  <h1>${escapeHtml(property.name)}</h1>
  <p class="meta">Created: ${new Date(property.createdAt).toLocaleString()} | Status: ${property.finalStatus}</p>

  <h2>Location</h2>
  <p class="meta">${loc ? `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)} (accuracy: ${loc.accuracy ? Math.round(loc.accuracy) + "m" : "n/a"}, source: ${loc.source})` : "Not captured"}</p>
  ${loc ? `<p><a href="${mapsLink}">${mapsLink}</a></p>` : ""}

  <h2>Site Signal Score</h2>
  <p class="score">${score.total} / 100 &mdash; ${score.status}</p>
  <ul>${score.explanation.map((e) => `<li style="font-size:12px">${e}</li>`).join("")}</ul>

  <h2>My Site Checklist</h2>
  <table>${checklistRows}</table>

  <h2>Owner Answers</h2>
  <table>${ownerRows}</table>

  <h2>Price / Property Data</h2>
  <table>
    <tr><td>Quoted price</td><td>${property.price.quotedPrice ?? "\u2014"}</td></tr>
    <tr><td>Asking price</td><td>${property.price.askingPrice ?? "\u2014"}</td></tr>
    <tr><td>Area (sq ft)</td><td>${property.price.areaSqft ?? "\u2014"}</td></tr>
    <tr><td>Area (guntha)</td><td>${property.price.areaGuntha ?? "\u2014"}</td></tr>
    <tr><td>Road width (ft)</td><td>${property.price.roadWidthFt ?? "\u2014"}</td></tr>
    <tr><td>Main road distance (m, approx. straight-line)</td><td>${property.price.mainRoadDistanceM ?? "\u2014"}</td></tr>
  </table>

  <h2>Notes</h2>
  <p><strong>Site notes:</strong> ${escapeHtml(property.notes.site || "\u2014")}</p>
  <p><strong>Owner notes:</strong> ${escapeHtml(property.notes.owner || "\u2014")}</p>
  <p><strong>General notes:</strong> ${escapeHtml(property.notes.general || "\u2014")}</p>

  <h2>Photo Evidence</h2>
  ${property.photos.length ? `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">${property.photos.map((photo) => `<figure style="margin:0;"><img src="${photo.dataUrl}" style="width:100%;max-height:260px;object-fit:cover;border:1px solid #ddd;"><figcaption style="font-size:11px;color:#555;margin-top:3px;">${escapeHtml(photo.category)}</figcaption></figure>`).join("")}</div>` : `<p class="meta">No photos attached.</p>`}

  <p class="disclaimer">Map data is an indicator only. Ownership, title, zoning, NA status, legal access and permissions must be independently verified. This score is not a professional legal or real-estate valuation.</p>
</body></html>`;
}

export function printPropertyReport(property: PropertyRecord) {
  const html = buildPrintableReportHtml(property);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup blocked. Allow popups to print/export the report.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
