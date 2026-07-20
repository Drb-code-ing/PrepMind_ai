# Phase 6.9.5 controlled-Live v2 schema-contract repair

## Root cause

The consumed v1 server-only diagnostic asked the provider to acknowledge a
probe, while the canonical runtime schema was
`REVIEW_MODEL_CANDIDATE_SCHEMA`. That schema only accepts a strict object with
`focusIndexes` and `diagnosis`. An acknowledgement is valid JSON but is not a
valid Review candidate, so the recorded `structured_output` result was an
expected local schema rejection rather than evidence that the model path had
received a satisfiable diagnostic contract.

## Narrow v2 change

The v2 diagnostic remains a fact-free Review candidate request and asks for
exactly:

```json
{"focusIndexes":[0],"diagnosis":"review_pressure"}
```

It still uses `REVIEW_MODEL_CANDIDATE_SCHEMA` as the canonical validator and
the OpenAI-compatible `json_object` mode. It sends no tools, tool choice, JSON
schema transport extension, user facts, summaries, paired-eval fixtures, or
business write capability.

The following controls are intentionally unchanged:

- 4500 ms timeout;
- 96 maximum diagnostic input tokens and 32 maximum output tokens;
- one diagnostic attempt, no retry;
- both Review and Planner production gates remain `false`;
- the later 48-case paired evaluation remains unreachable until this diagnostic
  succeeds with verifiable usage.

## Evidence lineage

v2 uses its own profile/run id, evidence schema version,
`docs/acceptance/evidence/phase-6-9-5-controlled-live-v2/` directory, and
`.review-planner-controlled-live-v2.once` marker. The v1 evidence and marker
from commit `27e86db` remain historical, read-only evidence. They are not
deleted, overwritten, reused, or combined with v2 counters.

Both profiles persist only the fixed state, gate, provider attempt count,
usage-known flag, and diagnostic enum. Prompts, candidate JSON, summaries,
evidence text, credentials, endpoint, headers, raw provider errors, stack,
token details, and cost remain outside the persisted contract.

## Zero-network verification

Before any future provider invocation, regression tests prove all of the
following:

- the exact valid Review object yields one complete diagnostic attempt;
- legal JSON acknowledgement, missing field, wrong field type, and extra field
  each yield `invalid_attempted / structured_output / attempt=1` with no raw
  content in the result;
- the factory passes `structuredOutputMode: 'json_object'` and no strict-tool
  profile or tool configuration;
- a pre-existing v1 marker does not block v2 reservation and is byte-for-byte
  unchanged; and
- the v2 evidence summary rejects extra raw summary/evidence fields.

This document only repairs the local diagnostic contract. It is not a Live
result, does not authorize a production gate, and does not claim a quality,
cost, Docker, browser, or main-branch acceptance result.
