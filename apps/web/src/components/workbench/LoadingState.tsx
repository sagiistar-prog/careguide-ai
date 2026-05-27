type LoadingStateProps = {
  progress: number;
  stage: string;
};

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function LoadingState({ progress, stage }: LoadingStateProps) {
  const safeProgress = clampProgress(progress);

  return (
    <section
      aria-live="polite"
      className="rounded-[30px] border border-care-line bg-care-paper p-6 shadow-care-soft"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-semibold text-care-ink">正在查询</p>
          <p className="mt-2 text-sm leading-7 text-care-muted">
            {stage}
          </p>
        </div>
        <div className="rounded-full bg-care-soft px-4 py-2 text-sm font-semibold text-care-primary">
          {safeProgress}%
        </div>
      </div>

      <div className="mt-5">
        <div
          className="h-3 overflow-hidden rounded-full bg-care-soft"
          role="progressbar"
          aria-label="查询进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeProgress}
        >
          <div
            className="h-full rounded-full bg-care-primary shadow-[0_0_18px_oklch(0.47_0.08_155_/0.28)] transition-[width] duration-500 ease-out"
            style={{ width: `${safeProgress}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-medium text-care-muted">
          <span>接收问题</span>
          <span>检索资料</span>
          <span>核对出处</span>
          <span>整理卡片</span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="h-36 animate-pulse rounded-3xl bg-care-soft" />
        <div className="h-36 animate-pulse rounded-3xl bg-care-soft" />
      </div>
    </section>
  );
}
