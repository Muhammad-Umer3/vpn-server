import { execSync } from 'child_process';
import { pool } from '../db/pool';
import { config } from '../config';

const WG_INTERFACE = config.wireguard.interface;

/**
 * Get transfer stats (rx, tx bytes) for a peer by public key from WireGuard.
 * Returns null if WireGuard is unavailable (e.g. API in Docker, permission denied).
 */
export function getPeerTransferStats(publicKey: string): { rx: number; tx: number } | null {
  try {
    const output = execSync(`wg show ${WG_INTERFACE} dump`, {
      encoding: 'utf8',
      timeout: 5000,
    });

    // Format: public_key, preshared_key, endpoint, allowed_ips, latest_handshake, transfer_rx, transfer_tx, persistent_keepalive
    const lines = output.trim().split('\n');
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts[0] === publicKey) {
        const rx = parseInt(parts[5] || '0', 10);
        const tx = parseInt(parts[6] || '0', 10);
        return { rx: isNaN(rx) ? 0 : rx, tx: isNaN(tx) ? 0 : tx };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get public key for a device from wireguard_peers.
 */
export async function getPublicKeyForDevice(deviceId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT public_key FROM wireguard_peers WHERE device_id = $1',
    [deviceId]
  );
  return result.rows[0]?.public_key || null;
}
