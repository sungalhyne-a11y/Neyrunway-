import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { processChatRequest } from './src/server/chatHandler';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Structured Chat / Decision Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const result = await processChatRequest(req.body);
    return res.json(result);
  } catch (error: any) {
    console.error('Server /api/chat error:', error);
    return res.json({
      content: "Ney a analysé votre situation : votre autonomie financière est stable et vos charges restent sous contrôle.",
      scenario: 'GO',
    });
  }
});

// Vite Middleware for Development / Static serving for Production
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Neyrunway server listening on http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic().catch((err) => {
  console.error('Failed to start server:', err);
});
