# 🛡️ easyVPN

Turn a home Mac into a private VPN that works even from heavily censored
networks — so a relative behind the Great Firewall or a friend on a filtered
connection can get online by pasting **one link** into a free app.

No terminal, no config files. You click through four steps; each person you
invite gets their own link (and a QR code) to paste into their VPN app.

Under the hood it uses two censorship-resistant protocols (Reality and
Hysteria2) that ordinary VPNs like WireGuard can't match on blocked networks —
but you never have to think about that.

---

## Getting started

You'll need a Mac that stays on at home, with [Homebrew](https://brew.sh)
installed.

### Fastest path — clone and run

```bash
git clone https://github.com/ThatXliner/easyVPN
cd easyVPN
./setup.sh
```

`setup.sh` installs what's missing (Rust, sing-box), builds and installs the
`easyvpn` CLI, creates your server, adds your first guest, and prints the share
link plus the two router rules to add. It's idempotent — re-run it anytime. The
only thing left to you is the router port-forward.

Manage it afterwards with the CLI (great over SSH on a headless box):

```bash
easyvpn status             # check sing-box + network + server state
easyvpn guest add laptop   # add another device, prints its link
easyvpn guest list         # all guests + links   (--json for scripting)
sudo easyvpn start | stop  # start/stop + boot service
```

### Prefer a graphical app?

```bash
npm install
npm run tauri dev          # or: npm run tauri build  → a double-click .app
```

Then follow the wizard: **System → Server → Port forward → Guests** (add a
person per device, copy their link or show the QR). The app and CLI share the
same server, so you can mix and match.

---

## Sending a link to someone

Everyone you add gets two links. Have them install a free client, then paste a
link in and connect:

| Their device | Free app to install |
|--------------|---------------------|
| iPhone/iPad  | **Hiddify** or **Streisand** |
| Android      | **v2rayNG** or **Hiddify** |
| Windows      | **v2rayN** or **Hiddify** |
| Mac          | **Hiddify** |

**Tell them to try the Hysteria2 link first** — it's usually much faster on
censored networks. If it won't connect, the Reality link is the stealthier
backup.

> ⚠️ A link is a password. Send it privately (e.g. Signal), not over email or
> text, and add a separate guest for each person so you can remove one without
> affecting the others.

---

## Good to know

- **macOS only** for now.
- Uses port 443; if your ISP blocks it, that's a known limitation (a port
  setting is coming).
- Helping family and friends reach the open internet is a legitimate use — but
  packaging or selling circumvention tools carries real legal and safety
  considerations in some places. Worth thinking through before you distribute.

---

**Developers:** see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for how it
works, the architecture, testing, and security details.
