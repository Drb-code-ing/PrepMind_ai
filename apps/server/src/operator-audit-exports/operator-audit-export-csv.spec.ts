import {
  OPERATOR_AUDIT_CSV_COLUMNS,
  sanitizeOperatorAuditCsvCell,
  serializeOperatorAuditCsv,
} from './operator-audit-export-csv';

describe('operator audit export CSV', () => {
  it('writes BOM, fixed 13-column header, CRLF records, and a final newline', async () => {
    const bytes = await serializeOperatorAuditCsv([]);

    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString('utf8').slice(1)).toBe(
      `${OPERATOR_AUDIT_CSV_COLUMNS.join(',')}\r\n`,
    );
    expect(OPERATOR_AUDIT_CSV_COLUMNS).toHaveLength(13);
  });

  it('quotes Chinese, commas, quotes, and embedded newlines while mapping null to empty', async () => {
    const bytes = await serializeOperatorAuditCsv([
      row({
        reason: '中文,"证据"\r\n第二行',
        targetId: null,
        createdAt: new Date('2026-07-10T08:09:10.000Z'),
      }),
    ]);
    const csv = bytes.toString('utf8').slice(1);

    expect(csv).toContain('"中文,""证据""\n第二行"');
    expect(csv).toContain(',TARGET_TYPE,,');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('prefixes formula-capable cells after whitespace and control bypasses', () => {
    const dangerous = [
      '=1+1',
      ' +SUM(A1:A2)',
      '\t-HYPERLINK("https://example.invalid")',
      '\r@SUM(1,1)',
      '\u0000=1+1',
      '\u0008+SUM(A1:A2)',
      '\u00a0=CMD()',
      '\u3000+CMD()',
    ];

    for (const value of dangerous) {
      expect(sanitizeOperatorAuditCsvCell(value)).toMatch(/^'/);
    }
    expect(sanitizeOperatorAuditCsvCell('ordinary text')).toBe('ordinary text');
  });

  it('normalizes CRLF, preserves legal embedded newlines, and removes other controls', () => {
    expect(sanitizeOperatorAuditCsvCell('a\r\nb\rc\u0000\u0008\td')).toBe(
      'a\nb\nc d'.replace(' ', ''),
    );
  });

  it('redacts bearer, cookie, and provider secrets from serialized bytes', async () => {
    const bytes = await serializeOperatorAuditCsv([
      row({
        reason: 'Bearer secret-token',
        errorPreview:
          'Cookie: refresh=secret QWEN_API_KEY=secret provider failed',
      }),
    ]);
    const serialized = bytes.toString('utf8');

    expect(serialized).not.toContain('Bearer secret-token');
    expect(serialized).not.toContain('Cookie: refresh=secret');
    expect(serialized).not.toContain('QWEN_API_KEY=secret');
  });
});

function row(
  overrides: Partial<
    Parameters<typeof serializeOperatorAuditCsv>[0][number]
  > = {},
): Parameters<typeof serializeOperatorAuditCsv>[0][number] {
  return {
    id: 'audit_1',
    actorUserId: 'admin_1',
    action: 'AUDIT_EXPORT_REQUEST',
    status: 'SUCCEEDED',
    targetType: 'TARGET_TYPE',
    targetId: 'target_1',
    reason: 'evidence request',
    requestId: 'request_1',
    ipAddressHash: `hmac-sha256:${'a'.repeat(64)}`,
    userAgentHash: `hmac-sha256:${'b'.repeat(64)}`,
    errorCode: null,
    errorPreview: null,
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    ...overrides,
  };
}
