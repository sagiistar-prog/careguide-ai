import type { KnowledgeGroup, SourceRef } from "./display-adapter";

type KnowledgeSectionProps = {
  groups: KnowledgeGroup[];
  onOpenSources: (refs: SourceRef[]) => void;
};

export function KnowledgeSection({ groups, onOpenSources }: KnowledgeSectionProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-care-ink">
        疾病知识或症状说明
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <article
            key={group.id}
            className="rounded-[28px] border border-care-line bg-care-paper p-5 shadow-care-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-care-lift"
          >
            <h3 className="text-lg font-semibold leading-7 text-care-ink">
              {group.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-care-muted">{group.text}</p>
            <button
              type="button"
              onClick={() => onOpenSources(group.sourceRefs)}
              disabled={group.sourceRefs.length === 0}
              className="mt-4 min-h-10 rounded-full border border-care-line bg-care-surface px-4 py-2 text-sm font-semibold text-care-ink transition duration-200 ease-out hover:-translate-y-0.5 hover:border-care-primary hover:bg-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-focus active:translate-y-0 disabled:bg-care-disabled disabled:text-care-muted"
            >
              出处
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
