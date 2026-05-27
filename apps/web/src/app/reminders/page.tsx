import { AppShell } from "../../components/layout/AppShell";

const PREVIEW_ITEMS = [
  { title: "早饭后", medicine: "示例药名", note: "可添加服用方式和备注" },
  { title: "午后", medicine: "待添加", note: "支持记录是否已经服用" },
  { title: "睡前", medicine: "待添加", note: "适合长期用药提醒" },
];

export default function RemindersPage() {
  return (
    <AppShell active="reminders">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
        <header className="rounded-[36px] border border-care-line bg-care-paper p-8 shadow-care-card">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-care-primary">用药提醒</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-care-ink">
                把服药时间留给系统提醒
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-care-muted">
                这个功能还没有接入真实提醒服务。当前先保留完整界面结构，后续可添加药名、服用时间和备注。
              </p>
            </div>
            <button
              type="button"
              disabled
              className="min-h-12 rounded-full bg-care-disabled px-6 text-sm font-semibold text-care-muted"
            >
              新建提醒即将开放
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PREVIEW_ITEMS.map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-care-line bg-care-paper p-5 shadow-care-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-care-lift"
            >
              <p className="text-sm font-semibold text-care-primary">{item.title}</p>
              <h2 className="mt-3 text-xl font-semibold text-care-ink">
                {item.medicine}
              </h2>
              <p className="mt-3 text-sm leading-7 text-care-muted">{item.note}</p>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
