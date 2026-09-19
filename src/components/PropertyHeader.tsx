import { useEffect, useRef, useState } from "react";
import { PropertyRecord } from "../types";
import { googleMapsPointUrl } from "../utils/geo";
import { exportPropertyJson, exportPropertyCsv, printPropertyReport } from "../utils/export";
import { canUse, getPlan } from "../entitlements";

export default function PropertyHeader({
  property,
  onNameChange,
  onBack
}: {
  property: PropertyRecord;
  onNameChange: (name: string) => void;
  onBack: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  async function share() {
    const loc = property.location;
    const text = `${property.name}${loc ? ` - ${googleMapsPointUrl(loc.lat, loc.lng)}` : ""}`;
    if (navigator.share) {
      try { await navigator.share({ title: property.name, text }); } catch { /* user cancelled */ }
    } else if (loc) {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard (share not supported on this browser).");
    }
  }

  function runReport() {
    setMenuOpen(false);
    if (canUse(getPlan(), "professional_report")) printPropertyReport(property);
    else alert("Before-Token Decision Reports are available on Plot Scout Pro.");
  }

  return (
    <div className="sticky top-0 z-10 bg-field-bg/95 backdrop-blur border-b border-field-line px-4 py-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-field-muted text-sm px-1 py-1 shrink-0" aria-label="Back">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18 9 12l6-6" /></svg>
        </button>
        <input
          value={property.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="ps-title-input flex-1 min-w-0 text-field-text font-semibold text-[16px] outline-none px-0"
        />

        {property.location && (
          <a
            href={googleMapsPointUrl(property.location.lat, property.location.lng)}
            target="_blank"
            rel="noreferrer"
            className="text-xs bg-field-panel border border-field-line text-field-text rounded-lg px-2.5 py-2 whitespace-nowrap shrink-0"
          >
            Maps
          </a>
        )}

        <button
          onClick={runReport}
          className="text-xs bg-field-accent/12 border border-field-accent/50 text-field-text rounded-lg px-2.5 py-2 whitespace-nowrap shrink-0 font-medium"
        >
          Report
        </button>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="text-field-muted bg-field-panel border border-field-line rounded-lg w-9 h-9 grid place-items-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
          </button>
          {menuOpen && (
            <>
              {/* Scrim: dims the page behind the menu so underlying score/decision text can't visually bleed into it, and doubles as a click-outside target */}
              <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 mt-1.5 w-52 max-w-[calc(100vw-2rem)] bg-field-card border border-field-line rounded-lg shadow-lg py-1 z-50">
                {property.location && (
                  <>
                    <button onClick={() => { navigator.clipboard.writeText(`${property.location!.lat},${property.location!.lng}`); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-field-text hover:bg-field-panel">Copy coordinates</button>
                    <button onClick={() => { setMenuOpen(false); void share(); }} className="w-full text-left px-3 py-2 text-sm text-field-text hover:bg-field-panel">Share</button>
                    <div className="border-t border-field-line my-1" />
                  </>
                )}
                <button onClick={() => { exportPropertyJson(property); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-field-text hover:bg-field-panel">Export JSON</button>
                <button onClick={() => { exportPropertyCsv(property); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-field-text hover:bg-field-panel">Export CSV</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
