import { PriceData } from "../types";

const GUNTHA_TO_SQFT = 1089;

function NumField({
  label,
  value,
  onChange,
  suffix
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
}) {
  return (
    <div>
      <label className="text-field-text text-sm block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
          className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
        />
        {suffix && <span className="text-field-muted text-xs shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

export default function PriceDataPanel({
  price,
  onChange
}: {
  price: PriceData;
  onChange: (price: PriceData) => void;
}) {
  const set = <K extends keyof PriceData>(key: K, value: PriceData[K]) => onChange({ ...price, [key]: value });

  const areaSqft = price.areaSqft ?? (price.areaGuntha ? price.areaGuntha * GUNTHA_TO_SQFT : null);
  const areaGuntha = price.areaGuntha ?? (price.areaSqft ? price.areaSqft / GUNTHA_TO_SQFT : null);
  const perSqft = price.quotedPrice && areaSqft ? price.quotedPrice / areaSqft : null;
  const perGuntha = price.quotedPrice && areaGuntha ? price.quotedPrice / areaGuntha : null;

  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-base mb-3">💰 Price / Property Data</h3>

      <div className="grid grid-cols-2 gap-3">
        <NumField label="Quoted price (₹)" value={price.quotedPrice} onChange={(v) => set("quotedPrice", v)} />
        <NumField label="Asking price (₹)" value={price.askingPrice} onChange={(v) => set("askingPrice", v)} />
        <NumField label="Area (sq ft)" value={price.areaSqft} onChange={(v) => set("areaSqft", v)} />
        <NumField label="Area (guntha)" value={price.areaGuntha} onChange={(v) => set("areaGuntha", v)} />
        <NumField label="Road width" value={price.roadWidthFt} onChange={(v) => set("roadWidthFt", v)} suffix="ft" />
        <NumField label="Main road distance" value={price.mainRoadDistanceM} onChange={(v) => set("mainRoadDistanceM", v)} suffix="m" />
      </div>

      {(perSqft || perGuntha) && (
        <div className="mt-3 bg-field-panel rounded-lg p-3 text-sm">
          <p className="text-field-muted text-xs mb-1">Estimated (1 guntha ≈ {GUNTHA_TO_SQFT} sq ft) — not a valuation:</p>
          {perSqft && <p className="text-field-text">₹{Math.round(perSqft).toLocaleString("en-IN")} / sq ft</p>}
          {perGuntha && <p className="text-field-text">₹{Math.round(perGuntha).toLocaleString("en-IN")} / guntha</p>}
        </div>
      )}
    </div>
  );
}
