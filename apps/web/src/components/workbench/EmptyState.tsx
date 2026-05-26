export function EmptyState() {
  return (
    <section className="rounded-md border border-care-line bg-care-surface p-6">
      <p className="text-sm font-semibold text-care-ink">先从一个问题开始</p>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-care-muted">
        你可以选择一个家庭常见场景，也可以直接输入药品名和想确认的内容。我们会先整理本地资料，再把来源放在你能检查的位置。
      </p>
    </section>
  );
}
