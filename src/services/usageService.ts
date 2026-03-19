import { pool } from '../db/pool';
import { config } from '../config';
import {
  getPublicKeyForDevice,
  getPeerTransferStats,
} from './wireguardStatsService';

export async function getUsage(deviceId: string): Promise<{
  remaining_minutes: number;
  remaining_time: number;
  minutes_used: number;
  data_bytes: number;
  data_used: number;
  daily_limit: number;
  rewards_today: number;
  remaining_bytes: number;
  daily_bandwidth_bytes: number;
  bytes_from_rewards_today: number;
}> {
  const today = new Date().toISOString().split('T')[0];

  const client = await pool.connect();
  try {
    const [usageResult, rewardsResult] = await Promise.all([
      client.query(
        `SELECT minutes_used, data_bytes FROM usage_records 
         WHERE device_id = $1 AND date = $2`,
        [deviceId, today]
      ),
      client.query(
        `SELECT COALESCE(SUM(minutes_added), 0)::integer as minutes_total,
                COALESCE(SUM(bytes_added), 0)::bigint as bytes_total
         FROM rewards 
         WHERE device_id = $1 AND DATE(created_at) = $2`,
        [deviceId, today]
      ),
    ]);

    const usage = usageResult.rows[0];
    const minutesUsed = usage ? usage.minutes_used : 0;
    const dataBytes = usage ? Number(usage.data_bytes) : 0;
    const rewardsToday = rewardsResult.rows[0]?.minutes_total || 0;
    const bytesFromRewardsToday = Number(rewardsResult.rows[0]?.bytes_total || 0);

    const dailyLimit = config.dailyFreeMinutes;
    const totalAvailable = dailyLimit + rewardsToday;
    const remainingMinutes = Math.max(0, totalAvailable - minutesUsed);

    const dailyBandwidthBytes = config.dailyBandwidthBytes;
    const totalBandwidthBytes = dailyBandwidthBytes + bytesFromRewardsToday;
    const remainingBytes = Math.max(0, totalBandwidthBytes - dataBytes);

    return {
      remaining_minutes: remainingMinutes,
      remaining_time: remainingMinutes,
      minutes_used: minutesUsed,
      data_bytes: dataBytes,
      data_used: dataBytes,
      daily_limit: dailyLimit,
      rewards_today: rewardsToday,
      remaining_bytes: remainingBytes,
      daily_bandwidth_bytes: dailyBandwidthBytes,
      bytes_from_rewards_today: bytesFromRewardsToday,
    };
  } finally {
    client.release();
  }
}

export async function startSession(deviceId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Capture WireGuard transfer stats at session start for server-side usage tracking
  let sessionStartRx: number | null = null;
  let sessionStartTx: number | null = null;
  const publicKey = await getPublicKeyForDevice(deviceId);
  if (publicKey) {
    const stats = getPeerTransferStats(publicKey);
    if (stats) {
      sessionStartRx = stats.rx;
      sessionStartTx = stats.tx;
    }
  }

  await pool.query(
    `INSERT INTO usage_records (device_id, date, last_session_start, session_start_rx, session_start_tx)
     VALUES ($1, $2, NOW(), $3, $4)
     ON CONFLICT (device_id, date) 
     DO UPDATE SET last_session_start = NOW(), session_start_rx = $3, session_start_tx = $4, updated_at = NOW()`,
    [deviceId, today, sessionStartRx, sessionStartTx]
  );
}

export async function endSession(deviceId: string, minutesUsed: number, dataBytes: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  let finalMinutes = minutesUsed;
  let finalBytes = dataBytes;

  // Use server-side stats when available (WireGuard on same host)
  const usageRow = await pool.query(
    `SELECT last_session_start, session_start_rx, session_start_tx 
     FROM usage_records WHERE device_id = $1 AND date = $2`,
    [deviceId, today]
  );
  const usage = usageRow.rows[0];

  const publicKey = await getPublicKeyForDevice(deviceId);
  if (publicKey) {
    const stats = getPeerTransferStats(publicKey);
    if (stats && usage?.session_start_rx != null && usage?.session_start_tx != null) {
      // Server is source of truth for data
      const deltaRx = Math.max(0, stats.rx - Number(usage.session_start_rx));
      const deltaTx = Math.max(0, stats.tx - Number(usage.session_start_tx));
      finalBytes = deltaRx + deltaTx;
    }
  }

  // Use elapsed time from last_session_start when available (server is source of truth for minutes)
  if (usage?.last_session_start) {
    const startTime = new Date(usage.last_session_start).getTime();
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
    if (elapsedMinutes >= 0) {
      finalMinutes = elapsedMinutes;
    }
  }

  await pool.query(
    `INSERT INTO usage_records (device_id, date, minutes_used, data_bytes, last_session_start, session_start_rx, session_start_tx)
     VALUES ($1, $2, $3, $4, NULL, NULL, NULL)
     ON CONFLICT (device_id, date) 
     DO UPDATE SET 
       minutes_used = usage_records.minutes_used + EXCLUDED.minutes_used,
       data_bytes = usage_records.data_bytes + EXCLUDED.data_bytes,
       last_session_start = NULL,
       session_start_rx = NULL,
       session_start_tx = NULL,
       updated_at = NOW()`,
    [deviceId, today, finalMinutes, finalBytes]
  );
}
