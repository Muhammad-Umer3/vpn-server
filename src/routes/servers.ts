import { Router, Request, Response } from 'express';
import { logger } from '../logger';
import { getActiveServers } from '../services/serverListService';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const servers = await getActiveServers();
    res.json({ servers });
  } catch (err) {
    logger.error({ err }, 'Servers error');
    res.status(500).json({ error: 'Failed to get servers' });
  }
});

export default router;
