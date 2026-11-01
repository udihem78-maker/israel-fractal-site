# Public monitor — full-stack companion

The Hebrew RTL prototype now lives in this product repository, isolated from the
existing static research site. Overview, people/ministry directory, detail dialogs,
coverage analysis and source methodology use React/Vite, Express and PostgreSQL.
There are no accounts, analytics, public write endpoints or performance ratings.

## Local development

Requires Node **24**, pnpm **10.34.0** and PostgreSQL (tested with PostgreSQL 17).
The workspace and lockfile are deliberately local to this directory; the research
site still needs only its existing Python/static preview.

```sh
cd apps/public-monitor
pnpm install --frozen-lockfile
# Set DATABASE_URL securely in your shell/runtime, then:
pnpm db:migrate
pnpm dev
```

The UI is at port 3000 and proxies `/api` to port 3001. `WEB_PORT` and `PORT`
override these defaults. For a cloud sandbox set `DEV_ALLOWED_HOST` to its exact
UI hostname. Keep credentials in your runtime's secret store, never in Git.
`.env.example` documents names; env files are not loaded automatically.

`MONITOR_SYNC_ENABLED` defaults to false. With collection disabled, the API still
reads PostgreSQL and serves the verified pinned fallback if no snapshot has ever
been stored. This is real dated source data, not a newly collected or verified
current roster. Browser reloads make no upstream requests.

## Production and migrations

```sh
pnpm build
# Run once as a release step with the target DATABASE_URL:
pnpm db:migrate
# Same-origin web UI and API on PORT (default 3001):
NODE_ENV=production pnpm start
```

Alternatively, build the Dockerfile with **this directory as build context**.
Supply `DATABASE_URL` through the hosting provider's secret mechanism. Run
`pnpm db:migrate` as a separate release command using the same image and database.
The container runs as the unprivileged `node` user. TLS and process supervision
belong to the chosen hosting platform.

Migrations are ordered SQL files under `lib/db/migrations/`. A transaction and
advisory lock serialize migration runs; a checksum prevents silently editing
applied migrations. Add a new migration for future schema changes. The app
checks the table before accepting traffic; it does not mutate schemas on startup.
Back up the database before production migrations. There is no destructive
automatic rollback; rolling back application code should keep stored snapshots.

`/api/healthz` is liveness; `/api/readyz` checks database/table access. The two
public read endpoints are `/api/public-monitor/snapshot` and
`/api/public-monitor/sync-status`. Production Express serves only the four
known client routes and the compiled `web/dist` assets, not repository files.
The same-origin design does not enable broad CORS access.

## One authoritative collector

Set `MONITOR_SYNC_ENABLED=true` only on the intended collection runtime. Keep
that process running: the collector checks due time every minute, collects every
24 hours, retries failure after one hour, and keeps up to 90 daily history entries.
PostgreSQL session advisory locks prevent concurrent collectors against the
**same database**; they do not coordinate different databases or the old Python
collector. API-only processes can leave collection disabled.

Five fixed Open Knesset CSV URLs are allowlisted. Downloads have time/size limits,
reject redirects and HTML responses, and stream to temporary files that are
deleted afterward. Validated data, collection history and success metadata
switch in one SQL update. Failure preserves the last good snapshot. Invalid
stored data returns 503 rather than hiding corruption behind a fallback.

Snapshot/history SHA-256 values cover the schema-normalized API content using
recursively sorted object keys (arrays retain order). Snapshot content includes
provenance and collection dates; only the two digest fields, the separately hashed
history and the runtime `sync_active` flag are excluded. Both digests are checked
on every stored-data read, including sync status. The pinned files are first
verified against their original byte hashes in the unchanged manifest, then
normalized and sealed with the same algorithm used by the collector.

Snapshots stored by the earlier unmerged implementation use a different digest
format and will fail closed with 503. Do not automatically re-seal stored rows:
that could bless corrupted data. Before rollout, verify/reimport trusted data or
use a fresh disposable preview database. No production data conversion is included.

Preserve these domain rules when continuing development:

- Open Knesset is secondary provenance, not independent current-appointment verification.
- Collection time, source-file modification time, role dates and event dates are distinct.
- Committee observations are historical counts, not attendance percentages or effectiveness.
- Missing metrics stay null; overlapping role groups are not distinct people.
- Fresh collection success must not hide stale underlying events.

## Checks and API contract

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm codegen
# Dedicated disposable PostgreSQL database with a name ending in "_test":
pnpm db:migrate
MONITOR_TEST_DATABASE=true pnpm test:integration
```

Integration tests mutate only an explicitly acknowledged test database and cover
repeatable migrations, fallback/storage reads, read-only API behavior, due-time
and advisory locking, invalid data, and a **stubbed HTML upstream failure**.
They do not claim a live source collection succeeded.

`lib/api-spec/openapi.yaml` is the source of truth for generated React Query hooks
and Zod contracts. Commit regenerated files after changing it.

## Relationship to the research site and PR #1

This branch starts from `master`; no existing research HTML/report is replaced.
GitHub Pages stages the static site while excluding `apps/`, so app source,
dependencies and server configuration are not published as research-site assets.
The monitor requires a separate Node/PostgreSQL runtime: Pages cannot host it.
Add a research-site link only after the public monitor URL and launch are approved.

[PR #1](https://github.com/udihem78-maker/israel-fractal-site/pull/1) remains
unmerged and unchanged. Its alternative static monitor replaces `/` and `/he/`
and adds a Python/Actions collector. **Do not merge both implementations as-is.**
This full-stack app retains the prototype's TypeScript collector and provenance
rules; it does not import that PR's root-page replacement or refresh workflow.
Before merging any part of PR #1, separately retain desired research accessibility
changes, omit the competing monitor/collector, and preserve the `apps/` exclusion
in every Pages artifact upload. Do not enable two authoritative pipelines.

## Import provenance

Source prototype: https://replit.com/@enh1/yshrl-prqtlyt-lvkh-mqb-tsybvry
at commit `b1ba7f0163f5e3229af6e9f984f918b19d932dd7`.

The unchanged pinned fallback comes from this repository's PR #1 revision
`dbd36bd26042d93ff8d3fcfc1eef8bf3abb36296`; hashes and import time remain in
`server/data/public-monitor/manifest.json`. That revision is not the default branch.
The original prototype has not been modified. Replit-only development plugins,
the mockup sandbox and unused UI scaffolding were not ported.

This PR does not merge PR #1, provision production infrastructure, configure a
domain, enable collection, link an unapproved public URL or deploy anything.
