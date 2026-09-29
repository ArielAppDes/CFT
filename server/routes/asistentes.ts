import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const asistentesRouter = Router();

// GET /api/asistentes - Listar asistentes por capacitación o legajo
asistentesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { id_cap, legajo } = req.query;

    let query = supabase.from('asistentes').select('*');

    if (id_cap) query = query.eq('id_cap', String(id_cap));
    if (legajo) query = query.eq('legajo', String(legajo));

    const { data, error } = await query.order('apellido', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/asistentes - Agregar asistente a una capacitación
asistentesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    if (!body.id_cap || !body.legajo) {
      return res.status(400).json({ error: 'id_cap y legajo son requeridos' });
    }

    const registro = {
      id_cap: String(body.id_cap).trim(),
      legajo: String(body.legajo).trim(),
      apellido: String(body.apellido || '').trim(),
      nombre: String(body.nombre || '').trim(),
      puesto: body.puesto || '',
      categoria: body.categoria || '',
      direccion: body.direccion || '',
      gerencia: body.gerencia || '',
      jefatura: body.jefatura || '',
      email: body.email || '',
      calificacion: body.calificacion !== undefined ? String(body.calificacion) : '',
      observaciones: body.observaciones || '',
    };

    const { data, error } = await supabase.from('asistentes').insert(registro).select().single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/asistentes/:id - Actualizar calificación y observaciones de asistente
asistentesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;
    const body = req.body;

    const actualizacion: Record<string, any> = {};
    if (body.calificacion !== undefined) actualizacion.calificacion = String(body.calificacion);
    if (body.observaciones !== undefined) actualizacion.observaciones = body.observaciones;

    const { data, error } = await supabase
      .from('asistentes')
      .update(actualizacion)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/asistentes/:id - Eliminar asistente
asistentesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;

    const { error } = await supabase.from('asistentes').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, message: `Asistente ${id} eliminado` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/asistentes/bulk-save - Reemplazar la nómina completa de una capacitación
asistentesRouter.post('/bulk-save', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { id_cap, asistentes } = req.body;

    if (!id_cap || !Array.isArray(asistentes)) {
      return res.status(400).json({ error: 'id_cap y la lista de asistentes son requeridos' });
    }

    // 1. Borrar existentes para esa capacitación
    await supabase.from('asistentes').delete().eq('id_cap', id_cap);

    // 2. Insertar nuevos si hay
    if (asistentes.length > 0) {
      const registros = asistentes.map((a: any) => ({
        id_cap,
        legajo: String(a.legajo || '').trim(),
        apellido: String(a.apellido || '').trim(),
        nombre: String(a.nombre || '').trim(),
        puesto: a.puesto || '',
        categoria: a.categoria || '',
        direccion: a.direccion || '',
        gerencia: a.gerencia || '',
        jefatura: a.jefatura || '',
        email: a.email || '',
        calificacion: a.calificacion !== undefined ? String(a.calificacion) : '',
        observaciones: a.observaciones || '',
      }));

      const { data, error } = await supabase.from('asistentes').insert(registros).select();
      if (error) return res.status(500).json({ error: error.message });

      return res.json({ success: true, count: data.length, data });
    }

    return res.json({ success: true, count: 0, data: [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
