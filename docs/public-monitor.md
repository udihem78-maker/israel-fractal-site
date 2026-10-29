# Public monitor

The root and `/he/` are a read-only Hebrew dashboard. The previous homepage is
`/research.html`; the full Hebrew report is `/he/research.html`. English and
Arabic reports remain available at `/en/` and `/ar/`.

## Run and refresh

No dependencies beyond Python 3.10+ and a browser with JavaScript are needed.
The existing Python preview server continues serving port 8000.

```sh
python3 scripts/sync_public_data.py
python3 -m unittest discover -s tests -v
```

Raw source files and conditional HTTP cache live outside the repository, by
default in `/tmp/israel-fractal-public-cache`. Only selected public fields,
aggregates, provenance and 90 daily collection snapshots are committed.
No email addresses, contact details or demographic attributes are retained.

## Data contract and limits

- The source is **Open Knesset**, a secondary publisher of Knesset data.
  Direct Knesset access returned a geographic availability page during setup.
- `IsCurrent` on a person is not sufficient to identify an MK. The synchronizer
  selects current MK and government **assignments**, validates dates, and scopes
  them to the highest current Knesset/government represented in those roles.
- These are **source-reported assignments**, not independent confirmation of
  today's officeholders or a newly elected Knesset. A current download timestamp
  does not establish that the records themselves are current.
- `fetched_at`, HTTP `Last-Modified`, assignment update dates and the last actual
  committee event date are distinct fields. Never substitute one for another.
- Committee figures count unique `(committee_id, meeting_start_date)` entries
  with a named participant. The window is 30 days ending at the last activity
  date **in the dataset**, not necessarily today. This is an observed count,
  not a completeness guarantee, attendance percentage or performance score.
- Current attendance, current voting, ministry outcomes, directors-general
  and agency heads are not connected. Missing values remain `null`.
- On initial inspection the vote-header data ended in 2021 and the presence
  CSV was empty. Neither was used to create present-day activity metrics.
- Snapshots record collection history; they do not imply new activity occurred
  on collection day. One entry per UTC day is retained for up to 90 days.
- A fetch/schema failure or invalid roster exits nonzero. The last committed
  snapshot remains available; no simulated replacement is published.

## Automation and deployment

`sync-public-data.yml` is configured for 04:17 UTC daily (GitHub schedules are
best effort) and manual dispatch on the repository default branch only.
It tests, synchronizes, validates, commits the two JSON files and deploys the
same validated directory to the existing GitHub Pages environment.

**This is not active from the preview or an unmerged PR.** The owner must merge
the PR, allow Actions and the required Contents/Pages permissions, and satisfy
any branch or environment protection. No production deployment was triggered
during implementation. The preview's Reload button only reloads the already
generated JSON; it does not invoke the collector. The static data is fetched
again on each page load and checked every five minutes while the page is visible
and idle, without interrupting a dialog or focused control. There is no real-time
source connection.

The explicit deploy job is needed because commits made with `GITHUB_TOKEN`
do not trigger a separate push-based workflow. It publishes only after the
synchronization job has succeeded. A failed job leaves the last deployed
snapshot untouched; browser freshness warnings remain visible.
