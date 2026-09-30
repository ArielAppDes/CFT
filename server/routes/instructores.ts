import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const instructoresRouter = Router();

// GET /api/instructores - Listar instructores
instructoresRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('instructores').select('*').order('apellido', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/instructores - Crear instructor
instructoresRouter.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    if (!body.nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    let codigo = (body.codigo_instructor || '').trim();
    if (!codigo) {
      const { data: ultimos } = await supabase
        .from('instructores')
        .select('codigo_instructor')
        .order('codigo_instructor', { ascending: false })
        .limit(1);
      const ultimo = ultimos && ultimos[0] ? ultimos[0].codigo_instructor : '';
      const match = ultimo.match(/\d+$/);
      const siguienteNum = match ? parseInt(match[0], 10) + 1 : 1;
      codigo = `INS-${new Date().getFullYear()}-${String(siguienteNum).padStart(3, '0')}`;
    }

    const registro = {
      codigo_instructor: codigo,
      nombre: String(body.nombre).trim(),
      apellido: String(body.apellido || '').trim(),
      dni: body.dni || '',
      email: body.email || '',
      especialidad: body.especialidad || '',
      tipo: body.tipo || 'Interno',
      estado: body.estado || 'Activo',
    };

    const { data, error } = await supabase
      .from('instructores')
      .upsert(registro, { onConflict: 'codigo_instructor' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/instructores/:codigo - Actualizar instructor
instructoresRouter.put('/:codigo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || '').trim();
    const body = req.body;

    const actualizacion: Record<string, any> = {};
    if (body.nombre !== undefined) actualizacion.nombre = String(body.nombre).trim();
    if (body.apellido !== undefined) actualizacion.apellido = String(body.apellido).trim();
    if (body.dni !== undefined) actualizacion.dni = body.dni;
    if (body.email !== undefined) actualizacion.email = body.email;
    if (body.especialidad !== undefined) actualizacion.especialidad = body.especialidad;
    if (body.tipo !== undefined) actualizacion.tipo = body.tipo;
    if (body.estado !== undefined) actualizacion.estado = body.estado;

    const { data, error } = await supabase
      .from('instructores')
      .update(actualizacion)
      .eq('codigo_instructor', codigo)
      .select()
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/instructores/:codigo - Eliminar instructor
instructoresRouter.delete('/:codigo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || '').trim();

    const { error } = await supabase.from('instructores').delete().eq('codigo_instructor', codigo);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, message: `Instructor ${codigo} eliminado` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
