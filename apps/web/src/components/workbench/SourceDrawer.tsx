import type { SourceDetail } from "./types";
import { translateMedicalTerms } from "./display-adapter";
import { sourceTypeLabel } from "./ui-copy";

type SourceDrawerProps = {
  open: boolean;
  details: SourceDetail[] | null;
  loading: boolean;
  onClose: () => void;
};

function locationLabel(detail: SourceDetail) {
  if (detail.page_start && detail.page_end && detail.page_start !== detail.page_end) {
    return `第 ${detail.page_start}-${detail.page_end} 页`;
  }

  if (detail.page_start) {
    return `第 ${detail.page_start} 页`;
  }

  return detail.location ?? "本地资料未列出";
}

function SourceDetailBlock({ detail }: { detail: SourceDetail }) {
  return (
    <article className="space-y-5 rounded-[28px] border border-care-line bg-care-paper p-4 shadow-care-soft">
      <section className="rounded-[24px] border border-care-line bg-care-surface p-4">
        <h3 className="text-lg font-semibold leading-7 text-care-ink">
          {translateMedicalTerms(detail.book_title ?? detail.document_title)}
        </h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-care-muted">资料类型</dt>
            <dd className="mt-1 text-care-ink">{sourceTypeLabel(detail.source_type)}</dd>
          </div>
          <div>
            <dt className="text-care-muted">来源机构</dt>
            <dd className="mt-1 text-care-ink">{detail.source_organization}</dd>
          </div>
          <div>
            <dt className="text-care-muted">章节</dt>
            <dd className="mt-1 text-care-ink">
              {translateMedicalTerms(detail.section_name ?? "本地资料未列出")}
            </dd>
          </div>
          <div>
            <dt className="text-care-muted">页码或位置</dt>
            <dd className="mt-1 text-care-ink">{locationLabel(detail)}</dd>
          </div>
          <div>
            <dt className="text-care-muted">发布日期</dt>
            <dd className="mt-1 text-care-ink">
              {detail.published_at ?? "本地资料未列出"}
            </dd>
          </div>
          <div>
            <dt className="text-care-muted">更新时间</dt>
            <dd className="mt-1 text-care-ink">
              {detail.source_updated_at ?? "本地资料未列出"}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-base font-semibold text-care-ink">原文摘录</h3>
        <blockquote className="mt-3 rounded-[24px] border border-care-line bg-care-surface px-4 py-4 text-sm leading-7 text-care-ink">
          {translateMedicalTerms(detail.source_excerpt ?? "本地资料未列出")}
        </blockquote>
      </section>

      <details className="rounded-[24px] border border-care-line bg-care-surface p-4 text-xs leading-5 text-care-muted">
        <summary className="cursor-pointer font-semibold text-care-ink">
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
    </article>
  );
}

export function SourceDrawer({
  open,
  details,
  loading,
  onClose,
}: SourceDrawerProps) {
  return (
    <div
      className={`fixed inset-0 z-40 transition duration-200 ease-out ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="关闭出处"
        onClick={onClose}
        className={`absolute inset-0 bg-care-ink/24 transition duration-200 ease-out ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-care-paper shadow-care-drawer transition duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="出处详情"
      >
        <div className="sticky top-0 z-10 border-b border-care-line bg-care-paper/95 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-care-muted">出处</p>
              <h2 className="mt-1 text-xl font-semibold text-care-ink">
                资料详情
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-full border border-care-line px-4 py-2 text-sm font-semibold text-care-ink transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-care-soft hover:shadow-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-focus active:translate-y-0"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-5 w-2/3 rounded-full bg-care-soft" />
              <div className="h-32 rounded-3xl bg-care-soft" />
            </div>
          ) : details && details.length > 0 ? (
            details.map((detail) => (
              <SourceDetailBlock
                key={`${detail.source_id}:${detail.chunk_id ?? detail.document_title}`}
                detail={detail}
              />
            ))
          ) : (
            <p className="text-sm text-care-muted">
              暂时无法读取这条出处，请稍后再试。
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
