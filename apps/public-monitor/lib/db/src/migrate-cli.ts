import { pool } from "./index";
import { runMigrations } from "./migrate";

if (!(await runMigrations(pool))) process.exitCode = 1;
