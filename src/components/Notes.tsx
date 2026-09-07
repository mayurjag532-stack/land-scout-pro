export default function NotesPanel({
  general,
  onGeneralChange
}: {
  general: string;
  onGeneralChange: (v: string) => void;
}) {
  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-base mb-1">📝 General Property Notes</h3>
      <p className="text-field-muted text-sm mb-3">Site notes and owner notes are captured in their own sections above. Anything else goes here.</p>
      <textarea
        value={general}
        onChange={(e) => onGeneralChange(e.target.value)}
        placeholder="General notes..."
        rows={4}
        className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
      />
    </div>
  );
}
