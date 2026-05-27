import { AppShell } from "../../components/layout/AppShell";

const SETTINGS = [
  {
    title: "语言",
    value: "简体中文",
    description: "所有回答和界面文案默认使用中文。",
  },
  {
    title: "显示密度",
    value: "舒适",
    description: "药品卡片保留足够行距，方便家人一起查看。",
  },
  {
    title: "资料显示偏好",
    value: "出处折叠",
    description: "主界面直接展示用药字段，资料来源放在出处抽屉中。",
  },
  {
    title: "交互模式",
    value: "咨询台",
    description: "以症状和药名为入口，优先展示具体药品卡片。",
  },
];

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-10">
        <header className="rounded-[36px] border border-care-line bg-care-paper p-8 shadow-care-card">
          <p className="text-sm font-semibold text-care-primary">设置</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-care-ink">
            显示和使用偏好
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-care-muted">
            这里先提供设置界面壳，后续可接入账号、偏好保存和更细的资料展示选项。
          </p>
        </header>

        <div className="mt-6 space-y-3">
          {SETTINGS.map((item) => (
            <article
              key={item.title}
              className="flex flex-col gap-3 rounded-[26px] border border-care-line bg-care-paper px-5 py-4 shadow-care-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-care-lift sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h2 className="font-semibold text-care-ink">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-care-muted">
                  {item.description}
                </p>
              </div>
              <span className="w-fit rounded-full bg-care-soft px-3 py-1 text-sm font-semibold text-care-cocoa">
                {item.value}
              </span>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
