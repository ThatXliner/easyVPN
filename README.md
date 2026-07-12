# 🛡️ easyVPN

Turn a home Mac into a censorship-resistant VPN server that anyone — a relative
behind the Great Firewall, a friend on a filtered network — can use by pasting a
single link into a free app.

easyVPN is a desktop wizard that automates the exact setup that reliably beats
aggressive DPI-based censorship, so you don't need to touch a terminal:

- **VLESS + Reality** on TCP 443 — steals a real HTTPS site's TLS fingerprint,
  so the traffic is indistinguishable from an ordinary visit to that site.
- **Hysteria2** on UDP 443 — QUIC with Salamander obfuscation and a
  loss-tolerant congestion controller; the fast path on lossy, high-latency,
  throttled routes where plain WireGuard/OpenVPN get strangled.

The host clicks through four steps; each guest gets their own credentials and a
ready-to-paste `vless://` / `hysteria2://` link (plus a QR code).

> **Why not just WireGuard?** WireGuard is easily fingerprinted and throttled by
> national firewalls — in the field it was capped to ~1 Mbps. Swapping to Reality
> for stealth and Hysteria2 for throughput took the same server to a usable
> tunnel. easyVPN packages that swap.

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

The app is a thin, well-tested control plane over
[`sing-box`](https://sing-box.sagernet.org):

1. **System** — detects/installs `sing-box` (via Homebrew), finds the machine's
   public and LAN IPs.
2. **Server** — generates the cryptographic identity once: a Reality keypair,
   a Hysteria2 obfuscation secret, and a self-signed cert. Stored locally in
   `~/Library/Application Support/com.me.easyvpn/`.
3. **Port forward** — shows the two router rules to add (the only manual step).
4. **Guests** — add a person per device; copy their link or show a QR. Starting
   the server writes the `sing-box` config, installs a boot `LaunchDaemon`, and
   launches it (one macOS admin prompt, because binding `:443` needs root).

Server state is the single source of truth: the `sing-box` config is rendered
deterministically from it, so it's disposable and always in sync.

---

## Quick start (development)

Prerequisites: **Node ≥ 18**, **Rust ≥ 1.77**, and **Homebrew** (used to install
`sing-box`). macOS 12+.

```bash
npm install
npm run tauri dev      # launches the app with hot-reload
```

Build a distributable `.app` / `.dmg`:

```bash
npm run tauri build    # output in src-tauri/target/release/bundle/
```

---

## For your guests

Any [sing-box](https://sing-box.sagernet.org)-compatible client works; all are
free:

| Platform | Recommended free client |
|----------|-------------------------|
| iOS      | **Hiddify** or **Streisand** (need a non-China Apple ID) |
| Android  | **v2rayNG**, **Hiddify**, or **NekoBox** (APK from GitHub) |
| Windows  | **v2rayN** or **Hiddify** |
| macOS    | **Hiddify** or **sing-box** |

Flow for the guest: copy the link → open the app → *Import from clipboard* →
connect. **Try the Hysteria2 link first** — it's usually much faster on censored
routes. Fall back to the Reality link if Hysteria2's UDP is blocked.

> **Hysteria2 speed tip:** in the client, set the *Download speed* to roughly the
> guest's real line speed. Its congestion control uses that to punch through
> packet loss — that's where the big win over WireGuard comes from.

---

## Testing

Pure logic (link building, config rendering, URL-safety of secrets):

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
subtle failure mode during the original manual bring-up.

---

## Project layout

```
easyVPN/
├── src/                    # React + TypeScript frontend (the wizard)
│   ├── App.tsx             # 4-step wizard UI
│   ├── api.ts              # typed wrapper over Tauri commands
│   └── Qr.tsx              # QR rendering for share links
├── src-tauri/
│   ├── src/server.rs       # the VPN engine (creds, config, service, links)
│   └── src/lib.rs          # Tauri command registration
└── scripts/e2e.sh          # real server+client end-to-end test
```

---

## Security & scope notes

- Guest credentials (UUIDs, Hysteria2 passwords) are per-guest, so any one can
  be revoked by removing that guest without disturbing the others.
- The Hysteria2 TLS cert is self-signed; the client connects with `insecure=1`.
  This is safe here because the Salamander obfuscation layer already encrypts and
  hides the TLS handshake — but it means the transport's authenticity rests on
  the obfs password, so treat share links as secrets and send them over a private
  channel (e.g. Signal), never email/SMS.
- If your ISP blocks inbound port 443, move both inbounds and the forward to
  another port (e.g. 8443). A port picker is on the roadmap.
- Currently macOS-only (uses `launchctl` + `osascript`). The engine is small and
  the sing-box config is cross-platform; Linux/Windows service management is the
  main port work.

---

## Roadmap

- [ ] Configurable ports (443 → custom) from the UI
- [ ] Live server status: handshake success, per-guest last-seen, throughput
- [ ] Optional WireGuard inbound for low-censorship guests
- [ ] Automatic UPnP port-forward attempt before falling back to manual
- [ ] Linux + Windows support

Built on the shoulders of [sing-box](https://github.com/SagerNet/sing-box).
