import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "생각수학 · HME 기출 학습",
  description: "공식 문제지와 풀이지를 대조하며 공부하는 수학 학습 앱",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
