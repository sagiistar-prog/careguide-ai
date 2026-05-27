import type { MedicationGroup, SourceRef } from "./display-adapter";
import { MedicationDisplayCard } from "./MedicationDisplayCard";

type MedicationSectionProps = {
  title: string;
  groups: MedicationGroup[];
  onOpenSources: (refs: SourceRef[]) => void;
};

export function MedicationSection({
  title,
  groups,
  onOpenSources,
}: MedicationSectionProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold tracking-tight text-care-ink">
        {title}
      </h3>
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => (
          <MedicationDisplayCard
            key={group.id}
            group={group}
            onOpenSources={onOpenSources}
          />
        ))}
      </div>
    </section>
  );
}
