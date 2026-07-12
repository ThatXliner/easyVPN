//! easyVPN server engine.
//!
//! Turns the host Mac into an obfuscated VPN server that stands up to
//! aggressive network censorship (built and validated against the Great
//! Firewall). It drives a local `sing-box` install with two inbounds on
//! port 443:
//!
//!   * **VLESS + Reality** (TCP 443) — borrows a real HTTPS site's TLS
//!     fingerprint, so on the wire it is indistinguishable from a normal
//!     visit to that site.
//!   * **Hysteria2** (UDP 443) — QUIC with Salamander obfuscation and a
//!     loss-tolerant congestion controller; the fast path on lossy,
//!     high-latency routes where plain TCP/WireGuard collapse.
//!
//! Everything a guest needs is a share link they paste into any sing-box
//! compatible client. The only manual step for the host is one router
//! port-forward, which the UI walks them through.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

pub const SERVICE_LABEL: &str = "com.easyvpn.singbox";
const PLIST_PATH: &str = "/Library/LaunchDaemons/com.easyvpn.singbox.plist";
/// Camouflage SNI for the Hysteria2 self-signed cert. Hidden under Salamander
/// obfs anyway, so it never appears on the wire in the clear.
const HY2_SNI: &str = "www.bing.com";

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

/// A person allowed to connect. Each guest gets their own VLESS UUID and
/// Hysteria2 password so access can be revoked individually.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Guest {
    pub name: String,
    pub uuid: String,
    pub hy2_password: String,
}

/// Persisted server identity. Everything needed to re-render the sing-box
/// config deterministically lives here, so the config file is disposable.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ServerState {
    pub reality_private_key: String,
    pub reality_public_key: String,
    pub reality_short_id: String,
    /// Real HTTPS site the Reality handshake is stolen from.
    pub reality_sni: String,
    pub obfs_password: String,
    pub guests: Vec<Guest>,
}

#[derive(Serialize, Clone, Debug)]
pub struct SystemInfo {
    pub singbox_installed: bool,
    pub singbox_version: Option<String>,
    pub homebrew_installed: bool,
    pub public_ip: Option<String>,
    pub lan_ip: Option<String>,
    pub server_created: bool,
    pub service_installed: bool,
    pub running: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct GuestLinks {
    pub name: String,
    pub vless_link: String,
    pub hysteria2_link: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct PortForwardRule {
    pub protocol: String,
    pub port: u16,
    pub purpose: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct PortForwardInfo {
    pub lan_ip: Option<String>,
    pub rules: Vec<PortForwardRule>,
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

fn app_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("com.me.easyvpn")
}

fn state_path() -> PathBuf {
    app_dir().join("state.json")
}
fn config_path() -> PathBuf {
    app_dir().join("config.json")
}
fn cert_path() -> PathBuf {
    app_dir().join("hy2.cert.pem")
}
fn key_path() -> PathBuf {
    app_dir().join("hy2.key.pem")
}

/// Locate the sing-box binary across common Homebrew/manual install paths.
fn singbox_bin() -> Option<PathBuf> {
    for p in [
        "/opt/homebrew/bin/sing-box",
        "/usr/local/bin/sing-box",
        "/usr/bin/sing-box",
    ] {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Some(pb);
        }
    }
    // fall back to PATH lookup
    let out = Command::new("which").arg("sing-box").output().ok()?;
    if out.status.success() {
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !s.is_empty() {
            return Some(PathBuf::from(s));
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Small process helpers
// ---------------------------------------------------------------------------

fn run(cmd: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new(cmd)
        .args(args)
        .output()
        .map_err(|e| format!("failed to run {cmd}: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "{cmd} exited with error: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn singbox_generate(args: &[&str]) -> Result<String, String> {
    let bin = singbox_bin().ok_or("sing-box is not installed")?;
    let bin = bin.to_string_lossy().to_string();
    let mut full = vec!["generate"];
    full.extend_from_slice(args);
    run(&bin, &full)
}

/// Run a script with administrator privileges via a single GUI password
/// prompt (the macOS-native way). We stage the script to a temp file and
/// invoke it, so quoting stays sane.
fn run_privileged(script: &str, prompt: &str) -> Result<String, String> {
    let tmp = std::env::temp_dir().join("easyvpn_priv.sh");
    std::fs::write(&tmp, script).map_err(|e| e.to_string())?;
    let osa = format!(
        "do shell script \"/bin/bash {}\" with prompt \"{}\" with administrator privileges",
        tmp.display(),
        prompt.replace('"', "'")
    );
    let out = Command::new("osascript")
        .arg("-e")
        .arg(&osa)
        .output()
        .map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&tmp);
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

fn load_state() -> Option<ServerState> {
    let data = std::fs::read_to_string(state_path()).ok()?;
    serde_json::from_str(&data).ok()
}

fn save_state(state: &ServerState) -> Result<(), String> {
    std::fs::create_dir_all(app_dir()).map_err(|e| e.to_string())?;
    let data = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    std::fs::write(state_path(), data).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Network detection
// ---------------------------------------------------------------------------

fn public_ip() -> Option<String> {
    for url in ["https://api.ipify.org", "https://ifconfig.me/ip"] {
        if let Ok(ip) = run("curl", &["-4", "-s", "--max-time", "8", url]) {
            let ip = ip.trim().to_string();
            if !ip.is_empty() && ip.split('.').count() == 4 {
                return Some(ip);
            }
        }
    }
    None
}

fn lan_ip() -> Option<String> {
    for iface in ["en0", "en1"] {
        if let Ok(ip) = run("ipconfig", &["getifaddr", iface]) {
            if !ip.trim().is_empty() {
                return Some(ip.trim().to_string());
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Config rendering
// ---------------------------------------------------------------------------

/// Render the full sing-box config from persisted state. This is the single
/// source of truth for what the server exposes.
fn render_config(state: &ServerState) -> serde_json::Value {
    let vless_users: Vec<serde_json::Value> = state
        .guests
        .iter()
        .map(|g| {
            serde_json::json!({ "uuid": g.uuid, "flow": "xtls-rprx-vision" })
        })
        .collect();

    let hy2_users: Vec<serde_json::Value> = state
        .guests
        .iter()
        .map(|g| serde_json::json!({ "name": g.name, "password": g.hy2_password }))
        .collect();

    serde_json::json!({
        "log": { "level": "warn", "timestamp": true },
        "inbounds": [
            {
                "type": "vless",
                "tag": "vless-in",
                "listen": "::",
                "listen_port": 443,
                "users": vless_users,
                "tls": {
                    "enabled": true,
                    "server_name": state.reality_sni,
                    "reality": {
                        "enabled": true,
                        "handshake": { "server": state.reality_sni, "server_port": 443 },
                        "private_key": state.reality_private_key,
                        "short_id": [state.reality_short_id]
                    }
                }
            },
            {
                "type": "hysteria2",
                "tag": "hy2-in",
                "listen": "::",
                "listen_port": 443,
                "users": hy2_users,
                "obfs": { "type": "salamander", "password": state.obfs_password },
                "tls": {
                    "enabled": true,
                    "alpn": ["h3"],
                    "certificate_path": cert_path().to_string_lossy(),
                    "key_path": key_path().to_string_lossy()
                }
            }
        ],
        "outbounds": [ { "type": "direct", "tag": "direct" } ]
    })
}

fn write_config(state: &ServerState) -> Result<(), String> {
    std::fs::create_dir_all(app_dir()).map_err(|e| e.to_string())?;
    let cfg = render_config(state);
    let data = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    std::fs::write(config_path(), data).map_err(|e| e.to_string())?;
    // Validate before we ever try to load it into the service.
    let bin = singbox_bin().ok_or("sing-box is not installed")?;
    run(
        &bin.to_string_lossy(),
        &["check", "-c", &config_path().to_string_lossy()],
    )
    .map_err(|e| format!("generated config failed validation: {e}"))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Link building
// ---------------------------------------------------------------------------

fn build_links(state: &ServerState, host: &str, guest: &Guest) -> GuestLinks {
    let vless = format!(
        "vless://{uuid}@{host}:443?encryption=none&flow=xtls-rprx-vision&security=reality\
&sni={sni}&fp=chrome&pbk={pbk}&sid={sid}&type=tcp#{name}",
        uuid = guest.uuid,
        host = host,
        sni = state.reality_sni,
        pbk = state.reality_public_key,
        sid = state.reality_short_id,
        name = urlencode(&format!("easyVPN-{}", guest.name)),
    );
    let hy2 = format!(
        "hysteria2://{pw}@{host}:443?obfs=salamander&obfs-password={obfs}&sni={sni}&insecure=1#{name}",
        pw = guest.hy2_password,
        host = host,
        obfs = state.obfs_password,
        sni = HY2_SNI,
        name = urlencode(&format!("easyVPN-{}", guest.name)),
    );
    GuestLinks {
        name: guest.name.clone(),
        vless_link: vless,
        hysteria2_link: hy2,
    }
}

/// Minimal percent-encoding for the `#fragment` label of share links.
fn urlencode(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' => c.to_string(),
            _ => format!("%{:02X}", c as u32),
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn check_system() -> SystemInfo {
    let bin = singbox_bin();
    let version = bin.as_ref().and_then(|b| {
        run(&b.to_string_lossy(), &["version"])
            .ok()
            .and_then(|v| v.lines().next().map(|l| l.to_string()))
    });
    SystemInfo {
        singbox_installed: bin.is_some(),
        singbox_version: version,
        homebrew_installed: PathBuf::from("/opt/homebrew/bin/brew").exists()
            || PathBuf::from("/usr/local/bin/brew").exists(),
        public_ip: public_ip(),
        lan_ip: lan_ip(),
        server_created: state_path().exists(),
        service_installed: PathBuf::from(PLIST_PATH).exists(),
        running: is_running(),
    }
}

fn brew_bin() -> Option<PathBuf> {
    for p in ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"] {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Some(pb);
        }
    }
    None
}

#[tauri::command]
pub fn install_singbox() -> Result<String, String> {
    let brew = brew_bin().ok_or(
        "Homebrew is required to install sing-box. Install it from https://brew.sh first.",
    )?;
    run(&brew.to_string_lossy(), &["install", "sing-box"])?;
    let bin = singbox_bin().ok_or("sing-box install did not complete")?;
    run(&bin.to_string_lossy(), &["version"])
}

#[tauri::command]
pub fn create_server(sni: Option<String>) -> Result<ServerState, String> {
    if let Some(existing) = load_state() {
        return Ok(existing); // idempotent: never clobber an existing identity
    }
    let sni = sni.unwrap_or_else(|| "www.apple.com".to_string());

    // Reality keypair
    let kp = singbox_generate(&["reality-keypair"])?;
    let mut priv_key = String::new();
    let mut pub_key = String::new();
    for line in kp.lines() {
        if let Some(v) = line.strip_prefix("PrivateKey:") {
            priv_key = v.trim().to_string();
        } else if let Some(v) = line.strip_prefix("PublicKey:") {
            pub_key = v.trim().to_string();
        }
    }
    if priv_key.is_empty() || pub_key.is_empty() {
        return Err("could not parse Reality keypair from sing-box".into());
    }

    let short_id = singbox_generate(&["rand", "--hex", "8"])?;
    let obfs_password = singbox_generate(&["rand", "--hex", "16"])?;

    // Self-signed cert for the Hysteria2 TLS layer (masked by obfs on the wire).
    std::fs::create_dir_all(app_dir()).map_err(|e| e.to_string())?;
    run(
        "openssl",
        &[
            "ecparam", "-genkey", "-name", "prime256v1", "-out",
            &key_path().to_string_lossy(),
        ],
    )?;
    run(
        "openssl",
        &[
            "req", "-new", "-x509", "-days", "3650", "-key",
            &key_path().to_string_lossy(), "-out",
            &cert_path().to_string_lossy(), "-subj",
            &format!("/CN={HY2_SNI}"),
        ],
    )?;

    let state = ServerState {
        reality_private_key: priv_key,
        reality_public_key: pub_key,
        reality_short_id: short_id,
        reality_sni: sni,
        obfs_password,
        guests: Vec::new(),
    };
    save_state(&state)?;
    Ok(state)
}

#[tauri::command]
pub fn add_guest(name: String) -> Result<Guest, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("guest name cannot be empty".into());
    }
    let mut state = load_state().ok_or("create the server first")?;
    if state.guests.iter().any(|g| g.name == name) {
        return Err(format!("a guest named '{name}' already exists"));
    }
    let guest = Guest {
        name: name.clone(),
        uuid: singbox_generate(&["uuid"])?,
        hy2_password: singbox_generate(&["rand", "--hex", "16"])?,
    };
    state.guests.push(guest.clone());
    save_state(&state)?;
    write_config(&state)?; // keep the on-disk config in lockstep with state
    Ok(guest)
}

#[tauri::command]
pub fn remove_guest(name: String) -> Result<(), String> {
    let mut state = load_state().ok_or("create the server first")?;
    let before = state.guests.len();
    state.guests.retain(|g| g.name != name);
    if state.guests.len() == before {
        return Err(format!("no guest named '{name}'"));
    }
    save_state(&state)?;
    write_config(&state)?;
    Ok(())
}

#[tauri::command]
pub fn list_guest_links() -> Result<Vec<GuestLinks>, String> {
    let state = load_state().ok_or("create the server first")?;
    let host = public_ip().ok_or("could not determine this machine's public IP")?;
    Ok(state
        .guests
        .iter()
        .map(|g| build_links(&state, &host, g))
        .collect())
}

#[tauri::command]
pub fn port_forward_info() -> PortForwardInfo {
    PortForwardInfo {
        lan_ip: lan_ip(),
        rules: vec![
            PortForwardRule {
                protocol: "TCP".into(),
                port: 443,
                purpose: "VLESS + Reality (looks like normal HTTPS)".into(),
            },
            PortForwardRule {
                protocol: "UDP".into(),
                port: 443,
                purpose: "Hysteria2 (fast, loss-tolerant path)".into(),
            },
        ],
    }
}

/// Check whether the sing-box service process is alive.
fn is_running() -> bool {
    Command::new("pgrep")
        .args(["-f", "sing-box run -c"])
        .output()
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false)
}

/// Write the config, install the boot LaunchDaemon, and (re)start the service.
/// Requires a single administrator prompt because binding :443 and installing
/// a system LaunchDaemon both need root.
#[tauri::command]
pub fn apply_and_start() -> Result<String, String> {
    let state = load_state().ok_or("create the server first")?;
    if state.guests.is_empty() {
        return Err("add at least one guest before starting".into());
    }
    write_config(&state)?;

    let bin = singbox_bin().ok_or("sing-box is not installed")?;
    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>{label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{bin}</string>
        <string>run</string>
        <string>-c</string>
        <string>{cfg}</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/var/log/easyvpn.log</string>
    <key>StandardErrorPath</key><string>/var/log/easyvpn.log</string>
</dict>
</plist>
"#,
        label = SERVICE_LABEL,
        bin = bin.to_string_lossy(),
        cfg = config_path().to_string_lossy(),
    );

    // Stage the plist to a temp file, then move it into place as root.
    let tmp_plist = std::env::temp_dir().join("com.easyvpn.singbox.plist");
    std::fs::write(&tmp_plist, plist).map_err(|e| e.to_string())?;

    let script = format!(
        r#"set -e
cp "{tmp}" "{dest}"
chown root:wheel "{dest}"
chmod 644 "{dest}"
launchctl bootout system/{label} 2>/dev/null || true
launchctl bootstrap system "{dest}"
sleep 1
launchctl kickstart -k system/{label} || true
echo started
"#,
        tmp = tmp_plist.display(),
        dest = PLIST_PATH,
        label = SERVICE_LABEL,
    );
    run_privileged(&script, "easyVPN needs administrator access to start the VPN service")?;
    let _ = std::fs::remove_file(&tmp_plist);
    Ok("Server started and set to launch at boot.".into())
}

#[tauri::command]
pub fn stop_server() -> Result<String, String> {
    let script = format!(
        r#"launchctl bootout system/{label} 2>/dev/null || true
rm -f "{dest}"
echo stopped
"#,
        label = SERVICE_LABEL,
        dest = PLIST_PATH,
    );
    run_privileged(&script, "easyVPN needs administrator access to stop the VPN service")?;
    Ok("Server stopped and boot service removed.".into())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_state() -> ServerState {
        ServerState {
            reality_private_key: "PRIV".into(),
            reality_public_key: "PUB".into(),
            reality_short_id: "abcd1234".into(),
            reality_sni: "www.apple.com".into(),
            obfs_password: "obfspw".into(),
            guests: vec![Guest {
                name: "brother".into(),
                uuid: "11111111-2222-3333-4444-555555555555".into(),
                hy2_password: "hy2pw".into(),
            }],
        }
    }

    #[test]
    fn urlencode_keeps_safe_chars_and_escapes_rest() {
        assert_eq!(urlencode("laptop-1"), "laptop-1");
        assert_eq!(urlencode("my phone"), "my%20phone");
        assert_eq!(urlencode("a/b"), "a%2Fb");
    }

    #[test]
    fn vless_link_has_reality_params() {
        let s = sample_state();
        let links = build_links(&s, "1.2.3.4", &s.guests[0]);
        assert!(links.vless_link.starts_with("vless://11111111-2222-3333-4444-555555555555@1.2.3.4:443"));
        assert!(links.vless_link.contains("security=reality"));
        assert!(links.vless_link.contains("flow=xtls-rprx-vision"));
        assert!(links.vless_link.contains("pbk=PUB"));
        assert!(links.vless_link.contains("sid=abcd1234"));
        assert!(links.vless_link.contains("sni=www.apple.com"));
    }

    #[test]
    fn hysteria2_link_has_obfs_and_is_url_safe() {
        let s = sample_state();
        let links = build_links(&s, "1.2.3.4", &s.guests[0]);
        assert!(links.hysteria2_link.starts_with("hysteria2://hy2pw@1.2.3.4:443"));
        assert!(links.hysteria2_link.contains("obfs=salamander"));
        assert!(links.hysteria2_link.contains("obfs-password=obfspw"));
        // the label fragment must be percent-encoded, never raw spaces
        assert!(!links.hysteria2_link.contains(' '));
    }

    #[test]
    fn config_exposes_both_inbounds_per_guest() {
        let s = sample_state();
        let cfg = render_config(&s);
        let inbounds = cfg["inbounds"].as_array().unwrap();
        assert_eq!(inbounds.len(), 2);

        let vless = &inbounds[0];
        assert_eq!(vless["type"], "vless");
        assert_eq!(vless["listen_port"], 443);
        assert_eq!(vless["users"][0]["uuid"], s.guests[0].uuid);
        assert_eq!(vless["tls"]["reality"]["enabled"], true);

        let hy2 = &inbounds[1];
        assert_eq!(hy2["type"], "hysteria2");
        assert_eq!(hy2["obfs"]["type"], "salamander");
        assert_eq!(hy2["users"][0]["password"], "hy2pw");
    }
}
