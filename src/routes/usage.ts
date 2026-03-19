import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../logger';
import { getUsage } from '../services/usageService';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const deviceId = (req as any).deviceId;
    const usage = await getUsage(deviceId);
    res.json(usage);
  } catch (err) {
    logger.error({ err }, 'Usage error');
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

export default router;
