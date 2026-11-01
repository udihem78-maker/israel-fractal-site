# PR #2 review fixes — 2026-11-01

Reviewed original head: `2b449fcf0c76bdd7128eea5f9c013f2adffc8891`.
All three review findings were still present at that head.

## Changes

- Verify both stored SHA-256 digests before either public endpoint serves a record.
  New collections and byte-verified pinned data use the same schema-normalized,
  recursively key-sorted JSON representation, independent of JSONB key order.
  Runtime `sync_active` is deliberately outside the content digest. Database reads
  never re-seal data. The unchanged manifest still verifies original pinned bytes.
- Register the HTTP server error handler before listening. Bind errors log their
  original error and exit with status 1; collection starts only after listening.
- Keep original migration errors, including connection/SQL/checksum failures.
  Rollback failure is logged separately without replacing the first diagnostic;
  clients and pool are cleaned up. The migration CLI returns exit status 1.
- Add schema-valid content/history tampering tests, a real occupied TCP port test,
  migration-failure tests and a rendered React freshness-notice regression.
- Extend the PostgreSQL integration suite with JSONB tampering/503 tests for both
  public endpoints and a real migration CLI checksum-failure/rollback test.
- Use Node's tsx import hook in test/migration scripts to avoid the tsx CLI's IPC
  socket requirement. Keep all changes under `apps/public-monitor/`.

## Local results

Environment: Node 24.22.1, pnpm 10.34.0.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed with pinned pnpm 10.34.0 |
| `pnpm test` | Passed: 19 tests, 0 failed, 0 skipped |
| `pnpm build` | Passed: library, server and web typechecks; production web/API bundles |
| `pnpm codegen` plus generated-path diff | Passed, generated files unchanged |
| `git diff --check` | Passed |
| Static-site boundary | All follow-up changes confined to `apps/public-monitor/`; research files and Pages workflow unchanged |
| `pnpm db:migrate` against real PostgreSQL | Not run locally: no PostgreSQL service/test database available |
| `pnpm test:integration` | Not run locally for the same reason; existing PostgreSQL 17 CI job includes the extended suite |

Build retains the original tooltip sourcemap and approximately 803 kB JavaScript
chunk warnings. They are not build failures.

The first attempt used the environment's pnpm 11, which required a different
build-script policy; installation was rerun successfully using the repository's
pinned version without committing a workspace/lockfile change. The tsx CLI also
failed on its IPC Unix socket; the Node import-hook scripts above passed.

## Rollout limits

The new canonical digests differ from the earlier unmerged implementation's
format. Existing rows using the old format fail closed with 503. Before rollout,
verify/reimport trusted data or use a fresh disposable preview database. Never
blindly re-seal database contents. This change does not convert production data.

No merge, deployment, live upstream collection or production validation was
performed. No browser interaction test was rerun; the added UI test renders the
actual freshness component to HTML and checks historical/stale warnings. Remote
CI results must be checked separately on the updated commit.
