import { Suspense, lazy } from "react";
import { PropertyRecord } from "../types";
import { economics } from "../utils/economics";
import { formatDistance } from "../utils/geo";
import { computeScore } from "../utils/scoring";
import { beforeTokenDecision } from "../utils/decision";
import { DecisionTag, decisionTone } from "./ui/StatusTag";
import { ScoreRing } from "./ui/ScoreRing";
const MapView = lazy(() => import("./MapView"));

function fmtMoney(n: number | null | undefined): string | null {
  if (n == null) return null;
  const v = Math.round(n);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v % 1e7 === 0 ? 0 : 2).replace(/\.00$/, "")} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 === 0 ? 0 : 1).replace(/\.0$/, "")} L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${v.toLocaleString("en-IN")}`;
}

const PHOTO_LABEL: Record<string, string> = {
  front_road: "Front road", plot: "Plot", left_side: "Left side", right_side: "Right side",
  rear: "Rear", surrounding: "Surroundings", access_road: "Access road", documents: "Documents"
};

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "saved") {
    return (
      <span className="flex items-center gap-2">
        <span className="ps-save-check w-4 h-4 rounded-full bg-field-good/15 grid place-items-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="#2E7D4F" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <span className="text-field-muted text-[11px]">Saved to this device</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${state === "saving" ? "bg-field-accent animate-pulse" : state === "error" ? "bg-field-bad" : "bg-field-muted"}`} aria-hidden="true" />
      <span className="text-field-muted text-[11px]">
        {state === "saving" ? "Saving…" : state === "error" ? "Save failed — will retry" : "Stored locally"}
      </span>
    </span>
  );
}

/**
 * Plot detail hero — entering a spatial dossier (§13).
 * Visual anchor: the property's own first photo, else its map context,
 * else an honest empty state. Nothing is fabricated.
 */
export default function SpatialHero({
  property,
  saveState
}: {
  property: PropertyRecord;
  saveState: "idle" | "saving" | "saved" | "error";
}) {
  const score = computeScore(property);
  const decision = beforeTokenDecision(property);
  const tone = decisionTone(decision.id);
  const e = economics(property.price);
  const price = fmtMoney(e.effectivePrice);
  const area = e.areaGuntha ? `${Number(e.areaGuntha.toFixed(2)).toLocaleString("en-IN")} guntha`
    : e.areaSqft ? `${Math.round(e.areaSqft).toLocaleString("en-IN")} sq ft`
    : e.areaAcre ? `${Number(e.areaAcre.toFixed(2))} acre` : null;
  const perGuntha = fmtMoney(e.perGuntha);
  const road = property.price.mainRoadDistanceM != null ? formatDistance(property.price.mainRoadDistanceM) : null;
  const photo = property.photos[0] ?? null;

  const stats: { label: string; value: string; tone?: string }[] = [];
  if (price) stats.push({ label: "Price", value: price });
  if (area) stats.push({ label: "Area", value: area });
  if (perGuntha) stats.push({ label: "₹ / guntha", value: perGuntha });
  if (road) stats.push({ label: "Main road", value: road });
  stats.push({
    label: "Critical flags",
    value: score.criticalFlags.length ? String(score.criticalFlags.length) : "None",
    tone: score.criticalFlags.length ? "text-field-bad" : undefined
  });

  return (
    <section className="ps-hero ps-rise" aria-label="Property overview">
      <div className="grid md:grid-cols-[minmax(0,1fr)_300px]">
        {/* Visual anchor — photo, map context, or honest empty state */}
        <div className="relative h-56 md:h-auto md:min-h-[280px] order-first md:order-last bg-field-panel overflow-hidden">
          {photo ? (
            <>
              <img src={photo.dataUrl} alt={`${PHOTO_LABEL[photo.category] ?? "Site"} photo of ${property.name}`} className="absolute inset-0 w-full h-full object-cover" loading="eager" />
              <span className="absolute left-3 bottom-3 ps-map-float rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-field-accent">
                {PHOTO_LABEL[photo.category] ?? "Site"} · field photo
              </span>
            </>
          ) : property.location ? (
            <Suspense fallback={<div className="absolute inset-0 skeleton" aria-label="Loading map preview" />}>
              <div className="absolute inset-0">
                <MapView location={property.location} height={280} interactive={false} />
              </div>
              <span className="absolute left-3 bottom-3 ps-map-float rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-field-accent">
                Map context
              </span>
            </Suspense>
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6" aria-hidden="true">
              <svg viewBox="0 0 300 224" className="w-full h-full opacity-60" preserveAspectRatio="xMidYMid slice">
                {[28, 56, 84, 112, 140, 168].map((y) => (
                  <path key={y} d={`M-10 ${y} C 60 ${y - 18}, 120 ${y + 18}, 190 ${y - 10} S 280 ${y + 8}, 320 ${y - 6}`} fill="none" stroke="#D9D2C7" strokeWidth="1.4" />
                ))}
                <circle cx="150" cy="112" r="7" fill="none" stroke="#B9955A" strokeWidth="1.6" strokeDasharray="4 3" />
              </svg>
              <p className="absolute text-[11px] text-field-muted text-center px-8">No visual yet —<br />capture a location or add site photos.</p>
            </div>
          )}
        </div>

        {/* Identity + quick intelligence */}
        <div className="ps-hero-body">
          <p className="ps-kicker">Field intelligence dossier</p>
          <h1 className="ps-title font-display">{property.name}</h1>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <DecisionTag id={decision.id} label={decision.shortLabel} />
            <span className="text-field-muted text-[11px]">Confidence {score.confidence}</span>
            <span className="ml-auto"><ScoreRing value={score.total} tone={tone} size={52} strokeWidth={5} /></span>
          </div>

          <dl className="ps-statgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))" }}>
            {stats.map((s) => (
              <div className="ps-stat" key={s.label}>
                <span>{s.label}</span>
                <b className={s.tone ?? ""}>{s.value}</b>
              </div>
            ))}
          </dl>

          <div className="mt-4"><SaveIndicator state={saveState} /></div>
        </div>
      </div>
    </section>
  );
}
