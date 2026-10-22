#!/bin/bash
# Stitch 3 scenes into one 24s explainer video
# Requires: ffmpeg
# Run after generate.mjs succeeded for all 3 scenes.

set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/output"

if [ ! -f "$OUT/scene1-hook.mp4" ] || [ ! -f "$OUT/scene2-robbery.mp4" ] || [ ! -f "$OUT/scene3-fix.mp4" ]; then
  echo "❌ Missing scene files. Run: node generate.mjs all"
  exit 1
fi

# Build concat list
cat > "$OUT/concat.txt" <<EOF
file 'scene1-hook.mp4'
file 'scene2-robbery.mp4'
file 'scene3-fix.mp4'
EOF

# Concat (fast, assumes same codec/resolution)
ffmpeg -y -f concat -safe 0 -i "$OUT/concat.txt" -c copy "$OUT/final-24s-no-audio.mp4"

# Add end card (optional) — generate a 2-sec card with site URL
# ffmpeg -y -f lavfi -i color=c=black:s=1080x1920:d=2 \
#   -vf "drawtext=text='udihem78-maker.github.io/israel-fractal-site':fontcolor=white:fontsize=48:x=(w-tw)/2:y=(h-th)/2" \
#   "$OUT/endcard.mp4"

echo "✅ Final: $OUT/final-24s-no-audio.mp4"
echo "   Next: add narration with ElevenLabs or in-app voice-over, then post."

# For adding narration (3 TTS files from ElevenLabs/OpenAI/Google):
# ffmpeg -i final-24s-no-audio.mp4 -i narration-combined.mp3 \
#   -map 0:v -map 1:a -c:v copy -c:a aac -shortest final-with-audio.mp4
