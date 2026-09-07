import { PropertyRecord, PropertyStatus } from "../types";
import { computeScore } from "../utils/scoring";

const STATUS_STYLE: Record<PropertyStatus, { label: string; bg: string; text: string }> = {
  STRONG: { label: "🟢 STRONG", bg: "bg-field-good/15", text: "text-field-good" },
  INVESTIGATE: { label: "🟡 INVESTIGATE", bg: "bg-field-warn/15", text: "text-field-warn" },
  REJECT: { label: "🔴 REJECT", bg: "bg-field-bad/15", text: "text-field-bad" },
  UNDECIDED: { label: "⚪ UNDECIDED", bg: "bg-field-muted/15", text: "text-field-muted" }
};

export default function FinalStatusPanel({
  property,
  onStatusChange,
  onFollowUpChange
}: {
  property: PropertyRecord;
  onStatusChange: (s: PropertyStatus) => void;
  onFollowUpChange: (v: string) => void;
}) {
  const score = computeScore(property);

  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-base mb-1">⭐ Final Status</h3>

      <div className={`rounded-lg p-3 mt-2 ${STATUS_STYLE[score.status].bg}`}>
        <p className="text-field-muted text-xs mb-1">Overall Site Signal</p>
        <p className={`text-3xl font-bold ${STATUS_STYLE[score.status].text}`}>{score.total} / 100</p>
        <p className={`text-sm font-semibold mt-1 ${STATUS_STYLE[score.status].text}`}>{STATUS_STYLE[score.status].label}</p>
      </div>

      <details className="mt-3">
        <summary className="text-field-accent text-sm cursor-pointer">Why this score?</summary>
        <ul className="mt-2 space-y-1">
          {score.explanation.map((line, i) => (
            <li key={i} className="text-field-muted text-xs">
              {line}
            </li>
          ))}
        </ul>
      </details>

      <p className="text-field-muted text-[11px] mt-3">
        This is a field-signal indicator, not a professional legal or real-estate valuation.
      </p>

      <div className="mt-4">
        <p className="text-field-text text-sm font-semibold mb-2">Set follow-up status</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(STATUS_STYLE) as PropertyStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`py-2.5 rounded-lg text-sm font-medium border ${
                property.finalStatus === s
                  ? `${STATUS_STYLE[s].bg} ${STATUS_STYLE[s].text} border-current`
                  : "bg-field-panel text-field-muted border-field-line"
              }`}
            >
              {STATUS_STYLE[s].label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={property.followUp}
        onChange={(e) => onFollowUpChange(e.target.value)}
        placeholder="Follow-up plan (call back, revisit, negotiate...)"
        rows={2}
        className="w-full mt-3 bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
      />

      <div className="mt-4 bg-field-panel border border-field-line rounded-lg p-3">
        <p className="text-field-muted text-[11px]">
          Map data is an indicator only. Ownership, title, zoning, NA status, legal access and permissions must be independently verified.
        </p>
      </div>
    </div>
  );
}
