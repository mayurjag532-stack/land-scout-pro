import { useMemo, useState } from "react";
import { PropertyRecord, PropertyStatus } from "../types";
import { computeScore } from "../utils/scoring";
import { googleMapsPointUrl } from "../utils/geo";

const STATUS_EMOJI: Record<string, string> = {
  STRONG: "🟢",
  INVESTIGATE: "🟡",
  REJECT: "🔴",
  UNDECIDED: "⚪"
};

const STATUS_FILTERS: { id: "ALL" | PropertyStatus; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "STRONG", label: "🟢 Strong" },
  { id: "INVESTIGATE", label: "🟡 Investigate" },
  { id: "REJECT", label: "🔴 Reject" },
  { id: "UNDECIDED", label: "⚪ Undecided" }
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

export default function PropertyList({
  properties,
  onOpen,
  onNew
}: {
  properties: PropertyRecord[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PropertyStatus>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const scored = useMemo(() => properties.map((p) => ({ property: p, score: computeScore(p) })), [properties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scored.filter(({ property }) => {
      const matchesSearch = q === "" || property.name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || property.finalStatus === statusFilter;
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
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelectedIds([]);
    setShowComparison(false);
  }

  const selectedProperties = properties.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="px-4 py-4 max-w-xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-field-text text-xl font-bold">Saved Properties</h2>
        <span className="text-field-muted text-sm">{properties.length}</span>
      </div>

      {properties.length === 0 ? (
        <div className="bg-field-card border border-field-line rounded-xl p-6 text-center">
          <p className="text-field-text font-medium">No property visits saved yet.</p>
          <p className="text-field-muted text-sm mt-1">Start your first visit to capture a location and build a record.</p>
          <button onClick={onNew} className="mt-4 bg-field-accent text-field-bg font-semibold px-5 py-3 rounded-xl">
            + New Visit
          </button>
        </div>
      ) : (
        <>
          <div className="bg-field-card border border-field-line rounded-xl p-3 mb-4 space-y-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by property name..."
              className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
            />

            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`text-xs rounded-full px-3 py-1.5 border whitespace-nowrap ${
                    statusFilter === f.id
                      ? "bg-field-accent text-field-bg border-field-accent"
                      : "bg-field-panel text-field-muted border-field-line"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-field-muted text-xs shrink-0">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="flex-1 bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-field-line">
              <button
                onClick={() => (compareMode ? exitCompareMode() : setCompareMode(true))}
                className={`text-xs rounded-lg px-3 py-2 border font-medium ${
                  compareMode
                    ? "bg-field-accent text-field-bg border-field-accent"
                    : "bg-field-panel text-field-accent border-field-accent"
                }`}
              >
                {compareMode ? "Cancel compare" : "Compare properties"}
              </button>
              {compareMode && (
                <button
                  onClick={() => setShowComparison(true)}
                  disabled={selectedIds.length < 2}
                  className="text-xs rounded-lg px-3 py-2 bg-field-accent text-field-bg font-semibold disabled:opacity-40"
                >
                  Compare selected ({selectedIds.length})
                </button>
              )}
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="bg-field-card border border-field-line rounded-xl p-6 text-center">
              <p className="text-field-muted text-sm">No properties match this search/filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map(({ property: p, score }) => {
                const isSelected = selectedIds.includes(p.id);
                return (
                  <div key={p.id} className="relative">
                    <button
                      onClick={() => (compareMode ? toggleSelected(p.id) : onOpen(p.id))}
                      className={`w-full text-left bg-field-card border rounded-xl p-4 ${
                        compareMode && isSelected ? "border-field-accent" : "border-field-line"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-start gap-2">
                          {compareMode && (
                            <span
                              className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center text-xs shrink-0 ${
                                isSelected ? "bg-field-accent text-field-bg border-field-accent" : "border-field-line text-field-muted"
                              }`}
                            >
                              {isSelected ? "✓" : ""}
                            </span>
                          )}
                          <div>
                            <p className="text-field-text font-semibold">{p.name}</p>
                            <p className="text-field-muted text-xs mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className="text-lg shrink-0">{STATUS_EMOJI[p.finalStatus]}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-field-muted">
                        {p.location && (
                          <span>
                            {p.location.lat.toFixed(4)}, {p.location.lng.toFixed(4)}
                          </span>
                        )}
                        {p.price.quotedPrice && <span>₹{p.price.quotedPrice.toLocaleString("en-IN")}</span>}
                        {p.price.areaSqft && <span>{p.price.areaSqft} sq ft</span>}
                        <span>Score: {score.total}/100</span>
                      </div>
                      {p.location && !compareMode && (
                        <a
                          href={googleMapsPointUrl(p.location.lat, p.location.lng)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-block mt-2 text-xs text-field-accent underline"
                        >
                          Open in Google Maps
                        </a>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showComparison && selectedProperties.length >= 2 && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-3">
          <div className="bg-field-card border border-field-line rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-field-text font-bold text-base">Compare Properties</h3>
              <button onClick={() => setShowComparison(false)} className="text-field-muted text-sm px-2">
                ✕ Close
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <td className="text-field-muted py-1 pr-2 align-bottom">Metric</td>
                    {selectedProperties.map((p) => (
                      <td key={p.id} className="text-field-text font-semibold py-1 px-2 align-bottom min-w-[120px]">
                        {p.name}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Status", get: (p: PropertyRecord) => `${STATUS_EMOJI[p.finalStatus]} ${p.finalStatus}` },
                    { label: "Score", get: (p: PropertyRecord) => `${computeScore(p).total} / 100` },
                    {
                      label: "Quoted price",
                      get: (p: PropertyRecord) => (p.price.quotedPrice ? `₹${p.price.quotedPrice.toLocaleString("en-IN")}` : "\u2014")
                    },
                    { label: "Area (sq ft)", get: (p: PropertyRecord) => (p.price.areaSqft ? `${p.price.areaSqft}` : "\u2014") },
                    { label: "Area (guntha)", get: (p: PropertyRecord) => (p.price.areaGuntha ? `${p.price.areaGuntha}` : "\u2014") },
                    {
                      label: "₹ / sq ft",
                      get: (p: PropertyRecord) =>
                        p.price.quotedPrice && p.price.areaSqft
                          ? `₹${Math.round(p.price.quotedPrice / p.price.areaSqft).toLocaleString("en-IN")}`
                          : "\u2014"
                    },
                    { label: "Road width (ft)", get: (p: PropertyRecord) => (p.price.roadWidthFt ? `${p.price.roadWidthFt}` : "\u2014") },
                    {
                      label: "Main road distance",
                      get: (p: PropertyRecord) => (p.price.mainRoadDistanceM ? `${p.price.mainRoadDistanceM} m` : "\u2014")
                    },
                    {
                      label: "Location",
                      get: (p: PropertyRecord) => (p.location ? `${p.location.lat.toFixed(4)}, ${p.location.lng.toFixed(4)}` : "Not captured")
                    },
                    {
                      label: "Checklist Yes",
                      get: (p: PropertyRecord) => `${Object.values(p.checklist).filter((v) => v === true).length}`
                    },
                    { label: "Photos", get: (p: PropertyRecord) => `${p.photos.length}` }
                  ].map((row) => (
                    <tr key={row.label} className="border-t border-field-line">
                      <td className="text-field-muted py-1.5 pr-2 whitespace-nowrap">{row.label}</td>
                      {selectedProperties.map((p) => (
                        <td key={p.id} className="text-field-text py-1.5 px-2">
                          {row.get(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
