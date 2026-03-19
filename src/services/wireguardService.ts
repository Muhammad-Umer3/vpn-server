import { execSync } from 'child_process';
import * as fs from 'fs';
import { pool } from '../db/pool';
import { config } from '../config';

const WG_CONFIG = config.wireguard.configPath;
const WG_INTERFACE = config.wireguard.interface;
const WG_SERVER_PUBLIC_KEY = config.wireguard.serverPublicKey;
const WG_SERVER_ENDPOINT = config.wireguard.serverEndpoint;
const WG_DNS = config.wireguard.dns;

function parseNetworkForNextIp(network: string): { base: string; lastOctet: number } {
  const [base, prefix] = network.split('/');
  const parts = base.split('.');
  return { base: parts.slice(0, 3).join('.'), lastOctet: parseInt(parts[3], 10) };
}

async function getNextAvailableIp(): Promise<string> {
  const { base, lastOctet } = parseNetworkForNextIp(config.wireguard.network);
  const result = await pool.query(
    'SELECT vpn_address FROM wireguard_peers ORDER BY vpn_address DESC LIMIT 1'
  );
  if (result.rows.length === 0) {
    return `${base}.${lastOctet + 2}`;
  }
  const last = result.rows[0].vpn_address;
  const lastNum = parseInt(last.split('.')[3], 10);
  return `${base}.${lastNum + 1}`;
}

function wgGenkey(): string {
  return execSync('wg genkey', { encoding: 'utf8' }).trim();
}

function wgPubkey(privateKey: string): string {
  return execSync(`echo ${privateKey} | wg pubkey`, { encoding: 'utf8', shell: '/bin/bash' }).trim();
}

function addPeerToConfig(publicKey: string, allowedIps: string): void {
  const peerBlock = `
[Peer]
# ${Date.now()}
PublicKey = ${publicKey}
AllowedIPs = ${allowedIps}/32
`;
  fs.appendFileSync(WG_CONFIG, peerBlock);
}

function removePeerFromConfig(publicKey: string): void {
  let content = fs.readFileSync(WG_CONFIG, 'utf8');
  const peerRegex = new RegExp(
    `\\n\\[Peer\\]\\n#[^\\n]*\\nPublicKey = ${publicKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\nAllowedIPs = [^\\n]+\\n`,
    'g'
  );
  content = content.replace(peerRegex, '\n');
  fs.writeFileSync(WG_CONFIG, content);
}

function wgSyncconf(): void {
  execSync(`wg syncconf ${WG_INTERFACE} <(wg-quick strip ${WG_INTERFACE})`, {
    shell: '/bin/bash',
  });
}

export interface WireGuardConfig {
  private_key: string;
  address: string;
  dns: string;
  server_public_key: string;
  endpoint: string;
  config_string: string;
}

export async function getOrCreatePeerConfig(deviceId: string): Promise<WireGuardConfig | null> {
  if (!WG_SERVER_PUBLIC_KEY || !WG_SERVER_ENDPOINT) {
    return null;
  }

  const existing = await pool.query(
    'SELECT public_key, vpn_address, private_key_encrypted FROM wireguard_peers WHERE device_id = $1',
    [deviceId]
  );

  if (existing.rows.length > 0) {
    const peer = existing.rows[0];
    if (peer.private_key_encrypted) {
      const privateKey = peer.private_key_encrypted;
      const configString = buildConfigString(privateKey, peer.vpn_address);
      return {
        private_key: privateKey,
        address: `${peer.vpn_address}/32`,
        dns: WG_DNS,
        server_public_key: WG_SERVER_PUBLIC_KEY,
        endpoint: WG_SERVER_ENDPOINT,
        config_string: configString,
      };
    }
  }

  const privateKey = wgGenkey();
  const publicKey = wgPubkey(privateKey);
  const vpnAddress = await getNextAvailableIp();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO wireguard_peers (device_id, public_key, private_key_encrypted, vpn_address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (device_id) DO UPDATE SET
         public_key = EXCLUDED.public_key,
         private_key_encrypted = EXCLUDED.private_key_encrypted,
         vpn_address = EXCLUDED.vpn_address`,
      [deviceId, publicKey, privateKey, vpnAddress]
    );

    addPeerToConfig(publicKey, vpnAddress);
    wgSyncconf();

    await client.query('COMMIT');

  const configString = buildConfigString(privateKey, vpnAddress);
  return {
      private_key: privateKey,
      address: `${vpnAddress}/32`,
      dns: WG_DNS,
      server_public_key: WG_SERVER_PUBLIC_KEY,
      endpoint: WG_SERVER_ENDPOINT,
      config_string: configString,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    removePeerFromConfig(publicKey);
    throw e;
  } finally {
    client.release();
  }
}

function buildConfigString(privateKey: string, address: string): string {
  const addr = address.includes('/') ? address : `${address}/32`;
  return `[Interface]
PrivateKey = ${privateKey}
Address = ${addr}
DNS = ${WG_DNS}

[Peer]
PublicKey = ${WG_SERVER_PUBLIC_KEY}
Endpoint = ${WG_SERVER_ENDPOINT}
AllowedIPs = 0.0.0.0/0
`;
}

export async function revokePeer(deviceId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT public_key FROM wireguard_peers WHERE device_id = $1',
    [deviceId]
  );

  if (result.rows.length === 0) return false;

  const publicKey = result.rows[0].public_key;

  try {
    removePeerFromConfig(publicKey);
    wgSyncconf();
  } catch {
    // Config might not exist or peer might not be in file
  }

  await pool.query('DELETE FROM wireguard_peers WHERE device_id = $1', [deviceId]);
  return true;
}
