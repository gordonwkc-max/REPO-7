#!/usr/bin/env bash
# Build "The Last Block": 360 frames -> H.264 -> synthesised sound -> muxed mp4.
set -euo pipefail
cd "$(dirname "$0")"

FF=$(node -e "process.stdout.write(require('@ffmpeg-installer/ffmpeg').path)")

rm -rf build
mkdir -p build

echo "1/4 rendering frames"
node src/render.mjs --frames build/frames

echo "2/4 encoding video"
"$FF" -y -loglevel error -framerate 30 -i build/frames/f_%04d.png \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p build/video.mp4

echo "3/4 synthesising soundtrack"
node src/audio.mjs build/audio.wav

echo "4/4 muxing"
"$FF" -y -loglevel error -i build/video.mp4 -i build/audio.wav \
  -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart last-block.mp4

"$FF" -i last-block.mp4 2>&1 | grep -E "Duration" || true
ls -la last-block.mp4
echo "done: $(pwd)/last-block.mp4"
