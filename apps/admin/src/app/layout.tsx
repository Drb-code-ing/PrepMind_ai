import type { Metadata } from 'next';

import { AuthSessionProvider } from '@/components/auth-session-provider';
import { QueryProvider } from '@/components/query-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'PrepMind Admin',
  description: 'PrepMind AI 管理员后台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <QueryProvider>
          <AuthSessionProvider>{children}</AuthSessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
