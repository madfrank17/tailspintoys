# CODE-only branch probe — PARTIAL / NON-CANONICAL

Authority: user-approved isolated branch additions only. No main edits, merge, deployment, new secret, permission expansion, cross-repository changes or canonicalization.

Files: `.github/workflows/mad-learning-kernel-code-probe.yml`; `.github/mad-learning-kernel/{probe.mjs,probe.test.mjs,run.mjs,README.md}`.

Workflow is a read-only preview: contents/actions/issues/pull-requests read; all other permissions none. It never executes producer PR code or downloads producer artifacts. Run identity, completed success/failure, same repository, owner-authored open PR and exact current head SHA are checked via API. Serial concurrency prevents overlapping consumers when activated.

Frozen signal/cooldown logic lives in probe.mjs. CI supplies only new_empirical_evidence, never transfer evidence. Capability UNKNOWN and New Ability UNVERIFIED. The reusable store interface supports one trusted marker create/update; current workflow deliberately does not write because existing Actions permissions are read-only. Duplicate/untrusted/malformed marker state fails closed. Serialized marker tests are synthetic, not live persistence evidence.

GitHub requires workflow_run and workflow_dispatch files on the default branch. This branch cannot establish automatic event delivery within current authority. A read-only dispatch attempt is permitted but may return 404. No fallback modifies main or widens permissions.

Remaining gates: authorize a deployment/activation surface that can receive real events without violating main prohibition; separately authorize minimal marker write permission if desired. Operational upgrade requires prospective delivery and actual cross-run marker persistence evidence. Current state is implementation/local validation only.

Run tests: `node --test .github/mad-learning-kernel/probe.test.mjs`.
