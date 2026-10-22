# Israel Fractal · Video Generator

**Stack:** fal.ai Veo 3 (text-to-video) → 3 × 8-sec scenes → ffmpeg stitch → 24-sec explainer.

## Setup

1. Get an API key at https://fal.ai/dashboard/keys
2. Add it to the session as a secret:
   - Session title bar (cloud icon) → **Edit** → **API credentials**
   - `FAL_KEY=<your-key>`
3. Reopen the session.

## Run

```bash
cd outreach/video-gen
node generate.mjs all              # all 3 scenes (~$12, ~15 min total)
node generate.mjs scene1-hook      # single scene
./stitch.sh                        # concatenate to final-24s-no-audio.mp4
```

## Output

```
output/
├── scene1-hook.mp4           # 8s · "0.6" big + Hebrew tagline
├── scene2-robbery.mp4        # 8s · ₪10T from vulnerable
├── scene3-fix.mp4            # 8s · OECD gap closes in 12 yrs
├── final-24s-no-audio.mp4    # stitched
└── concat.txt
```

## Cost estimate (as of 2026)

| Scene | Model | Duration | Price |
|---|---|---|---|
| 1 | Veo 3 | 8s | ~$4 |
| 2 | Veo 3 | 8s | ~$4 |
| 3 | Veo 3 | 8s | ~$4 |
| **Total** | | **24s** | **~$12** |

Confirm current pricing at https://fal.ai/models/fal-ai/veo3.

## After generation

1. Add narration (ElevenLabs/OpenAI TTS — scripts in scenes.json → narration_he/en)
2. Add subtitles with ffmpeg or Descript
3. Upload to repo: `israel-fractal-site/videos/explainer-he.mp4`
4. Push vertical cuts to TikTok/Instagram/Twitter per outreach/SOCIAL-MEDIA.md

## Alternate models (if Veo 3 is slow or you want cheaper)

Edit `scenes.json` and change `model`:
- `fal-ai/kling-video/v2.5-turbo/pro` — ~$0.08/sec · 5s or 10s clips
- `fal-ai/minimax-video` — ~$0.30/sec · 6s clips
- `fal-ai/ltx-video` — ~$0.02/sec · 5s clips · lower quality but fast
- `fal-ai/pixverse/v4.5` — ~$0.12/sec

Any model takes the same `{prompt, aspect_ratio, duration}` shape — the script handles it.
