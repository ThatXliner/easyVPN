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

You'll need a Mac that stays on at home, and [Homebrew](https://brew.sh)
installed.

```bash
npm install
npm run tauri dev      # run the app
```

Then just follow the wizard:

1. **System** — installs the pieces it needs and finds your network info.
2. **Server** — sets up your VPN (one click).
3. **Port forward** — shows the two rules to add on your router. *This is the
   only manual step.*
4. **Guests** — add a person for each device, then copy their link or show the
   QR code.

To build a double-click `.app` instead: `npm run tauri build`.

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
