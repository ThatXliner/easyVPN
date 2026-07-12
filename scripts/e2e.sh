#!/usr/bin/env bash
#
# easyVPN end-to-end test.
#
# Stands up a REAL sing-box server (both easyVPN inbounds — VLESS+Reality and
# Hysteria2) on a local unprivileged port, connects a REAL sing-box client
# through each, and pushes traffic in BOTH directions to prove the tunnels
# actually carry data. No root required: everything binds to 127.0.0.1 on a
# high port, so it needs no port-forward and no LaunchDaemon.
#
# This mirrors the hand verification the server design was validated with.
#
# Usage:  scripts/e2e.sh
# Exit 0 = all checks passed.

set -euo pipefail

RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; DIM=$'\e[2m'; RST=$'\e[0m'
pass() { echo "${GRN}✓${RST} $1"; }
fail() { echo "${RED}✗ $1${RST}"; exit 1; }
info() { echo "${DIM}• $1${RST}"; }

SB="$(command -v sing-box || true)"
[ -n "$SB" ] || fail "sing-box not found on PATH — install it (brew install sing-box) and retry."
pass "sing-box: $("$SB" version | head -1)"

WORK="$(mktemp -d /tmp/easyvpn-e2e.XXXXXX)"
SRV_PORT=8443          # server listens here (both TCP for Reality, UDP for Hy2)
VLESS_SOCKS=11080      # client SOCKS for the Reality path
HY2_SOCKS=11081        # client SOCKS for the Hysteria2 path
PIDS=()
cleanup() {
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done
  rm -rf "$WORK"
}
trap cleanup EXIT

# --- generate credentials, exactly like the app's create_server -------------
info "generating server identity…"
KP="$("$SB" generate reality-keypair)"
RPRIV="$(echo "$KP" | awk '/PrivateKey/{print $2}')"
RPUB="$(echo "$KP" | awk '/PublicKey/{print $2}')"
SID="$("$SB" generate rand --hex 8)"
UUID="$("$SB" generate uuid)"
HY2_PW="$("$SB" generate rand --hex 16)"
OBFS_PW="$("$SB" generate rand --hex 16)"
SNI="www.apple.com"

openssl ecparam -genkey -name prime256v1 -out "$WORK/key.pem" 2>/dev/null
openssl req -new -x509 -days 3650 -key "$WORK/key.pem" -out "$WORK/cert.pem" \
  -subj "/CN=www.bing.com" 2>/dev/null
pass "credentials generated (Reality keypair, Hysteria2 secret, self-signed cert)"

# --- server config (both inbounds) ------------------------------------------
cat > "$WORK/server.json" <<EOF
{
  "log": { "level": "error" },
  "inbounds": [
    {
      "type": "vless", "tag": "vless-in", "listen": "127.0.0.1", "listen_port": $SRV_PORT,
      "users": [ { "uuid": "$UUID", "flow": "xtls-rprx-vision" } ],
      "tls": {
        "enabled": true, "server_name": "$SNI",
        "reality": {
          "enabled": true,
          "handshake": { "server": "$SNI", "server_port": 443 },
          "private_key": "$RPRIV", "short_id": ["$SID"]
        }
      }
    },
    {
      "type": "hysteria2", "tag": "hy2-in", "listen": "127.0.0.1", "listen_port": $SRV_PORT,
      "users": [ { "name": "e2e", "password": "$HY2_PW" } ],
      "obfs": { "type": "salamander", "password": "$OBFS_PW" },
      "tls": { "enabled": true, "alpn": ["h3"],
               "certificate_path": "$WORK/cert.pem", "key_path": "$WORK/key.pem" }
    }
  ],
  "outbounds": [ { "type": "direct", "tag": "direct" } ]
}
EOF

"$SB" check -c "$WORK/server.json" && pass "server config validates" || fail "server config rejected by sing-box"

# --- client configs ----------------------------------------------------------
cat > "$WORK/client-vless.json" <<EOF
{
  "log": { "level": "error" },
  "inbounds": [ { "type": "mixed", "listen": "127.0.0.1", "listen_port": $VLESS_SOCKS } ],
  "outbounds": [ {
    "type": "vless", "server": "127.0.0.1", "server_port": $SRV_PORT,
    "uuid": "$UUID", "flow": "xtls-rprx-vision",
    "tls": {
      "enabled": true, "server_name": "$SNI",
      "utls": { "enabled": true, "fingerprint": "chrome" },
      "reality": { "enabled": true, "public_key": "$RPUB", "short_id": "$SID" }
    }
  } ]
}
EOF

cat > "$WORK/client-hy2.json" <<EOF
{
  "log": { "level": "error" },
  "inbounds": [ { "type": "mixed", "listen": "127.0.0.1", "listen_port": $HY2_SOCKS } ],
  "outbounds": [ {
    "type": "hysteria2", "server": "127.0.0.1", "server_port": $SRV_PORT,
    "password": "$HY2_PW",
    "obfs": { "type": "salamander", "password": "$OBFS_PW" },
    "tls": { "enabled": true, "server_name": "www.bing.com", "insecure": true, "alpn": ["h3"] }
  } ]
}
EOF
"$SB" check -c "$WORK/client-vless.json" && "$SB" check -c "$WORK/client-hy2.json" \
  && pass "client configs validate" || fail "client config rejected"

# --- boot the server + both clients -----------------------------------------
"$SB" run -c "$WORK/server.json"       >"$WORK/server.log" 2>&1 & PIDS+=($!)
"$SB" run -c "$WORK/client-vless.json" >"$WORK/cv.log"     2>&1 & PIDS+=($!)
"$SB" run -c "$WORK/client-hy2.json"   >"$WORK/ch.log"     2>&1 & PIDS+=($!)
info "waiting for tunnels to come up…"
sleep 4

# --- exercise each tunnel end-to-end ----------------------------------------
TRACE_URL="https://www.cloudflare.com/cdn-cgi/trace"
UP_URL="https://speed.cloudflare.com/__up"
DOWN_URL="https://speed.cloudflare.com/__down?bytes=8000000"

check_tunnel() {
  local name="$1" socks="$2"
  # reachability: does the exit see our traffic?
  curl -s --max-time 20 -x "socks5h://127.0.0.1:$socks" "$TRACE_URL" | grep -q '^ip=' \
    || fail "$name: no connectivity through tunnel"
  # download direction
  local dl
  dl=$(curl -s --max-time 30 -o /dev/null -x "socks5h://127.0.0.1:$socks" \
        -w '%{speed_download}' "$DOWN_URL")
  [ "${dl%.*}" -gt 0 ] || fail "$name: download produced no data"
  # upload direction (the case that was broken on big-mac — test it explicitly)
  local ul
  ul=$(head -c 3000000 /dev/urandom | curl -s --max-time 30 -o /dev/null \
        -x "socks5h://127.0.0.1:$socks" -w '%{speed_upload}' --data-binary @- "$UP_URL")
  [ "${ul%.*}" -gt 0 ] || fail "$name: upload produced no data"
  pass "$(printf '%-10s down %6.1f Mbps  up %6.1f Mbps' \
        "$name" "$(echo "$dl*8/1000000" | bc -l)" "$(echo "$ul*8/1000000" | bc -l)")"
}

check_tunnel "Reality" "$VLESS_SOCKS"
check_tunnel "Hysteria2" "$HY2_SOCKS"

echo
echo "${GRN}All end-to-end checks passed.${RST} Both inbounds carry traffic both directions."
