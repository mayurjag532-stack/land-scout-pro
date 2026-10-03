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
      <span className="ps-save">
        <span className="ps-save-check w-4 h-4 rounded-full bg-field-good/15 grid place-items-center text-field-good" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <span className="ps-save-text">Saved to this device</span>
      </span>
    );
  }
  return (
    <span className="ps-save">
      <span className={`w-1.5 h-1.5 rounded-full ml-1.5 ${state === "saving" ? "bg-field-accent animate-pulse" : state === "error" ? "bg-field-bad" : "bg-field-muted"}`} aria-hidden="true" />
      <span className="ps-save-text">
        {state === "saving" ? "Saving…" : state === "error" ? "Save failed — will retry" : "Stored locally"}
      </span>
    </span>
  );
}

/**
 * Plot detail hero — a spatial dossier (§13).
 * Visual anchor: the property's own first photo, else its map context,
 * else an honest empty state. Nothing is fabricated.
 *
 * Structure: aerial/spatial visual → plot identity → one hero metric
 * (price, else area, else score — whichever the data supports) →
 * quiet key-facts row → honest save state.
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

  // One hero metric: the most important figure the data supports. Never invented.
  const heroKind = price ? "price" : area ? "area" : "score";
  const heroMetric =
    heroKind === "price" ? { label: "Effective price", value: price as string, suffix: null as string | null } :
    heroKind === "area" ? { label: "Plot area", value: area as string, suffix: null } :
    { label: "Plot score", value: String(Math.round(score.total)), suffix: " / 100" };

  // Quiet key facts — everything the hero didn't take, only what exists.
  const facts: { label: string; value: string; alert?: boolean }[] = [];
  if (heroKind !== "price" && price) facts.push({ label: "Price", value: price });
  if (heroKind !== "area" && area) facts.push({ label: "Area", value: area });
  if (property.location) facts.push({
    label: "Coordinates",
    value: `${property.location.lat.toFixed(5)}, ${property.location.lng.toFixed(5)}`
  });
  if (road) facts.push({ label: "Main road", value: road });
  if (perGuntha) facts.push({ label: "₹ / guntha", value: perGuntha });
  facts.push({
    label: "Critical flags",
    value: score.criticalFlags.length ? String(score.criticalFlags.length) : "None",
    alert: score.criticalFlags.length > 0
  });

  return (
    <section className="ps-hero ps-dossier ps-rise" aria-label="Property overview">
      {/* Aerial / spatial hero — photo, map context, or honest empty state */}
      <div className="ps-dossier-visual">
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
              <MapView location={property.location} height={300} interactive={false} />
            </div>
            <span className="absolute left-3 bottom-3 ps-map-float rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-field-accent">
              Map context
            </span>
          </Suspense>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6" aria-hidden="true">
            <svg viewBox="0 0 300 224" className="w-full h-full opacity-60" preserveAspectRatio="xMidYMid slice">
              {[28, 56, 84, 112, 140, 168].map((y) => (
                <path key={y} d={`M-10 ${y} C 60 ${y - 18}, 120 ${y + 18}, 190 ${y - 10} S 280 ${y + 8}, 320 ${y - 6}`} fill="none" stroke="var(--line-strong)" strokeWidth="1.4" />
              ))}
              <circle cx="150" cy="112" r="7" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="4 3" />
            </svg>
            <p className="absolute text-[11px] text-field-muted text-center px-8">No visual yet —<br />capture a location or add site photos.</p>
          </div>
        )}
      </div>

      {/* Plot identity */}
      <div className="ps-hero-body ps-dossier-body">
        <p className="ps-kicker">Field intelligence dossier</p>
        <h1 className="ps-dossier-title font-display">{property.name}</h1>
        <div className="ps-dossier-decision">
          <DecisionTag id={decision.id} label={decision.shortLabel} />
          <span className="ps-dossier-confidence">Confidence {score.confidence}</span>
          <span className="ps-dossier-score"><ScoreRing value={score.total} tone={tone} size={52} strokeWidth={5} /></span>
        </div>

        {/* One hero metric */}
        <div className="ps-hero-metric">
          <p className="ps-hero-metric-label">{heroMetric.label}</p>
          <p className="ps-hero-metric-value font-display">
            {heroMetric.value}
            {heroMetric.suffix && <span className="ps-hero-metric-suffix">{heroMetric.suffix}</span>}
          </p>
        </div>

        {/* Key facts — quiet, scannable */}
        {facts.length > 0 && (
          <dl className="ps-facts">
            {facts.map((f) => (
              <div className="ps-fact" key={f.label}>
                <dt>{f.label}</dt>
                <dd className={f.alert ? "text-field-bad" : undefined}>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="ps-dossier-save"><SaveIndicator state={saveState} /></div>
      </div>
    </section>
  );
}
