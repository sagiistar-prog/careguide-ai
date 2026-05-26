import type { AnswerSentence } from "./types";
import { displayMedicineText } from "./ui-copy";

export function SafetyNoticeList({ notices }: { notices: AnswerSentence[] }) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-care-warning/45 bg-care-warning-soft p-4">
      <h2 className="text-base font-semibold text-care-ink">用药提醒</h2>
      <ul className="mt-3 space-y-2">
        {notices.map((notice) => (
          <li key={notice.sentence_id} className="text-sm leading-7 text-care-ink">
            {displayMedicineText(notice.text)}
          </li>
        ))}
      </ul>
    </section>
  );
}
