#!/usr/bin/env bash
#
# easyVPN one-shot setup.
#
#   git clone https://github.com/ThatXliner/easyVPN && cd easyVPN && ./setup.sh
#
# Installs prerequisites, builds & installs the `easyvpn` CLI, creates the
# server, adds your first guest, and prints the share link + the router rules
# you need. The only thing it won't do for you is the router port-forward.
#
# Safe to re-run: every step is idempotent.

set -euo pipefail
cd "$(dirname "$0")"

BOLD=$'\e[1m'; DIM=$'\e[2m'; GRN=$'\e[32m'; YLW=$'\e[33m'; RED=$'\e[31m'; RST=$'\e[0m'
say()  { echo "${BOLD}==>${RST} $1"; }
ok()   { echo "${GRN}  ✓${RST} $1"; }
warn() { echo "${YLW}  !${RST} $1"; }
die()  { echo "${RED}error:${RST} $1" >&2; exit 1; }
ask()  { local a; read -r -p "${BOLD}?${RST} $1 " a; echo "$a"; }

# --- 0. platform ------------------------------------------------------------
[ "$(uname -s)" = "Darwin" ] || die "easyVPN is macOS-only for now."

# --- 1. Homebrew ------------------------------------------------------------
say "Checking Homebrew…"
if command -v brew >/dev/null 2>&1; then
  ok "Homebrew present"
else
  die "Homebrew is required. Install it from https://brew.sh then re-run ./setup.sh"
fi

# --- 2. Rust toolchain ------------------------------------------------------
say "Checking Rust toolchain…"
if command -v cargo >/dev/null 2>&1; then
  ok "cargo present ($(cargo --version))"
else
  warn "Rust (cargo) not found."
  if [ "$(ask 'Install Rust now via rustup? [y/N]')" = "y" ]; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
    ok "Rust installed"
  else
    die "Rust is required. Install from https://rustup.rs then re-run."
  fi
fi

# --- 3. sing-box ------------------------------------------------------------
say "Checking sing-box…"
if command -v sing-box >/dev/null 2>&1 \
   || [ -x /opt/homebrew/bin/sing-box ] || [ -x /usr/local/bin/sing-box ]; then
  ok "sing-box present"
else
  warn "sing-box not found — installing via Homebrew…"
  brew install sing-box
  ok "sing-box installed"
fi

# --- 4. build & install the CLI --------------------------------------------
say "Building and installing the easyvpn CLI (release build, ~1 min)…"
cargo install --path crates/cli --quiet --force
BIN_DIR="${CARGO_INSTALL_ROOT:-${CARGO_HOME:-$HOME/.cargo}}/bin"
EASYVPN="$BIN_DIR/easyvpn"
[ -x "$EASYVPN" ] || die "install failed: $EASYVPN not found"
ok "installed: $EASYVPN"
case ":$PATH:" in
  *":$BIN_DIR:"*) : ;;
  *) warn "add $BIN_DIR to your PATH to run 'easyvpn' directly (e.g. in ~/.zshrc)";;
esac

# --- 5. create the server ---------------------------------------------------
say "Creating the server identity…"
"$EASYVPN" init

# --- 6. first guest ---------------------------------------------------------
if [ -z "$("$EASYVPN" guest list --json | grep -o '"name"' || true)" ]; then
  name="$(ask 'Name your first guest/device (e.g. phone):')"
  [ -n "$name" ] || name="phone"
  "$EASYVPN" guest add "$name"
else
  say "Existing guests:"
  "$EASYVPN" guest list
fi

# --- 7. router rules --------------------------------------------------------
echo
say "Router setup (the one manual step):"
"$EASYVPN" ports

# --- 8. start ---------------------------------------------------------------
echo
if [ "$(ask 'Start the server now and enable it at boot? (needs sudo) [y/N]')" = "y" ]; then
  sudo "$EASYVPN" start
  echo
  ok "Running. Send a guest their Hysteria2 link and have them try it first."
else
  echo "${DIM}When ready:${RST} sudo easyvpn start"
fi

echo
ok "Done. Manage guests anytime with:  easyvpn guest add <name> | list | rm <name>"
