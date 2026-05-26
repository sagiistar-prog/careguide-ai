import type { SourceDetail } from "./types";
import { displayMedicineText, sourceTypeLabel } from "./ui-copy";

type SourceDrawerProps = {
  open: boolean;
  detail: SourceDetail | null;
  loading: boolean;
  onClose: () => void;
};

function isBookSource(detail: SourceDetail) {
  return (
    detail.source_type === "medical_book" ||
    detail.source_type === "prescription_reference" ||
    /指南|处方|全书|book/i.test(detail.document_title)
  );
}

export function SourceDrawer({
  open,
  detail,
  loading,
  onClose,
}: SourceDrawerProps) {
  const bookSource = detail ? isBookSource(detail) : false;

  return (
    <div
      className={`fixed inset-0 z-40 transition duration-200 ease-out ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="关闭资料来源"
        onClick={onClose}
        className={`absolute inset-0 bg-care-ink/20 transition duration-200 ease-out ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-care-paper shadow-care-drawer transition duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="资料来源详情"
      >
        <div className="sticky top-0 border-b border-care-line bg-care-paper/95 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-care-muted">资料来源</p>
              <h2 className="mt-1 text-lg font-semibold text-care-ink">
                {bookSource ? "参考书籍出处" : "原文摘录"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-md border border-care-line px-3 py-2 text-sm text-care-ink transition hover:bg-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care-focus"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-5 w-2/3 rounded bg-care-soft" />
              <div className="h-24 rounded bg-care-soft" />
            </div>
          ) : detail ? (
            <>
              <div>
                <h3 className="text-base font-semibold leading-7 text-care-ink">
                  {displayMedicineText(detail.document_title)}
                </h3>
                <p className="mt-1 text-sm leading-6 text-care-muted">
                  {detail.source_organization}，{sourceTypeLabel(detail.source_type)}
                </p>
              </div>

              <dl className="grid gap-3 rounded-md border border-care-line bg-care-surface p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-care-muted">发布日期</dt>
                  <dd className="mt-1 text-care-ink">
                    {detail.published_at ?? "未提供"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-care-muted">更新时间</dt>
                  <dd className="mt-1 text-care-ink">
                    {detail.source_updated_at ?? "未提供"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-care-muted">
                    {bookSource ? "章节或位置" : "章节名称"}
                  </dt>
                  <dd className="mt-1 text-care-ink">
                    {detail.section_name ?? "未提供"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-care-muted">版本</dt>
                  <dd className="mt-1 text-care-ink">
                    {detail.version ?? "未提供"}
                  </dd>
                </div>
              </dl>

              {bookSource ? (
                <details className="rounded-md border border-care-line bg-care-surface p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-care-ink">
                    查看书中出处摘录
                  </summary>
                  <p className="mt-2 text-xs leading-6 text-care-muted">
                    主界面会用更容易理解的方式整理资料；这里保留短摘录，方便你核对出处。
                  </p>
                  <blockquote className="mt-3 rounded-md border border-care-line bg-care-paper px-4 py-3 text-sm leading-7 text-care-ink">
                    {displayMedicineText(
                      detail.source_excerpt ?? "当前资料不足，暂不能确认。",
                    )}
                  </blockquote>
                </details>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-care-ink">原文摘录</p>
                  <blockquote className="mt-2 rounded-md border border-care-line bg-care-surface px-4 py-3 text-sm leading-7 text-care-ink">
                    {displayMedicineText(
                      detail.source_excerpt ?? "当前资料不足，暂不能确认。",
                    )}
                  </blockquote>
                </div>
              )}

              <details className="rounded-md border border-care-line bg-care-surface p-4 text-xs leading-5 text-care-muted">
                <summary className="cursor-pointer font-medium text-care-ink">
                  技术追溯信息
                </summary>
                <dl className="mt-3 space-y-3">
                  <div>
                    <dt className="font-medium text-care-ink">source_id</dt>
                    <dd className="mt-1 break-all">{detail.source_id}</dd>
                  </div>
                  {detail.chunk_id ? (
                    <div>
                      <dt className="font-medium text-care-ink">chunk_id</dt>
                      <dd className="mt-1 break-all">{detail.chunk_id}</dd>
                    </div>
                  ) : null}
                  {detail.license_note ? (
                    <div>
                      <dt className="font-medium text-care-ink">许可说明</dt>
                      <dd className="mt-1">{detail.license_note}</dd>
                    </div>
                  ) : null}
                </dl>
              </details>
            </>
          ) : (
            <p className="text-sm text-care-muted">
              暂时无法读取这条资料来源。
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
