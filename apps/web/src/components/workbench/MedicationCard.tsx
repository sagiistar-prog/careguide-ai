import type { MedicationCardData } from "./types";
import { confidenceLabel, displayMedicineText } from "./ui-copy";

type MedicationCardProps = {
  card: MedicationCardData;
  index: number;
  onOpenSource: (input: { chunkId: string; sourceId: string }) => void;
};

export function MedicationCard({
  card,
  index,
  onOpenSource,
}: MedicationCardProps) {
  const chunkId = card.chunk_ids[0];
  const sourceId = card.source_ids[0];

  return (
    <article className="rounded-[24px] border border-care-line bg-care-surface p-4 transition duration-200 ease-out hover:border-care-primary/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-care-muted">
            用药资料 {index + 1}
          </p>
          <h3 className="mt-1 text-base font-semibold leading-7 text-care-ink">
            {displayMedicineText(card.title)}
          </h3>
        </div>
        <span className="w-fit rounded-full border border-care-line bg-care-soft px-3 py-1 text-xs text-care-muted">
          可信度：{confidenceLabel(card.confidence)}
        </span>
      </div>

      <p className="mt-3 text-sm leading-7 text-care-ink">
        {displayMedicineText(card.plain_language_text || "当前资料不足，暂不能确认。")}
      </p>

      <button
        type="button"
        onClick={() => {
          if (chunkId && sourceId) {
            onOpenSource({ chunkId, sourceId });
          }
        }}
        disabled={!chunkId || !sourceId}
        className="mt-4 min-h-10 rounded-full border border-care-line bg-care-paper px-3 py-2 text-sm font-medium text-care-ink transition duration-200 ease-out hover:-translate-y-0.5 hover:border-care-primary hover:bg-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-focus active:translate-y-0 disabled:cursor-not-allowed disabled:text-care-muted"
      >
        出处
      </button>
    </article>
  );
}
