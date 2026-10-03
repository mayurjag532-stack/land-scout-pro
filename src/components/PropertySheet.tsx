import { useEffect, useRef, useState } from "react";
import { PropertyRecord, Score } from "../types";
import { economics } from "../utils/economics";
import { beforeTokenDecision } from "../utils/decision";
import { formatDistance } from "../utils/geo";
import { ScoreRing } from "./ui/ScoreRing";
import { DecisionTag } from "./ui/StatusTag";
import type { Tone } from "./ui/StatusTag";

function fmtMoney(n: number | null | undefined): string | null {
  if (n == null) return null;
  const v = Math.round(n);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v % 1e7 === 0 ? 0 : 2).replace(/\.00$/, "")} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 === 0 ? 0 : 1).replace(/\.0$/, "")} L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${v.toLocaleString("en-IN")}`;
}

type Detent = "peek" | "half" | "full";

const DETENT_HEIGHT: Record<Detent, string> = {
  peek: "132px",
  half: "55dvh",
  full: "88dvh",
};

/**
 * Mobile bottom sheet for map-selected properties.
 * Three detents — PEEK / HALF / FULL — with a visible grabber.
 * Drag the header or use the detent buttons to move between states.
 */
export default function PropertySheet({
  item,
  onClose,
  onOpen,
}: {
  item: { property: PropertyRecord; score: Score; tone: Tone } | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [detent, setDetent] = useState<Detent>("peek");
  const [dragY, setDragY] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startDetent = useRef<Detent>("peek");

  /* Reset to peek whenever a new property is selected */
  useEffect(() => {
    if (item) setDetent("peek");
  }, [item?.property.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Lock body scroll when sheet is half/full */
  useEffect(() => {
    if (!item || detent === "peek") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [item, detent]);

  if (!item) return null;
  const { property: p, score, tone } = item;
  const decision = beforeTokenDecision(p);
  const e = economics(p.price);
  const price = fmtMoney(e.effectivePrice);
  const area = e.areaGuntha
    ? `${Number(e.areaGuntha.toFixed(2)).toLocaleString("en-IN")} guntha`
    : e.areaSqft ? `${Math.round(e.areaSqft).toLocaleString("en-IN")} sq ft`
    : e.areaAcre ? `${Number(e.areaAcre.toFixed(2))} acre` : null;

  function onTouchStart(ev: React.TouchEvent) {
    startY.current = ev.touches[0].clientY;
    startDetent.current = detent;
    setDragY(0);
  }
  function onTouchMove(ev: React.TouchEvent) {
    if (dragY === null) return;
    setDragY(ev.touches[0].clientY - startY.current);
  }
  function onTouchEnd() {
    if (dragY === null) return;
    const dy = dragY;
    setDragY(null);
    /* Drag up (negative) → expand; drag down (positive) → collapse */
    const order: Detent[] = ["peek", "half", "full"];
    const idx = order.indexOf(startDetent.current);
    if (dy < -60 && idx < 2) setDetent(order[idx + 1]);
    else if (dy > 60 && idx > 0) setDetent(order[idx - 1]);
    else if (dy > 140) onClose();
  }

  const cycleDetent = () =>
    setDetent((d) => (d === "peek" ? "half" : d === "half" ? "full" : "peek"));

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[700] md:hidden"
      role="dialog"
      aria-modal="false"
      aria-label={`Property: ${p.name}`}
    >
      {/* Scrim — only for half/full */}
      {detent !== "peek" && (
        <button
          aria-label="Close property sheet"
          onClick={onClose}
          className="fixed inset-0 bg-black/30 ps-fade"
          style={{ bottom: DETENT_HEIGHT[detent] }}
        />
      )}
      <div
        ref={sheetRef}
        className="bg-field-card border-t border-x border-field-line rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden"
        style={{
          height: DETENT_HEIGHT[detent],
          transform: dragY !== null ? `translateY(${Math.max(-80, Math.min(160, dragY))}px)` : undefined,
          transition: dragY !== null ? "none" : "height 280ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Grabber header — drag target, 44px+ */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={cycleDetent}
          className="shrink-0 pt-2.5 pb-1.5 px-4 cursor-grab active:cursor-grabbing touch-none select-none"
          role="button"
          aria-label={`${p.name}. Tap to ${detent === "peek" ? "expand" : detent === "half" ? "expand fully" : "collapse"}. Drag to resize.`}
        >
          <div className="w-10 h-1.5 rounded-full bg-field-lineStrong mx-auto" aria-hidden="true" />
        </div>

        {/* PEEK content — always visible */}
        <div className="px-5 pb-3 flex items-center gap-3.5">
          <ScoreRing value={score.total} tone={tone} size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-field-text text-[19px] leading-tight truncate">{p.name}</p>
            <p className="text-field-muted text-xs mt-0.5 tabular-nums">
              {[price, area].filter(Boolean).join(" · ") || "No price data yet"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Deselect property"
            className="w-11 h-11 grid place-items-center rounded-xl text-field-muted hover:text-field-text shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* HALF/FULL content */}
        {detent !== "peek" && (
          <div className="flex-1 overflow-y-auto px-5 pb-6 -mt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <DecisionTag id={decision.id} label={decision.shortLabel} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-field-line">
              {price && <div><dt className="text-[10px] uppercase tracking-[.1em] text-field-muted font-semibold">Price</dt><dd className="text-field-text text-lg font-bold tabular-nums mt-0.5">{price}</dd></div>}
              {area && <div><dt className="text-[10px] uppercase tracking-[.1em] text-field-muted font-semibold">Area</dt><dd className="text-field-text text-lg font-bold tabular-nums mt-0.5">{area}</dd></div>}
              {e.perGuntha != null && <div><dt className="text-[10px] uppercase tracking-[.1em] text-field-muted font-semibold">₹ / guntha</dt><dd className="text-field-text text-sm font-semibold tabular-nums mt-0.5">{fmtMoney(e.perGuntha)}</dd></div>}
              {p.price.mainRoadDistanceM != null && <div><dt className="text-[10px] uppercase tracking-[.1em] text-field-muted font-semibold">Main road</dt><dd className="text-field-text text-sm font-semibold tabular-nums mt-0.5">{formatDistance(p.price.mainRoadDistanceM)}</dd></div>}
            </dl>
            {detent === "full" && (p.notes.site || p.notes.general) && (
              <div className="mt-4 pt-4 border-t border-field-line">
                <p className="text-[10px] uppercase tracking-[.1em] text-field-muted font-semibold mb-1.5">Notes</p>
                <p className="text-field-text text-sm leading-relaxed line-clamp-4">{[p.notes.site, p.notes.general].filter(Boolean).join(" · ")}</p>
              </div>
            )}
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => onOpen(p.id)}
                className="flex-1 min-h-[48px] rounded-xl bg-field-accent text-field-bg font-semibold text-[15px]"
              >
                Open dossier
              </button>
              {p.location && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${p.location.lat},${p.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Get directions in Google Maps"
                  className="w-12 h-12 grid place-items-center rounded-xl border border-field-line text-field-accent shrink-0"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 19 21l-7-4-7 4V2z" /></svg>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
