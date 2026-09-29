import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const statsRouter = Router();

// GET /api/stats/dashboard - Métricas consolidadas para el Dashboard y Reportes
statsRouter.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    const [
      { count: totalDotacion },
      { count: totalCursos },
      { count: totalInstructores },
      { count: totalProgramas },
      { data: capacitaciones },
      { data: certificaciones }
    ] = await Promise.all([
      supabase.from('dotacion').select('*', { count: 'exact', head: true }).eq('estado', 'Activo'),
      supabase.from('cursos').select('*', { count: 'exact', head: true }).eq('estado', 'Activo'),
      supabase.from('instructores').select('*', { count: 'exact', head: true }).eq('estado', 'Activo'),
      supabase.from('programas').select('*', { count: 'exact', head: true }).eq('estado', 'Activo'),
      supabase.from('capacitaciones').select('id_cap, estado, fecha, total_clases, nombre_curso'),
      supabase.from('certificaciones_externas').select('id, estado, fecha_vencimiento')
    ]);

    const caps = capacitaciones || [];
    const certs = certificaciones || [];

    const capsFinalizadas = caps.filter(c => c.estado === 'Finalizado' || c.estado === 'Completada').length;
    const capsEnCurso = caps.filter(c => c.estado === 'En Curso').length;
    const capsProgramadas = caps.filter(c => c.estado === 'Programado' || c.estado === 'Planificada').length;

    const certsVigentes = certs.filter(c => c.estado === 'Vigente').length;
    const certsPorVencer = certs.filter(c => c.estado === 'Por Vencer').length;
    const certsVencidas = certs.filter(c => c.estado === 'Vencido').length;

    return res.json({
      dotacion: totalDotacion || 0,
      cursos: totalCursos || 0,
      instructores: totalInstructores || 0,
      programas: totalProgramas || 0,
      capacitaciones: {
        total: caps.length,
        finalizadas: capsFinalizadas,
        enCurso: capsEnCurso,
        programadas: capsProgramadas,
      },
      certificaciones: {
        total: certs.length,
        vigentes: certsVigentes,
        porVencer: certsPorVencer,
        vencidas: certsVencidas,
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
