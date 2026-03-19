import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../logger';
import { startSession, endSession } from '../services/usageService';

const router = Router();

router.post('/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const deviceId = (req as any).deviceId;
    await startSession(deviceId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Session start error');
    res.status(500).json({ error: 'Failed to start session' });
  }
});

router.post('/end', requireAuth, async (req: Request, res: Response) => {
  try {
    const deviceId = (req as any).deviceId;
    const { minutes_used = 0, data_bytes = 0 } = req.body;

    await endSession(deviceId, Number(minutes_used), Number(data_bytes));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Session end error');
    res.status(500).json({ error: 'Failed to end session' });
  }
});

export default router;
