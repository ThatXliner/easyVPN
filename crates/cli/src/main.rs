//! easyVPN command-line front-end.
//!
//! Same engine as the desktop app ([`easyvpn_core`]), for headless home
//! servers. Typical first run:
//!
//! ```text
//! easyvpn status            # check sing-box / network
//! easyvpn install           # brew install sing-box (if needed)
//! easyvpn init              # create the server identity
//! easyvpn ports             # what to forward on your router
//! easyvpn guest add phone   # prints a ready-to-paste link
//! sudo easyvpn start        # write config + start at boot
//! ```

use clap::{Parser, Subcommand};
use easyvpn_core as core;
use easyvpn_core::Elevation;

#[derive(Parser)]
#[command(
    name = "easyvpn",
    version,
    about = "Run a censorship-resistant VPN server (Reality + Hysteria2) from your Mac."
)]
struct Cli {
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Show system + server status.
    Status {
        /// Emit JSON instead of a table.
        #[arg(long)]
        json: bool,
    },
    /// Install sing-box via Homebrew.
    Install,
    /// Create the server identity (Reality keypair, Hysteria2 secret, cert).
    Init {
        /// HTTPS site whose TLS fingerprint Reality borrows.
        #[arg(long, default_value = "www.apple.com")]
        sni: String,
    },
    /// Show the router port-forward rules you need to add.
    Ports {
        #[arg(long)]
        json: bool,
    },
    /// Manage guests (people/devices allowed to connect).
    #[command(subcommand)]
    Guest(GuestCmd),
    /// Write the config, install the boot service, and start it. Needs sudo.
    Start,
    /// Stop the server and remove the boot service. Needs sudo.
    Stop,
}

#[derive(Subcommand)]
enum GuestCmd {
    /// Add a guest and print their share links.
    Add {
        name: String,
    },
    /// Remove a guest (revokes only their access).
    Rm {
        name: String,
    },
    /// List all guests with their share links.
    List {
        #[arg(long)]
        json: bool,
    },
}

fn main() {
    if let Err(e) = run() {
        eprintln!("\x1b[31merror:\x1b[0m {e}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    match Cli::parse().command {
        Cmd::Status { json } => status(json),
        Cmd::Install => {
            println!("Installing sing-box (this can take a minute)…");
            let v = core::install_singbox()?;
            println!("✓ {v}");
            Ok(())
        }
        Cmd::Init { sni } => {
            let state = core::create_server(Some(sni))?;
            println!("✓ Server identity ready (camouflage: {}).", state.reality_sni);
            println!("  Next: `easyvpn ports`, then `easyvpn guest add <name>`.");
            Ok(())
        }
        Cmd::Ports { json } => ports(json),
        Cmd::Guest(GuestCmd::Add { name }) => {
            core::add_guest(&name)?;
            // Re-fetch with resolved public IP to print full links.
            let links = core::list_guest_links()?;
            match links.into_iter().find(|g| g.name == name) {
                Some(g) => {
                    println!("✓ Added guest '{}'.\n", g.name);
                    print_guest(&g);
                }
                None => println!("✓ Added guest '{name}'. Run `easyvpn guest list` for links."),
            }
            Ok(())
        }
        Cmd::Guest(GuestCmd::Rm { name }) => {
            core::remove_guest(&name)?;
            println!("✓ Removed guest '{name}'. Run `sudo easyvpn start` to apply.");
            Ok(())
        }
        Cmd::Guest(GuestCmd::List { json }) => {
            let links = core::list_guest_links()?;
            if json {
                println!("{}", serde_json::to_string_pretty(&links).map_err(|e| e.to_string())?);
            } else if links.is_empty() {
                println!("No guests yet. Add one with `easyvpn guest add <name>`.");
            } else {
                for g in &links {
                    print_guest(g);
                    println!();
                }
            }
            Ok(())
        }
        Cmd::Start => {
            require_root("start")?;
            let msg = core::apply_and_start(Elevation::AlreadyRoot)?;
            println!("✓ {msg}");
            Ok(())
        }
        Cmd::Stop => {
            require_root("stop")?;
            let msg = core::stop_server(Elevation::AlreadyRoot)?;
            println!("✓ {msg}");
            Ok(())
        }
    }
}

/// Root is required to bind :443 and manage the system LaunchDaemon.
fn require_root(action: &str) -> Result<(), String> {
    if core::is_root() {
        Ok(())
    } else {
        Err(format!("`{action}` needs root — re-run with: sudo easyvpn {action}"))
    }
}

fn status(json: bool) -> Result<(), String> {
    let s = core::check_system();
    if json {
        println!("{}", serde_json::to_string_pretty(&s).map_err(|e| e.to_string())?);
        return Ok(());
    }
    let yn = |b: bool| if b { "\x1b[32myes\x1b[0m" } else { "\x1b[31mno\x1b[0m" };
    println!("sing-box installed : {}", yn(s.singbox_installed));
    if let Some(v) = &s.singbox_version {
        println!("sing-box version   : {v}");
    }
    println!("homebrew           : {}", yn(s.homebrew_installed));
    println!("public IP          : {}", s.public_ip.as_deref().unwrap_or("unknown"));
    println!("LAN IP             : {}", s.lan_ip.as_deref().unwrap_or("unknown"));
    println!("server created     : {}", yn(s.server_created));
    println!("boot service       : {}", yn(s.service_installed));
    println!(
        "running            : {}",
        if s.running { "\x1b[32myes\x1b[0m" } else { "\x1b[33mno\x1b[0m" }
    );
    Ok(())
}

fn ports(json: bool) -> Result<(), String> {
    let info = core::port_forward_info();
    if json {
        println!("{}", serde_json::to_string_pretty(&info).map_err(|e| e.to_string())?);
        return Ok(());
    }
    println!(
        "Forward these to this Mac ({}):\n",
        info.lan_ip.as_deref().unwrap_or("this machine's LAN IP")
    );
    for r in &info.rules {
        println!("  {:>3} {}    {}", r.protocol, r.port, r.purpose);
    }
    println!("\nTCP 443 and UDP 443 are separate rules on most routers — add both.");
    Ok(())
}

fn print_guest(g: &core::GuestLinks) {
    println!("\x1b[1m{}\x1b[0m", g.name);
    println!("  Hysteria2 (try first, faster):");
    println!("    {}", g.hysteria2_link);
    println!("  Reality (stealth fallback):");
    println!("    {}", g.vless_link);
}
