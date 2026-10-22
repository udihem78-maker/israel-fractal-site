#!/usr/bin/env node
// Fal.ai video generator for Israel Fractal explainer
// Usage: FAL_KEY=xxx node generate.mjs [scene1-hook|scene2-robbery|scene3-fix|all]
//
// Uses fal.ai REST API with Veo 3 (image-to-video and text-to-video).
// Docs: https://fal.ai/models/fal-ai/veo3/api
//
// Output: ./output/<scene-id>.mp4
//
// Pricing (as of 2026): Veo 3 ≈ $0.50 per 1-second clip, so 3 × 8s ≈ $12.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCENES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "scenes.json"), "utf8")
);

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("❌ FAL_KEY not set. Add it as a session secret and reopen the session.");
  console.error("   Get your key: https://fal.ai/dashboard/keys");
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, "output");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const FAL_BASE = "https://fal.run";
const FAL_QUEUE = "https://queue.fal.run";

async function submitJob(scene) {
  const url = `${FAL_QUEUE}/${scene.model}`;
  const body = {
    prompt: scene.prompt,
    aspect_ratio: scene.aspect_ratio,
    duration: `${scene.duration_seconds}s`,
    negative_prompt: scene.negative_prompt || "",
    enhance_prompt: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Submit failed (${res.status}): ${err}`);
  }

  return await res.json(); // { request_id, status, response_url, status_url }
}

async function pollStatus(statusUrl) {
  const res = await fetch(statusUrl, {
    headers: { "Authorization": `Key ${FAL_KEY}` },
  });
  return await res.json();
}

async function fetchResult(responseUrl) {
  const res = await fetch(responseUrl, {
    headers: { "Authorization": `Key ${FAL_KEY}` },
  });
  return await res.json();
}

async function downloadMp4(url, destPath) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

async function generateScene(scene) {
  console.log(`\n🎬 Scene: ${scene.id}`);
  console.log(`   Model: ${scene.model} · ${scene.duration_seconds}s · ${scene.aspect_ratio}`);
  console.log(`   Prompt: ${scene.prompt.substring(0, 80)}...`);

  const job = await submitJob(scene);
  console.log(`   📤 Submitted: ${job.request_id}`);

  const maxWait = 10 * 60 * 1000; // 10 min
  const pollEvery = 10 * 1000; // 10 sec
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollEvery));
    const status = await pollStatus(job.status_url);
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    console.log(`   ⏳ ${status.status} · ${elapsed}s`);

    if (status.status === "COMPLETED") {
      const result = await fetchResult(job.response_url);
      const videoUrl = result?.video?.url || result?.videos?.[0]?.url;
      if (!videoUrl) {
        throw new Error("No video URL in result: " + JSON.stringify(result));
      }
      const destPath = path.join(OUTPUT_DIR, `${scene.id}.mp4`);
      const bytes = await downloadMp4(videoUrl, destPath);
      console.log(`   ✅ Saved: ${destPath} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
      return destPath;
    }
    if (status.status === "FAILED") {
      throw new Error("Fal job failed: " + JSON.stringify(status));
    }
  }
  throw new Error("Timeout");
}

async function main() {
  const target = process.argv[2] || "all";
  const toRun = target === "all"
    ? SCENES.scenes
    : SCENES.scenes.filter((s) => s.id === target);

  if (toRun.length === 0) {
    console.error(`❌ Unknown scene: ${target}`);
    console.error(`   Available: ${SCENES.scenes.map((s) => s.id).join(", ")}, all`);
    process.exit(1);
  }

  console.log(`🎥 Israel Fractal · video generator (fal.ai Veo 3)`);
  console.log(`   Running ${toRun.length} scene(s)`);

  const results = [];
  for (const scene of toRun) {
    try {
      const path = await generateScene(scene);
      results.push({ id: scene.id, path, ok: true });
    } catch (e) {
      console.error(`   ❌ ${scene.id} failed: ${e.message}`);
      results.push({ id: scene.id, ok: false, error: e.message });
    }
  }

  console.log(`\n📊 Summary:`);
  for (const r of results) {
    console.log(`   ${r.ok ? "✅" : "❌"} ${r.id}${r.ok ? "" : " · " + r.error}`);
  }
  console.log(`\n   Output: ${OUTPUT_DIR}`);
  console.log(`   Next: ffmpeg stitch → upload to GitHub repo`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
