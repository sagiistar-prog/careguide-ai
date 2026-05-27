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
          ink: "oklch(23% 0.028 116)",
          muted: "oklch(43% 0.03 92)",
          faint: "oklch(63% 0.022 88)",
          line: "oklch(86% 0.018 78)",
          wash: "oklch(95.5% 0.02 78)",
          paper: "oklch(98.5% 0.012 82)",
          surface: "oklch(96.8% 0.018 78)",
          soft: "oklch(91.5% 0.035 82)",
          primary: "oklch(33% 0.058 146)",
          "primary-strong": "oklch(27% 0.062 146)",
          "on-primary": "oklch(97.2% 0.014 86)",
          focus: "oklch(57% 0.12 78)",
          gold: "oklch(70% 0.115 82)",
          amber: "oklch(76% 0.095 76)",
          cocoa: "oklch(37% 0.052 62)",
          "cocoa-soft": "oklch(91% 0.035 64)",
          warning: "oklch(61% 0.105 70)",
          "warning-soft": "oklch(94% 0.04 76)",
          danger: "oklch(52% 0.13 34)",
          "danger-soft": "oklch(94% 0.035 34)",
          success: "oklch(45% 0.075 145)",
          "success-soft": "oklch(93% 0.035 145)",
          disabled: "oklch(86% 0.012 85)",
        },
      },
      boxShadow: {
        "care-drawer": "-18px 0 45px oklch(25% 0.025 170 / 0.16)",
        "care-card": "0 24px 70px oklch(30% 0.04 82 / 0.14)",
        "care-soft": "0 10px 30px oklch(33% 0.04 72 / 0.09)",
        "care-lift": "0 16px 38px oklch(28% 0.04 80 / 0.13)",
        "care-glow": "0 0 0 1px oklch(78% 0.08 82 / 0.35), 0 18px 56px oklch(70% 0.10 82 / 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
