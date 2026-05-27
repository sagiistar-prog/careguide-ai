import { AppShell } from "../../components/layout/AppShell";

const GROUPS = [
  {
    title: "官方药品资料",
    items: [
      {
        name: "DailyMed",
        type: "药品标签",
        use: "导入药品说明书章节、警示、禁忌和用量用法原文。",
        status: "后台导入使用，查询时不实时调用。",
      },
      {
        name: "openFDA Drug Label",
        type: "药品标签",
        use: "补充 FDA 标签字段，用于西药卡片中的章节整理。",
        status: "后台导入使用。",
      },
      {
        name: "openFDA NDC Directory",
        type: "药品目录",
        use: "记录药品产品和包装目录信息。",
        status: "后台导入使用。",
      },
      {
        name: "openFDA Drug Enforcement",
        type: "监管信息",
        use: "记录召回和监管相关资料，仅用于对应场景。",
        status: "后台导入使用。",
      },
    ],
  },
  {
    title: "药品术语与分类",
    items: [
      {
        name: "RxNorm / RxTerms / RxClass",
        type: "药品术语",
        use: "标准化药品名、成分名和药品类别。",
        status: "后台标准化使用。",
      },
    ],
  },
  {
    title: "患者教育",
    items: [
      {
        name: "MedlinePlus Connect",
        type: "患者教育",
        use: "补充普通用户可理解的患者教育资料。",
        status: "第一阶段记录接入计划。",
      },
      {
        name: "NHS Website Content API",
        type: "患者教育",
        use: "补充英文患者教育资料和照护说明。",
        status: "第一阶段记录接入计划。",
      },
    ],
  },
  {
    title: "本地授权参考书籍",
    items: [
      {
        name: "家庭常见病中成药使用指南",
        type: "本地参考书籍",
        use: "用于中成药、证型和家庭常见病用药参考。",
        status: "用户授权，本地入库，不提供全文导出。",
      },
      {
        name: "216种常见病门诊处方全书",
        type: "本地参考书籍",
        use: "用于常见病门诊通用处方和用药方案参考。",
        status: "用户授权，本地入库，不提供全文导出。",
      },
      {
        name: "医目了然：家庭常见病中成药使用指南",
        type: "本地参考书籍",
        use: "用于中成药对照、常见症状和家庭照护参考。",
        status: "用户授权，本地入库，不提供全文导出。",
      },
    ],
  },
];

export default function SourcesPage() {
  return (
    <AppShell active="sources">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <header className="rounded-[36px] border border-care-line bg-care-paper p-6 shadow-care-card">
          <p className="text-sm font-semibold text-care-primary">数据来源</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-care-ink">
            这些资料已经进入本地知识库
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-care-muted">
            外部医学接口只用于后台导入和标准化。用户查询时，前端只调用内部 API，从本地知识库读取资料。
          </p>
        </header>

        <div className="mt-8 space-y-8">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="text-xl font-semibold text-care-ink">{group.title}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((source) => (
                  <article
                    key={source.name}
                    className="rounded-[28px] border border-care-line bg-care-paper p-5 shadow-care-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-care-lift focus-within:ring-2 focus-within:ring-care-gold/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold leading-7 text-care-ink">
                        {source.name}
                      </h3>
                      <span className="rounded-full bg-care-soft px-3 py-1 text-xs font-semibold text-care-cocoa">
                        {source.type}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-care-muted">
                      {source.use}
                    </p>
                    <p className="mt-4 rounded-2xl bg-care-cocoa-soft px-3 py-2 text-sm leading-6 text-care-muted">
                      {source.status}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
