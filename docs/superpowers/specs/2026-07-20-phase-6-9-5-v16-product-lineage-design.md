# Phase 6.9.5 V16 Product-Acceptance Design

## Trigger

V15 consumed its one branch command at a `default_off` preflight. The ordinary
Compose server was healthy and safely closed, but used the official OpenAI-
compatible DeepSeek URL `https://api.deepseek.com/v1`; V15 accepted only the
same official URL without the suffix. No V15 owner, ledger, execution
manifest, Docker mutation, browser, API, provider or synthetic resource was
created. V15 is root-absent, non-retryable and not recovery-admissible.

## V16 boundary

V16 is a fresh isolated lineage with its own confirmation, schemas, public,
recovery and execution roots, browser profile, Node runner and package entry
points. Its native sentinel proves V11--V15 public, recovery and execution
roots remain byte-identical. V16 runtime does not read or write those roots.

The V16 default-off validator accepts exactly two official DeepSeek URLs:
`https://api.deepseek.com` and `https://api.deepseek.com/v1`. It continues to
require mock mode, live false, both product gates false, empty credentials and
product fields, zero maximum requests, unique controlled keys, and Flash or
Pro only. Historical V8 validation remains fixed Pro/no-suffix.

## Receipt and recovery

V16 durable default-off receipts record both the model and the non-secret
base URL, and reader revalidation requires both. V8 receipts are parsed under
their original strict schema before V16 projection. The controlled V8 restore
path always records its actual Pro/root URL provenance. For recovery, V8's
restore helper receives V16's validator explicitly; its V8 default stays
unchanged. This ensures a V16 Flash or `/v1` failure can still restore to a
verified default-off state.

## Next command

After final static and Docker default-off checks, execute the already
authorized unique V16 branch command once. A non-`passed` result stops V16;
recovery is considered only after its own preflight authorizes it. Only a
branch `passed` permits main merge, main replay and remote push.
