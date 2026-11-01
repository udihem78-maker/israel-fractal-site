# Pinned public source snapshot

These files were retrieved read-only from the public repository
https://github.com/udihem78-maker/israel-fractal-site at revision
`dbd36bd26042d93ff8d3fcfc1eef8bf3abb36296`.
`national.json` and `history.json` are byte-identical copies of `data/` at that revision.
The branch head was resolved through GitHub's public commit API before retrieval.
`manifest.json` records SHA-256 hashes of these copies and the import time into this app.
Hashes in `national.json.sources` are supplied by the upstream collector; this app
does not claim to have downloaded or rehashed those large underlying CSVs.

This is a source-reported Open Knesset secondary snapshot, not independent
confirmation of present officeholders. File timestamps, collection times,
role periods, row updates, and actual event times are different facts.
The original source's pipeline in the unmerged PR is not activated here.
The companion app has its own independent collector of five fixed Open Knesset CSVs.
It runs every 24 hours while the API is running, retries failure after one hour,
and atomically stores validated domain data/history/status in PostgreSQL.
These pinned files remain unchanged and serve as the initial fallback only.
Reloading the API reads the last validated stored data; it never triggers upstream traffic.
The source repository is not modified or executed.

This pinned fallback has one collection history entry, insufficient for a trend. Historical
committee observations count distinct committee/date pairs, not attendance
percentage, absence, effectiveness, or comparative performance.
Null values remain unavailable and must not be converted to zero.
