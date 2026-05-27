import type { MedicationGroup, SourceRef } from "./display-adapter";
import { confidenceLabel } from "./ui-copy";

type MedicationDisplayCardProps = {
  group: MedicationGroup;
  onOpenSources: (refs: SourceRef[]) => void;
};

const FIELD_LABELS = {
  indication: "适应症",
  dosage: "用量用法",
  decoction: "煎法或做法",
  contraindications: "禁忌",
  cautions: "注意事项",
  adverse: "不良反应",
} as const;

export function MedicationDisplayCard({
  group,
  onOpenSources,
}: MedicationDisplayCardProps) {
  const fields =
    group.category === "tcm"
      ? ([
          "indication",
          "dosage",
          "decoction",
          "contraindications",
          "cautions",
        ] as const)
      : ([
          "indication",
          "dosage",
          "contraindications",
          "cautions",
          "adverse",
        ] as const);
  const sourceCount = group.sourceRefs.length;

  return (
    <article className="rounded-[30px] border border-care-line bg-care-paper p-5 shadow-care-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-care-lift">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-care-cocoa">
            {group.category === "tcm" ? "中成药" : "西药"}
          </p>
          <h4 className="mt-1 text-2xl font-semibold leading-9 text-care-ink">
            {group.name}
          </h4>
          <p className="mt-2 text-xs font-semibold text-care-muted">
            可信度：{confidenceLabel(group.confidence)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenSources(group.sourceRefs)}
          disabled={sourceCount === 0}
          className="min-h-11 rounded-full border border-care-line bg-care-surface px-4 py-2 text-sm font-semibold text-care-ink transition duration-200 ease-out hover:-translate-y-0.5 hover:border-care-primary hover:bg-care-soft hover:shadow-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-focus active:translate-y-0 active:scale-[0.98] disabled:bg-care-disabled disabled:text-care-muted disabled:shadow-none"
        >
          出处{sourceCount > 1 ? `（${sourceCount}）` : ""}
        </button>
      </div>

      <dl className="mt-5 grid gap-3">
        {fields.map((field) => (
          <div
            key={field}
            className="rounded-2xl border border-care-line bg-care-surface px-4 py-3"
          >
            <dt className="text-sm font-semibold text-care-cocoa">
              {FIELD_LABELS[field]}
            </dt>
            <dd className="mt-1 whitespace-pre-line text-sm leading-7 text-care-ink">
              {group.fields[field]}
            </dd>
          </div>
        ))}
      </dl>

      {group.externalNotes.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-care-line bg-care-soft px-4 py-3">
          <p className="text-sm font-semibold text-care-cocoa">外部检索补充</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {group.externalNotes.map((note) => (
              <li key={note} className="text-sm leading-7 text-care-ink">
                {note}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </article>
  );
}
