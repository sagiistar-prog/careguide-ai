"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMedicationDisplay,
  type SourceRef,
} from "./display-adapter";
import { KnowledgeSection } from "./KnowledgeSection";
import { LoadingState } from "./LoadingState";
import { MedicationSection } from "./MedicationSection";
import { QuestionComposer } from "./QuestionComposer";
import { SourceDrawer } from "./SourceDrawer";
import type { KbCoverage, QueryResponse, SourceDetail } from "./types";
import { statusLabel } from "./ui-copy";

type CareGuideWorkbenchProps = {
  initialQuestion?: string;
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

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function loadingStage(progress: number) {
  if (progress >= 96) {
    return "已经整理好，正在打开结果。";
  }

  if (progress >= 78) {
    return "正在把可查看的信息整理成用药卡片。";
  }

  if (progress >= 52) {
    return "正在核对资料来源和原文出处。";
  }

  if (progress >= 24) {
    return "正在检索本地资料库里的相关内容。";
  }

  return "正在接收你的问题。";
}

export function CareGuideWorkbench({
  initialQuestion = "",
}: CareGuideWorkbenchProps) {
  const hasInitialQuestion = initialQuestion.trim().length >= 2;
  const [question, setQuestion] = useState(initialQuestion);
  const [coverage, setCoverage] = useState<KbCoverage | null>(null);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(hasInitialQuestion);
  const [loadingProgress, setLoadingProgress] = useState(
    hasInitialQuestion ? 12 : 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sourceDetails, setSourceDetails] = useState<SourceDetail[] | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const autoSubmitted = useRef(false);

  const display = useMemo(
    () =>
      result
        ? buildMedicationDisplay(result)
        : { western: [], tcm: [], knowledge: [] },
    [result],
  );
  const medicationCount = display.western.length + display.tcm.length;

  useEffect(() => {
    let cancelled = false;

    async function loadCoverage() {
      try {
        const data = await fetchJson<KbCoverage>("/api/kb/coverage");

        if (!cancelled) {
          setCoverage(data);
        }
      } catch {
        if (!cancelled) {
          setCoverage(null);
        }
      }
    }

    loadCoverage();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialQuestion.trim().length >= 2 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submitQuestion(initialQuestion);
    }
  }, [initialQuestion]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    setLoadingProgress((current) => (current > 0 ? current : 12));

    const timer = window.setInterval(() => {
      setLoadingProgress((current) => {
        if (current >= 92) {
          return current;
        }

        if (current < 28) {
          return Math.min(28, current + 4);
        }

        if (current < 58) {
          return Math.min(58, current + 5);
        }

        if (current < 82) {
          return Math.min(82, current + 3);
        }

        return Math.min(92, current + 1);
      });
    }, 420);

    return () => {
      window.clearInterval(timer);
    };
  }, [loading]);

  async function submitQuestion(input = question) {
    const trimmed = input.trim();

    if (trimmed.length < 2) {
      setError("请先写下症状、药名或想确认的问题。");
      return;
    }

    setLoadingProgress(8);
    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<QueryResponse>("/api/query", {
        method: "POST",
        body: JSON.stringify({
          query: trimmed,
          locale: "zh-CN",
        }),
      });
      setLoadingProgress(100);
      setResult(data);
      await wait(220);
    } catch {
      setLoadingProgress(100);
      setError("暂时无法完成查询，请稍后重试。");
      await wait(180);
    } finally {
      setLoading(false);
    }
  }

  async function openSources(refs: SourceRef[]) {
    const safeRefs = refs.slice(0, 6);

    if (safeRefs.length === 0) {
      return;
    }

    setDrawerOpen(true);
    setSourceLoading(true);
    setSourceDetails(null);

    try {
      const details = await Promise.all(
        safeRefs.map(async (target) => {
          const [evidence, source] = await Promise.all([
            fetchJson<SourceDetail>(`/api/evidence/${target.chunkId}`),
            fetchJson<SourceDetail>(
              `/api/sources/${encodeURIComponent(target.sourceId)}`,
            ),
          ]);

          return {
            ...source,
            ...evidence,
            source_id: target.sourceId,
            chunk_id: target.chunkId,
          };
        }),
      );

      setSourceDetails(details);
    } catch {
      setSourceDetails(null);
    } finally {
      setSourceLoading(false);
    }
  }

  return (
    <div className="consult-enter mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="consult-enter-input mb-8 flex flex-col gap-5 rounded-[36px] border border-care-line bg-care-paper p-6 shadow-care-card lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-care-primary">咨询台</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-care-ink">
            今天想先确认哪件事？
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-care-muted">
            可以直接写“男 25 感冒 中成药”这类问题。页面会优先展示具体药品卡片，再把症状说明放在后面。
          </p>
        </div>
        <div className="rounded-2xl bg-care-soft px-4 py-3 text-sm text-care-muted">
          当前本地资料：{coverage?.source_documents ?? "多"} 份资料，
          {coverage?.source_chunks ?? "多"} 段可查原文
        </div>
      </div>

      <div className="consult-enter-input">
        <QuestionComposer
          value={question}
          loading={loading}
          onChange={(value) => {
            setQuestion(value);
            setError(null);
          }}
          onSubmit={() => void submitQuestion()}
        />
      </div>

      <div className="consult-enter-results mt-6 space-y-8">
        {error ? (
          <div className="rounded-[24px] border border-care-danger/30 bg-care-danger-soft px-5 py-4 text-sm leading-7 text-care-ink">
            {error}
          </div>
        ) : null}

        {loading ? (
          <LoadingState
            progress={loadingProgress}
            stage={loadingStage(loadingProgress)}
          />
        ) : null}

        {!loading && result?.answer_status === "insufficient_evidence" ? (
          <div className="rounded-[30px] border border-care-line bg-care-paper p-6 shadow-care-soft">
            <h2 className="text-xl font-semibold text-care-ink">
              当前本地资料还没有覆盖这个问题
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-care-muted">
              可以换一个更具体的药品名、症状或人群描述，例如年龄、持续时间、是否正在服用其他药。
            </p>
          </div>
        ) : null}

        {!loading && result && result.answer_status !== "insufficient_evidence" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-care-primary px-4 py-2 text-sm font-semibold text-care-on-primary">
                {statusLabel(result.answer_status)}
              </span>
              {result.answer_status !== "answered_with_evidence" ? (
                <span className="rounded-full bg-care-warning-soft px-4 py-2 text-sm font-semibold text-care-cocoa">
                  请结合个人情况谨慎判断
                </span>
              ) : null}
            </div>

            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-care-ink">
                  推荐药物
                </h2>
                <p className="mt-2 text-sm leading-7 text-care-muted">
                  以下内容按药品聚合，同一种药的多个出处会合并在一张卡片里。
                </p>
              </div>
              <MedicationSection
                title="西药"
                groups={display.western}
                onOpenSources={openSources}
              />
              <MedicationSection
                title="中成药"
                groups={display.tcm}
                onOpenSources={openSources}
              />

              {medicationCount === 0 ? (
                <div className="rounded-[30px] border border-care-line bg-care-paper p-6 shadow-care-soft">
                  <h2 className="text-xl font-semibold text-care-ink">
                    暂时没有可展示的药品卡片
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-care-muted">
                    可以换一个更具体的药名、症状或用药方向，例如“感冒 中成药”或“布洛芬 儿童 警示”。
                  </p>
                </div>
              ) : null}
            </section>

            <KnowledgeSection
              groups={display.knowledge}
              onOpenSources={openSources}
            />

            <p className="rounded-[22px] bg-care-cocoa-soft px-4 py-3 text-sm leading-7 text-care-muted">
              如果症状持续、加重，或你不确定是否适合自己，可以带着这些信息问医生或药师。
            </p>
          </>
        ) : null}
      </div>

      <SourceDrawer
        open={drawerOpen}
        details={sourceDetails}
        loading={sourceLoading}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
