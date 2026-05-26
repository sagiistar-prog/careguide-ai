import type { QueryResponse } from "./types";
import { statusLabel, statusTone } from "./ui-copy";

export function AnswerStatusBanner({ result }: { result: QueryResponse }) {
  const tone = statusTone(result.answer_status);
  const toneClass =
    tone === "steady"
      ? "border-care-success/35 bg-care-success-soft text-care-ink"
      : tone === "attention"
        ? "border-care-warning/45 bg-care-warning-soft text-care-ink"
        : "border-care-line bg-care-surface text-care-ink";

  return (
    <section className={`rounded-md border px-4 py-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{statusLabel(result.answer_status)}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-care-muted">
            {result.answer_status === "answered_with_evidence"
              ? "我们先帮你把资料整理清楚。下面内容来自后端已核对的本地来源。"
              : result.answer_status === "insufficient_evidence"
                ? "可以换一种问法，或补充药品名称、年龄、症状和正在使用的药物。"
                : "这部分需要医生或药师确认。你可以带着下面这些问题去咨询。"}
          </p>
        </div>
        <div className="rounded-full border border-care-line bg-care-paper px-3 py-1 text-xs text-care-muted">
          来源覆盖 {result.citation_coverage}%
        </div>
      </div>
    </section>
  );
}
