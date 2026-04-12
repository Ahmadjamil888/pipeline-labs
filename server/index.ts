import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { plannerRouter } from './routes/planner';
import { cloudRouter } from './routes/cloud';
import { jobsRouter } from './routes/jobs';
import { monitoringRouter } from './routes/monitoring';

// Validate required environment variables at startup
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is required');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required');
}

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:8080',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Health check (unauthenticated)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth middleware - validates Supabase JWT
app.use('/api', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const user = await response.json();
    (req as any).user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Routes
app.use('/api/planner', plannerRouter);
app.use('/api/cloud', cloudRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/monitoring', monitoringRouter);

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`[Pipeline Labs Server] Running on port ${PORT}`);
});

export { app, server };
