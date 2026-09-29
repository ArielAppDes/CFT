import { Router, Request, Response } from 'express';
import { authRouter } from './auth';
import { dotacionRouter } from './routes/dotacion';
import { cursosRouter } from './routes/cursos';
import { programasRouter } from './routes/programas';
import { instructoresRouter } from './routes/instructores';
import { capacitacionesRouter } from './routes/capacitaciones';
import { asistentesRouter } from './routes/asistentes';
import { evaluacionesRouter } from './routes/evaluaciones';
import { certificacionesRouter } from './routes/certificaciones';
import { proveedoresRouter } from './routes/proveedores';
import { statsRouter } from './routes/stats';
import { usuariosRouter } from './routes/usuarios';
import { getSupabase } from './db';

export const apiRouter = Router();

// Endpoint de verificación de salud del sistema y conexión a Supabase
apiRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    if (error) {
      return res.status(503).json({
        status: 'degraded',
        database: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    return res.json({
      status: 'ok',
      database: 'connected',
      profilesCount: count,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      database: 'unreachable',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Registrar submódulos REST
apiRouter.use('/auth', authRouter);
apiRouter.use('/dotacion', dotacionRouter);
apiRouter.use('/cursos', cursosRouter);
apiRouter.use('/programas', programasRouter);
apiRouter.use('/instructores', instructoresRouter);
apiRouter.use('/capacitaciones', capacitacionesRouter);
apiRouter.use('/asistentes', asistentesRouter);
apiRouter.use('/evaluaciones', evaluacionesRouter);
apiRouter.use('/certificaciones', certificacionesRouter);
apiRouter.use('/proveedores', proveedoresRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/usuarios', usuariosRouter);

