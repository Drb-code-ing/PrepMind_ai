import type { Metadata, Viewport } from 'next';
import { AuthSessionProvider } from '@/components/providers/auth-session-provider';
import { ChatRuntimeProvider } from '@/components/providers/chat-runtime-provider';
import { OcrRuntimeProvider } from '@/components/providers/ocr-runtime-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrepMind AI - 智能备考助手',
  description: 'AI 驱动的智能备考助手，拍照识题、AI 讲解、错题本管理',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PrepMind',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6366f1',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <AuthSessionProvider>
            <ChatRuntimeProvider>
              <OcrRuntimeProvider>{children}</OcrRuntimeProvider>
            </ChatRuntimeProvider>
          </AuthSessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
