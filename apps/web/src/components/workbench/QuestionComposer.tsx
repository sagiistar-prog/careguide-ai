type QuestionComposerProps = {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function QuestionComposer({
  value,
  loading,
  onChange,
  onSubmit,
}: QuestionComposerProps) {
  return (
    <section className="rounded-[32px] border border-care-line bg-care-paper p-4 shadow-care-soft transition duration-200 ease-out focus-within:shadow-care-glow">
      <label
        htmlFor="careguide-question"
        className="text-sm font-semibold text-care-ink"
      >
        把情况写具体一点
      </label>
      <textarea
        id="careguide-question"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        maxLength={500}
        placeholder="年龄、性别、症状、持续时间、既往病史、正在服用的药"
        className="mt-3 min-h-28 w-full resize-none rounded-[24px] border border-care-line bg-care-surface px-4 py-3 text-base leading-7 text-care-ink outline-none transition duration-200 ease-out placeholder:text-care-faint hover:border-care-gold/60 focus:border-care-gold focus:ring-4 focus:ring-care-gold/20"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || value.trim().length < 2}
          aria-busy={loading}
          className="min-h-12 rounded-full bg-care-primary px-8 text-base font-semibold text-care-on-primary shadow-care-soft transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-care-primary-strong hover:shadow-care-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-focus active:translate-y-0 active:scale-[0.98] disabled:bg-care-disabled disabled:text-care-muted disabled:shadow-none"
        >
          {loading ? "正在查询" : "发送"}
        </button>
      </div>
    </section>
  );
}
