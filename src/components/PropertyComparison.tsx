import { PropertyRecord } from "../types";
import { computeScore } from "../utils/scoring";
import { economics } from "../utils/economics";
import { SignalTag } from "./ui/StatusTag";
import { ScoreRing } from "./ui/ScoreRing";

const STATUS_LABEL: Record<string, string> = { STRONG: "Strong", INVESTIGATE: "Investigate", REJECT: "Reject", UNDECIDED: "Undecided" };
const money = (n: number | null | undefined) => n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;
const value = (n: number | null | undefined, suffix = "") => n == null ? "—" : `${Number(n.toFixed(2)).toLocaleString("en-IN")}${suffix}`;

interface Row { label: string; get: (x: any) => React.ReactNode }
interface Group { title: string; rows: Row[] }

export default function PropertyComparison({ properties, onClose }: { properties: PropertyRecord[]; onClose: () => void }) {
  const enriched = properties.map(p => ({ p, s: computeScore(p), e: economics(p.price) }));
  const withPrice = enriched.filter(x => x.e.perSqft);
  const bestPrice = withPrice.length ? [...withPrice].sort((a, b) => (a.e.perSqft || Infinity) - (b.e.perSqft || Infinity))[0].p.id : null;
  const bestScore = [...enriched].sort((a, b) => b.s.total - a.s.total)[0]?.p.id;
  const bestAccess = [...enriched].filter(x => x.p.price.mainRoadDistanceM != null).sort((a, b) => (a.p.price.mainRoadDistanceM ?? Infinity) - (b.p.price.mainRoadDistanceM ?? Infinity))[0]?.p.id;
  const mostEvidence = [...enriched].sort((a, b) => b.s.breakdown.evidence - a.s.breakdown.evidence)[0]?.p.id;

  const groups: Group[] = [
    {
      title: "Decision",
      rows: [
        { label: "Verdict", get: (x: any) => <span className="inline-flex flex-col items-start gap-1"><SignalTag status={x.s.status} label={STATUS_LABEL[x.s.status]} /><span className="text-field-muted text-[10px]">Confidence {x.s.confidence}</span></span> },
        { label: "Site signal", get: (x: any) => <span className="inline-flex items-center gap-2"><ScoreRing value={x.s.total} tone={x.s.status === "STRONG" ? "good" : x.s.status === "REJECT" ? "bad" : x.s.status === "INVESTIGATE" ? "warn" : "neutral"} size={34} strokeWidth={3.5} /><span className="tabular-nums font-semibold">{x.s.total}<span className="text-field-muted font-normal">/100</span></span></span> },
        { label: "Critical flags", get: (x: any) => x.s.criticalFlags.length ? <span className="text-field-bad font-medium">{x.s.criticalFlags.length} flag(s)</span> : "None recorded" }
      ]
    },
    {
      title: "Economics",
      rows: [
        { label: "Effective price", get: (x: any) => <span className="tabular-nums font-semibold">{money(x.e.effectivePrice)}</span> },
        { label: "Total acquisition", get: (x: any) => <span className="tabular-nums">{money(x.e.totalAcquisition)}</span> },
        { label: "Area", get: (x: any) => <span className="tabular-nums">{value(x.e.areaGuntha, " guntha")} · {value(x.e.areaSqft, " sq ft")}</span> },
        { label: "₹ / guntha", get: (x: any) => <span className="tabular-nums">{money(x.e.perGuntha)}</span> },
        { label: "₹ / sq ft", get: (x: any) => <span className="tabular-nums">{money(x.e.perSqft)}</span> }
      ]
    },
    {
      title: "Access",
      rows: [
        { label: "Road width", get: (x: any) => <span className="tabular-nums">{value(x.p.price.roadWidthFt, " ft")}</span> },
        { label: "Main-road distance", get: (x: any) => <span className="tabular-nums">{value(x.p.price.mainRoadDistanceM, " m")}</span> },
        { label: "Access score", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.access}/15</span> }
      ]
    },
    {
      title: "Scores",
      rows: [
        { label: "Location", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.location}/15</span> },
        { label: "Infrastructure", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.infrastructure}/15</span> },
        { label: "Site condition", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.siteCondition}/15</span> },
        { label: "Legal readiness", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.legalReadiness}/10</span> }
      ]
    },
    {
      title: "Evidence",
      rows: [
        { label: "Evidence score", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.evidence}/10 · {x.p.photos.length} photos</span> }
      ]
    }
  ];

  const callouts = [
    { label: "Best overall signal", id: bestScore },
    { label: "Lowest observed ₹/sq ft", id: bestPrice },
    { label: "Closest recorded main road", id: bestAccess },
    { label: "Strongest evidence set", id: mostEvidence }
  ].filter(x => x.id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 ps-fade" onClick={onClose} role="dialog" aria-modal="true" aria-label="Property comparison">
      <section
        className="bg-field-card border border-field-line rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-[var(--shadow-sheet)] ps-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-white/95 backdrop-blur border-b border-field-line px-5 py-4 flex justify-between items-start gap-3 z-10 rounded-t-3xl">
          <div>
            <p className="ps-kicker">Decision workspace</p>
            <h3 className="font-display text-field-text text-[22px] mt-1">Property comparison</h3>
            <p className="text-field-muted text-xs mt-1">Observed data only. Legal and market verification remain independent.</p>
          </div>
          <button onClick={onClose} className="text-field-muted border border-field-line rounded-xl px-4 text-sm font-medium hover:text-field-text shrink-0">Close</button>
        </header>
        <div className="p-5">
          <div className="grid sm:grid-cols-2 gap-2.5 mb-6">
            {callouts.map((c, i) => (
              <div key={c.label} className="bg-field-panel border border-field-line rounded-2xl p-3.5 ps-stagger" style={{ animationDelay: `${i * 40}ms` }}>
                <p className="text-[10px] uppercase tracking-[.12em] text-field-muted font-semibold">{c.label}</p>
                <p className="text-sm text-field-text font-semibold mt-1">{properties.find(p => p.id === c.id)?.name}</p>
              </div>
            ))}
          </div>
          {groups.map((g) => (
            <div key={g.title} className="mb-6 last:mb-2">
              <p className="ps-kicker mb-2">{g.title}</p>
              <div className="overflow-x-auto border border-field-line rounded-2xl">
                <table className="w-full text-xs border-collapse min-w-[620px]">
                  <thead>
                    <tr className="bg-field-panel">
                      <th className="text-left text-field-muted font-semibold p-3 w-40">Metric</th>
                      {properties.map(p => <th key={p.id} className="text-left text-field-text p-3 min-w-[160px] font-display text-[15px] font-semibold">{p.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((row, ri: number) => (
                      <tr key={row.label} className={`border-t border-field-line ${ri % 2 === 1 ? "bg-field-panel/50" : ""}`}>
                        <td className="text-field-muted p-3 whitespace-nowrap font-medium">{row.label}</td>
                        {enriched.map(x => <td key={x.p.id} className="text-field-text p-3 align-top">{row.get(x)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-field-muted mt-2 leading-relaxed">Callouts rank only the information recorded in Plot Scout. They are not investment recommendations or legal conclusions.</p>
        </div>
      </section>
    </div>
  );
}
