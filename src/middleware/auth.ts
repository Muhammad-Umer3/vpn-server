import { Request, Response, NextFunction } from 'express';
import { getDeviceByToken } from '../services/deviceService';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.body?.device_token || req.query?.device_token;

  if (!token) {
    res.status(401).json({ error: 'Missing device token' });
    return;
  }

  const device = await getDeviceByToken(token);
  if (!device) {
    res.status(401).json({ error: 'Invalid device token' });
    return;
  }

  (req as any).deviceId = device.id;
  next();
}
