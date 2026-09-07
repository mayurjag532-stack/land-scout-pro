import { useState } from "react";
import { PropertyRecord } from "../types";
import { exportAllJson, exportAllCsv } from "../utils/export";
import { deleteProperty } from "../db";

export default function Settings({
  properties,
  onDataChanged
}: {
  properties: PropertyRecord[];
  onDataChanged: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  async function clearAll() {
    for (const p of properties) {
      await deleteProperty(p.id);
    }
    setConfirmClear(false);
    onDataChanged();
  }

  const storageEstimateMb = properties.reduce((sum, p) => sum + JSON.stringify(p).length, 0) / (1024 * 1024);

  return (
    <div className="px-4 py-4 max-w-xl mx-auto pb-24 space-y-4">
      <h2 className="text-field-text text-xl font-bold">Settings / Data</h2>

      <div className="bg-field-card border border-field-line rounded-xl p-4">
        <p className="text-field-text font-semibold mb-1">Storage</p>
        <p className="text-field-muted text-sm">
          {properties.length} properties saved on this device &middot; approx. {storageEstimateMb.toFixed(2)} MB
        </p>
        <p className="text-field-muted text-xs mt-2">
          All data (locations, checklist, owner answers, photos) is stored locally in this browser only. Nothing is uploaded automatically.
        </p>
      </div>

      <div className="bg-field-card border border-field-line rounded-xl p-4">
        <p className="text-field-text font-semibold mb-2">Export</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => exportAllJson(properties)}
            className="bg-field-panel border border-field-accent text-field-accent rounded-lg py-2.5 text-sm font-medium"
          >
            Export all as JSON
          </button>
          <button
            onClick={() => exportAllCsv(properties)}
            className="bg-field-panel border border-field-accent text-field-accent rounded-lg py-2.5 text-sm font-medium"
          >
            Export all as CSV
          </button>
        </div>
      </div>

      <div className="bg-field-card border border-field-bad/40 rounded-xl p-4">
        <p className="text-field-bad font-semibold mb-2">Danger zone</p>
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)} className="text-field-bad text-sm border border-field-bad/50 rounded-lg px-4 py-2">
            Delete all saved properties
          </button>
        ) : (
          <div>
            <p className="text-field-text text-sm mb-2">This permanently deletes all {properties.length} saved properties. Export first if needed.</p>
            <div className="flex gap-2">
              <button onClick={clearAll} className="bg-field-bad text-field-bg rounded-lg px-4 py-2 text-sm font-semibold">
                Yes, delete everything
              </button>
              <button onClick={() => setConfirmClear(false)} className="bg-field-panel text-field-text rounded-lg px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-field-panel border border-field-line rounded-xl p-4">
        <p className="text-field-muted text-[11px]">
          Map data is an indicator only. Ownership, title, zoning, NA status, legal access and permissions must be independently verified.
        </p>
      </div>
    </div>
  );
}
