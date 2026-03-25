import { Router, Request, Response } from 'express';
import { registerDevice } from '../services/deviceService';
import { logger } from '../logger';
import { registerRateLimiter } from '../middleware/rateLimit';
import { requirePlayIntegrity } from '../middleware/playIntegrity';

const router = Router();

router.post('/', registerRateLimiter, requirePlayIntegrity, async (req: Request, res: Response) => {
  try {
    const { device_id } = req.body;

    if (!device_id || typeof device_id !== 'string') {
      res.status(400).json({ error: 'device_id is required' });
      return;
    }

    const result = await registerDevice(device_id);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Register error');
    res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
