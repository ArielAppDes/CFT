import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

function copyStaticFoldersPlugin(): Plugin {
  return {
    name: 'copy-static-folders',
    closeBundle() {
      const folders = ['jss', 'data', 'css'];
      for (const folder of folders) {
        const src = resolve(__dirname, folder);
        const dest = resolve(__dirname, 'dist', folder);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true, force: true });
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [copyStaticFoldersPlugin()],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        actividades: resolve(__dirname, 'actividades.html'),
        capacitaciones: resolve(__dirname, 'capacitaciones.html'),
        asistentes: resolve(__dirname, 'asistentes.html'),
        agenda: resolve(__dirname, 'agenda.html'),
        certificaciones: resolve(__dirname, 'certificaciones.html'),
        normativas: resolve(__dirname, 'normativas.html'),
        reportes: resolve(__dirname, 'reportes.html'),
        administracion: resolve(__dirname, 'administracion.html'),
        dotacion: resolve(__dirname, 'dotacion.html'),
        encuesta: resolve(__dirname, 'encuesta.html'),
        transferencia: resolve(__dirname, 'transferencia.html'),
        planilla_asistencia: resolve(__dirname, 'planilla_asistencia.html'),
      },
    },
  },
});
