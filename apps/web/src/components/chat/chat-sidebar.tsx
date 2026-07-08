'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarClock,
  CalendarDays,
  LogOut,
  MessageCircle,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';

import { useLogout } from '@/hooks/use-auth';
import { getLogoutConfirmationView } from '@/lib/logout-confirmation';
import { useUserStore } from '@/stores/userStore';

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/chat', label: 'AI 对话', hint: '拍照识题与追问', icon: MessageCircle },
  { href: '/knowledge', label: '知识库', hint: '资料入库与检索测试', icon: BookMarked },
  { href: '/today', label: '今日任务', hint: '轻学习手账', icon: CalendarDays },
  { href: '/plan', label: '复习计划', hint: '未来到期与复习压力', icon: CalendarClock },
  { href: '/stats', label: '学习统计', hint: '复习趋势与记录', icon: BarChart3 },
  { href: '/error-book', label: '错题本', hint: '复盘和标记掌握', icon: BookOpen },
  { href: '/profile', label: '我的档案', hint: '偏好与账号资料', icon: UserRound },
];

export default function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const logout = useLogout();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const logoutConfirmation = getLogoutConfirmationView({
    confirming: logoutConfirmOpen,
    pending: logout.isPending,
  });
  const handleClose = () => {
    setLogoutConfirmOpen(false);
    onClose();
  };

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-50 cursor-default bg-[#2b2335]/25 backdrop-blur-[2px]"
          onClick={handleClose}
          aria-label="关闭导航遮罩"
        />
      ) : null}

      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(22rem,88vw)] flex-col border-l border-white/70 bg-[#fffdf8]/92 shadow-[0_24px_80px_rgba(91,61,102,0.2)] backdrop-blur-2xl transition-transform duration-300 ${
          open ? 'pointer-events-auto translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        {open ? (
          <>
            <div className="px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="pm-mascot-float flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-[#fff7d6] text-base font-black text-[#247269] ring-1 ring-[#f3e6a8]">
                    学
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--pm-ink)]">
                      {currentUser?.username || '学习者'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--pm-muted)]">
                      {currentUser?.email || currentUser?.phone || 'PrepMind AI 学习搭子'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
                  aria-label="关闭导航"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 rounded-[1.35rem] border border-[#bdeee5] bg-[#eafff9]/80 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#247269]">
                  <Sparkles className="h-4 w-4" />
                  Chat-first 学习流
                </div>
                <p className="mt-1 text-xs leading-5 text-[#5e6f69]">
                  对话仍是主入口，任务、错题和档案都围绕 AI 学习过程展开。
                </p>
              </div>
            </div>

            <nav className="flex-1 px-3 py-2">
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const isActive =
                    item.href === '/chat' ? pathname === '/chat' : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={handleClose}
                        className={`tap-target group flex items-center gap-3 rounded-[1.15rem] px-3 py-3 text-sm transition-all active:scale-[0.99] ${
                          isActive
                            ? 'bg-white text-[var(--pm-ink)] shadow-sm ring-1 ring-[#bdeee5]'
                            : 'text-[var(--pm-muted)] hover:bg-white/70 hover:text-[var(--pm-ink)]'
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 transition-all ${
                            isActive
                              ? 'bg-[#eafff9] text-[#247269] ring-[#bdeee5]'
                              : 'bg-white/70 text-[var(--pm-muted)] ring-[var(--pm-line)] group-hover:bg-[#f8fbff]'
                          }`}
                        >
                          <item.icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{item.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--pm-muted)]">
                            {item.hint}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t border-[var(--pm-line)] px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={logout.isPending}
                onClick={() => setLogoutConfirmOpen(true)}
                className="tap-target flex w-full items-center gap-3 rounded-[1.15rem] px-3 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-[0.99] disabled:opacity-60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100">
                  <LogOut className="h-5 w-5" />
                </span>
                {logout.isPending ? '退出中...' : '退出登录'}
              </button>
            </div>
          </>
        ) : null}
      </aside>

      {logoutConfirmation.state !== 'idle' ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
          <button
            type="button"
            aria-label="关闭退出确认"
            className="absolute inset-0 cursor-default bg-[#221b2c]/35 backdrop-blur-[3px]"
            onClick={() => {
              if (!logout.isPending) setLogoutConfirmOpen(false);
            }}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            className="relative w-full max-w-[20.5rem] overflow-hidden rounded-[1.75rem] border border-white/80 bg-[#fffdf8] p-4 text-center shadow-[0_26px_80px_rgba(43,35,53,0.28)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_50%_0%,rgba(134,220,207,0.22),transparent_62%)]" />
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff3f1] text-[#c84840] ring-1 ring-[#ffd9d3]">
              <LogOut className="h-6 w-6" />
            </div>
            <h2
              id="logout-confirm-title"
              className="relative mt-4 text-lg font-black leading-tight text-[var(--pm-ink)]"
            >
              {logoutConfirmation.title}
            </h2>
            <p className="relative mx-auto mt-2 max-w-[16.5rem] text-sm leading-6 text-[var(--pm-muted)]">
              {logoutConfirmation.description}
            </p>
            <div className="relative mt-5 flex flex-col gap-2">
              {logoutConfirmation.secondaryLabel ? (
                <button
                  type="button"
                  disabled={logout.isPending}
                  onClick={() => setLogoutConfirmOpen(false)}
                  className="tap-target min-h-12 rounded-2xl bg-[#2b2335] px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(43,35,53,0.18)] transition-all hover:bg-[#3a3045] active:scale-[0.98] disabled:opacity-60"
                >
                  {logoutConfirmation.secondaryLabel}
                </button>
              ) : null}
              <button
                type="button"
                disabled={logout.isPending}
                onClick={async () => {
                  await logout.mutateAsync().catch(() => undefined);
                  handleClose();
                  router.replace('/login');
                }}
                className="tap-target min-h-12 rounded-2xl bg-white px-4 text-sm font-bold text-[#c84840] ring-1 ring-[#ffd9d3] transition-all hover:bg-[#fff3f1] active:scale-[0.98] disabled:opacity-60"
              >
                {logoutConfirmation.primaryLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
