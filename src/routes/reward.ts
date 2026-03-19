import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { rewardRateLimiter } from '../middleware/rateLimit';
import { claimReward } from '../services/rewardService';

const router = Router();

router.post('/', rewardRateLimiter, requireAuth, async (req: Request, res: Response) => {
  try {
    const deviceId = (req as any).deviceId;
    const { reward_type, ad_network } = req.body;

    const result = await claimReward(
      deviceId,
      reward_type || 'admob_rewarded',
      ad_network || 'admob'
    );

    if (!result.success && result.error) {
      res.status(429).json({ error: result.error, success: false });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('Reward error:', err);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

export default router;
