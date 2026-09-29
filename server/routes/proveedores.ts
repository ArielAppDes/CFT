import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const proveedoresRouter = Router();

// GET /api/proveedores - Listar proveedores
proveedoresRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('proveedores').select('*').order('razon_social', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/proveedores - Crear proveedor
proveedoresRouter.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    if (!body.razon_social) {
      return res.status(400).json({ error: 'La razón social es obligatoria' });
    }

    let codigo = (body.codigo_proveedor || '').trim();
    if (!codigo) {
      const { data: ultimos } = await supabase
        .from('proveedores')
        .select('codigo_proveedor')
        .order('codigo_proveedor', { ascending: false })
        .limit(1);
      const ultimo = ultimos && ultimos[0] ? ultimos[0].codigo_proveedor : '';
      const match = ultimo.match(/\d+$/);
      const siguienteNum = match ? parseInt(match[0], 10) + 1 : 1;
      codigo = `PRV-${String(siguienteNum).padStart(3, '0')}`;
    }

    const registro = {
      codigo_proveedor: codigo,
      razon_social: String(body.razon_social).trim(),
      ente: body.ente || '',
      rubro: body.rubro || '',
      contacto: body.contacto || '',
      telefono: body.telefono || '',
      email: body.email || '',
      estado: body.estado || 'Activo',
      carpetas_seguimiento: body.carpetas_seguimiento || [],
    };

    const { data, error } = await supabase
      .from('proveedores')
      .upsert(registro, { onConflict: 'codigo_proveedor' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/proveedores/:codigo - Actualizar proveedor
proveedoresRouter.put('/:codigo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const codigo = req.params.codigo.trim();
    const body = req.body;

    const actualizacion: Record<string, any> = {};
    if (body.razon_social !== undefined) actualizacion.razon_social = body.razon_social;
    if (body.ente !== undefined) actualizacion.ente = body.ente;
    if (body.rubro !== undefined) actualizacion.rubro = body.rubro;
    if (body.contacto !== undefined) actualizacion.contacto = body.contacto;
    if (body.telefono !== undefined) actualizacion.telefono = body.telefono;
    if (body.email !== undefined) actualizacion.email = body.email;
    if (body.estado !== undefined) actualizacion.estado = body.estado;
    if (body.carpetas_seguimiento !== undefined) actualizacion.carpetas_seguimiento = body.carpetas_seguimiento;

    const { data, error } = await supabase
      .from('proveedores')
      .update(actualizacion)
      .eq('codigo_proveedor', codigo)
      .select()
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/proveedores/:codigo - Eliminar proveedor
proveedoresRouter.delete('/:codigo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const codigo = req.params.codigo.trim();

    const { error } = await supabase.from('proveedores').delete().eq('codigo_proveedor', codigo);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, message: `Proveedor ${codigo} eliminado` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
