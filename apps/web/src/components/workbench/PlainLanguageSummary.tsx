import type { AnswerSentence } from "./types";
import { displayMedicineText } from "./ui-copy";

export function PlainLanguageSummary({
  sentences,
}: {
  sentences: AnswerSentence[];
}) {
  if (sentences.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[24px] border border-care-line bg-care-surface p-4">
      <h2 className="text-base font-semibold text-care-ink">简要说明</h2>
      <div className="mt-3 space-y-3">
        {sentences.map((sentence) => (
          <p key={sentence.sentence_id} className="max-w-3xl text-sm leading-7 text-care-ink">
            {displayMedicineText(sentence.text)}
          </p>
        ))}
      </div>
    </section>
  );
}
