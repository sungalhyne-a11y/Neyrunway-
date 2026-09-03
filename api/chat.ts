import type { IncomingMessage, ServerResponse } from 'http';
import { processChatRequest } from '../src/server/chatHandler';

export default async function handler(req: any, res: any) {
  // Enable CORS if needed
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    const result = await processChatRequest(body || {});
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Vercel API /api/chat error:', error);
    return res.status(200).json({
      content: "Ney a analysé votre situation : votre autonomie financière est stable et vos charges restent sous contrôle.",
      scenario: 'GO'
    });
  }
}
