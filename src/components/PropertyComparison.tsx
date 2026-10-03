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
interface Enriched { p: PropertyRecord; s: ReturnType<typeof computeScore>; e: ReturnType<typeof economics> }

function toneFor(status: string) {
  return status === "STRONG" ? "good" : status === "REJECT" ? "bad" : status === "INVESTIGATE" ? "warn" : "neutral";
}

/* Identity block: name, verdict, signal, confidence, flags — shared by both layouts */
function IdentityBlock({ x, index }: { x: Enriched; index: number }) {
  return (
    <div className="ps-stagger" style={{ animationDelay: `${index * 40}ms` }}>
      <p className="font-display text-field-text text-[20px] leading-tight">{x.p.name}</p>
      <div className="mt-2.5 flex items-center gap-2.5">
        <ScoreRing value={x.s.total} tone={toneFor(x.s.status) as any} size={40} strokeWidth={4} />
        <div>
          <p className="tabular-nums text-field-text font-semibold text-[15px] leading-none">{x.s.total}<span className="text-field-muted font-normal text-xs">/100</span></p>
          <p className="text-field-muted text-[10px] mt-1">Confidence {x.s.confidence}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <SignalTag status={x.s.status} label={STATUS_LABEL[x.s.status]} />
        {x.s.criticalFlags.length > 0 && (
          <span className="text-field-bad text-[11px] font-medium">{x.s.criticalFlags.length} critical flag{x.s.criticalFlags.length === 1 ? "" : "s"}</span>
        )}
      </div>
    </div>
  );
}

/* Desktop: calm column table — hairlines, no zebra, generous rhythm */
function GroupTable({ title, rows, enriched }: { title: string; rows: Row[]; enriched: Enriched[] }) {
  return (
    <section className="mb-9 last:mb-2 hidden md:block" aria-label={title}>
      <p className="ps-kicker mb-3">{title}</p>
      <div className="border-t border-field-line">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr>
              <th className="w-44" aria-label="Metric" />
              {enriched.map((x) => (
                <th key={x.p.id} className="text-left font-display text-field-text text-[17px] font-semibold pt-4 pb-3 pr-6 align-bottom">{x.p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-field-line">
                <td className="text-field-muted py-3.5 pr-4 font-medium text-[12px] align-top">{row.label}</td>
                {enriched.map((x) => (
                  <td key={x.p.id} className="text-field-text py-3.5 pr-6 align-top">{row.get(x)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* Mobile: stacked sections per property — never a tiny table */
function GroupStack({ title, rows, enriched }: { title: string; rows: Row[]; enriched: Enriched[] }) {
  return (
    <section className="mb-9 last:mb-2 md:hidden" aria-label={title}>
      <p className="ps-kicker mb-3">{title}</p>
      <div className="space-y-5">
        {enriched.map((x, i) => (
          <div key={x.p.id} className="ps-stagger border-t border-field-line pt-4" style={{ animationDelay: `${i * 40}ms` }}>
            <p className="font-display text-field-text text-[16px] mb-2.5">{x.p.name}</p>
            <dl className="space-y-2">
              {rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-field-muted text-[12px] shrink-0">{row.label}</dt>
                  <dd className="text-field-text text-[13px] text-right">{row.get(x)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PropertyComparison({ properties, onClose }: { properties: PropertyRecord[]; onClose: () => void }) {
  const enriched: Enriched[] = properties.map(p => ({ p, s: computeScore(p), e: economics(p.price) }));
  const withPrice = enriched.filter(x => x.e.perSqft);
  const bestPrice = withPrice.length ? [...withPrice].sort((a, b) => (a.e.perSqft || Infinity) - (b.e.perSqft || Infinity))[0].p.id : null;
  const bestScore = [...enriched].sort((a, b) => b.s.total - a.s.total)[0]?.p.id;
  const bestAccess = [...enriched].filter(x => x.p.price.mainRoadDistanceM != null).sort((a, b) => (a.p.price.mainRoadDistanceM ?? Infinity) - (b.p.price.mainRoadDistanceM ?? Infinity))[0]?.p.id;
  const mostEvidence = [...enriched].sort((a, b) => b.s.breakdown.evidence - a.s.breakdown.evidence)[0]?.p.id;

  /* IDENTITY → PRICE → AREA → KEY FACTS → ECONOMICS → SPATIAL → EVIDENCE */
  const groups: Group[] = [
    {
      title: "Price",
      rows: [
        { label: "Effective price", get: (x: any) => <span className="font-display text-field-text text-[22px] tabular-nums">{money(x.e.effectivePrice)}</span> },
        { label: "Total acquisition", get: (x: any) => <span className="tabular-nums">{money(x.e.totalAcquisition)}</span> },
      ]
    },
    {
      title: "Area",
      rows: [
        { label: "Area", get: (x: any) => <span className="tabular-nums">{value(x.e.areaGuntha, " guntha")} · {value(x.e.areaSqft, " sq ft")}</span> },
        { label: "₹ / guntha", get: (x: any) => <span className="tabular-nums">{money(x.e.perGuntha)}</span> },
        { label: "₹ / sq ft", get: (x: any) => <span className="tabular-nums">{money(x.e.perSqft)}</span> },
      ]
    },
    {
      title: "Key facts",
      rows: [
        { label: "Road width", get: (x: any) => <span className="tabular-nums">{value(x.p.price.roadWidthFt, " ft")}</span> },
        { label: "Main-road distance", get: (x: any) => <span className="tabular-nums">{value(x.p.price.mainRoadDistanceM, " m")}</span> },
        { label: "Access score", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.access}/15</span> },
      ]
    },
    {
      title: "Site intelligence",
      rows: [
        { label: "Location", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.location}/15</span> },
        { label: "Infrastructure", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.infrastructure}/15</span> },
        { label: "Site condition", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.siteCondition}/15</span> },
        { label: "Legal readiness", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.legalReadiness}/10</span> },
      ]
    },
    {
      title: "Evidence",
      rows: [
        { label: "Evidence score", get: (x: any) => <span className="tabular-nums">{x.s.breakdown.evidence}/10</span> },
        { label: "Photos captured", get: (x: any) => <span className="tabular-nums">{x.p.photos.length}</span> },
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
        <header className="sticky top-0 ps-surface-float backdrop-blur border-b border-field-line px-5 md:px-8 py-4 flex justify-between items-start gap-3 z-10 rounded-t-3xl">
          <div>
            <p className="ps-kicker">Decision workspace</p>
            <h3 className="font-display text-field-text text-[24px] mt-1">Compare plots</h3>
            <p className="text-field-muted text-xs mt-1">Observed data only. Legal and market verification remain independent.</p>
          </div>
          <button onClick={onClose} aria-label="Close comparison" className="text-field-muted border border-field-line rounded-xl px-4 text-sm font-medium hover:text-field-text shrink-0">Close</button>
        </header>

        <div className="px-5 md:px-8 py-6 md:py-8">
          {/* Identity: each property introduced once, editorially */}
          <div className={`grid gap-6 mb-10 ${enriched.length > 2 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
            {enriched.map((x, i) => <IdentityBlock key={x.p.id} x={x} index={i} />)}
          </div>

          {/* Callouts: quiet editorial strip, not cards-in-grid */}
          {callouts.length > 0 && (
            <div className="border-y border-field-line py-4 mb-10 space-y-2.5">
              {callouts.map((c, i) => (
                <div key={c.label} className="flex items-baseline justify-between gap-4 ps-stagger" style={{ animationDelay: `${i * 40}ms` }}>
                  <p className="text-[10px] uppercase tracking-[.12em] text-field-muted font-semibold shrink-0">{c.label}</p>
                  <p className="text-sm text-field-text font-medium text-right">{properties.find(p => p.id === c.id)?.name}</p>
                </div>
              ))}
            </div>
          )}

          {groups.map((g) => (
            <div key={g.title}>
              <GroupTable title={g.title} rows={g.rows} enriched={enriched} />
              <GroupStack title={g.title} rows={g.rows} enriched={enriched} />
            </div>
          ))}

          <p className="text-[11px] text-field-muted mt-4 leading-relaxed max-w-[62ch]">Callouts rank only the information recorded in Plot Scout. They are not investment recommendations or legal conclusions.</p>
        </div>
      </section>
    </div>
  );
}
