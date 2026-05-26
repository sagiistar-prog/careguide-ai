"use client";

import { useEffect, useMemo, useState } from "react";
import { AnswerStatusBanner } from "./AnswerStatusBanner";
import { DetectedContext } from "./DetectedContext";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { KbCoverageBar } from "./KbCoverageBar";
import { LoadingState } from "./LoadingState";
import { MedicationCard } from "./MedicationCard";
import { PharmacistQuestions } from "./PharmacistQuestions";
import { PlainLanguageSummary } from "./PlainLanguageSummary";
import { QuestionComposer } from "./QuestionComposer";
import { SafetyNoticeList } from "./SafetyNoticeList";
import { ScenarioGrid } from "./ScenarioGrid";
import { SourceDrawer } from "./SourceDrawer";
import { SourceList } from "./SourceList";
import type { KbCoverage, QueryResponse, Scenario, SourceDetail } from "./types";

type DrawerTarget = {
  chunkId: string;
  sourceId: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error("request_failed");
  }

  return (await response.json()) as T;
}

export function CareGuideWorkbench() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [coverage, setCoverage] = useState<KbCoverage | null>(null);
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sourceDetail, setSourceDetail] = useState<SourceDetail | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.key === selectedScenarioKey) ?? null,
    [scenarios, selectedScenarioKey],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWorkbenchData() {
      try {
        const [scenarioData, coverageData] = await Promise.all([
          fetchJson<{ scenarios: Scenario[] }>("/api/scenarios"),
          fetchJson<KbCoverage>("/api/kb/coverage"),
        ]);

        if (!cancelled) {
          setScenarios(scenarioData.scenarios);
          setCoverage(coverageData);
        }
      } catch {
        if (!cancelled) {
          setError("暂时无法读取工作台资料。请稍后重试。");
        }
      }
    }

    loadWorkbenchData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitQuestion() {
    const trimmed = question.trim();

    if (trimmed.length < 2) {
      setError("请先写下想核对的问题。");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<QueryResponse>("/api/query", {
        method: "POST",
        body: JSON.stringify({
          query: trimmed,
          scenario: selectedScenarioKey ?? undefined,
          locale: "zh-CN",
        }),
      });
      setResult(data);
    } catch {
      setError("暂时无法完成查询，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function openSource(target: DrawerTarget) {
    setDrawerOpen(true);
    setSourceLoading(true);
    setSourceDetail(null);

    try {
      const [evidence, source] = await Promise.all([
        fetchJson<SourceDetail>(`/api/evidence/${target.chunkId}`),
        fetchJson<SourceDetail>(`/api/sources/${encodeURIComponent(target.sourceId)}`),
      ]);

      setSourceDetail({
        ...source,
        ...evidence,
        source_id: target.sourceId,
        chunk_id: target.chunkId,
      });
    } catch {
      setSourceDetail(null);
    } finally {
      setSourceLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-care-wash text-care-ink">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="space-y-5 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-1">
          <header className="rounded-md border border-care-line bg-care-paper px-5 py-5">
            <p className="text-sm font-semibold text-care-primary">CareGuide AI</p>
            <h1 className="mt-3 text-2xl font-semibold leading-9 text-care-ink">
              家庭用药资料工作台
            </h1>
            <p className="mt-3 text-sm leading-7 text-care-muted">
              把复杂用药资料整理成家人能看懂的说明。我们不会替你诊断，也不会替你决定怎么用药。
            </p>
          </header>

          <KbCoverageBar coverage={coverage} />

          <ScenarioGrid
            scenarios={scenarios}
            selectedScenario={selectedScenarioKey}
            onSelect={(scenario) => {
              setSelectedScenarioKey(scenario.key);
              setQuestion(scenario.example_questions[0] ?? "");
              setError(null);
            }}
          />

          <QuestionComposer
            value={question}
            selectedScenario={selectedScenario}
            loading={loading}
            onChange={setQuestion}
            onSubmit={submitQuestion}
            onExample={(example) => {
              setQuestion(example);
              setError(null);
            }}
          />
        </aside>

        <section className="space-y-5">
          {error ? <ErrorState message={error} /> : null}
          {loading ? <LoadingState /> : null}
          {!loading && !result && !error ? <EmptyState /> : null}

          {!loading && result ? (
            <>
              <AnswerStatusBanner result={result} />
              <DetectedContext detected={result.detected_entities} />

              {result.answer_status === "insufficient_evidence" ? (
                <section className="rounded-md border border-care-line bg-care-surface p-6">
                  <p className="text-base font-semibold text-care-ink">
                    当前资料不足，暂不能确认
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-care-muted">
                    可以换一种问法，或补充药品名称、年龄、症状和正在使用的药物。
                  </p>
                </section>
              ) : null}

              <PlainLanguageSummary sentences={result.plain_language_summary} />
              <SafetyNoticeList notices={result.safety_notices} />
              <PharmacistQuestions
                questions={result.questions_for_doctor_or_pharmacist}
                highlight={
                  result.answer_status === "needs_professional_confirmation" ||
                  result.answer_status === "blocked_high_risk"
                }
              />

              {result.evidence_cards.length > 0 ? (
                <section className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-care-ink">
                      用药资料卡
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-care-muted">
                      每一条都可以打开查看原文和来源。
                    </p>
                  </div>
                  <div className="space-y-3">
                    {result.evidence_cards.map((card, index) => (
                      <MedicationCard
                        key={`${card.title}-${index}`}
                        card={card}
                        index={index}
                        onOpenSource={openSource}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {result.limitations.length > 0 ? (
                <section className="rounded-md border border-care-line bg-care-surface p-4">
                  <h2 className="text-base font-semibold text-care-ink">限制说明</h2>
                  <div className="mt-3 space-y-2">
                    {result.limitations.map((item) => (
                      <p key={item.sentence_id} className="text-sm leading-7 text-care-muted">
                        {item.text}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}

              <SourceList citations={result.citations} onOpenSource={openSource} />
            </>
          ) : null}
        </section>
      </div>

      <SourceDrawer
        open={drawerOpen}
        detail={sourceDetail}
        loading={sourceLoading}
        onClose={() => setDrawerOpen(false)}
      />
    </main>
  );
}
