import express from 'express';
import cors from 'cors';
import { config } from './config';
import { apiRateLimiter } from './middleware/rateLimit';

import registerRouter from './routes/register';
import usageRouter from './routes/usage';
import rewardRouter from './routes/reward';
import sessionRouter from './routes/session';
import configRouter from './routes/config';
import serversRouter from './routes/servers';
import { configRateLimiter, serversRateLimiter } from './middleware/rateLimit';
import healthRouter from './routes/health';

const app = express();

// Trust X-Forwarded-* headers when behind nginx/reverse proxy (required for rate limiting)
app.set('trust proxy', 1);

app.use(cors({ origin: config.corsOrigins === '*' ? true : config.corsOrigins.split(',') }));
app.use(express.json());
app.use(apiRateLimiter);

app.use('/health', healthRouter);
app.use('/api/register', registerRouter);
app.use('/api/usage', usageRouter);
app.use('/api/reward', rewardRouter);
app.use('/api/session', sessionRouter);
app.use('/api/config', configRateLimiter, configRouter);
app.use('/api/servers', serversRateLimiter, serversRouter);

app.listen(config.port, () => {
  console.log(`VPN Control API running on port ${config.port}`);
});
