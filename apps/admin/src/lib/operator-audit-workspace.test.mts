import assert from 'node:assert/strict';
import test from 'node:test';

import { JSDOM } from 'jsdom';
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { AuditWorkspaceTabs, SelectableActionRow } from '../components/operator-audit-workspace.ts';

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:3100/audit',
  });
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
  })) {
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  return dom;
}

test('tabs support ArrowLeft/Right/Home/End and keep one panel visible', () => {
  const dom = installDom();
  try {
    const view = render(
      React.createElement(AuditWorkspaceTabs, {
        records: React.createElement('p', null, 'records-body'),
        exports: React.createElement('p', null, 'exports-body'),
      }),
    );
    const recordsTab = view.getByRole('tab', { name: '审计记录' });
    const exportsTab = view.getByRole('tab', { name: '证据包' });

    recordsTab.focus();
    fireEvent.keyDown(recordsTab, { key: 'End' });
    assert.equal(exportsTab.getAttribute('aria-selected'), 'true');
    assert.equal(document.activeElement, exportsTab);
    assert.equal(view.queryByText('records-body'), null);
    assert.ok(view.getByText('exports-body'));

    fireEvent.keyDown(exportsTab, { key: 'Home' });
    assert.equal(recordsTab.getAttribute('aria-selected'), 'true');
    fireEvent.keyDown(recordsTab, { key: 'ArrowLeft' });
    assert.equal(exportsTab.getAttribute('aria-selected'), 'true');
    fireEvent.keyDown(exportsTab, { key: 'ArrowRight' });
    assert.equal(recordsTab.getAttribute('aria-selected'), 'true');

    const visiblePanels = view
      .getAllByRole('tabpanel', { hidden: true })
      .filter((panel) => !panel.hasAttribute('hidden'));
    assert.equal(visiblePanels.length, 1);
  } finally {
    cleanup();
    dom.window.close();
  }
});

test('selectable action row renders selection and action buttons as siblings', () => {
  const dom = installDom();
  try {
    const view = render(
      React.createElement(
        SelectableActionRow,
        {
          label: '证据包 export_1',
          selected: true,
          onSelect() {},
          actions: React.createElement('button', { type: 'button' }, '下载'),
        },
        React.createElement('span', null, 'row body'),
      ),
    );
    const group = view.getByRole('group', { name: '证据包 export_1' });
    assert.equal(group.querySelectorAll('button').length, 2);
    assert.equal(group.querySelector('button button'), null);
    assert.equal(
      view.getByRole('button', { name: '选择证据包 export_1' }).getAttribute('aria-pressed'),
      'true',
    );
  } finally {
    cleanup();
    dom.window.close();
  }
});
