import type { Scenario } from "./types";

type QuestionComposerProps = {
  value: string;
  selectedScenario: Scenario | null;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onExample: (question: string) => void;
};

export function QuestionComposer({
  value,
  selectedScenario,
  loading,
  onChange,
  onSubmit,
  onExample,
}: QuestionComposerProps) {
  const examples = selectedScenario?.example_questions ?? [
    "metformin 有哪些不良反应？",
    "lisinopril 有哪些禁忌或警示？",
  ];

  return (
    <section className="space-y-4 rounded-md border border-care-line bg-care-surface p-4">
      <div>
        <label htmlFor="careguide-question" className="text-sm font-semibold text-care-ink">
          写下你想核对的用药问题
        </label>
        <p className="mt-1 text-sm leading-6 text-care-muted">
          可以写药品名、年龄或想确认的警示。系统只整理本地已有资料。
        </p>
      </div>
      <textarea
        id="careguide-question"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        maxLength={500}
        placeholder="例如：ibuprofen 对儿童有什么警示？"
        className="min-h-32 w-full resize-none rounded-md border border-care-line bg-care-paper px-4 py-3 text-sm leading-7 text-care-ink outline-none transition duration-200 ease-out placeholder:text-care-faint focus:border-care-primary focus:ring-2 focus:ring-care-focus/30"
      />
      <div className="flex flex-wrap gap-2">
        {examples.slice(0, 3).map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onExample(question)}
            className="rounded-full border border-care-line bg-care-paper px-3 py-2 text-xs text-care-muted transition duration-200 ease-out hover:border-care-primary hover:text-care-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care-focus"
          >
            {question}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || value.trim().length < 2}
        className="min-h-11 w-full rounded-md bg-care-primary px-4 py-3 text-sm font-semibold text-care-on-primary transition duration-200 ease-out hover:bg-care-primary-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care-focus disabled:cursor-not-allowed disabled:bg-care-disabled disabled:text-care-muted sm:w-auto"
      >
        {loading ? "正在整理本地资料" : "整理资料"}
      </button>
    </section>
  );
}
