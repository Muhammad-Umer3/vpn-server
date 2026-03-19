import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import rfs from 'rotating-file-stream';

const isDev = process.env.NODE_ENV !== 'production';
const logPath = process.env.LOG_PATH || path.join(process.cwd(), 'logs');

function createLogger() {
  const level = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');
  const baseOptions = {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (isDev) {
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      },
    });
  }

  // Production: stdout + daily rotating file
  const streams: pino.StreamEntry[] = [{ stream: process.stdout }];

  try {
    fs.mkdirSync(logPath, { recursive: true });
    const fileStream = rfs.createStream('app.log', {
      path: logPath,
      interval: '1d',
      maxFiles: 14,
      compress: 'gzip',
    });
    streams.push({ stream: fileStream });
  } catch {
    // Fallback to stdout only if log dir fails
  }

  return pino(baseOptions, pino.multistream(streams));
}

export const logger = createLogger();
