import Link from "next/link";

type NavKey = "consult" | "sources" | "reminders" | "settings";

type AppShellProps = {
  active: NavKey;
  children: React.ReactNode;
};

const NAV_ITEMS: Array<{ key: NavKey; label: string; href: string }> = [
  { key: "consult", label: "咨询台", href: "/consult" },
  { key: "sources", label: "数据来源", href: "/sources" },
  { key: "reminders", label: "用药提醒", href: "/reminders" },
  { key: "settings", label: "设置", href: "/settings" },
];

export function AppShell({ active, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-care-wash text-care-ink">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-care-line bg-care-paper/90 px-4 py-4 shadow-care-soft lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full px-3 text-lg font-semibold tracking-tight text-care-ink transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-care-soft hover:text-care-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-focus active:translate-y-0"
          >
            CareGuide AI
          </Link>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV_ITEMS.map((item) => {
              const current = active === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`min-h-11 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-focus active:translate-y-0 lg:rounded-2xl ${
                    current
                      ? "bg-care-primary text-care-on-primary shadow-care-soft"
                      : "text-care-muted hover:-translate-y-0.5 hover:bg-care-soft hover:text-care-ink hover:shadow-care-soft"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 hidden rounded-[26px] border border-care-line bg-care-surface p-4 text-sm leading-7 text-care-muted lg:block">
            写清年龄、症状和正在用的药，页面会把检索到的药品信息整理成可查看的用药卡片。
          </div>
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
