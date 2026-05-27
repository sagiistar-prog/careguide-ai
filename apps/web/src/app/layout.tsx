import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareGuide AI",
  description: "家庭常见病用药资料咨询台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
