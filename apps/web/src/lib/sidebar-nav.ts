export type SidebarUserRole = 'STUDENT' | 'ADMIN' | undefined;

export type SidebarNavIconKey =
  | 'chat'
  | 'knowledge'
  | 'today'
  | 'plan'
  | 'stats'
  | 'errorBook'
  | 'profile'
  | 'audit'
  | 'adminConsole';

export interface SidebarNavItem {
  href: string;
  label: string;
  hint: string;
  iconKey: SidebarNavIconKey;
  adminOnly?: boolean;
  desktopOnly?: boolean;
  external?: boolean;
}

export interface SidebarNavOptions {
  adminConsoleUrl?: string;
}

const baseNavItems: SidebarNavItem[] = [
  { href: '/chat', label: 'AI 对话', hint: '拍照识题与追问', iconKey: 'chat' },
  { href: '/knowledge', label: '知识库', hint: '资料入库与检索测试', iconKey: 'knowledge' },
  { href: '/today', label: '今日任务', hint: '轻学习手账', iconKey: 'today' },
  { href: '/plan', label: '复习计划', hint: '未来到期与复习压力', iconKey: 'plan' },
  { href: '/stats', label: '学习统计', hint: '复习趋势与记录', iconKey: 'stats' },
  { href: '/error-book', label: '错题本', hint: '复盘和标记掌握', iconKey: 'errorBook' },
  { href: '/profile', label: '我的档案', hint: '偏好与账号资料', iconKey: 'profile' },
];

function getAdminNavItems(adminConsoleUrl: string): SidebarNavItem[] {
  return [
    {
      href: adminConsoleUrl,
      label: '后台管理',
      hint: '桌面端系统运维入口',
      iconKey: 'adminConsole',
      adminOnly: true,
      desktopOnly: true,
      external: true,
    },
    {
      href: '/operator-audit',
      label: '审计',
      hint: '管理员操作留痕',
      iconKey: 'audit',
      adminOnly: true,
    },
  ];
}

export function getSidebarNavItems(
  role: SidebarUserRole,
  options: SidebarNavOptions = {},
): SidebarNavItem[] {
  if (role !== 'ADMIN') {
    return baseNavItems;
  }

  return [...baseNavItems, ...getAdminNavItems(resolveAdminConsoleUrl(options))];
}

function resolveAdminConsoleUrl(options: SidebarNavOptions) {
  return (
    options.adminConsoleUrl ??
    process.env.NEXT_PUBLIC_ADMIN_CONSOLE_URL ??
    'http://127.0.0.1:3100'
  );
}
