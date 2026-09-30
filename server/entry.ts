import type { Request, Response } from 'express';
import { createServerApp } from './app.js';

const app = createServerApp();

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
