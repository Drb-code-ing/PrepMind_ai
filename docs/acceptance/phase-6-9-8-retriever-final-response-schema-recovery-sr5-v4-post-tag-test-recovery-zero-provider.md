# Phase 6.9.8 SR5 v4 post-tag test recovery

Date: 2026-08-13

Branch: `drb/phase-6-9-8-sr5-final-tag-test-recovery`

Quality authority: `none`

## Sealed v4 checkpoint

The immutable annotated tag
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v4-approved` was created and pushed on
commit `5d1d299744d21c74e2fbd01a9668e6b7395f425b`. Its tag object is
`6523ae1260cb3dfb553a49ebc440a6232d013edb`; its source bundle is
`sha256:e702a81a180ca17e259c67e083d9f96c7b6c759ca85aed6ceaa03b7a11084e2a`.

D5 read-only Git inspection succeeded: local/remote tag identity, annotated kind, main/upstream/origin,
peeled/target commit, source manifest/bundle, sealed predecessor, clean tree, and empty evidence namespace
all matched. It issued only Git/source authority; runner/provider dispatch remained false and all credential,
Provider, formal-evidence, and business-write counters were zero.

The immediate tagged-source focused replay then passed `21/22` and exposed one invalid test assumption:
the test asserted that the real PrepMind checkout must permanently be in a pre-tag state. Once the expected
tag correctly existed, the production verifier returned success and the test failed. This is a test-lifecycle
defect, not Git/source parity or Provider evidence. Because a final source requires the whole focused suite,
v4 is retained unchanged but is not eligible for authorization or controlled-Live.

## Recovery

The final runtime contract moves to v5. The lifecycle-dependent test now uses an isolated non-repository
temporary root for fail-closed coverage, while real post-tag Git verification remains a separate operational
acceptance after tag creation. The v5 source binding also uses new V5 data-boundary and exact authorization
vocabulary, so no v4 receipt or future approval can cross the recovery boundary.

Focused D5+D3+D4 passed `48/48` (`85 expect()` calls); typecheck, lint, Prettier, and diff check passed.
This recovery reads no `.env` or credential, calls no Provider, creates no formal evidence or business data,
and does not start Docker/API/browser, Trace, BackgroundJob, or Outbox.

Next order: feature push -> `--no-ff` merge/push `main` -> merged-main zero-provider validation -> create/push
one final v5 annotated tag -> real read-only D5 verification. Fresh data-boundary acceptance and any
controlled-Live remain later independent decisions.
