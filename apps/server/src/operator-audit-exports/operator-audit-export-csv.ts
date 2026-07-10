import { stringify } from 'csv-stringify';

import { sanitizeJobError } from '../jobs/job-error-sanitizer';

export const OPERATOR_AUDIT_CSV_COLUMNS = [
  'id',
  'actorUserId',
  'action',
  'status',
  'targetType',
  'targetId',
  'reason',
  'requestId',
  'ipAddressHash',
  'userAgentHash',
  'errorCode',
  'errorPreview',
  'createdAt',
] as const;

export type OperatorAuditCsvRecord = {
  id: string;
  actorUserId: string | null;
  action: string;
  status: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  requestId: string | null;
  ipAddressHash: string | null;
  userAgentHash: string | null;
  errorCode: string | null;
  errorPreview: string | null;
  createdAt: Date;
};

const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

export function sanitizeOperatorAuditCsvCell(value: string): string {
  const secretSafe = sanitizeJobError(value, '');
  const formulaCapable = isFormulaCapableAfterNormalization(secretSafe);
  const normalized = removeDisallowedControls(
    secretSafe.replace(/\r\n?/g, '\n'),
  );

  return formulaCapable ? `'${normalized}` : normalized;
}

function removeDisallowedControls(value: string) {
  return [...value]
    .filter((character) => !isDisallowedControl(character))
    .join('');
}

function isFormulaCapableAfterNormalization(value: string) {
  for (const character of value) {
    if (character.trim() === '' || isDisallowedControl(character)) continue;
    return FORMULA_PREFIX_PATTERN.test(character);
  }
  return false;
}

function isDisallowedControl(character: string) {
  const code = character.charCodeAt(0);
  return code !== 10 && (code <= 31 || code === 127);
}

export function formatOperatorAuditCsvRecord(record: OperatorAuditCsvRecord) {
  return Object.fromEntries(
    OPERATOR_AUDIT_CSV_COLUMNS.map((column) => {
      const value = record[column];
      const text =
        value === null || value === undefined
          ? ''
          : value instanceof Date
            ? value.toISOString()
            : String(value);
      return [column, sanitizeOperatorAuditCsvCell(text)];
    }),
  );
}

export async function serializeOperatorAuditCsv(
  records: OperatorAuditCsvRecord[],
): Promise<Buffer> {
  const csv = await stringifyCsv(records.map(formatOperatorAuditCsvRecord));
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv)]);
}

function stringifyCsv(records: Array<Record<string, string>>) {
  return new Promise<string>((resolve, reject) => {
    stringify(
      records,
      {
        header: true,
        columns: [...OPERATOR_AUDIT_CSV_COLUMNS],
        record_delimiter: '\r\n',
      },
      (error, output) => {
        if (error) reject(error);
        else resolve(output);
      },
    );
  });
}
