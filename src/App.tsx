import { useCallback, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  api,
  type GuestLinks,
  type PortForwardInfo,
  type SystemInfo,
} from "./api";
import { Qr } from "./Qr";
import "./App.css";

type Busy = string | null;

const STEPS = ["System", "Identity", "Router", "Guests"] as const;
const REPO_URL = "https://github.com/ThatXliner/easyVPN";

export default function App() {
  const isDesktop = "__TAURI_INTERNALS__" in window;
  return isDesktop ? <DesktopApp /> : <LandingPage />;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brandmark ${compact ? "brandmark--compact" : ""}`} aria-hidden="true">
      <span className="brandmark__core" />
    </span>
  );
}

function Wordmark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`wordmark ${inverted ? "wordmark--inverted" : ""}`}>
      easy<span>VPN</span>
    </span>
  );
}

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function LandingPage() {
  return (
    <div className="site-shell">
      <header className="site-nav">
        <a className="site-brand" href="#top" aria-label="easyVPN home">
          <BrandMark compact />
          <Wordmark />
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#inside">The app</a>
          <a href={REPO_URL}>GitHub <Arrow /></a>
        </nav>
      </header>

      <main id="top">
        <section className="simple-hero">
          <div className="simple-hero__copy">
            <p className="eyebrow"><i /> Private infrastructure for real people</p>
            <h1>
              The open internet,
              <span>hosted at home.</span>
            </h1>
            <p className="simple-hero__lede">
              easyVPN turns a Mac into a secure internet gateway for the people you care about.
              Set it up once. Share one link. Stay in control.
            </p>
            <div className="simple-hero__actions">
              <a className="cta cta--ink" href={`${REPO_URL}#quick-start`}>
                Get started <Arrow />
              </a>
              <a className="text-link" href="#inside">See the app</a>
            </div>
          </div>

          <div className="route-visual" aria-label="A private connection from a guest back home">
            <div className="route-orbit route-orbit--outer" />
            <div className="route-orbit route-orbit--inner" />
            <div className="route-visual__line"><i /></div>
            <div className="route-node route-node--home">
              <span><BrandMark compact /></span>
              <div><b>Your Mac</b><small>Home gateway</small></div>
            </div>
            <div className="route-node route-node--guest">
              <i />
              <div><b>Someone you trust</b><small>Connected privately</small></div>
            </div>
            <span className="route-visual__label">Encrypted route · 443</span>
            <div className="route-visual__stamp">YOU OWN<br />THE EXIT</div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Product highlights">
          <div><strong>2</strong><span>resilient protocols</span></div>
          <div><strong>4</strong><span>guided setup steps</span></div>
          <div><strong>0</strong><span>accounts or subscriptions</span></div>
        </section>

        <section className="plain-intro" id="how-it-works">
          <p className="section-label">How it works</p>
          <div>
            <h2>Your Mac is already powerful enough.</h2>
            <p>
              easyVPN wraps powerful networking tools in a guided desktop app. Your guests get
              their own revocable credentials. Their traffic travels through your home connection,
              while the keys and configuration stay on your machine.
            </p>
          </div>
        </section>

        <section className="simple-steps" aria-label="Four setup steps">
          <article><span>01</span><h3>Check</h3><p>Confirm the Mac and network are ready.</p></article>
          <article><span>02</span><h3>Create</h3><p>Generate a private server identity locally.</p></article>
          <article><span>03</span><h3>Route</h3><p>Add two clearly explained router rules.</p></article>
          <article><span>04</span><h3>Share</h3><p>Send each guest their own link or QR code.</p></article>
        </section>

        <section className="quiet-showcase" id="inside">
          <div className="quiet-showcase__heading">
            <p className="section-label section-label--light">The desktop app</p>
            <h2>Serious tech. Four calm screens.</h2>
            <p>
              Four calm screens replace a weekend of configuration. Each step explains what it
              changes, why it matters, and what comes next.
            </p>
          </div>

          <div className="product-window" aria-label="Preview of the easyVPN desktop app">
            <div className="product-window__bar">
              <span /><span /><span />
              <b>easyVPN / Home base</b>
              <i>● SECURE</i>
            </div>
            <div className="product-window__body">
              <aside className="product-window__sidebar">
                <div className="mock-brand"><BrandMark compact /><Wordmark inverted /></div>
                <small>SETUP</small>
                <div className="mock-step is-done"><b>01</b><span>System</span></div>
                <div className="mock-step is-done"><b>02</b><span>Identity</span></div>
                <div className="mock-step is-active"><b>03</b><span>Router</span></div>
                <div className="mock-step"><b>04</b><span>Guests</span></div>
              </aside>
              <div className="mock-panel">
                <div className="mock-panel__top"><span>STEP 03 OF 04</span><i>ABOUT 2 MINUTES</i></div>
                <h3>Point traffic home.</h3>
                <p>Add these two rules to your router. Both point to this Mac.</p>
                <div className="route-row"><b>TCP</b><strong>443</strong><span>→</span><em>192.168.1.24</em><small>REALITY</small></div>
                <div className="route-row"><b>UDP</b><strong>443</strong><span>→</span><em>192.168.1.24</em><small>HYSTERIA2</small></div>
                <button type="button">I&apos;ve added both rules <Arrow /></button>
              </div>
            </div>
          </div>
        </section>

        <section className="simple-protocols">
          <div className="simple-protocols__heading">
            <p className="section-label">Two routes</p>
            <h2>Choose what the network allows.</h2>
          </div>
          <div className="simple-protocols__grid">
            <article>
              <span>Fast path</span>
              <h3>Hysteria2</h3>
              <p>Designed to stay responsive on unreliable, lossy, or heavily filtered connections.</p>
            </article>
            <article>
              <span>Stealth path</span>
              <h3>Reality</h3>
              <p>Designed to resemble ordinary HTTPS traffic when blending in matters most.</p>
            </article>
          </div>
        </section>

        <section className="simple-cta">
          <div>
            <p>Your hardware. Your people. Your rules.</p>
            <h2>Bring the internet home.</h2>
          </div>
          <a className="cta cta--acid" href={REPO_URL}>
            View on GitHub <Arrow />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <div><Wordmark inverted /><p>A private way back home.</p></div>
        <nav><a href={REPO_URL}>GitHub</a><a href={`${REPO_URL}#quick-start`}>Setup</a><a href="https://sing-box.sagernet.org">sing-box</a></nav>
        <small>Open source · macOS · Use responsibly</small>
      </footer>
    </div>
  );
}

function DesktopApp() {
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

  useEffect(() => { void refresh(); }, [refresh]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  };

  const guard = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try { await fn(); } catch (e) { setError(String(e)); } finally { setBusy(null); }
  };

  return (
    <div className="desktop-shell">
      <aside className="desktop-sidebar">
        <div className="desktop-brand"><BrandMark compact /><Wordmark inverted /></div>
        <p className="desktop-sidebar__eyebrow">HOME BASE</p>
        <nav className="desktop-steps" aria-label="Setup steps">
          {STEPS.map((label, index) => (
            <button
              key={label}
              className={`${index === step ? "is-active" : ""} ${index < step ? "is-done" : ""}`}
              onClick={() => setStep(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{label}</b>
              <small>{index < step ? "Complete" : index === step ? "Current" : "Up next"}</small>
            </button>
          ))}
        </nav>
        <div className="desktop-sidebar__status">
          <StatusPill sys={sys} />
          <small>VLESS + Reality<br />Hysteria2 + TLS</small>
        </div>
      </aside>

      <div className="desktop-main">
        <header className="desktop-header">
          <div><span>SETUP / {STEPS[step].toUpperCase()}</span><small>STEP {step + 1} OF 4</small></div>
          <button onClick={() => void openUrl(REPO_URL)}>Help ↗</button>
        </header>

        {error && <button className="banner banner--error" onClick={() => setError(null)}>{error}</button>}

        <main className="desktop-panel">
          {step === 0 && (
            <SystemStep sys={sys} busy={busy} onInstall={() => guard("install", async () => {
              await api.installSingbox(); await refresh(); flash("sing-box installed");
            })} onRefresh={refresh} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <ServerStep sys={sys} busy={busy} onCreate={(sni) => guard("create", async () => {
              await api.createServer(sni); await refresh(); flash("Server identity created"); setStep(2);
            })} />
          )}
          {step === 2 && <PortForwardStep onNext={() => setStep(3)} />}
          {step === 3 && <GuestsStep sys={sys} busy={busy} guard={guard} refresh={refresh} flash={flash} />}
        </main>

        <footer className="desktop-footer">
          <span>POWERED BY SING-BOX</span><i /><span>LOCAL-FIRST</span><i /><span>NO SUBSCRIPTION</span>
        </footer>
      </div>
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function StatusPill({ sys }: { sys: SystemInfo | null }) {
  if (!sys) return <span className="pill pill--muted">CHECKING</span>;
  if (sys.running) return <span className="pill pill--ok">● LIVE</span>;
  if (sys.server_created) return <span className="pill pill--warn">● PAUSED</span>;
  return <span className="pill pill--muted">● NOT SET UP</span>;
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return <div className="row"><span>{label}</span><b className={ok === true ? "is-ok" : ok === false ? "is-bad" : ""}>{value}</b></div>;
}

function StepIntro({ number, eyebrow, title, copy }: { number: string; eyebrow: string; title: string; copy: string }) {
  return (
    <div className="step-intro">
      <span>{number}</span>
      <div><small>{eyebrow}</small><h1>{title}</h1><p>{copy}</p></div>
    </div>
  );
}

function SystemStep({ sys, busy, onInstall, onRefresh, onNext }: {
  sys: SystemInfo | null; busy: Busy; onInstall: () => void; onRefresh: () => void; onNext: () => void;
}) {
  if (!sys) return <div className="loading-state"><BrandMark /><p>Inspecting your home base…</p></div>;
  return (
    <>
      <StepIntro number="01" eyebrow="PRE-FLIGHT CHECK" title="Let’s check the Mac." copy="We’ll make sure the essentials are ready before creating your private gateway." />
      <div className="check-grid">
        <Row label="sing-box engine" value={sys.singbox_installed ? sys.singbox_version ?? "Installed" : "Not installed"} ok={sys.singbox_installed} />
        <Row label="Homebrew" value={sys.homebrew_installed ? "Available" : "Missing"} ok={sys.homebrew_installed} />
        <Row label="Public address" value={sys.public_ip ?? "Unknown"} ok={!!sys.public_ip} />
        <Row label="Local address" value={sys.lan_ip ?? "Unknown"} ok={!!sys.lan_ip} />
      </div>
      <div className="actions">
        {!sys.singbox_installed && <button className="btn btn--primary" disabled={busy !== null} onClick={onInstall}>{busy === "install" ? "INSTALLING…" : "INSTALL SING-BOX"}</button>}
        <button className="btn" disabled={busy !== null} onClick={onRefresh}>RE-CHECK</button>
        <button className="btn btn--primary btn--next" disabled={!sys.singbox_installed} onClick={onNext}>CONTINUE <Arrow /></button>
      </div>
      {!sys.homebrew_installed && !sys.singbox_installed && <p className="hint">Homebrew is needed first. Install it from <button className="inline-link" onClick={() => void openUrl("https://brew.sh")}>brew.sh ↗</button>, then re-check.</p>}
    </>
  );
}

const SNI_CHOICES = ["www.apple.com", "www.microsoft.com", "www.cloudflare.com"];

function ServerStep({ sys, busy, onCreate }: { sys: SystemInfo | null; busy: Busy; onCreate: (sni: string) => void }) {
  const [sni, setSni] = useState(SNI_CHOICES[0]);
  const created = sys?.server_created;
  return (
    <>
      <StepIntro number="02" eyebrow="PRIVATE IDENTITY" title="Make this gateway yours." copy="We’ll generate the cryptographic identity and camouflage that keep your route private." />
      <label className="field">
        <span>CAMOUFLAGE SITE</span>
        <select value={sni} onChange={(event) => setSni(event.target.value)} disabled={created}>
          {SNI_CHOICES.map((choice) => <option key={choice}>{choice}</option>)}
        </select>
        <small>Connections resemble ordinary HTTPS traffic to this site. Pick one reachable from your guest’s country.</small>
      </label>
      <div className="identity-note"><span>GENERATED LOCALLY</span><p>Reality keypair · Hysteria2 secret · TLS certificate</p></div>
      {created ? <div className="banner banner--ok">✓ Identity ready. Your secrets live only on this Mac.</div> : <div className="actions"><button className="btn btn--primary btn--next" disabled={busy !== null} onClick={() => onCreate(sni)}>{busy === "create" ? "GENERATING…" : "CREATE IDENTITY"} <Arrow /></button></div>}
    </>
  );
}

function PortForwardStep({ onNext }: { onNext: () => void }) {
  const [info, setInfo] = useState<PortForwardInfo | null>(null);
  useEffect(() => { void api.portForwardInfo().then(setInfo); }, []);
  return (
    <>
      <StepIntro number="03" eyebrow="OPEN THE ROUTE" title="Point traffic home." copy="Add two rules in your router’s Port Forwarding screen. Both point to this Mac." />
      <div className="router-target"><span>THIS MAC</span><strong>{info?.lan_ip ?? "Finding local address…"}</strong></div>
      <div className="port-rules">
        {(info?.rules ?? []).map((rule) => <div className="port-rule" key={rule.protocol}><b>{rule.protocol}</b><strong>{rule.port}</strong><span>→</span><em>{info?.lan_ip ?? "…"}</em><small>{rule.purpose}</small></div>)}
      </div>
      <p className="hint">TCP 443 and UDP 443 are separate rules on most routers. Add both.</p>
      <div className="actions"><button className="btn btn--primary btn--next" onClick={onNext}>I’VE ADDED BOTH <Arrow /></button></div>
    </>
  );
}

function GuestsStep({ sys, busy, guard, refresh, flash }: {
  sys: SystemInfo | null; busy: Busy; guard: (label: string, fn: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>; flash: (message: string) => void;
}) {
  const [links, setLinks] = useState<GuestLinks[]>([]);
  const [name, setName] = useState("");
  const reload = useCallback(async () => { try { setLinks(await api.listGuestLinks()); } catch { setLinks([]); } }, []);
  useEffect(() => { void reload(); }, [reload]);
  const add = () => guard("add", async () => { await api.addGuest(name.trim()); setName(""); await reload(); flash("Guest added"); });
  const remove = (guestName: string) => guard("remove", async () => { await api.removeGuest(guestName); await reload(); });
  const start = () => guard("start", async () => { await api.applyAndStart(); await refresh(); flash("Gateway live"); });
  const stop = () => guard("stop", async () => { await api.stopServer(); await refresh(); flash("Gateway paused"); });
  return (
    <>
      <StepIntro number="04" eyebrow="INVITE YOUR PEOPLE" title="Give everyone their own key." copy="Each person gets private credentials you can revoke without disrupting anyone else." />
      <div className="addrow"><input aria-label="Guest name" placeholder="Name this person or device" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && name.trim() && void add()} /><button className="btn btn--primary" disabled={busy !== null || !name.trim()} onClick={add}>{busy === "add" ? "ADDING…" : "+ ADD GUEST"}</button></div>
      {links.length === 0 && <div className="empty-guests"><span>+</span><p>No guest keys yet.<br /><small>Add someone to generate their private routes.</small></p></div>}
      <div className="guests">{links.map((guest) => <GuestCard key={guest.name} guest={guest} onRemove={() => remove(guest.name)} flash={flash} />)}</div>
      {links.length > 0 && <div className="startbar">{sys?.running ? <><StatusPill sys={sys} /><button className="btn" disabled={busy !== null} onClick={stop}>{busy === "stop" ? "PAUSING…" : "PAUSE"}</button><button className="btn" disabled={busy !== null} onClick={start}>APPLY CHANGES</button></> : <button className="btn btn--primary btn--next" disabled={busy !== null} onClick={start}>{busy === "start" ? "STARTING…" : "GO LIVE"} <Arrow /></button>}</div>}
    </>
  );
}

function GuestCard({ guest, onRemove, flash }: { guest: GuestLinks; onRemove: () => void; flash: (message: string) => void }) {
  const [protocol, setProtocol] = useState<"hysteria2" | "vless">("hysteria2");
  const link = protocol === "hysteria2" ? guest.hysteria2_link : guest.vless_link;
  const copy = async () => { await navigator.clipboard.writeText(link); flash("Link copied"); };
  return (
    <article className="guest">
      <header><div><span className="guest__avatar">{guest.name.slice(0, 1).toUpperCase()}</span><h3>{guest.name}</h3></div><button className="linkbtn" onClick={onRemove}>REMOVE</button></header>
      <div className="guest__body">
        <Qr value={link} size={142} />
        <div className="guest__links">
          <div className="toggle"><button className={protocol === "hysteria2" ? "is-active" : ""} onClick={() => setProtocol("hysteria2")}>HYSTERIA2 <span>FAST</span></button><button className={protocol === "vless" ? "is-active" : ""} onClick={() => setProtocol("vless")}>REALITY <span>STEALTH</span></button></div>
          <textarea className="linkbox" readOnly value={link} rows={3} aria-label={`${guest.name}'s share link`} />
          <div className="guest__copy"><small>{protocol === "hysteria2" ? "Best for speed on difficult networks." : "Best when blending in matters most."}</small><button className="btn btn--primary" onClick={copy}>COPY LINK</button></div>
        </div>
      </div>
    </article>
  );
}
