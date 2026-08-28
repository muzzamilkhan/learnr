#!/usr/bin/env bash
# Repairs public/logo-mark.png against public/logo.PNG, and re-cuts src/app/icon.png
# from the result.
#
# The mark was cut by flood-filling the white page away from the edges inwards, and
# that flood ran into the book's white pages: the two whites TOUCH, at the book's
# outer tips where a page edge meets the page behind it. So a fill loose enough to
# clear the background eats the pages - measured on the master, it holds to 3% fuzz
# and is gone by 4%. What shipped has ~9,900 pixels missing from the right-hand leaf,
# including part of the dark wedge inside the open book, which is why this is visible
# on `--color-paper` and not only on a coloured ground.
#
# This REPAIRS rather than re-cuts, and the distinction is the point. The mark's
# silhouette and a clean cut from the master agree to within 108 pixels, so there is
# nothing to gain from a new outline - but the mark's edge pixels carry their own
# antialiasing, blended against the white page it was lifted off, and a fresh binary
# cut would replace that with a hard edge on every header in the app. So the alpha is
# the UNION of what the mark has and what a clean cut keeps: the outer boundary is
# left exactly as it is, and only the interior hole is filled.
#
# The clean silhouette below is derived the same way as in scripts/app-icon.sh - by
# connectivity at a tight threshold, never by fuzz - and the two must stay in step.
# That script carries the reasoning for each step.
set -euo pipefail
cd "$(dirname "$0")/.."

MASTER=public/logo.PNG
MARK=public/logo-mark.png
ICON=src/app/icon.png
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

magick "$MASTER" -crop 544x544+346+189 +repage "$WORK/badge.png"

# the clean silhouette: outside by connectivity, then the antialiasing cleared by a
# dilation constrained to near-white and bounded, so it can never reach the pages
magick "$WORK/badge.png" -colorspace Gray -threshold 99% -colorspace sRGB -type TrueColor \
  -fuzz 0 -fill red \
  -draw "color 0,0 floodfill"   -draw "color 543,0 floodfill" \
  -draw "color 0,543 floodfill" -draw "color 543,543 floodfill" \
  -fuzz 0 -fill white +opaque red -fill black -opaque red -negate "$WORK/outside.png"
magick "$WORK/badge.png" -colorspace Gray -threshold 94% "$WORK/nearwhite.png"
magick "$WORK/outside.png" -morphology Dilate Disk:6 "$WORK/nearwhite.png" \
  -compose Multiply -composite "$WORK/grown.png"
magick "$WORK/grown.png" "$WORK/outside.png" -compose Lighten -composite -negate \
  -filter Lanczos -resize 512x512 -threshold 50% "$WORK/clean.png"

# colour: the mark's own pixels where it has them, the master's underneath where the
# flood took them away
magick "$WORK/badge.png" -filter Lanczos -resize 512x512 "$WORK/master512.png"
# a BINARY selection, not an alpha blend: blending the mark over the master would
# re-blend the mark's own antialiased edge every run, so the script would quietly
# degrade the edge each time it was used. Taking the mark's raw pixels wherever it
# has any opacity at all, and the master's only where it has none, makes it idempotent.
#
# ... except along the wound itself. The pixels bordering the hole are the flood's own
# antialiasing, contaminated with the white page it was eating, so butting the master
# straight against them leaves a speckled seam. So the master is taken across a 1px
# ring around the restored area as well. On a second run there is nothing left to
# restore, the ring is empty, and the selection collapses to the mark's own alpha.
magick "$MARK" -alpha extract -threshold 0 "$WORK/have.png"
magick "$WORK/clean.png" "$WORK/have.png" -compose MinusSrc -composite -threshold 50% "$WORK/restored.png"
magick "$WORK/restored.png" -morphology Dilate Disk:1 -negate "$WORK/not-seam.png"
magick "$WORK/have.png" "$WORK/not-seam.png" -compose Multiply -composite "$WORK/use-mark.png"
magick "$WORK/master512.png" \( "$MARK" -alpha off \) "$WORK/use-mark.png" \
  -compose Over -composite -alpha off "$WORK/rgb.png"
# alpha: the mark's silhouette with the bite filled back in - a union, never a replacement
magick "$MARK" -alpha extract "$WORK/alpha.png"
magick "$WORK/alpha.png" "$WORK/clean.png" -compose Lighten -composite "$WORK/alpha-new.png"
magick "$WORK/rgb.png" "$WORK/alpha-new.png" -alpha off -compose CopyOpacity -composite \
  -strip "$MARK"

# src/app/icon.png is the mark at 180 centred in 192 - measured against what shipped,
# which this reproduces to within about 1% RMSE
magick "$MARK" -filter Lanczos -resize 180x180 -background none -gravity center \
  -extent 192x192 -strip "$ICON"

magick identify -format "%f: %wx%h %[channels]\n" "$MARK" "$ICON"
