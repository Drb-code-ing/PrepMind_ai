import React, { createElement, useState, type ReactNode } from 'react';

type AuditTab = 'records' | 'exports';

const tabs: Array<{ id: AuditTab; label: string; panelId: string }> = [
  { id: 'records', label: '审计记录', panelId: 'audit-records-panel' },
  { id: 'exports', label: '证据包', panelId: 'audit-exports-panel' },
];

export function AuditWorkspaceTabs({
  records,
  exports,
}: {
  records: ReactNode;
  exports: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<AuditTab>('records');

  function selectTab(index: number) {
    const next = tabs[index];
    if (!next) return;
    setActiveTab(next.id);
    document.getElementById(`audit-${next.id}-tab`)?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectTab(nextIndex);
  }

  const tabList = createElement(
    'div',
    {
      role: 'tablist',
      'aria-label': '操作审计工作台',
      className: 'inline-flex rounded-md border border-[var(--admin-line)] bg-white p-1 shadow-sm',
    },
    tabs.map((tab, index) =>
      createElement(
        'button',
        {
          key: tab.id,
          id: `audit-${tab.id}-tab`,
          type: 'button',
          role: 'tab',
          'aria-controls': tab.panelId,
          'aria-selected': activeTab === tab.id,
          tabIndex: activeTab === tab.id ? 0 : -1,
          onClick: () => setActiveTab(tab.id),
          onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => handleKeyDown(event, index),
          className: [
            'min-h-10 rounded px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[rgba(15,118,110,0.24)]',
            activeTab === tab.id
              ? 'bg-[var(--admin-ink)] text-white'
              : 'text-[var(--admin-muted)] hover:bg-slate-50 hover:text-[var(--admin-ink)]',
          ].join(' '),
        },
        tab.label,
      ),
    ),
  );

  const panel = (tab: (typeof tabs)[number], content: ReactNode) =>
    createElement(
      'div',
      {
        id: tab.panelId,
        role: 'tabpanel',
        'aria-labelledby': `audit-${tab.id}-tab`,
        hidden: activeTab !== tab.id,
        className: 'mt-4',
      },
      activeTab === tab.id ? content : null,
    );

  return createElement(
    React.Fragment,
    null,
    tabList,
    panel(tabs[0], records),
    panel(tabs[1], exports),
  );
}

export function SelectableActionRow({
  label,
  selected,
  onSelect,
  actions,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return createElement(
    'div',
    {
      role: 'group',
      'aria-label': label,
      className: [
        'relative flex w-full items-start pr-3 hover:bg-slate-50',
        selected ? 'bg-slate-50' : '',
      ].join(' '),
    },
    createElement('span', {
      'aria-hidden': 'true',
      className: [
        'absolute left-0 top-0 h-full w-1',
        selected ? 'bg-[var(--admin-accent)]' : 'bg-transparent',
      ].join(' '),
    }),
    createElement(
      'button',
      {
        type: 'button',
        'aria-label': `选择${label}`,
        'aria-pressed': selected,
        onClick: onSelect,
        className:
          'grid min-w-0 flex-1 grid-cols-[7rem_minmax(0,1fr)] items-start gap-3 px-4 py-3 text-left',
      },
      children,
    ),
    actions ? createElement('div', { className: 'flex shrink-0 gap-1 py-3' }, actions) : null,
  );
}
