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
          <a href="#inside">Inside the app</a>
          <a href={REPO_URL}>GitHub <Arrow /></a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero__copy">
            <div className="eyebrow"><span /> Private infrastructure for real people</div>
            <h1>
              The open internet,
              <em>hosted at home.</em>
            </h1>
            <p className="hero__lede">
              Turn a Mac into a private, censorship-resistant gateway for the people you care
              about. No terminal. No config maze. One link and they&apos;re through.
            </p>
            <div className="hero__actions">
              <a className="cta cta--ink" href={`${REPO_URL}#getting-started`}>
                Set up easyVPN <Arrow />
              </a>
              <a className="text-link" href="#how-it-works">See the four steps ↓</a>
            </div>
            <div className="hero__proof" aria-label="Product highlights">
              <span>macOS</span>
              <span>Open source</span>
              <span>Built on sing-box</span>
            </div>
          </div>

          <div className="signal-orbit" aria-label="A private connection from home to anywhere">
            <div className="orbit orbit--one" />
            <div className="orbit orbit--two" />
            <div className="orbit orbit--three" />
            <div className="signal-orbit__home">
              <BrandMark />
              <b>YOUR MAC</b>
              <small>HOME BASE</small>
            </div>
            <div className="signal-orbit__guest">
              <span className="signal-dot" />
              <b>FAMILY</b>
              <small>CONNECTED</small>
            </div>
            <div className="signal-orbit__route">ENCRYPTED ROUTE · 443</div>
          </div>
        </section>

        <section className="ticker" aria-label="Supported technologies">
          <div>
            <span>REALITY</span><i>✦</i><span>HYSTERIA2</span><i>✦</i><span>ONE-TAP SHARING</span>
            <i>✦</i><span>YOUR HARDWARE</span><i>✦</i><span>NO SUBSCRIPTION</span>
          </div>
        </section>

        <section className="manifesto" id="how-it-works">
          <div className="section-kicker">01 / THE IDEA</div>
          <div className="manifesto__copy">
            <h2>Your Mac is already powerful enough.</h2>
            <p>
              easyVPN turns hardware you own into a quiet little doorway home. It wraps two
              resilient protocols in a guided setup, then gives each guest a private QR code and
              share link. You stay in control. They get a route that actually works.
            </p>
          </div>
        </section>

        <section className="steps-grid" aria-label="How easyVPN works">
          <article className="step-card step-card--acid">
            <span className="step-card__num">01</span>
            <div className="mini-glyph mini-glyph--scan"><i /><i /><i /></div>
            <h3>Check the Mac</h3>
            <p>easyVPN finds your network, checks the essentials, and installs the engine.</p>
          </article>
          <article className="step-card step-card--blue">
            <span className="step-card__num">02</span>
            <div className="mini-glyph mini-glyph--key"><i /><i /></div>
            <h3>Create an identity</h3>
            <p>Fresh cryptographic keys and camouflage are generated and kept on your machine.</p>
          </article>
          <article className="step-card step-card--coral">
            <span className="step-card__num">03</span>
            <div className="mini-glyph mini-glyph--route"><i /><i /></div>
            <h3>Open the route</h3>
            <p>Two clearly explained router rules point secure traffic to your new gateway.</p>
          </article>
          <article className="step-card step-card--cream">
            <span className="step-card__num">04</span>
            <div className="mini-glyph mini-glyph--share"><i /><i /><i /></div>
            <h3>Invite your people</h3>
            <p>Give each person a revocable link or QR code. They paste, connect, and go.</p>
          </article>
        </section>

        <section className="app-showcase" id="inside">
          <div className="section-kicker section-kicker--light">02 / INSIDE THE APP</div>
          <div className="app-showcase__heading">
            <h2>Serious technology.<br />A very unserious learning curve.</h2>
            <p>
              Four calm screens replace a weekend of command-line archaeology. Every action says
              what it does, what changed, and what comes next.
            </p>
          </div>

          <div className="product-window" aria-label="Preview of the easyVPN desktop app">
            <div className="product-window__bar">
              <span /><span /><span />
              <b>easyVPN / Home base</b>
              <i>● SECURE</i>
            </div>
            <div className="product-window__body">
              <aside>
                <div className="mock-brand"><BrandMark compact /><Wordmark inverted /></div>
                <small>SETUP FLOW</small>
                <div className="mock-step is-done"><b>01</b><span>System<small>Ready</small></span></div>
                <div className="mock-step is-done"><b>02</b><span>Identity<small>Created</small></span></div>
                <div className="mock-step is-active"><b>03</b><span>Router<small>In progress</small></span></div>
                <div className="mock-step"><b>04</b><span>Guests<small>Up next</small></span></div>
              </aside>
              <div className="mock-panel">
                <div className="mock-panel__top"><span>STEP 03</span><i>2 MINUTES</i></div>
                <h3>Open a route home.</h3>
                <p>Add these two rules to your router. Both point to this Mac.</p>
                <div className="route-row"><b>TCP</b><strong>443</strong><span>→</span><em>192.168.1.24</em><small>REALITY</small></div>
                <div className="route-row"><b>UDP</b><strong>443</strong><span>→</span><em>192.168.1.24</em><small>HYSTERIA2</small></div>
                <button type="button">I&apos;ve added both rules <Arrow /></button>
              </div>
            </div>
          </div>
        </section>

        <section className="protocols">
          <div className="section-kicker">03 / TWO ROUTES, ONE GOAL</div>
          <div className="protocols__intro">
            <h2>Fast when it can be.<br />Invisible when it must be.</h2>
          </div>
          <div className="protocol-card">
            <span className="protocol-card__index">A</span>
            <div><small>FAST LANE</small><h3>Hysteria2</h3></div>
            <p>Built for unreliable, lossy, or heavily filtered networks. This is the first route guests try.</p>
            <span className="protocol-card__signal">))))</span>
          </div>
          <div className="protocol-card">
            <span className="protocol-card__index">B</span>
            <div><small>STEALTH LANE</small><h3>Reality</h3></div>
            <p>Traffic blends into ordinary HTTPS when discretion matters more than raw throughput.</p>
            <span className="protocol-card__signal">····</span>
          </div>
        </section>

        <section className="final-cta">
          <BrandMark />
          <div>
            <p>YOUR HOUSE. YOUR HARDWARE. YOUR RULES.</p>
            <h2>Bring the internet home.</h2>
          </div>
          <a className="cta cta--acid" href={REPO_URL}>
            Get the source <Arrow />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <div><Wordmark inverted /><p>Private infrastructure for the people you care about.</p></div>
        <div><b>PROJECT</b><a href={REPO_URL}>GitHub</a><a href={`${REPO_URL}/blob/main/README.md`}>Setup guide</a></div>
        <div><b>BUILT WITH</b><a href="https://sing-box.sagernet.org">sing-box</a><span>Reality + Hysteria2</span></div>
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
