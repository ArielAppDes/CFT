import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const programasRouter = Router();

// GET /api/programas - Listar programas
programasRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('programas').select('*').order('nombre', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/programas - Crear programa
programasRouter.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    if (!body.nombre) {
      return res.status(400).json({ error: 'El nombre del programa es obligatorio' });
    }

    let codigo = (body.codigo_programa || '').trim();
    if (!codigo) {
      const { data: ultimos } = await supabase
        .from('programas')
        .select('codigo_programa')
        .order('codigo_programa', { ascending: false })
        .limit(1);
      const ultimo = ultimos && ultimos[0] ? ultimos[0].codigo_programa : '';
      const match = ultimo.match(/\d+$/);
      const siguienteNum = match ? parseInt(match[0], 10) + 1 : 1;
      codigo = `PRO-${new Date().getFullYear()}-${String(siguienteNum).padStart(3, '0')}`;
    }

    const registro = {
      codigo_programa: codigo,
      nombre: String(body.nombre).trim(),
      descripcion: body.descripcion || '',
      estado: body.estado || 'Activo',
    };

    const { data, error } = await supabase
      .from('programas')
      .upsert(registro, { onConflict: 'codigo_programa' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/programas/:codigo - Modificar programa
programasRouter.put('/:codigo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || '').trim();
    const body = req.body;

    const actualizacion: Record<string, any> = {};
    if (body.nombre !== undefined) actualizacion.nombre = String(body.nombre).trim();
    if (body.descripcion !== undefined) actualizacion.descripcion = body.descripcion;
    if (body.estado !== undefined) actualizacion.estado = body.estado;

    const { data, error } = await supabase
      .from('programas')
      .update(actualizacion)
      .eq('codigo_programa', codigo)
      .select()
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/programas/:codigo - Eliminar programa
programasRouter.delete('/:codigo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || '').trim();

    const { error } = await supabase.from('programas').delete().eq('codigo_programa', codigo);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, message: `Programa ${codigo} eliminado` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
