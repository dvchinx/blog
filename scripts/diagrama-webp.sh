#!/usr/bin/env bash
# Descarga un diagrama (PNG/JPG) y lo guarda optimizado como WebP.
# Uso: scripts/diagrama-webp.sh <url-o-archivo-local> <destino.webp> [ancho_max=1600] [calidad=80]
set -euo pipefail
src="$1"; dest="$2"; width="${3:-1600}"; q="${4:-80}"
mkdir -p "$(dirname "$dest")"
tmp="$(mktemp --suffix=.png)"; trap 'rm -f "$tmp"' EXIT
if [[ "$src" =~ ^https?:// ]]; then curl -fsSL -o "$tmp" "$src"; else cp "$src" "$tmp"; fi

if command -v cwebp >/dev/null; then
  cwebp -quiet -q "$q" -m 6 -resize "$width" 0 "$tmp" -o "$dest"
elif command -v magick >/dev/null; then
  magick "$tmp" -resize "${width}x>" -quality "$q" -define webp:method=6 "$dest"
elif command -v convert >/dev/null; then
  convert "$tmp" -resize "${width}x>" -quality "$q" -define webp:method=6 "$dest"
elif command -v ffmpeg >/dev/null; then
  ffmpeg -loglevel error -y -i "$tmp" -vf "scale='min($width,iw)':-2" -c:v libwebp -quality "$q" "$dest"
else
  echo "Instala cwebp (libwebp), ImageMagick o ffmpeg" >&2; exit 1
fi
echo "$dest  $(du -h "$dest" | cut -f1)"
