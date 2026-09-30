# MAD Night Shift Reality Probe v0.1

Status: `ACTIVE / PROBE / NON-CANONICAL`.

This probe is deliberately isolated inside the disposable `madfrank17/tailspintoys` workshop repository. It must not be treated as MAD_System, MAELE, MAD Capital, or MAD-Lab canonical state.

## Frozen v0.1 scope

- CODE lane only.
- One worker/model at a time.
- One concurrent task.
- Issue -> validation -> PR only.
- No merge, production deploy, permission change, secret write, or canonicalization.
- `night-shift` execution authority comes from the actor who applies the executable label, not merely the issue author.
- Idempotency checks must prevent a second run when an open PR, branch, or non-terminal run already exists.
- Deadline, nightly budget, and circuit breaker are global stops. A retry must re-enter those checks.
- Locks have TTL and are released in a finally path for PASS, needs-human, and interruption.
- Global stop starts no new task. Active work receives a bounded grace period; after it expires, preserve a safe checkpoint if available, otherwise preserve logs/diff/artifacts without forcing a broken commit.
- v0.1 retries transient failures only. Capability, ambiguous-requirement, and environment failures go to needs-human because model escalation is intentionally disabled in this single-model probe.
- Morning reports and eval rows are derived from execution records; neither is a source of truth.

## Files

- `policy.json`: frozen v0.1 limits and authority settings.
- `lib/policy.mjs`: deterministic decision layer for authority, idempotency, hard stops, retry classification, interruption, lock-finalization, morning report, and eval records.
- `test/policy.test.mjs`: contract tests.
- `n8n/night-shift-code-v0.1.json`: inactive, importable n8n workflow skeleton. It contains no credential and is not claimed as a live n8n run.

## Validation boundary

The repository CI can validate the deterministic policy and n8n workflow structure. A live n8n execution still requires an n8n runtime plus a GitHub credential configured outside Git. Until that is observed, `liveN8nExecutionValidated=false` remains mandatory.
