export function LoadingState() {
  return (
    <section className="rounded-md border border-care-line bg-care-surface p-5">
      <p className="text-sm font-semibold text-care-ink">正在整理本地资料</p>
      <p className="mt-1 text-sm leading-6 text-care-muted">正在核对来源，请稍等。</p>
      <div className="mt-5 space-y-3">
        <div className="h-4 w-2/3 rounded bg-care-soft" />
        <div className="h-24 rounded bg-care-soft" />
        <div className="h-24 rounded bg-care-soft" />
      </div>
    </section>
  );
}
