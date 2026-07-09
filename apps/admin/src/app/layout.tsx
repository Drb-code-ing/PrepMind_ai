import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'PrepMind Admin',
  description: 'PrepMind AI 管理员后台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
