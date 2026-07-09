export type AdminNavIconKey = 'dashboard' | 'outbox' | 'audit' | 'worker';

export interface AdminNavItem {
  href: string;
  label: string;
  description: string;
  iconKey: AdminNavIconKey;
  adminOnly: true;
}

const adminNavItems: AdminNavItem[] = [
  {
    href: '/',
    label: '控制台',
    description: '系统诊断入口总览',
    iconKey: 'dashboard',
    adminOnly: true,
  },
  {
    href: '/outbox',
    label: 'Outbox Ops',
    description: '查看失败事件并安全重新入队',
    iconKey: 'outbox',
    adminOnly: true,
  },
  {
    href: '/audit',
    label: '操作审计',
    description: '追踪管理员诊断写操作',
    iconKey: 'audit',
    adminOnly: true,
  },
  {
    href: '/worker',
    label: 'Worker 健康',
    description: '检查后台任务链路 readiness',
    iconKey: 'worker',
    adminOnly: true,
  },
];

export function getAdminNavItems() {
  return adminNavItems;
}
