import { scenarioTitle } from "./ui-copy";
import type { Scenario } from "./types";

type ScenarioGridProps = {
  scenarios: Scenario[];
  selectedScenario: string | null;
  onSelect: (scenario: Scenario) => void;
};

export function ScenarioGrid({
  scenarios,
  selectedScenario,
  onSelect,
}: ScenarioGridProps) {
  if (scenarios.length === 0) {
    return (
      <div className="rounded-[24px] border border-care-line bg-care-surface px-4 py-5 text-sm text-care-muted">
        场景正在加载。你也可以先直接输入问题。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-care-ink">常见场景</h2>
        <p className="mt-1 text-sm leading-6 text-care-muted">
          选择场景会自动带入示例问题，方便你更快开始。
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {scenarios.map((scenario) => {
          const active = selectedScenario === scenario.key;

          return (
            <button
              key={scenario.key}
              type="button"
              onClick={() => onSelect(scenario)}
              className={`rounded-[20px] border px-4 py-3 text-left transition duration-200 ease-out hover:-translate-y-0.5 hover:border-care-primary hover:bg-care-soft hover:shadow-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-focus active:translate-y-0 ${
                active
                  ? "border-care-primary bg-care-soft text-care-ink"
                  : "border-care-line bg-care-surface text-care-ink"
              }`}
            >
              <span className="block text-sm font-semibold">
                {scenarioTitle(scenario.key)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-care-muted">
                已整理 {scenario.coverage_count} 份相关资料
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
