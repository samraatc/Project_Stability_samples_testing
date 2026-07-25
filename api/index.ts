import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/dist/app.js';
import { connectDatabase } from '../server/dist/config/db.js';

const app = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await connectDatabase();
  } catch (error) {
    console.error('Serverless function bootstrap error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        message: 'Internal Server Error (Serverless Bootstrap Failed)',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return;
  }

  return app(req, res);
}
