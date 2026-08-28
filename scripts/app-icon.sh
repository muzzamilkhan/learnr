#!/usr/bin/env bash
# Cuts the 1024x1024 App Store icon from public/logo.PNG into public/app-icon-1024.png.
#
# Apple's marketing icon must be 1024x1024, opaque and free of an alpha channel, and
# it is the one asset a reviewer sees at full size. There is no vector master and no
# native 1024 badge - inside the 1254x1254 artwork the badge spans 544px - so this is
# a 1.88x upscale, cut from the master rather than from public/logo-mark.png (which is
# 512 and would make it 2.0x, on top of its own downscale).
#
# Four things here were measured rather than chosen, and each has a failure it prevents:
#
#   1. The crop. master = (346,189) + mark * 1.0625, verified against ten sampled
#      pixels, so this frames the badge exactly as logo-mark.png does.
#   2. The background bleeds the blob's own field to the full square. The badge carries
#      a rounded silhouette of its own, so on any contrasting ground Apple's mask rounds
#      it a second time and leaves a ring. The field is interpolated from colours sampled
#      around the blob's perimeter, not filled flat: the blob is gently shaded, and a
#      flat fill leaves a visible arc where it meets the hard edge.
#   3. The cut separates the page background from the book's white pages by CONNECTIVITY
#      at a tight threshold, never by a fuzzy flood. The two whites touch at the book's
#      outer tips, so any flood loose enough to clear the background eats the pages -
#      which is exactly what happened to public/logo-mark.png, whose right-hand page is
#      chewed through. Invisible there because it is drawn on near-white paper.
#   4. The near-white halo left behind is removed by a dilation CONSTRAINED to near-white
#      pixels and bounded to 6px, so it can swallow the antialiasing without ever running
#      into the pages. The final 3px erode cuts past the blob's own dark rim, which would
#      otherwise trace its silhouette against the bled background.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=public/logo.PNG
OUT=public/app-icon-1024.png
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

# 1. the badge, at native resolution, still on its white page
magick "$SRC" -crop 544x544+346+189 +repage "$WORK/badge.png"

# 2. the field, interpolated from the blob's perimeter (1024 space)
magick -size 1024x1024 xc: -sparse-color inverse \
 '124,124 #503CE3  300,40 #5140DD  512,12 #584CE4  720,48 #5A51E6  900,136 #5A51E6
  16,512 #5241E0  1004,512 #534ADC  60,600 #5140D9  960,600 #5046DB
  40,704 #4E3ED6  980,704 #4F43D8  40,1000 #4E3ED6  512,1000 #4E3ED6  980,1000 #4F43D8' \
 "$WORK/field.png"

# 3. the outside, by connectivity from the four corners - which are four separate regions,
#    because the blob touches all four mid-edges of the frame
magick "$WORK/badge.png" -colorspace Gray -threshold 99% -colorspace sRGB -type TrueColor \
  -fuzz 0 -fill red \
  -draw "color 0,0 floodfill"   -draw "color 543,0 floodfill" \
  -draw "color 0,543 floodfill" -draw "color 543,543 floodfill" \
  -fuzz 0 -fill white +opaque red -fill black -opaque red -negate "$WORK/outside.png"

# 4. grow it into the antialiasing, but only into near-white and only by 6px
magick "$WORK/badge.png" -colorspace Gray -threshold 94% "$WORK/nearwhite.png"
magick "$WORK/outside.png" -morphology Dilate Disk:6 "$WORK/nearwhite.png" \
  -compose Multiply -composite "$WORK/grown.png"
magick "$WORK/grown.png" "$WORK/outside.png" -compose Lighten -composite -negate \
  -morphology Erode Disk:3 "$WORK/keep.png"

# 5. mask, upscale, bleed, flatten - and no alpha channel, which Apple rejects outright
magick "$WORK/badge.png" "$WORK/keep.png" -alpha off -compose CopyOpacity -composite \
  -filter Lanczos -resize 1024x1024 png:- \
| magick "$WORK/field.png" png:- -compose over -composite \
  -alpha remove -alpha off -colorspace sRGB -depth 8 -strip "$OUT"

magick identify -format "%f: %wx%h %[channels] depth=%z\n" "$OUT"
