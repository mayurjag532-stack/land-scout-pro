import { useState } from "react";
import LeadInbox from "./LeadInbox";
import { OpportunityLead, newDiscoveryLead } from "../leads";

type Scope = { mode: "near_me" | "selected"; lat?: number; lon?: number; state: string; district: string; taluka: string; locality: string; radiusKm: number };
const endpoint = (import.meta.env.VITE_RADAR_DISCOVERY_URL || "/api/radar-discovery").trim();

function gpsErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return "Location permission denied. Enable location access for this site in your browser settings, or use \"Choose area\" below instead — Radar works fully without GPS.";
  if (err.code === err.TIMEOUT) return "GPS timed out. Try again outdoors/near a window, or use \"Choose area\" below instead.";
  return "Location unavailable right now. Try again, or use \"Choose area\" below instead.";
}

export default function OpportunityRadar({ leads, onDelete, onDiscovered, onDeleteSelected, onDeleteAll, onUpdate }: { leads: OpportunityLead[]; onDelete: (id: string) => void; onDiscovered: (lead: OpportunityLead) => Promise<void>; onDeleteSelected?: (ids: string[]) => Promise<void>; onDeleteAll?: () => Promise<void>; onUpdate?: (lead: OpportunityLead) => Promise<void> }) {
  const [scope, setScope] = useState<Scope>({ mode: "near_me", state: "", district: "", taluka: "", locality: "", radiusKm: 15 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  function locate() {
    if (!("geolocation" in navigator)) { setMsg("This browser does not support GPS. Use \"Choose area\" below instead."); return; }
    setBusy(true);
    setMsg("Getting location\u2026");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude, lon = p.coords.longitude;
        let patch: Partial<Scope> = { lat, lon };
        let resolved = true;
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;
          const r = await fetch(url, { headers: { Accept: "application/json", "Accept-Language": "en" } });
          if (!r.ok) throw new Error(`Geocoder ${r.status}`);
          const d = await r.json();
          const a = d?.address || {};
          patch = { ...patch, state: a.state || "", district: a.state_district || a.county || a.district || "", taluka: a.subdistrict || a.taluka || a.county || "", locality: a.village || a.town || a.city || a.suburb || a.hamlet || a.neighbourhood || a.city_district || "" };
          resolved = Boolean(patch.state || patch.district || patch.taluka || patch.locality);
        } catch {
          resolved = false;
        }
        setScope((s) => ({ ...s, ...patch, mode: "near_me" }));
        setMsg(resolved ? "Location ready. Discovery will use this area, not a hard-coded city." : "GPS captured, but area names could not be resolved (geocoder unavailable). Coordinates were kept safely — nothing was guessed. Tap \"Refresh current location\" to retry, or use \"Choose area\" below.");
        setBusy(false);
      },
      (err) => { setMsg(gpsErrorMessage(err)); setBusy(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  async function discover() {
    if (scope.mode === "near_me" && !scope.lat) { setMsg("Capture current location first, or switch to \"Choose area\"."); return; }
    if (scope.mode === "selected" && !scope.state.trim()) { setMsg("Enter at least a State for selected-area search."); return; }
    if (!endpoint) { setMsg("Discovery engine is not connected yet. Scope is ready; no fake leads were generated."); return; }
    setBusy(true);
    setMsg("Searching public opportunity sources...");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scope, country: "IN" }) });
      if (!r.ok) throw new Error(`Discovery service ${r.status}`);
      const d = await r.json();
      const candidates = Array.isArray(d?.candidates) ? d.candidates : [];
      const actionable = candidates
        .filter((candidate: any) => candidate?.saleIntent === true || candidate?.evidenceClass === "sale_signal")
        .sort((a: any, b: any) => (Number(a?.distanceKm) || 999999) - (Number(b?.distanceKm) || 999999));
      let added = 0;
      for (const candidate of actionable) {
        const url = String(candidate?.sourceUrl || "").trim();
        const externalId = String(candidate?.externalId || "").trim();
        const duplicate = leads.some((l) => l.sourceUrl === url || l.evidence.some((e) => e.kind === "verification_snapshot" && externalId && e.value.includes(`"externalId":"${externalId}"`)));
        if (duplicate) continue;
        await onDiscovered(newDiscoveryLead(candidate));
        added++;
      }
      setMsg(`${candidates.length} signals scanned. ${actionable.length} sale signals found. ${added} new leads captured. ${candidates.length - actionable.length} context-only signals filtered out.`);
    } catch (e: any) {
      setMsg(`Discovery failed safely: ${e?.message || "Unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-4 pt-4 pb-24 max-w-xl mx-auto space-y-5">
      <section><p className="text-[11px] uppercase tracking-[.18em] text-field-muted">Opportunity Radar - India</p><h2 className="text-2xl font-semibold tracking-tight mt-1">Find land opportunities</h2><p className="text-sm text-field-muted mt-1">Choose where. Plot Scout does the searching, verification and filtering.</p></section>
      <section className="rounded-2xl border border-field-line bg-field-card p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setScope((s) => ({ ...s, mode: "near_me" }))} className={`rounded-xl border p-3 text-sm ${scope.mode === "near_me" ? "border-field-accent text-field-accent" : "border-field-line text-field-muted"}`}>Near me</button>
          <button onClick={() => setScope((s) => ({ ...s, mode: "selected" }))} className={`rounded-xl border p-3 text-sm ${scope.mode === "selected" ? "border-field-accent text-field-accent" : "border-field-line text-field-muted"}`}>Choose area</button>
        </div>
        {scope.mode === "near_me" ? (
          <div>
            <button disabled={busy} onClick={locate} className="w-full rounded-xl bg-field-accent text-field-bg font-semibold py-3">{scope.lat ? "Refresh current location" : "Use current location"}</button>
            {scope.lat && <p className="text-xs text-field-muted mt-2">{[scope.locality, scope.taluka, scope.district, scope.state].filter(Boolean).join(" - ") || `${scope.lat.toFixed(5)}, ${scope.lon?.toFixed(5)}`}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(["state", "district", "taluka", "locality"] as const).map((k) => (
              <label key={k} className="text-xs text-field-muted">
                {k === "state" ? "State *" : k === "district" ? "District" : k === "taluka" ? "Taluka / Tehsil" : "Village / Locality"}
                <input value={scope[k]} onChange={(e) => setScope((s) => ({ ...s, [k]: e.target.value }))} className="mt-1 w-full rounded-lg border border-field-line bg-field-bg px-3 py-2 text-field-text" />
              </label>
            ))}
          </div>
        )}
        <label className="block text-xs text-field-muted">Search radius: {scope.radiusKm} km<input type="range" min="2" max="100" value={scope.radiusKm} onChange={(e) => setScope((s) => ({ ...s, radiusKm: Number(e.target.value) }))} className="w-full mt-2" /></label>
        <button disabled={busy} onClick={discover} className="w-full rounded-xl border border-field-accent bg-field-accent/10 text-field-accent font-semibold py-3">{busy ? "Working..." : "Find opportunities"}</button>
        {msg && <p className="text-xs text-field-muted">{msg}</p>}
      </section>
      <div className="rounded-xl border border-field-warn/30 bg-field-card p-3 text-sm"><span className="font-semibold text-field-warn">Evidence rule:</span> <span className="text-field-muted">Search context is never treated as property location. No verified location - no opportunity score.</span></div>
      <section className="rounded-2xl border border-field-line bg-field-card p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelected(selected.length === leads.length ? [] : leads.map((l) => l.id))} disabled={!leads.length} className="rounded-xl border border-field-line px-3 py-2 text-xs font-semibold">
            {selected.length === leads.length && leads.length ? "Clear Selection" : "Select All"}
          </button>
          <button type="button" disabled={!selected.length} onClick={async () => { if (!confirm(`Delete ${selected.length} selected leads?`)) return; if (onDeleteSelected) await onDeleteSelected(selected); else for (const id of selected) await Promise.resolve(onDelete(id)); setSelected([]); }} className="rounded-xl border border-field-line px-3 py-2 text-xs font-semibold">
            Delete Selected ({selected.length})
          </button>
          <button type="button" disabled={!leads.length} onClick={async () => { if (!confirm(`Delete all ${leads.length} leads? This cannot be undone.`)) return; if (onDeleteAll) await onDeleteAll(); else for (const lead of leads) await Promise.resolve(onDelete(lead.id)); setSelected([]); }} className="rounded-xl border border-field-line px-3 py-2 text-xs font-semibold">
            Delete All ({leads.length})
          </button>
        </div>
        {!!leads.length && <div className="max-h-44 overflow-auto space-y-1">{leads.map((l) => <label key={l.id} className="flex items-center gap-2 text-xs text-field-muted"><input type="checkbox" checked={selected.includes(l.id)} onChange={() => setSelected((s) => s.includes(l.id) ? s.filter((id) => id !== l.id) : [...s, l.id])} /><span className="truncate">{l.sharedTitle || "Untitled lead"}</span></label>)}</div>}
      </section>
      <LeadInbox leads={leads} onDelete={onDelete} onUpdate={onUpdate} embedded />
    </main>
  );
}
