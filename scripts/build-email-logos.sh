#!/usr/bin/env bash
# Builds public/logos/email/: the raster logo set the newsletter uses.
#
# Why a second set: Gmail and Outlook strip <img src="*.svg">, and two firm
# logos (Blue Guardian, E8 Markets) only exist as SVG. Everything else is
# copied as is. Run this after adding a firm logo to public/logos/.
#
# Needs rsvg-convert (brew install librsvg).
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p public/logos/email

for svg in public/logos/*.svg; do
  [ -e "$svg" ] || continue
  name=$(basename "$svg" .svg)
  rsvg-convert -w 256 -h 256 "$svg" -o "public/logos/email/$name.png"
  echo "rasterised $name"
done

for png in public/logos/*.png; do
  [ -e "$png" ] || continue
  cp "$png" "public/logos/email/$(basename "$png")"
  echo "copied $(basename "$png")"
done

# The email set is checked against the firm list by scripts/deal-of-day.test.mjs,
# which fails if a firm in prop-firms.json has no PNG here.
node --test scripts/deal-of-day.test.mjs >/dev/null && echo "logo set matches the firm list"
