import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import { logger } from "./logger";

// Fixed upstream allowlist. No user-supplied URLs and no redirects.
const paths = {
  people: ["members/mk_individual/mk_individual.csv", ["PersonID", "FirstName", "LastName"]],
  roles: ["members/kns_persontoposition/kns_persontoposition.csv", ["PersonToPositionID", "PersonID", "PositionID", "KnessetNum", "GovernmentNum", "StartDate", "FinishDate", "IsCurrent"]],
  positions: ["members/kns_position/kns_position.csv", ["PositionID", "Description"]],
  ministries: ["knesset/kns_govministry/kns_govministry.csv", ["GovMinistryID", "Name", "GovID", "IsActive"]],
  attendance: ["people/committees/committee-meeting-attendees-mks-stats/mk_attendance.csv", ["meeting_start_date", "knesset_num", "committee_id", "mk_id"]],
} as const;
export type SourceKey = keyof typeof paths;
export type Row = Record<string, string>;
export type SourceMeta = { url: string; last_modified: string | null; sha256: string; bytes: number };

export async function* csvRows(file: string, key: SourceKey): AsyncGenerator<Row> {
  const input = createReadStream(file);
  const parser = input.pipe(parse({
    bom: true, skip_empty_lines: true, max_record_size: 2_000_000,
    columns: (header: string[]) => {
      if (!paths[key][1].every((field) => header.includes(field))) {
        throw new Error(`Invalid CSV schema: ${key}`);
      }
      return header;
    },
  }));
  input.on("error", (err) => parser.destroy(err));
  try {
    for await (const row of parser) yield row as Row;
  } finally {
    input.destroy();
    parser.destroy();
  }
}

export async function withSources<T>(
  consume: (files: Record<SourceKey, string>, sources: Record<SourceKey, SourceMeta>) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "public-monitor-"));
  const files = {} as Record<SourceKey, string>;
  const sources = {} as Record<SourceKey, SourceMeta>;
  const signal = AbortSignal.timeout(10 * 60_000);
  try {
    for (const key of Object.keys(paths) as SourceKey[]) {
      const url = `https://production.oknesset.org/pipelines/data/${paths[key][0]}`;
      const response = await fetch(url, {
        redirect: "error",
        headers: { "User-Agent": "IsraelFractal-Companion-Monitor/1.0", Accept: "text/csv" },
        signal,
      });
      if (!response.ok || !response.body) throw new Error(`Source ${key}: HTTP ${response.status}`);
      if (response.headers.get("content-type")?.includes("text/html")) throw new Error(`Source ${key}: HTML instead of CSV`);
      let size = 0;
      const hash = createHash("sha256");
      const limit = key === "attendance" ? 180_000_000 : 20_000_000;
      const meter = new Transform({
        transform(chunk, _encoding, done) {
          size += chunk.length;
          if (size > limit) return done(new Error(`Source ${key}: safety size limit exceeded`));
          hash.update(chunk);
          done(null, chunk);
        },
      });
      files[key] = join(dir, `${key}.csv`);
      await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(files[key]), { signal });
      sources[key] = { url, last_modified: response.headers.get("last-modified"), sha256: hash.digest("hex"), bytes: size };
      logger.info({ source: key, bytes: size }, "Downloaded public source");
    }
    return await consume(files, sources);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
