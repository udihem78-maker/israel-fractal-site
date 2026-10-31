import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool } from "./index";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock($1)", [7364922]);
  await client.query(`CREATE TABLE IF NOT EXISTS monitor_migrations (
    name text PRIMARY KEY,
    sha256 text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const directory = new URL("../migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter((f) => /^\d+_.*\.sql$/.test(f)).sort()) {
    const sql = await readFile(new URL(file, directory), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    const { rows } = await client.query("SELECT sha256 FROM monitor_migrations WHERE name = $1", [file]);
    if (rows.length) {
      if (rows[0].sha256 !== hash) throw new Error("Applied migration was changed");
      continue;
    }
    await client.query(sql);
    await client.query("INSERT INTO monitor_migrations (name, sha256) VALUES ($1, $2)", [file, hash]);
    console.info(`Applied migration ${file}`);
  }
  await client.query("COMMIT");
} catch {
  await client.query("ROLLBACK");
  console.error("Database migration failed; check database access and migration history.");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
