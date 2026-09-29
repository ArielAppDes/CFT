import { createServerApp } from './server/app';
import express from 'express';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const app = createServerApp();

// En producción, servir los archivos compilados de Vite
const distPath = resolve(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback para páginas HTML
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const cleanPath = req.path === '/' ? 'index.html' : req.path.replace(/^\//, '');
  const htmlPath = resolve(distPath, cleanPath.endsWith('.html') ? cleanPath : `${cleanPath}.html`);
  res.sendFile(htmlPath, (err) => {
    if (err) {
      res.sendFile(resolve(distPath, 'index.html'));
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SIGA Server] Servidor backend escuchando en http://0.0.0.0:${PORT}`);
});
