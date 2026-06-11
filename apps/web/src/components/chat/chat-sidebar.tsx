'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, CalendarDays, LogOut, User, X } from 'lucide-react';

import { useLogout } from '@/hooks/use-auth';
import { useUserStore } from '@/stores/userStore';

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/today', label: '今日任务', icon: CalendarDays },
  { href: '/error-book', label: '错题本', icon: BookOpen },
];

export default function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useUserStore((s) => s.currentUser);
  const logout = useLogout();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 transition-opacity" onClick={onClose} />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{currentUser?.username || '未登录'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {currentUser?.email || currentUser?.phone || ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`tap-target flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-1 border-t border-border px-3 py-4">
          <Link
            href="/profile"
            onClick={onClose}
            className={`tap-target flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              pathname === '/profile'
                ? 'bg-primary/5 text-primary'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <User className="h-5 w-5" />
            个人中心
          </Link>
          <button
            type="button"
            disabled={logout.isPending}
            onClick={async () => {
              await logout.mutateAsync().catch(() => undefined);
              onClose();
              router.replace('/login');
            }}
            className="tap-target flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" />
            {logout.isPending ? '退出中...' : '退出登录'}
          </button>
        </div>
      </aside>
    </>
  );
}
