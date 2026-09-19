import { lazy, Suspense, useMemo, useState } from "react";
import { PropertyRecord } from "../types";
import { computeScore } from "../utils/scoring";
import { googleMapsPointUrl } from "../utils/geo";
import { getProperty } from "../db";
import { canUse, Plan } from "../entitlements";
import { beforeTokenDecision, BeforeTokenDecision } from "../utils/decision";
import { visitCompletion } from "../utils/visitState";
import { DecisionTag, decisionTone } from "./ui/StatusTag";
import { ScoreRing } from "./ui/ScoreRing";
const PropertyComparison = lazy(() => import("./PropertyComparison"));

const STATUS_FILTERS: { id: "ALL" | BeforeTokenDecision; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "PROCEED_TO_VERIFICATION", label: "Proceed" },
  { id: "HOLD_MORE_INFO", label: "Hold / verify" },
  { id: "HIGH_CONCERN", label: "High concern" },
  { id: "INSUFFICIENT_DATA", label: "Insufficient data" }
];

type SortKey = "newest" | "oldest" | "score_desc" | "score_asc" | "price_desc" | "price_asc" | "area_desc" | "area_asc";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "score_desc", label: "Score: high to low" },
  { id: "score_asc", label: "Score: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "area_desc", label: "Area: high to low" },
  { id: "area_asc", label: "Area: low to high" }
];

function relativeTime(ts: number) {
  const s = Math.max(0, Date.now() - ts) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function PinIcon() { return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>; }
function TagIcon() { return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m20.6 13.4-8.2 8.2a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1 0-2.8l8.2-8.2a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.2a2 2 0 0 1-.4 1.4Z" /><circle cx="14.5" cy="8.5" r="1.2" /></svg>; }
function RulerIcon() { return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="10" rx="1.5" /><path d="M7 7v3M11 7v3M15 7v3" /></svg>; }
function SearchIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>; }
function ChevronIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.9 12.1a2 2 0 0 1-2 1.9H8.9a2 2 0 0 1-2-1.9L6 7" /></svg>; }

export default function PropertyList({
  properties,
  onOpen,
  onNew,
  plan,
  onDelete
}: {
  properties: PropertyRecord[];
  onOpen: (id: string) => void;
  onNew: () => void;
  plan: Plan;
  onDelete: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | BeforeTokenDecision>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonProperties, setComparisonProperties] = useState<PropertyRecord[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const scored = useMemo(() => properties.map((p) => ({ property: p, score: computeScore(p) })), [properties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scored.filter(({ property }) => {
      const matchesSearch = q === "" || property.name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || beforeTokenDecision(property).id === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scored, search, statusFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "oldest":
        return list.sort((a, b) => a.property.createdAt - b.property.createdAt);
      case "score_desc":
        return list.sort((a, b) => b.score.total - a.score.total);
      case "score_asc":
        return list.sort((a, b) => a.score.total - b.score.total);
      case "price_desc":
        return list.sort((a, b) => (b.property.price.quotedPrice ?? -1) - (a.property.price.quotedPrice ?? -1));
      case "price_asc":
        return list.sort((a, b) => {
          const av = a.property.price.quotedPrice;
          const bv = b.property.price.quotedPrice;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          return av - bv;
        });
      case "area_desc":
        return list.sort((a, b) => (b.property.price.areaSqft ?? -1) - (a.property.price.areaSqft ?? -1));
      case "area_asc":
        return list.sort((a, b) => {
          const av = a.property.price.areaSqft;
          const bv = b.property.price.areaSqft;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          return av - bv;
        });
      case "newest":
      default:
        return list.sort((a, b) => b.property.createdAt - a.property.createdAt);
    }
  }, [filtered, sortBy]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev);
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelectedIds([]);
    setShowComparison(false);
  }

  async function openComparison() {
    if (selectedIds.length < 2 || comparisonLoading) return;
    setComparisonLoading(true);
    try {
      const full = await Promise.all(selectedIds.slice(0, 5).map((id) => getProperty(id)));
      setComparisonProperties(full.filter((p): p is PropertyRecord => Boolean(p)));
      setShowComparison(true);
    } finally { setComparisonLoading(false); }
  }

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-xl mx-auto pb-24 md:pb-10">
      <div className="flex items-center justify-between mb-5">
        <div><p className="text-[10px] uppercase tracking-[.18em] text-field-muted mb-1">Field portfolio</p><h2 className="text-field-text text-[26px] font-bold tracking-tight">Saved Properties</h2></div>
        <div className="text-right shrink-0">
          <p className="text-field-text text-xl font-bold leading-none">{properties.length}</p>
          <p className="text-field-muted text-[10px] mt-0.5">{properties.length === 1 ? "record" : "records"}</p>
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="bg-field-card border border-field-line rounded-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-field-panel border border-field-line grid place-items-center text-field-accent"><PinIcon /></div>
          <p className="text-field-text font-semibold mt-4">No property visits saved yet</p>
          <p className="text-field-muted text-sm mt-1.5 max-w-sm mx-auto">Start your first visit to capture a location, evidence and price signal — Plot Scout builds the decision record as you go.</p>
          <button onClick={onNew} className="mt-5 bg-field-accent text-field-bg font-semibold px-6 py-3 rounded-xl">
            + New Visit
          </button>
        </div>
      ) : (
        <>
          <div className="bg-field-card border border-field-line rounded-xl p-3 md:p-3.5 mb-5">
            <div className="flex flex-col md:flex-row md:items-center gap-2.5">
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-field-muted pointer-events-none"><SearchIcon /></span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by property name…"
                  className="w-full bg-field-panel border border-field-line rounded-lg pl-9 pr-3 py-2.5 text-field-text text-sm"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="bg-field-panel border border-field-line rounded-lg pl-3 pr-2 py-2.5 text-field-text text-xs md:w-44"
                >
                  {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <button
                  onClick={() => canUse(plan,"portfolio_compare") ? (compareMode ? exitCompareMode() : setCompareMode(true)) : alert("Property comparison is available on Plot Scout Pro.")}
                  className={`text-xs rounded-lg px-3 py-2.5 border font-medium whitespace-nowrap shrink-0 ${
                    compareMode ? "bg-field-accent text-field-bg border-field-accent" : "bg-field-panel text-field-accent border-field-accent/40"
                  }`}
                >
                  {compareMode ? "Cancel" : canUse(plan,"portfolio_compare") ? "Compare" : "Compare · Pro"}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pt-3 -mx-0.5 px-0.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`text-xs rounded-full px-3 py-1.5 border whitespace-nowrap transition-colors ${
                    statusFilter === f.id
                      ? "bg-field-accent text-field-bg border-field-accent font-medium"
                      : "bg-field-panel text-field-muted border-field-line hover:border-field-lineStrong"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {compareMode && (
              <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-field-line">
                <p className="text-field-muted text-xs">{selectedIds.length ? `${selectedIds.length} selected` : "Select 2–5 properties to compare"}</p>
                <button
                  onClick={openComparison}
                  disabled={selectedIds.length < 2 || comparisonLoading}
                  className="text-xs rounded-lg px-3 py-2 bg-field-accent text-field-bg font-semibold disabled:opacity-40"
                >
                  {comparisonLoading ? "Loading…" : `Compare selected (${selectedIds.length})`}
                </button>
              </div>
            )}
          </div>

          {sorted.length === 0 ? (
            <div className="bg-field-card border border-field-line rounded-xl p-6 text-center">
              <p className="text-field-muted text-sm">No properties match this search/filter.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {sorted.map(({ property: p, score }) => {
                const isSelected = selectedIds.includes(p.id);
                const decision = beforeTokenDecision(p);
                const tone = decisionTone(decision.id);
                const completion = visitCompletion(p);
                return (
                  <div key={p.id} className="ps-property-row group relative">
                    <button
                      onClick={() => (compareMode ? toggleSelected(p.id) : onOpen(p.id))}
                      className={`w-full text-left bg-field-card border rounded-xl p-4 transition-colors ps-property-btn ${
                        compareMode && isSelected ? "border-field-accent" : "border-field-line group-hover:border-field-lineStrong"
                      } ${tone === "bad" && !compareMode ? "ps-attn-bad" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        {compareMode ? (
                          <span
                            className={`mt-1 w-5 h-5 rounded border flex items-center justify-center text-xs shrink-0 ${
                              isSelected ? "bg-field-accent text-field-bg border-field-accent" : "border-field-line text-field-muted"
                            }`}
                          >
                            {isSelected ? "✓" : ""}
                          </span>
                        ) : (
                          <ScoreRing value={score.total} tone={tone} />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className={`flex items-start justify-between gap-2 ${!compareMode ? "pr-16" : ""}`}>
                            <p className="text-field-text font-semibold truncate leading-tight">{p.name}</p>
                            {!compareMode && <span className="hidden md:inline-flex text-field-muted shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronIcon /></span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <DecisionTag id={decision.id} label={decision.shortLabel} />
                            <span className="text-field-muted text-[11px]">{relativeTime(p.createdAt)}</span>
                          </div>

                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11px] text-field-muted">
                            {p.location && <span className="inline-flex items-center gap-1"><PinIcon />{p.location.lat.toFixed(3)}, {p.location.lng.toFixed(3)}</span>}
                            {p.price.quotedPrice && <span className="inline-flex items-center gap-1"><TagIcon />₹{p.price.quotedPrice.toLocaleString("en-IN")}</span>}
                            {p.price.areaSqft && <span className="inline-flex items-center gap-1"><RulerIcon />{p.price.areaSqft.toLocaleString("en-IN")} sq ft</span>}
                          </div>

                          <div className="flex items-center gap-2 mt-3">
                            <div className="h-1 flex-1 bg-field-raised rounded-full overflow-hidden"><div className="h-full bg-field-accent rounded-full" style={{ width: `${completion}%` }} /></div>
                            <span className="text-field-muted text-[10px] tabular-nums shrink-0">{completion}%</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {!compareMode && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                        {p.location && (
                          <a
                            href={googleMapsPointUrl(p.location.lat, p.location.lng)}
                            target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                            aria-label="Open in Google Maps"
                            className="w-8 h-8 grid place-items-center rounded-lg bg-field-bg/90 border border-field-line text-field-muted hover:text-field-accent"
                          >
                            <PinIcon />
                          </a>
                        )}
                        <button
                          type="button"
                          aria-label="Delete property"
                          onClick={async (e) => { e.stopPropagation(); if (confirm(`Delete ${p.name}? Its saved photos will also be removed. Create a Full Backup first if you may need it later.`)) await onDelete(p.id); }}
                          className="w-8 h-8 grid place-items-center rounded-lg bg-field-bg/90 border border-field-line text-field-bad hover:border-field-bad/50"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showComparison && comparisonProperties.length >= 2 && <Suspense fallback={<div className="fixed inset-0 z-50 bg-field-bg/90 flex items-center justify-center text-field-muted text-sm">Preparing comparison…</div>}><PropertyComparison properties={comparisonProperties} onClose={() => setShowComparison(false)} /></Suspense>}
    </div>
  );
}
