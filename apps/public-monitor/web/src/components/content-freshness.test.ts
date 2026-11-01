import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { loadPinnedSnapshot } from "../../../server/src/lib/public-snapshot";
import { contentFreshness } from "../../../server/src/lib/monitor-freshness";

test("rendered notice warns of historical activity despite a fresh collection and HTTP file", async () => {
  const vite = await createServer({
    root: new URL("../../", import.meta.url).pathname,
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    server: { middlewareMode: true, watch: null, ws: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const { ContentFreshnessNotice } = await vite.ssrLoadModule(
      "/src/components/content-freshness.tsx",
    );
    const now = new Date("2026-11-01T12:00:00Z");
    const snapshot = await loadPinnedSnapshot();
    snapshot.fetched_at = now.toISOString();
    snapshot.sources.attendance.last_modified = now.toUTCString();
    const markup = renderToStaticMarkup(
      createElement(ContentFreshnessNotice, {
        freshness: contentFreshness(snapshot, now),
      }),
    );
    const attendance = markup.match(
      /data-testid="freshness-attendance"[\s\S]*?<\/li>/,
    )?.[0];
    assert.ok(attendance);
    assert.match(attendance, /תצפיות היסטוריות/);
    assert.match(attendance, /פעילות: אזהרה — התאריך ישן/);
    assert.match(attendance, /11\.08\.2025/);
    assert.match(attendance, /שינוי קובץ HTTP: התאריך בתוך סף האזהרה/);
    assert.match(markup, /שינוי קובץ אינו מעיד על אירוע חדש/);
    assert.match(
      markup,
      /לא היעדר פעילות של אדם, שיעור נוכחות או איכות ביצועיו/,
    );
  } finally {
    await vite.close();
  }
});
