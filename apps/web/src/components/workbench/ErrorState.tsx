export function ErrorState({ message }: { message?: string }) {
  return (
    <section className="rounded-md border border-care-danger/35 bg-care-danger-soft p-5">
      <p className="text-sm font-semibold text-care-ink">暂时无法完成查询</p>
      <p className="mt-2 text-sm leading-7 text-care-muted">
        {message ?? "请稍后重试。我们不会显示没有来源的结论。"}
      </p>
    </section>
  );
}
