import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getUsage } from '../services/usageService';
import { getOrCreatePeerConfig } from '../services/wireguardService';
import { getActiveServers } from '../services/serverListService';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const deviceId = (req as any).deviceId;

    const usage = await getUsage(deviceId);
    if (usage.remaining_minutes <= 0) {
      res.status(403).json({
        error: 'No remaining minutes',
        remaining_minutes: 0,
        message: 'Watch an ad to earn more minutes',
      });
      return;
    }
    if (usage.remaining_bytes <= 0) {
      res.status(403).json({
        error: 'Daily bandwidth limit reached',
        remaining_bytes: 0,
        message: 'Daily data limit reached. Try again tomorrow.',
      });
      return;
    }

    const wgConfig = await getOrCreatePeerConfig(deviceId);
    const servers = await getActiveServers();

    res.json({
      remaining_minutes: usage.remaining_minutes,
      servers,
      config: wgConfig,
    });
  } catch (err) {
    console.error('Config error:', err);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

export default router;
