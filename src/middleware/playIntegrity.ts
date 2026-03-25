import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

let playIntegrityClient: any = null;
let isEnabled = false;
let packageName = '';

async function initPlayIntegrity(): Promise<boolean> {
  const enabled = process.env.PLAY_INTEGRITY_ENABLED === 'true';
  const pkg = process.env.PLAY_INTEGRITY_PACKAGE_NAME || '';
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!enabled || !pkg || !credsPath) {
    return false;
  }

  try {
    const { playintegrity, auth } = await import('@googleapis/playintegrity');

    const authClient = new auth.GoogleAuth({
      keyFilename: credsPath,
      scopes: ['https://www.googleapis.com/auth/playintegrity'],
    });

    playIntegrityClient = playintegrity({
      version: 'v1',
      auth: authClient as any,
    });
    packageName = pkg;
    isEnabled = true;
    return true;
  } catch (err) {
    logger.error({ err }, 'Play Integrity init failed');
    return false;
  }
}

const initPromise = initPlayIntegrity();

/**
 * Middleware that verifies X-Play-Integrity-Token for sensitive endpoints
 * (register, config, reward). When PLAY_INTEGRITY_ENABLED is not set, passes through.
 * Requires MEETS_DEVICE_INTEGRITY and MEETS_APP_INTEGRITY for success.
 */
export async function requirePlayIntegrity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await initPromise;

  if (!isEnabled || !playIntegrityClient) {
    next();
    return;
  }

  const token =
    req.headers['x-play-integrity-token'] ||
    req.body?.integrity_token ||
    req.body?.play_integrity_token;

  if (!token || typeof token !== 'string') {
    res.status(403).json({
      error: 'Play Integrity token required',
      message: 'This endpoint requires app attestation. Update your app.',
    });
    return;
  }

  try {
    const response = await playIntegrityClient.v1.decodeIntegrityToken({
      packageName,
      requestBody: { integrityToken: token } as { integrityToken: string },
    });

    const payload = response?.data?.tokenPayloadExternal;
    if (!payload) {
      res.status(403).json({ error: 'Invalid integrity token' });
      return;
    }

    const deviceIntegrity = payload?.deviceIntegrity?.deviceRecognitionVerdict || [];
    const appIntegrity = payload?.appIntegrity?.appRecognitionVerdict || '';

    const meetsDevice =
      Array.isArray(deviceIntegrity) &&
      deviceIntegrity.some((v: string) => v === 'MEETS_DEVICE_INTEGRITY');
    const meetsApp = appIntegrity === 'MEETS_APP_INTEGRITY';

    if (!meetsDevice || !meetsApp) {
      res.status(403).json({
        error: 'Integrity check failed',
        message: 'Device or app integrity could not be verified.',
      });
      return;
    }

    next();
  } catch (err: any) {
    logger.error({ err: err?.message || err }, 'Play Integrity verification error');
    res.status(403).json({
      error: 'Integrity verification failed',
      message: 'Could not verify app authenticity.',
    });
  }
}
