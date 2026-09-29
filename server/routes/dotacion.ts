import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const dotacionRouter = Router();

// GET /api/dotacion - Listar dotación con búsqueda opcional
dotacionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { q, estado, limit = 500, offset = 0 } = req.query;

    let query = supabase.from('dotacion').select('*');

    if (estado) {
      query = query.eq('estado', String(estado));
    }

    if (q) {
      const search = String(q).trim();
      query = query.or(`legajo.ilike.%${search}%,nombre.ilike.%${search}%,apellido.ilike.%${search}%,puesto.ilike.%${search}%,gerencia.ilike.%${search}%`);
    }

    query = query.order('apellido', { ascending: true }).range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[API dotacion] Error al listar:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ data: data || [], count: count || (data ? data.length : 0) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/dotacion/:legajo - Obtener empleado por legajo
dotacionRouter.get('/:legajo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const legajo = req.params.legajo.trim();

    const { data, error } = await supabase
      .from('dotacion')
      .select('*')
      .eq('legajo', legajo)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: `Empleado con legajo ${legajo} no encontrado` });
    }

    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/dotacion - Crear o registrar empleado
dotacionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    if (!body.legajo || !body.nombre || !body.apellido) {
      return res.status(400).json({ error: 'Legajo, nombre y apellido son obligatorios' });
    }

    const registro = {
      legajo: String(body.legajo).trim(),
      nombre: String(body.nombre).trim(),
      apellido: String(body.apellido).trim(),
      puesto: body.puesto || '',
      categoria: body.categoria || '',
      direccion: body.direccion || '',
      gerencia: body.gerencia || '',
      jefatura: body.jefatura || '',
      coordinacion: body.coordinacion || '',
      email: body.email || '',
      estado: body.estado || 'Activo',
    };

    const { data, error } = await supabase
      .from('dotacion')
      .upsert(registro, { onConflict: 'legajo' })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/dotacion/:legajo - Modificar datos de empleado
dotacionRouter.put('/:legajo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const legajo = req.params.legajo.trim();
    const body = req.body;

    const actualizacion: Record<string, any> = {};
    if (body.nombre !== undefined) actualizacion.nombre = String(body.nombre).trim();
    if (body.apellido !== undefined) actualizacion.apellido = String(body.apellido).trim();
    if (body.puesto !== undefined) actualizacion.puesto = body.puesto;
    if (body.categoria !== undefined) actualizacion.categoria = body.categoria;
    if (body.direccion !== undefined) actualizacion.direccion = body.direccion;
    if (body.gerencia !== undefined) actualizacion.gerencia = body.gerencia;
    if (body.jefatura !== undefined) actualizacion.jefatura = body.jefatura;
    if (body.coordinacion !== undefined) actualizacion.coordinacion = body.coordinacion;
    if (body.email !== undefined) actualizacion.email = body.email;
    if (body.estado !== undefined) actualizacion.estado = body.estado;

    const { data, error } = await supabase
      .from('dotacion')
      .update(actualizacion)
      .eq('legajo', legajo)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/dotacion/:legajo - Eliminar empleado
dotacionRouter.delete('/:legajo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const legajo = req.params.legajo.trim();

    const { error } = await supabase
      .from('dotacion')
      .delete()
      .eq('legajo', legajo);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, message: `Empleado ${legajo} eliminado correctamente` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/dotacion/bulk - Importación masiva desde Excel/CSV
dotacionRouter.post('/bulk', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { empleados } = req.body;

    if (!Array.isArray(empleados) || empleados.length === 0) {
      return res.status(400).json({ error: 'Se requiere una lista de empleados' });
    }

    const registrosValidos = empleados
      .filter((e: any) => e && e.legajo && (e.nombre || e.apellido))
      .map((e: any) => ({
        legajo: String(e.legajo).trim(),
        nombre: String(e.nombre || '').trim(),
        apellido: String(e.apellido || '').trim(),
        puesto: e.puesto || '',
        categoria: e.categoria || '',
        direccion: e.direccion || '',
        gerencia: e.gerencia || '',
        jefatura: e.jefatura || '',
        coordinacion: e.coordinacion || '',
        email: e.email || '',
        estado: e.estado || 'Activo',
      }));

    if (registrosValidos.length === 0) {
      return res.status(400).json({ error: 'Ningún registro contiene legajo y nombre válidos' });
    }

    const { data, error } = await supabase
      .from('dotacion')
      .upsert(registrosValidos, { onConflict: 'legajo' })
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, count: data ? data.length : registrosValidos.length, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
