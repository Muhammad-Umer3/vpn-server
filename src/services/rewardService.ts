import { pool } from '../db/pool';
import { config } from '../config';

const REWARD_MINUTES = config.rewardMinutesPerAd;
const REWARD_BYTES = config.rewardBytesPerAd;
const MAX_REWARDS_PER_DAY = config.maxRewardsPerDay;

export async function claimReward(
  deviceId: string,
  rewardType: string = 'admob_rewarded',
  adNetwork?: string
): Promise<{ minutes_added: number; bytes_added: number; success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];

    const countResult = await client.query(
      `SELECT COUNT(*)::int as count FROM rewards 
       WHERE device_id = $1 AND DATE(created_at) = $2`,
      [deviceId, today]
    );
    const rewardsToday = countResult.rows[0]?.count ?? 0;

    if (rewardsToday >= MAX_REWARDS_PER_DAY) {
      return {
        minutes_added: 0,
        bytes_added: 0,
        success: false,
        error: `Daily reward limit reached (${MAX_REWARDS_PER_DAY} per day). Try again tomorrow.`,
      };
    }

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO rewards (device_id, reward_type, minutes_added, bytes_added, ad_network)
       VALUES ($1, $2, $3, $4, $5)`,
      [deviceId, rewardType, REWARD_MINUTES, REWARD_BYTES, adNetwork || 'admob']
    );

    await client.query('COMMIT');

    return { minutes_added: REWARD_MINUTES, bytes_added: REWARD_BYTES, success: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
