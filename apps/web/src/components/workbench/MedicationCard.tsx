import type { MedicationCardData } from "./types";
import { confidenceLabel, displayMedicineText } from "./ui-copy";

type MedicationCardProps = {
  card: MedicationCardData;
  index: number;
  onOpenSource: (input: { chunkId: string; sourceId: string }) => void;
};

function isPrescriptionReference(card: MedicationCardData) {
  const text = `${card.card_type} ${card.title} ${card.plain_language_text}`;
  return /处方|prescription|dosage|用药方案|通用用药/i.test(text);
}

export function MedicationCard({
  card,
  index,
  onOpenSource,
}: MedicationCardProps) {
  const chunkId = card.chunk_ids[0];
  const sourceId = card.source_ids[0];
  const prescriptionReference = isPrescriptionReference(card);

  return (
    <article className="rounded-md border border-care-line bg-care-surface p-4 transition duration-200 ease-out hover:border-care-primary/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-care-muted">
            {prescriptionReference ? "书中通用处方参考" : `用药资料 ${index + 1}`}
          </p>
          <h3 className="mt-1 text-base font-semibold leading-7 text-care-ink">
            {displayMedicineText(card.title)}
          </h3>
        </div>
        <span className="w-fit rounded-full border border-care-line bg-care-soft px-3 py-1 text-xs text-care-muted">
          可信度 {confidenceLabel(card.confidence)}
        </span>
      </div>

      <div
        className={`mt-3 max-w-3xl rounded-md ${
          prescriptionReference
            ? "border border-care-primary/25 bg-care-paper px-3 py-3"
            : ""
        }`}
      >
        {prescriptionReference ? (
          <p className="mb-2 text-xs font-medium text-care-muted">
            以下是资料中整理出的通用参考，不等同于个人医嘱。
          </p>
        ) : null}
        <p className="text-sm leading-7 text-care-ink">
          {displayMedicineText(
            card.plain_language_text || "当前资料不足，暂不能确认。",
          )}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-care-line pt-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-care-muted">适用范围</dt>
          <dd className="mt-1 text-sm leading-6 text-care-ink">
            {card.applicability ||
              "先看资料描述的是哪类人群、症状和用药场景，再和自己的情况对照。"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-care-muted">
            需要留意的个人因素
          </dt>
          <dd className="mt-1 text-sm leading-6 text-care-ink">
            {card.not_applicable_when ||
              "年龄、孕期或哺乳、肝肾功能、过敏史、正在使用的药物和症状严重程度，都会影响资料是否适用。"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            if (chunkId && sourceId) {
              onOpenSource({ chunkId, sourceId });
            }
          }}
          disabled={!chunkId || !sourceId}
          className="min-h-10 rounded-md border border-care-line bg-care-paper px-3 py-2 text-sm font-medium text-care-ink transition duration-200 ease-out hover:border-care-primary hover:bg-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care-focus disabled:cursor-not-allowed disabled:text-care-muted"
        >
          查看出处
        </button>
        <button
          type="button"
          onClick={() => {
            if (chunkId && sourceId) {
              onOpenSource({ chunkId, sourceId });
            }
          }}
          disabled={!chunkId || !sourceId}
          className="min-h-10 rounded-md border border-care-line bg-care-paper px-3 py-2 text-sm font-medium text-care-ink transition duration-200 ease-out hover:border-care-primary hover:bg-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care-focus disabled:cursor-not-allowed disabled:text-care-muted"
        >
          资料来源
        </button>
      </div>
    </article>
  );
}
