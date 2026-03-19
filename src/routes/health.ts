import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

export default router;
