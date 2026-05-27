import type { AnswerSentence } from "./types";
import { displayMedicineText } from "./ui-copy";

export function PharmacistQuestions({
  questions,
  highlight = false,
}: {
  questions: AnswerSentence[];
  highlight?: boolean;
}) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <section
      className={`rounded-[24px] border p-4 ${
        highlight
          ? "border-care-warning/45 bg-care-warning-soft"
          : "border-care-line bg-care-surface"
      }`}
    >
      <h2 className="text-base font-semibold text-care-ink">可补充确认的信息</h2>
      <ol className="mt-3 space-y-3">
        {questions.map((question, index) => (
          <li key={question.sentence_id} className="flex gap-3 text-sm leading-7 text-care-ink">
            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-care-paper text-xs font-semibold text-care-muted">
              {index + 1}
            </span>
            <span>{displayMedicineText(question.text)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
