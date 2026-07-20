# Phase 6.9.5 V17 Product-Acceptance Design

## Trigger

V16 consumed its unique command at a root-absent preflight. The server and
V16 validator were ready; the Node runner instead started in `apps/server`,
while the immutable V10 evidence authority correctly defaults to
`process.cwd()`. It therefore read no authority and stopped before owner,
ledger, Docker, browser, API, provider or synthetic resources.

## V17 boundary

V17 has independent confirmation, schemas, evidence/recovery/execution roots,
browser profile and Node entry points. Before loading either exact allowlisted
entry, its runner switches to and re-verifies the repository root. The entry
filenames, allowed source roots, two workspace bridges and resolver restrictions
remain unchanged. V11--V16 roots are native-sentinel immutable.

V17 inherits V16's strictly closed Flash/Pro and official DeepSeek root-or-v1
URL receipt, including durable model/baseUrl read-back and V17 recovery
validator injection. No V17 runtime command has run while this document was
written.
