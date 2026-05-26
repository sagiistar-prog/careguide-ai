import type { Citation } from "./types";
import { displayMedicineText } from "./ui-copy";

type SourceListProps = {
  citations: Citation[];
  onOpenSource: (input: { chunkId: string; sourceId: string }) => void;
};

export function SourceList({ citations, onOpenSource }: SourceListProps) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-care-line bg-care-surface p-4">
      <h2 className="text-base font-semibold text-care-ink">资料来源</h2>
      <div className="mt-3 divide-y divide-care-line">
        {citations.map((citation) => (
          <button
            key={citation.citation_id}
            type="button"
            onClick={() =>
              onOpenSource({
                chunkId: citation.chunk_id,
                sourceId: citation.source_id,
              })
            }
            className="block w-full py-3 text-left transition duration-200 ease-out hover:bg-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care-focus"
          >
            <span className="block text-sm font-medium leading-6 text-care-ink">
              {displayMedicineText(citation.document_title)}
            </span>
            <span className="mt-1 block text-xs leading-5 text-care-muted">
              {citation.source_organization}，{citation.section_name}
              {citation.published_at || citation.source_updated_at
                ? `，${citation.published_at ?? citation.source_updated_at}`
                : ""}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
