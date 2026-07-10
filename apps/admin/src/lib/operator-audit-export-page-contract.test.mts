import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(__dirname, '../app/audit/page.tsx'), 'utf8');
const exportPanelSource = readFileSync(
  resolve(__dirname, '../components/operator-audit-export-panel.tsx'),
  'utf8',
);
const workspaceSource = readFileSync(
  resolve(__dirname, '../components/operator-audit-workspace.ts'),
  'utf8',
);
const tabWiringSource = `${pageSource}\n${workspaceSource}`;

test('static contract keeps audit semantics wired; DOM behavior has a dedicated test', () => {
  assert.match(tabWiringSource, /tablist/);
  assert.match(tabWiringSource, /tabpanel/);
  assert.match(tabWiringSource, /aria-controls/);
  assert.match(tabWiringSource, /aria-selected/);
  assert.match(tabWiringSource, /审计记录/);
  assert.match(tabWiringSource, /证据包/);
  assert.match(pageSource, /AuditFilterState/);
  assert.match(pageSource, /defaultFilters/);
  assert.match(
    pageSource,
    /<OperatorAuditExportPanel key={JSON\.stringify\(filters\)} defaultFilters={filters} \/>/,
  );
});

test('evidence request states limits, validates fields, and preserves idempotency', () => {
  assert.match(exportPanelSource, /reason/);
  assert.match(exportPanelSource, /datetime-local/);
  assert.match(exportPanelSource, /31 天/);
  assert.match(exportPanelSource, /50,000/);
  assert.match(exportPanelSource, /aria-describedby/);
  assert.match(exportPanelSource, /requestSignature/);
  assert.match(exportPanelSource, /transitionOperatorAuditExportRequest/);
  assert.match(exportPanelSource, /crypto\.randomUUID/);
  assert.match(exportPanelSource, /isPending/);
  assert.match(exportPanelSource, /QUEUED|排队中/);
  assert.match(exportPanelSource, /getOperatorAuditExportPollInterval/);
});

test('evidence panel provides cursor pagination, safe details, and accessible download actions', () => {
  assert.match(exportPanelSource, /useInfiniteQuery/);
  assert.match(exportPanelSource, /nextCursor/);
  assert.match(exportPanelSource, /operatorAuditExportApi\.detail/);
  assert.match(exportPanelSource, /operatorAuditExportApi\.download/);
  assert.match(exportPanelSource, /triggerOperatorAuditExportDownload/);
  assert.match(exportPanelSource, /aria-label="下载证据包"/);
  assert.match(exportPanelSource, /title="下载证据包"/);
  assert.match(exportPanelSource, /aria-label="复制 ZIP SHA-256"/);
  assert.match(exportPanelSource, /title="复制 ZIP SHA-256"/);
  assert.match(exportPanelSource, /BackgroundJob|后台任务/);
  assert.match(exportPanelSource, /CSV SHA-256/);
  assert.match(exportPanelSource, /ZIP SHA-256/);
  assert.match(exportPanelSource, /break-all/);
  assert.match(exportPanelSource, /文件已删除/);
  assert.match(exportPanelSource, /缩小时间范围/);
  assert.match(exportPanelSource, /SelectableActionRow/);
});

test('evidence UI never references storage internals or unsupported object operations', () => {
  assert.doesNotMatch(
    exportPanelSource,
    /objectKey|processingToken|requestHash|payload|metadata|leaseExpiresAt/,
  );
  assert.doesNotMatch(exportPanelSource, /延长|恢复文件|编辑对象/);
  assert.doesNotMatch(exportPanelSource, /presigned|预签名/i);
});
