"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { HeroIllustration } from "./HeroIllustration";

const TRANSITION_DELAY_MS = 560;

const NAV_ITEMS = [
  { label: "咨询台", href: "/consult" },
  { label: "数据来源", href: "/sources" },
  { label: "用药提醒", href: "/reminders" },
  { label: "设置", href: "/settings" },
] as const;

export function LandingPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const targetRef = useRef<string | null>(null);

  function beginTransition(target: string) {
    if (transitioning) {
      return;
    }

    targetRef.current = target;
    setTransitioning(true);

    window.setTimeout(() => {
      router.push(targetRef.current ?? target);
    }, TRANSITION_DELAY_MS);
  }

  function submit() {
    const trimmed = question.trim();
    const target = trimmed
      ? `/consult?q=${encodeURIComponent(trimmed)}`
      : "/consult";
    beginTransition(target);
  }

  return (
    <main
      className="hero-scene relative min-h-screen overflow-hidden text-care-on-primary"
      data-transitioning={transitioning ? "true" : "false"}
    >
      <HeroIllustration transitioning={transitioning} />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-5 py-5 transition duration-[560ms] ease-out sm:px-8 lg:px-10">
        <Link
          href="/"
          aria-current="page"
          className="rounded-full px-3 py-2 text-xl font-semibold tracking-tight text-care-on-primary transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-care-on-primary/10 hover:text-care-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-gold active:translate-y-0 active:bg-care-on-primary/16"
        >
          CareGuide AI
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-care-on-primary/14 bg-care-ink/22 p-1 shadow-care-soft backdrop-blur-sm md:flex">
          {NAV_ITEMS.map((item) =>
            item.href === "/consult" ? (
              <button
                key={item.href}
                type="button"
                onClick={() => beginTransition("/consult")}
                disabled={transitioning}
                className="min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold text-care-on-primary/82 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-care-on-primary/14 hover:text-care-on-primary hover:shadow-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-gold active:translate-y-0 active:bg-care-on-primary/22 disabled:cursor-not-allowed disabled:text-care-on-primary/45"
              >
                {item.label}
              </button>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold text-care-on-primary/82 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-care-on-primary/14 hover:text-care-on-primary hover:shadow-care-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-gold active:translate-y-0 active:bg-care-on-primary/22"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <button
          type="button"
          onClick={() => beginTransition("/consult")}
          disabled={transitioning}
          className="min-h-12 rounded-full bg-care-on-primary px-6 py-3 text-sm font-semibold text-care-ink shadow-care-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-care-gold hover:shadow-care-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-gold active:translate-y-0 active:scale-[0.98] disabled:bg-care-disabled disabled:text-care-muted disabled:shadow-none"
        >
          立即体验
        </button>
      </header>

      <section
        className={`relative z-10 flex min-h-screen w-full flex-col justify-center px-5 pb-28 pt-28 transition duration-[560ms] ease-out sm:px-8 lg:px-10 ${
          transitioning ? "scale-[0.985] opacity-70 blur-[2px]" : "scale-100 opacity-100"
        }`}
      >
        <div className="max-w-[920px]">
          <p className="inline-flex rounded-full border border-care-on-primary/20 bg-care-on-primary/11 px-4 py-2 text-sm font-medium text-care-on-primary/88 shadow-care-soft backdrop-blur-sm">
            家庭常见病用药资料咨询台
          </p>
          <h1 className="mt-8 max-w-5xl text-[3.65rem] font-semibold leading-[1.02] tracking-tight text-care-on-primary sm:text-[5.8rem] lg:text-[7.1rem]">
            家庭用药，先把问题说清楚
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-care-on-primary/82 sm:text-lg">
            输入年龄、性别、症状、持续时间、既往病史和正在服用的药，系统会从本地资料中整理可核对的用药信息。
          </p>
        </div>

        <div className="absolute inset-x-5 bottom-8 z-20 mx-auto max-w-5xl sm:bottom-12">
          <div
            className={`rounded-[34px] border border-care-on-primary/18 bg-care-on-primary/13 p-2.5 shadow-care-card backdrop-blur-sm transition duration-[560ms] ease-out hover:-translate-y-0.5 hover:shadow-care-glow ${
              transitioning ? "scale-[1.018] shadow-care-glow" : "scale-100"
            }`}
          >
            <div className="flex flex-col gap-3 rounded-[26px] bg-care-paper p-3 shadow-care-soft sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="landing-question">
                用药问题
              </label>
              <textarea
                id="landing-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    submit();
                  }
                }}
                disabled={transitioning}
                rows={2}
                maxLength={500}
                placeholder="请尽量写清：年龄、性别、症状、持续时间、既往病史、正在服用的药"
                className="min-h-20 flex-1 resize-none rounded-[20px] border border-transparent bg-transparent px-4 py-3 text-base leading-7 text-care-ink outline-none transition duration-200 ease-out placeholder:text-care-faint hover:bg-care-surface focus:border-care-gold focus:bg-care-surface focus:ring-4 focus:ring-care-gold/20 disabled:text-care-muted"
              />
              <button
                type="button"
                onClick={submit}
                disabled={transitioning}
                aria-busy={transitioning}
                className="min-h-14 rounded-full bg-care-primary px-9 text-base font-semibold text-care-on-primary shadow-care-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-care-primary-strong hover:shadow-care-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-focus active:translate-y-0 active:scale-[0.98] disabled:bg-care-disabled disabled:text-care-muted disabled:shadow-none"
              >
                {transitioning ? "正在打开" : "发送"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div
        className={`pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[radial-gradient(circle_at_50%_54%,oklch(78%_0.11_78_/_0.22),transparent_28%),linear-gradient(135deg,oklch(22%_0.045_145_/_0.84),oklch(36%_0.052_78_/_0.78))] transition duration-[560ms] ease-out ${
          transitioning ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!transitioning}
      >
        <div
          className={`rounded-full border border-care-on-primary/18 bg-care-on-primary/12 px-6 py-3 text-base font-semibold text-care-on-primary shadow-care-card transition duration-[560ms] ease-out ${
            transitioning ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
          aria-live="polite"
        >
          正在打开咨询台
        </div>
      </div>
    </main>
  );
}
