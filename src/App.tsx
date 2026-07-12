import { useEffect, useState, useCallback } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  api,
  type SystemInfo,
  type GuestLinks,
  type PortForwardInfo,
} from "./api";
import { Qr } from "./Qr";
import "./App.css";

type Busy = string | null;

const STEPS = ["System", "Server", "Port forward", "Guests"] as const;

export default function App() {
  const [step, setStep] = useState(0);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSys(await api.checkSystem());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const guard = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="brand">
          <span className="brand__mark">🛡️</span>
          <div>
            <h1>easyVPN</h1>
            <p>Turn this Mac into a censorship-resistant VPN in a few clicks.</p>
          </div>
        </div>
        <StatusPill sys={sys} />
      </header>

      <nav className="stepper">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className={`stepper__item ${i === step ? "is-active" : ""} ${
              i < step ? "is-done" : ""
            }`}
            onClick={() => setStep(i)}
          >
            <span className="stepper__num">{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="banner banner--error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <main className="panel">
        {step === 0 && (
          <SystemStep
            sys={sys}
            busy={busy}
            onInstall={() =>
              guard("install", async () => {
                await api.installSingbox();
                await refresh();
                flash("sing-box installed");
              })
            }
            onRefresh={refresh}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <ServerStep
            sys={sys}
            busy={busy}
            onCreate={(sni) =>
              guard("create", async () => {
                await api.createServer(sni);
                await refresh();
                flash("Server identity created");
                setStep(2);
              })
            }
          />
        )}
        {step === 2 && <PortForwardStep onNext={() => setStep(3)} />}
        {step === 3 && (
          <GuestsStep
            sys={sys}
            busy={busy}
            guard={guard}
            refresh={refresh}
            flash={flash}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
      <footer className="app__footer">
        VLESS + Reality (TCP 443) &nbsp;·&nbsp; Hysteria2 (UDP 443) &nbsp;·&nbsp;
        powered by sing-box
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            void openUrl("https://sing-box.sagernet.org");
          }}
        >
          docs
        </a>
      </footer>
    </div>
  );
}

function StatusPill({ sys }: { sys: SystemInfo | null }) {
  if (!sys) return <span className="pill pill--muted">checking…</span>;
  if (sys.running) return <span className="pill pill--ok">● running</span>;
  if (sys.server_created) return <span className="pill pill--warn">● stopped</span>;
  return <span className="pill pill--muted">● not set up</span>;
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <span className={`row__value ${ok === true ? "is-ok" : ok === false ? "is-bad" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function SystemStep({
  sys,
  busy,
  onInstall,
  onRefresh,
  onNext,
}: {
  sys: SystemInfo | null;
  busy: Busy;
  onInstall: () => void;
  onRefresh: () => void;
  onNext: () => void;
}) {
  if (!sys) return <p className="muted">Inspecting your system…</p>;
  return (
    <>
      <h2>System check</h2>
      <p className="muted">
        easyVPN drives <code>sing-box</code> under the hood. Everything below
        must be green before you build the server.
      </p>
      <div className="card">
        <Row
          label="sing-box"
          value={sys.singbox_installed ? sys.singbox_version ?? "installed" : "not installed"}
          ok={sys.singbox_installed}
        />
        <Row
          label="Homebrew"
          value={sys.homebrew_installed ? "available" : "missing"}
          ok={sys.homebrew_installed}
        />
        <Row label="Public IP" value={sys.public_ip ?? "unknown"} ok={!!sys.public_ip} />
        <Row label="LAN IP" value={sys.lan_ip ?? "unknown"} ok={!!sys.lan_ip} />
      </div>

      <div className="actions">
        {!sys.singbox_installed && (
          <button className="btn btn--primary" disabled={busy !== null} onClick={onInstall}>
            {busy === "install" ? "Installing…" : "Install sing-box"}
          </button>
        )}
        <button className="btn" disabled={busy !== null} onClick={onRefresh}>
          Re-check
        </button>
        <button
          className="btn btn--primary"
          disabled={!sys.singbox_installed}
          onClick={onNext}
        >
          Next →
        </button>
      </div>
      {!sys.homebrew_installed && !sys.singbox_installed && (
        <p className="hint">
          Homebrew isn't installed. Install it from{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              void openUrl("https://brew.sh");
            }}
          >
            brew.sh
          </a>{" "}
          then re-check.
        </p>
      )}
    </>
  );
}

const SNI_CHOICES = ["www.apple.com", "www.microsoft.com", "www.cloudflare.com"];

function ServerStep({
  sys,
  busy,
  onCreate,
}: {
  sys: SystemInfo | null;
  busy: Busy;
  onCreate: (sni: string) => void;
}) {
  const [sni, setSni] = useState(SNI_CHOICES[0]);
  const created = sys?.server_created;
  return (
    <>
      <h2>Create the server</h2>
      <p className="muted">
        This generates the server's cryptographic identity: a Reality keypair,
        Hysteria2 obfuscation secret, and a TLS certificate. It runs once and is
        stored locally.
      </p>

      <label className="field">
        <span>Camouflage site (Reality borrows its TLS fingerprint)</span>
        <select value={sni} onChange={(e) => setSni(e.target.value)} disabled={created}>
          {SNI_CHOICES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <small>
          To anyone inspecting the traffic, connections look like ordinary
          HTTPS visits to this site. Pick one that's reachable from your guest's
          country.
        </small>
      </label>

      {created ? (
        <div className="banner banner--ok">
          ✓ Server identity already created. Move on to port forwarding.
        </div>
      ) : (
        <div className="actions">
          <button
            className="btn btn--primary"
            disabled={busy !== null}
            onClick={() => onCreate(sni)}
          >
            {busy === "create" ? "Generating…" : "Create VPN server"}
          </button>
        </div>
      )}
    </>
  );
}

function PortForwardStep({ onNext }: { onNext: () => void }) {
  const [info, setInfo] = useState<PortForwardInfo | null>(null);
  useEffect(() => {
    void api.portForwardInfo().then(setInfo);
  }, []);
  return (
    <>
      <h2>Forward two ports on your router</h2>
      <p className="muted">
        This is the only manual step. Open your router's admin page, find{" "}
        <b>Port Forwarding</b>, and add these two rules pointing at this Mac.
      </p>
      <div className="card">
        <Row label="Forward to (this Mac's LAN IP)" value={info?.lan_ip ?? "…"} ok={!!info?.lan_ip} />
      </div>
      <table className="ports">
        <thead>
          <tr>
            <th>Protocol</th>
            <th>External port</th>
            <th>Internal port</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {(info?.rules ?? []).map((r) => (
            <tr key={r.protocol}>
              <td>
                <b>{r.protocol}</b>
              </td>
              <td>{r.port}</td>
              <td>{r.port}</td>
              <td className="muted">{r.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        TCP 443 and UDP 443 are <b>separate rules</b> on most routers — add both.
        If your ISP blocks inbound 443, you can move to another port later.
      </p>
      <div className="actions">
        <button className="btn btn--primary" onClick={onNext}>
          I've added the rules →
        </button>
      </div>
    </>
  );
}

function GuestsStep({
  sys,
  busy,
  guard,
  refresh,
  flash,
}: {
  sys: SystemInfo | null;
  busy: Busy;
  guard: (label: string, fn: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  flash: (m: string) => void;
}) {
  const [links, setLinks] = useState<GuestLinks[]>([]);
  const [name, setName] = useState("");

  const reload = useCallback(async () => {
    try {
      setLinks(await api.listGuestLinks());
    } catch {
      setLinks([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = () =>
    guard("add", async () => {
      await api.addGuest(name.trim());
      setName("");
      await reload();
      flash("Guest added");
    });

  const remove = (n: string) =>
    guard("remove", async () => {
      await api.removeGuest(n);
      await reload();
    });

  const start = () =>
    guard("start", async () => {
      await api.applyAndStart();
      await refresh();
      flash("Server running");
    });

  const stop = () =>
    guard("stop", async () => {
      await api.stopServer();
      await refresh();
      flash("Server stopped");
    });

  return (
    <>
      <h2>Guests &amp; share links</h2>
      <p className="muted">
        Add a person for each device you want to allow. Everyone gets their own
        credentials, so you can revoke one without affecting the others.
      </p>

      <div className="addrow">
        <input
          placeholder="e.g. brother, laptop, phone"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && add()}
        />
        <button
          className="btn btn--primary"
          disabled={busy !== null || !name.trim()}
          onClick={add}
        >
          {busy === "add" ? "Adding…" : "Add guest"}
        </button>
      </div>

      {links.length === 0 && <p className="muted">No guests yet.</p>}

      <div className="guests">
        {links.map((g) => (
          <GuestCard key={g.name} g={g} onRemove={() => remove(g.name)} flash={flash} />
        ))}
      </div>

      {links.length > 0 && (
        <div className="startbar">
          {sys?.running ? (
            <>
              <span className="pill pill--ok">● running</span>
              <button className="btn" disabled={busy !== null} onClick={stop}>
                {busy === "stop" ? "Stopping…" : "Stop server"}
              </button>
              <button className="btn" disabled={busy !== null} onClick={start}>
                Apply changes
              </button>
            </>
          ) : (
            <button className="btn btn--primary btn--lg" disabled={busy !== null} onClick={start}>
              {busy === "start" ? "Starting…" : "Start server & enable at boot"}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function GuestCard({
  g,
  onRemove,
  flash,
}: {
  g: GuestLinks;
  onRemove: () => void;
  flash: (m: string) => void;
}) {
  const [which, setWhich] = useState<"hysteria2" | "vless">("hysteria2");
  const link = which === "hysteria2" ? g.hysteria2_link : g.vless_link;
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    flash("Link copied");
  };
  return (
    <div className="guest">
      <div className="guest__head">
        <h3>{g.name}</h3>
        <button className="linkbtn" onClick={onRemove}>
          remove
        </button>
      </div>
      <div className="guest__body">
        <Qr value={link} />
        <div className="guest__links">
          <div className="toggle">
            <button
              className={which === "hysteria2" ? "is-active" : ""}
              onClick={() => setWhich("hysteria2")}
            >
              Hysteria2 <span className="tag">fast</span>
            </button>
            <button
              className={which === "vless" ? "is-active" : ""}
              onClick={() => setWhich("vless")}
            >
              Reality <span className="tag">stealth</span>
            </button>
          </div>
          <textarea className="linkbox" readOnly value={link} rows={4} />
          <div className="actions">
            <button className="btn btn--primary" onClick={copy}>
              Copy link
            </button>
          </div>
          <small className="muted">
            {which === "hysteria2"
              ? "Best throughput on lossy/censored routes. Import into Hiddify, NekoBox, v2rayN, or sing-box."
              : "Hardest to detect — looks like normal HTTPS. Same clients."}
          </small>
        </div>
      </div>
    </div>
  );
}
