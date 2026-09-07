import { OWNER_QUESTIONS, OwnerAnswers } from "../types";

export default function OwnerQuestionsPanel({
  answers,
  onChange,
  notes,
  onNotesChange
}: {
  answers: OwnerAnswers;
  onChange: (id: string, value: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-base mb-1">🗣️ Owner Questions</h3>
      <p className="text-field-muted text-sm mb-3">Standard property due-diligence questions to ask the owner.</p>

      <div className="space-y-3">
        {OWNER_QUESTIONS.map((q) => (
          <div key={q.id}>
            <label className="text-field-text text-sm block mb-1">{q.text}</label>
            <input
              value={answers[q.id] || ""}
              onChange={(e) => onChange(q.id, e.target.value)}
              className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 bg-field-panel rounded-lg p-3">
        <p className="text-field-muted text-xs italic">
          If asked why you're buying: "Investment / apne use ke liye property dekh raha hoon. Location suitable hui toh aage decide karunga."
        </p>
      </div>

      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Additional owner notes..."
        rows={3}
        className="w-full mt-3 bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
      />
    </div>
  );
}
