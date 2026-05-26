import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Alibaba PuHuiTi",
          "阿里巴巴普惠体",
          "Alibaba PuHuiTi 2.0",
          "PingFang SC",
          "Microsoft YaHei",
          "Hiragino Sans GB",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        care: {
          ink: "oklch(25% 0.025 170)",
          muted: "oklch(46% 0.026 170)",
          faint: "oklch(65% 0.018 170)",
          line: "oklch(88% 0.014 160)",
          wash: "oklch(97% 0.012 130)",
          paper: "oklch(99% 0.006 120)",
          surface: "oklch(98% 0.01 130)",
          soft: "oklch(94% 0.025 150)",
          primary: "oklch(45% 0.085 165)",
          "primary-strong": "oklch(39% 0.09 165)",
          "on-primary": "oklch(98% 0.01 145)",
          focus: "oklch(58% 0.105 165)",
          warning: "oklch(63% 0.105 75)",
          "warning-soft": "oklch(95% 0.04 82)",
          danger: "oklch(56% 0.13 34)",
          "danger-soft": "oklch(95% 0.035 34)",
          success: "oklch(55% 0.08 150)",
          "success-soft": "oklch(94% 0.035 150)",
          disabled: "oklch(87% 0.01 150)",
        },
      },
      boxShadow: {
        "care-drawer": "-18px 0 45px oklch(25% 0.025 170 / 0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
