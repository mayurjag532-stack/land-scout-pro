import { useEffect, useState } from "react";
import { Basemap, getBasemap, setBasemap } from "../utils/basemap";

const OPTIONS: { value: Basemap; label: string }[] = [
  { value: "map", label: "Map" },
  { value: "satellite", label: "Satellite" },
  { value: "hybrid", label: "Hybrid" },
];

/** Quiet segmented basemap switcher for floating map chrome. 44px targets. */
export default function BasemapSwitcher() {
  const [basemap, setCurrent] = useState<Basemap>(() => getBasemap());

  useEffect(() => {
    const h = (e: Event) => setCurrent((e as CustomEvent).detail?.basemap || getBasemap());
    window.addEventListener("plot-scout-basemap-change", h);
    return () => window.removeEventListener("plot-scout-basemap-change", h);
  }, []);

  return (
    <div
      className="ps-map-float rounded-xl flex overflow-hidden"
      role="group"
      aria-label="Basemap style"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setBasemap(o.value)}
          aria-pressed={basemap === o.value}
          className={`min-h-[44px] px-3.5 text-xs font-semibold transition-colors ${
            basemap === o.value
              ? "text-field-accent"
              : "text-field-muted hover:text-field-text"
          }`}
          style={basemap === o.value ? { background: "var(--accent-soft)" } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
