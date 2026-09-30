import express, { Express } from 'express';
import { apiRouter } from './api.js';

export function createServerApp(): Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Registrar rutas API (en /api y en / para total compatibilidad con Vercel Serverless)
  app.use('/api', apiRouter);
  app.use('/', apiRouter);

  return app;
}
