import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const evaluacionesRouter = Router();

// GET /api/evaluaciones/satisfaccion - Listar encuestas de satisfacción
evaluacionesRouter.get('/satisfaccion', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { id_cap } = req.query;

    let query = supabase.from('evaluaciones_satisfaccion').select('*');
    if (id_cap) query = query.eq('id_cap', String(id_cap));

    const { data, error } = await query.order('fecha_registro', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/evaluaciones/satisfaccion - Registrar encuesta de satisfacción (desde encuesta.html)
evaluacionesRouter.post('/satisfaccion', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    const id = body.id || `EVA-${Date.now()}`;
    const idCap = body.id_cap ? String(body.id_cap).trim() : null;

    const registro = {
      id,
      id_cap: idCap,
      instructor: body.instructor || '',
      puntaje_objetivos: Number(body.puntaje_objetivos) || 0,
      puntaje_aplicabilidad: Number(body.puntaje_aplicabilidad) || 0,
      puntaje_instructor: Number(body.puntaje_instructor) || 0,
      puntaje_material: Number(body.puntaje_material) || 0,
      puntaje_entorno: Number(body.puntaje_entorno) || 0,
      puntaje_general: Number(body.puntaje_general) || 0,
      puntaje_docente: Number(body.puntaje_docente || body.puntaje_instructor) || 0,
      puntaje_contenido: Number(body.puntaje_contenido || body.puntaje_objetivos) || 0,
      destacados: body.destacados || '',
      sugerencias: body.sugerencias || '',
      comentarios: body.comentarios || '',
      fecha_registro: body.fecha_registro || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('evaluaciones_satisfaccion')
      .upsert(registro, { onConflict: 'id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Actualizar estado_sat en la capacitación
    if (idCap) {
      await supabase
        .from('capacitaciones')
        .update({ estado_sat: 'Respondida', estado_encuesta: 'Respondida' })
        .eq('id_cap', idCap);
    }

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/evaluaciones/transferencia - Listar evaluaciones de transferencia
evaluacionesRouter.get('/transferencia', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { id_cap, legajo } = req.query;

    let query = supabase.from('transferencias').select('*');
    if (id_cap) query = query.eq('id_cap', String(id_cap));
    if (legajo) query = query.eq('legajo', String(legajo));

    const { data, error } = await query.order('fecha_registro', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/evaluaciones/transferencia - Registrar evaluación de transferencia (desde transferencia.html)
evaluacionesRouter.post('/transferencia', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    const idCap = body.id_cap ? String(body.id_cap).trim() : null;

    const registro = {
      id_cap: idCap,
      jefatura: body.jefatura || '',
      nombre_curso: body.nombre_curso || '',
      fecha_curso: body.fecha_curso || '',
      legajo: body.legajo || '',
      nombre: body.nombre || '',
      aplica_contenidos: body.aplica_contenidos || 'SI',
      motivo_dificultad: body.motivo_dificultad || '',
      plan_accion: body.plan_accion || '',
      firma_responsable: body.firma_responsable || '',
      fecha_registro: body.fecha_registro || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('transferencias')
      .insert(registro)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Actualizar estado_tra en la capacitación
    if (idCap) {
      await supabase
        .from('capacitaciones')
        .update({ estado_tra: 'Recibida' })
        .eq('id_cap', idCap);
    }

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
