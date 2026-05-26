import type { KbCoverage } from "./types";

export function KbCoverageBar({ coverage }: { coverage: KbCoverage | null }) {
  if (!coverage) {
    return (
      <div className="rounded-md border border-care-line bg-care-surface px-4 py-3 text-sm text-care-muted">
        正在读取当前已整理的资料范围。
      </div>
    );
  }

  return (
    <div className="rounded-md border border-care-line bg-care-surface px-4 py-3">
      <p className="text-sm font-medium text-care-ink">当前可查资料</p>
      <p className="mt-1 text-sm leading-6 text-care-muted">
        已整理 {coverage.source_documents} 份资料、{coverage.source_chunks}{" "}
        段可查原文，覆盖感冒发热、儿童退烧、高血压和糖尿病四类家庭场景。
      </p>
    </div>
  );
}
