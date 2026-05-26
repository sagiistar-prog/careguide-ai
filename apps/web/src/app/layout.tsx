import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareGuide AI",
  description: "把复杂用药资料整理成家人能看懂的说明。",
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
