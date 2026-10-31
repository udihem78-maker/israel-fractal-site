import { pgTable, integer, jsonb, timestamp, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const monitorSyncTable = pgTable("monitor_sync", {
  id: integer("id").primaryKey(),
  snapshot: jsonb("snapshot"),
  lastAttempt: timestamp("last_attempt", { withTimezone: true }),
  lastSuccess: timestamp("last_success", { withTimezone: true }),
  nextAttempt: timestamp("next_attempt", { withTimezone: true }),
  lastError: text("last_error"),
  running: boolean("running").notNull().default(false),
});
export const insertMonitorSyncSchema = createInsertSchema(monitorSyncTable);
export type MonitorSync = typeof monitorSyncTable.$inferSelect;
