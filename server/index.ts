import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ensureEnvLoaded, getAllowedOrigins, getServerPort } from './env';
import { authMiddleware } from './auth';
import { authRouter } from './routes/auth';
import { aiRouter } from './routes/ai';
import { plannerRouter } from './routes/planner';
import { cloudRouter } from './routes/cloud';
import { jobsRouter } from './routes/jobs';
import { monitoringRouter } from './routes/monitoring';

ensureEnvLoaded();

if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is required');
}
if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required');
}

const app = express();
const PORT = getServerPort();
const allowedOrigins = getAllowedOrigins();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Health check (unauthenticated)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    authMode: process.env.DISABLE_AUTH === 'true' ? 'development-bypass' : 'enforced',
  });
});

// Routes with auth middleware
app.use('/api/auth', authMiddleware, authRouter);
app.use('/api/ai', authMiddleware, aiRouter);
app.use('/api/planner', authMiddleware, plannerRouter);
app.use('/api/cloud', authMiddleware, cloudRouter);
app.use('/api/jobs', authMiddleware, jobsRouter);
app.use('/api/monitoring', authMiddleware, monitoringRouter);

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`[Pipeline Labs Server] Running on port ${PORT}`);
});

export { app, server };
