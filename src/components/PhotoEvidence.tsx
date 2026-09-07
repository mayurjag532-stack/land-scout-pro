import { useRef, useState } from "react";
import { PhotoCategory, PropertyPhoto } from "../types";

const CATEGORIES: { id: PhotoCategory; label: string }[] = [
  { id: "front_road", label: "Front road" },
  { id: "plot", label: "Plot" },
  { id: "left_side", label: "Left side" },
  { id: "right_side", label: "Right side" },
  { id: "rear", label: "Rear" },
  { id: "surrounding", label: "Surrounding area" },
  { id: "access_road", label: "Access road" },
  { id: "documents", label: "Documents (optional)" }
];

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.72;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read photo file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode photo."));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported on this device."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoEvidence({
  photos,
  onAdd,
  onRemove
}: {
  photos: PropertyPhoto[];
  onAdd: (photo: PropertyPhoto) => void;
  onRemove: (id: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<PhotoCategory>("plot");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const dataUrl = await resizeImage(file);
      onAdd({ id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, category: activeCategory, dataUrl, addedAt: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add photo. Check camera/file permission.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-base mb-1">📷 Photo Evidence</h3>
      <p className="text-field-muted text-sm mb-3">Stored locally on this device with the visit record.</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              activeCategory === c.id ? "bg-field-accent text-field-bg border-field-accent" : "bg-field-panel text-field-muted border-field-line"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" id="photo-input" />
      <label
        htmlFor="photo-input"
        className="block w-full text-center py-3 rounded-xl bg-field-panel border border-field-accent text-field-accent font-medium cursor-pointer"
      >
        Add photo — {CATEGORIES.find((c) => c.id === activeCategory)?.label}
      </label>

      {error && <p className="text-field-bad text-sm mt-2">{error}</p>}

      <div className="grid grid-cols-3 gap-2 mt-4">
        {photos.map((p) => (
          <div key={p.id} className="relative">
            <img src={p.dataUrl} className="w-full h-24 object-cover rounded-lg border border-field-line" />
            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded-b-lg truncate">
              {CATEGORIES.find((c) => c.id === p.category)?.label}
            </span>
            <button
              onClick={() => onRemove(p.id)}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs leading-5"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="text-field-muted text-xs italic mt-2">No photos added yet.</p>}
    </div>
  );
}
