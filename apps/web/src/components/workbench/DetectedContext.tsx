import type { QueryResponse } from "./types";
import { displayMedicineText, scenarioTitle } from "./ui-copy";

export function DetectedContext({
  detected,
}: {
  detected: QueryResponse["detected_entities"];
}) {
  const items = [
    ...detected.drugs.map((drug) => ({
      label: "药品",
      value: displayMedicineText(drug.display_name || drug.canonical_name),
    })),
    ...detected.scenarios.map((scenario) => ({
      label: "场景",
      value: scenarioTitle(scenario.canonical_name),
    })),
    ...detected.population.map((population) => ({
      label: "人群",
      value:
        population === "children"
          ? "儿童"
          : population === "older_adult"
            ? "老人"
            : population,
    })),
  ];

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[24px] border border-care-line bg-care-surface px-4 py-3">
      <p className="text-xs font-medium text-care-muted">已识别的信息</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={`${item.label}-${item.value}-${index}`}
            className="rounded-full border border-care-line bg-care-paper px-3 py-1 text-xs text-care-muted"
          >
            {item.label}：{item.value}
          </span>
        ))}
      </div>
    </section>
  );
}
