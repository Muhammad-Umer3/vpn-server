import { pool } from '../db/pool';
import { config } from '../config';
import crypto from 'crypto';

const TOKEN_BYTES = 32;

function hashDeviceId(deviceId: string): string {
  return crypto.createHash('sha256').update(deviceId).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

export async function registerDevice(deviceId: string): Promise<{ device_token: string; device_id: string }> {
  const deviceIdHash = hashDeviceId(deviceId);
  const deviceToken = generateToken();

  const client = await pool.connect();
  try {
    const existing = await client.query(
      'SELECT device_token FROM devices WHERE device_id_hash = $1',
      [deviceIdHash]
    );

    if (existing.rows.length > 0) {
      const newToken = generateToken();
      await client.query(
        'UPDATE devices SET device_token = $1, updated_at = NOW() WHERE device_id_hash = $2',
        [newToken, deviceIdHash]
      );
      return { device_token: newToken, device_id: deviceId };
    }

    await client.query(
      'INSERT INTO devices (device_id_hash, device_token) VALUES ($1, $2)',
      [deviceIdHash, deviceToken]
    );

    return { device_token: deviceToken, device_id: deviceId };
  } finally {
    client.release();
  }
}

export async function getDeviceByToken(deviceToken: string): Promise<{ id: string } | null> {
  const result = await pool.query(
    'SELECT id FROM devices WHERE device_token = $1',
    [deviceToken]
  );
  return result.rows[0] || null;
}
