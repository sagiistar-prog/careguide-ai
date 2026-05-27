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
    <section className={`rounded-[24px] border px-4 py-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{statusLabel(result.answer_status)}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-care-muted">
            {result.answer_status === "answered_with_evidence"
              ? "已整理成可查看的用药信息。"
              : result.answer_status === "insufficient_evidence"
                ? "可以补充更具体的药品名、年龄、症状和正在使用的药物。"
                : "这类问题需要结合个人情况谨慎确认。"}
          </p>
        </div>
        <div className="rounded-full border border-care-line bg-care-paper px-3 py-1 text-xs text-care-muted">
          已核对 {result.citation_coverage}%
        </div>
      </div>
    </section>
  );
}
