import { validatePhase697TutorOrganizerV2EvidenceFiles } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';

if (import.meta.main) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    process.stdout.write(`${JSON.stringify({ ok: false, code: 'evidence_read_failed' })}\n`);
    process.exitCode = 1;
  } else {
    const result = await validatePhase697TutorOrganizerV2EvidenceFiles(paths);
    process.stdout.write(
      `${JSON.stringify({ ...result, filesChecked: result.ok ? paths.length : 0 })}\n`,
    );
    process.exitCode = result.ok ? 0 : 1;
  }
}
