import { invoke } from "@tauri-apps/api/core";

export interface SystemInfo {
  singbox_installed: boolean;
  singbox_version: string | null;
  homebrew_installed: boolean;
  public_ip: string | null;
  lan_ip: string | null;
  server_created: boolean;
  service_installed: boolean;
  running: boolean;
}

export interface Guest {
  name: string;
  uuid: string;
  hy2_password: string;
}

export interface GuestLinks {
  name: string;
  vless_link: string;
  hysteria2_link: string;
}

export interface PortForwardRule {
  protocol: string;
  port: number;
  purpose: string;
}

export interface PortForwardInfo {
  lan_ip: string | null;
  rules: PortForwardRule[];
}

export const api = {
  checkSystem: () => invoke<SystemInfo>("check_system"),
  installSingbox: () => invoke<string>("install_singbox"),
  createServer: (sni?: string) => invoke<unknown>("create_server", { sni: sni ?? null }),
  addGuest: (name: string) => invoke<Guest>("add_guest", { name }),
  removeGuest: (name: string) => invoke<void>("remove_guest", { name }),
  listGuestLinks: () => invoke<GuestLinks[]>("list_guest_links"),
  portForwardInfo: () => invoke<PortForwardInfo>("port_forward_info"),
  applyAndStart: () => invoke<string>("apply_and_start"),
  stopServer: () => invoke<string>("stop_server"),
};
