import { AppShell } from "../../components/layout/AppShell";
import { CareGuideWorkbench } from "../../components/workbench/CareGuideWorkbench";

type ConsultPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function ConsultPage({ searchParams }: ConsultPageProps) {
  const params = await searchParams;

  return (
    <AppShell active="consult">
      <CareGuideWorkbench initialQuestion={params.q ?? ""} />
    </AppShell>
  );
}
