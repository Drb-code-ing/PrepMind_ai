import { executePhase697TutorOrganizerV2Cli } from './phase-6-9-7-tutor-wrong-question-cli.ts';

if (import.meta.main) {
  try {
    const result = await executePhase697TutorOrganizerV2Cli({
      argv: process.argv.slice(2),
      env: process.env,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    process.stdout.write(`${JSON.stringify({ ok: false, code: 'execution_failed' })}\n`);
    process.exitCode = 1;
  }
}
