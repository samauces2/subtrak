#!/usr/bin/env bash
set -euo pipefail

image="${1:?Usage: bash scripts/smoke-container.sh IMAGE [HOST_PORT]}"
port="${2:-18080}"
container_id=""
scratch_dir="$(mktemp -d)"

cleanup() {
  if [ -n "$container_id" ]; then
    docker logs "$container_id" || true
    docker rm -f "$container_id" >/dev/null || true
  fi
  rm -rf "$scratch_dir"
}
trap cleanup EXIT

container_id="$(docker run --detach --rm --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  --publish "127.0.0.1:${port}:8080" "$image")"
base_url="http://127.0.0.1:${port}"

curl --fail --silent --show-error --retry 15 --retry-connrefused \
  --retry-delay 1 --max-time 3 "$base_url/healthz" > "$scratch_dir/health"
test "$(cat "$scratch_dir/health")" = "ok"
curl --fail --silent --show-error -D "$scratch_dir/headers" \
  "$base_url/" > "$scratch_dir/index.html"
grep -q '<title>SubTrack' "$scratch_dir/index.html"
grep -qi 'cache-control: no-cache' "$scratch_dir/headers"

js_asset="$(sed -n 's/.*src="\(\/assets\/[^" ]*\.js\)".*/\1/p' "$scratch_dir/index.html")"
css_asset="$(sed -n 's/.*href="\(\/assets\/[^" ]*\.css\)".*/\1/p' "$scratch_dir/index.html")"
test -n "$js_asset"
test -n "$css_asset"
curl --fail --silent --show-error -D "$scratch_dir/asset-headers" \
  "$base_url$js_asset" -o /dev/null
grep -qi 'cache-control: .*immutable' "$scratch_dir/asset-headers"
curl --fail --silent --show-error "$base_url$css_asset" -o /dev/null
test "$(curl --silent --output /dev/null --write-out '%{http_code}' "$base_url/assets/not-found.js")" = "404"
curl --fail --silent --show-error "$base_url/mis-suscripciones" | grep -q '<title>SubTrack'
test "$(docker inspect --format '{{.Config.User}}' "$container_id")" = "nginx"
printf 'Container smoke checks passed: health, HTML, JS, CSS, cache, SPA fallback and non-root runtime.\n'
