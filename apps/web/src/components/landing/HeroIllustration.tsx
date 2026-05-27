type HeroIllustrationProps = {
  transitioning?: boolean;
};

export function HeroIllustration({ transitioning = false }: HeroIllustrationProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden transition duration-[560ms] ease-out ${
        transitioning ? "scale-[0.985] opacity-80 blur-[3px]" : "scale-100 opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="hero-ambient absolute inset-0 bg-[radial-gradient(circle_at_72%_34%,oklch(78%_0.10_78_/_0.24),transparent_34%),radial-gradient(circle_at_18%_22%,oklch(92%_0.05_76_/_0.17),transparent_28%)]" />
      <div
        className="absolute inset-0 bg-cover bg-center opacity-95"
        style={{
          backgroundImage:
            'url("/hero-careguide-3d.png"), url("/hero-careguide-3d.svg")',
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(19%_0.032_116_/_0.86),oklch(23%_0.032_116_/_0.55)_42%,oklch(24%_0.032_116_/_0.2)_70%,oklch(24%_0.032_116_/_0.38))]" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(0deg,oklch(15%_0.026_116_/_0.72),transparent)]" />

      <div className="hero-panel absolute right-[8%] top-[22%] hidden w-[360px] rounded-[36px] border border-care-on-primary/18 bg-care-on-primary/14 p-5 shadow-care-card lg:block">
        <div className="h-3 w-28 rounded-full bg-care-on-primary/60" />
        <div className="mt-5 grid grid-cols-[72px_1fr] gap-4">
          <div className="h-24 rounded-[26px] bg-care-gold/85 shadow-care-soft" />
          <div className="space-y-3">
            <div className="h-4 rounded-full bg-care-on-primary/74" />
            <div className="h-4 w-4/5 rounded-full bg-care-on-primary/42" />
            <div className="h-4 w-3/5 rounded-full bg-care-on-primary/34" />
          </div>
        </div>
      </div>

      <div className="hero-float absolute bottom-[18%] right-[16%] hidden h-20 w-20 rounded-[28px] bg-care-paper/88 shadow-care-card md:block" />
      <div className="hero-float absolute right-[34%] top-[20%] hidden h-12 w-12 rounded-2xl bg-care-gold/80 shadow-care-soft md:block" />
    </div>
  );
}
