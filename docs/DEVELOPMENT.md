# easyVPN — Development & Architecture

Implementation details for contributors. For the user-facing overview, see the
[README](../README.md).

---

## Why these protocols

WireGuard is trivially fingerprinted and throttled by national firewalls — in
the field it was capped to ~1 Mbps. easyVPN packages the swap that fixes that:

- **VLESS + Reality** (TCP 443) — steals a real HTTPS site's TLS fingerprint, so
  the traffic is indistinguishable from an ordinary visit to that site. Maximum
  stealth.
- **Hysteria2** (UDP 443) — QUIC with Salamander obfuscation and a loss-tolerant
  congestion controller. The fast path on lossy, high-latency, throttled routes.

Both run simultaneously on port 443 (TCP and UDP are independent), and guests
pick whichever gets through.

---

## How it works

```
┌──────────── Guest device (e.g. in China) ────────────┐
│  Hiddify / NekoBox / v2rayN / sing-box                │
│      │  paste vless:// or hysteria2:// link           │
└──────┼───────────────────────────────────────────────┘
       │  looks like HTTPS (Reality) or random UDP (Hy2)
       ▼
   [ router ]  ── forwards TCP 443 + UDP 443 ──▶  [ Home Mac ]
                                                   easyVPN app
                                                      │ drives
                                                      ▼
                                                  sing-box
                                              (LaunchDaemon, boots
                                               with the machine)
                                                      │
                                                      ▼
                                                 the open internet
```

The app is a thin, tested control plane over
[`sing-box`](https://sing-box.sagernet.org). The four wizard steps map to:

1. **System** — detect/install `sing-box` (via Homebrew), resolve public + LAN
   IPs (`check_system`, `install_singbox`).
2. **Server** — generate the cryptographic identity once: a Reality keypair, a
   Hysteria2 obfuscation secret, and a self-signed cert (`create_server`).
   Stored in `~/Library/Application Support/com.me.easyvpn/`.
3. **Port forward** — surface the two router rules to add (`port_forward_info`).
   The only manual step.
4. **Guests** — add a person per device (`add_guest` / `remove_guest`), fetch
   their links (`list_guest_links`); `apply_and_start` writes the config,
   installs a boot `LaunchDaemon`, and launches it (one macOS admin prompt,
   because binding `:443` needs root).

**Server state is the single source of truth.** The `sing-box` config is
rendered deterministically from `state.json`, so the config file is disposable
and always in sync. Each guest has its own UUID + Hysteria2 password, so access
is revoked per-guest by removing them.

---

## Project layout

The engine is a standalone crate shared by two front-ends — the Tauri desktop
app and the CLI — so there's exactly one implementation.

```
easyVPN/
├── Cargo.toml              # workspace root (members: crates/*, excludes src-tauri)
├── crates/
│   ├── core/               # easyvpn-core: the engine (no UI, no Tauri dep)
│   │   └── src/lib.rs      #   creds, config rendering, service mgmt, links, tests
│   └── cli/                # easyvpn-cli: `easyvpn` binary (clap)
│       └── src/main.rs
├── src/                    # React + TypeScript frontend (the wizard)
│   ├── App.tsx             # 4-step wizard UI
│   ├── api.ts              # typed wrapper over Tauri commands
│   └── Qr.tsx              # QR rendering for share links
├── src-tauri/
│   └── src/server.rs       # thin #[tauri::command] wrappers over easyvpn-core
├── scripts/e2e.sh          # real server+client end-to-end test
└── docs/DEVELOPMENT.md      # this file
```

`easyvpn-core` is the only place that shells out to external tools (`sing-box`,
`openssl`, `launchctl`, `osascript`). It has no UI or Tauri dependency, so the
CLI stays lightweight. Both front-ends read/write the same state under
`~/Library/Application Support/com.me.easyvpn/`, so you can set the server up
over SSH with the CLI and manage guests from the app, or vice versa.

Privileged operations go through one `run_privileged` helper parameterized by an
`Elevation` mode: the app passes `GuiPrompt` (a native `osascript` password
dialog, one prompt), while the CLI runs under `sudo` and passes `AlreadyRoot`.

`src-tauri` is deliberately **excluded** from the Cargo workspace so its
`cargo tauri` tooling keeps its own target dir and lockfile; it depends on
`easyvpn-core` by path.

### Building

```bash
cargo build --release -p easyvpn-cli   # CLI  -> target/release/easyvpn
npm run tauri build                     # app  -> src-tauri/target/.../easyVPN.app
cargo test -p easyvpn-core              # unit tests
./scripts/e2e.sh                        # end-to-end tunnel test
```

---

## Testing

Pure logic — link building, config rendering, URL-safety of secrets:

```bash
cd src-tauri && cargo test
```

Full end-to-end — stands up a **real** `sing-box` server and clients on
localhost and pushes traffic **both directions** through **both** protocols
(no root, no port-forward needed):

```bash
./scripts/e2e.sh
```

Example output:

```
✓ server config validates
✓ client configs validate
✓ Reality    down  141.9 Mbps  up   56.1 Mbps
✓ Hysteria2  down  176.8 Mbps  up   65.9 Mbps
All end-to-end checks passed.
```

The e2e test deliberately exercises the **upload** direction, since that was the
subtle failure mode during the original manual bring-up (BBR backing off on a
lossy path; the fix was declaring bandwidth to switch Hysteria2 to Brutal CC).

---

## Security notes

- Guest credentials (UUIDs, Hysteria2 passwords) are per-guest and revocable
  individually.
- The Hysteria2 TLS cert is self-signed and the client connects with
  `insecure=1`. This is safe here because the Salamander obfuscation layer
  already encrypts and hides the TLS handshake — but it means the transport's
  authenticity rests on the obfs password. Treat share links as secrets.
- Runtime secrets never touch the repo; they live in
  `~/Library/Application Support/com.me.easyvpn/`.
- If the ISP blocks inbound 443, move both inbounds and the forward to another
  port (e.g. 8443). A port picker is on the roadmap.

---

## Platform support

Currently macOS-only — it uses `launchctl` + `osascript` for service management
and the admin prompt. The `sing-box` config itself is cross-platform, so
Linux/Windows support is mainly service-management work.

---

## Roadmap

- [ ] Configurable ports (443 → custom) from the UI
- [ ] Live server status: handshake success, per-guest last-seen, throughput
- [ ] Optional WireGuard inbound for low-censorship guests
- [ ] Automatic UPnP port-forward attempt before falling back to manual
- [ ] Linux + Windows support

Built on the shoulders of [sing-box](https://github.com/SagerNet/sing-box).
