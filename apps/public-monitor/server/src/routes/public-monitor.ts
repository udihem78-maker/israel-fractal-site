import { Router, type IRouter } from "express";
import { loadPublicSnapshot, getSyncStatus } from "../lib/monitor-sync";

const router: IRouter = Router();

// These read-only requests do not trigger upstream traffic.
router.get("/public-monitor/sync-status", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json(await getSyncStatus());
  } catch (err) {
    req.log.error({ err }, "Collector status unavailable");
    res.status(503).json({ error: "מצב העדכון אינו זמין. אין להסיק שהמקורות עודכנו." });
  }
});

router.get("/public-monitor/snapshot", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json(await loadPublicSnapshot());
  } catch (err) {
    req.log.error({ err }, "Stored public-monitor snapshot unavailable");
    res.status(503).json({
      error: "העותק השמור אינו זמין או לא עבר אימות. אין נתונים חלופיים מומצאים.",
    });
  }
});

export default router;
