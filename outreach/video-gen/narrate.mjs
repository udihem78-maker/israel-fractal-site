#!/usr/bin/env node
// ElevenLabs TTS narrator for Israel Fractal explainer
// Usage: ELEVENLABS_API_KEY=xxx node narrate.mjs [he|en|all]
//
// Takes narration_he / narration_en from scenes.json and renders 3 MP3 clips per language.
// Output: ./output/narration-{he|en}-scene{1,2,3}.mp3 + combined per language.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCENES = JSON.parse(fs.readFileSync(path.join(__dirname, "scenes.json"), "utf8"));

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("❌ ELEVENLABS_API_KEY not set. Add it as a session secret.");
  console.error("   Get it: https://elevenlabs.io/app/settings/api-keys");
  process.exit(1);
}

// Default voices — override via env vars for your custom voice IDs
const VOICE_HE = process.env.ELEVENLABS_VOICE_HE || "ErXwobaYiN019PkySvjV"; // Antoni (works OK for he)
const VOICE_EN = process.env.ELEVENLABS_VOICE_EN || "VR6AewLTigWG4xSOukaG"; // Arnold
const MODEL = "eleven_multilingual_v2"; // supports Hebrew

const OUT = path.join(__dirname, "output");
fs.mkdirSync(OUT, { recursive: true });

async function tts(text, voiceId, destPath) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS failed (${res.status}): ${err}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

async function narrateLang(lang) {
  const voiceId = lang === "he" ? VOICE_HE : VOICE_EN;
  const field = `narration_${lang}`;
  const clips = [];
  console.log(`\n🎙️  Narrating ${lang.toUpperCase()} with voice ${voiceId}`);

  for (const scene of SCENES.scenes) {
    const text = scene[field];
    if (!text) {
      console.warn(`   ⚠️  No ${field} for ${scene.id}`);
      continue;
    }
    const dest = path.join(OUT, `narration-${lang}-${scene.id}.mp3`);
    const bytes = await tts(text, voiceId, dest);
    console.log(`   ✅ ${scene.id}: ${(bytes / 1024).toFixed(0)} KB`);
    clips.push(dest);
  }

  // Combine with ffmpeg (if available)
  try {
    const listPath = path.join(OUT, `narr-${lang}-list.txt`);
    fs.writeFileSync(listPath, clips.map((c) => `file '${c}'`).join("\n"));
    const combined = path.join(OUT, `narration-${lang}-combined.mp3`);
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${combined}"`, {
      stdio: "ignore",
    });
    console.log(`   🎶 Combined: ${combined}`);
  } catch (e) {
    console.warn(`   ⚠️  ffmpeg concat failed (install ffmpeg to combine): ${e.message}`);
  }
}

async function main() {
  const target = process.argv[2] || "all";
  const langs = target === "all" ? ["he", "en"] : [target];
  for (const l of langs) await narrateLang(l);
  console.log(`\n   Output: ${OUT}`);
  console.log(`   Next: mux into final MP4 with ffmpeg (see stitch.sh comments)`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
