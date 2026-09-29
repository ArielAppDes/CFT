import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const certificacionesRouter = Router();

// GET /api/certificaciones - Listar certificaciones
certificacionesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { estado, legajo, proveedor_id } = req.query;

    let query = supabase.from('certificaciones_externas').select('*');

    if (estado) query = query.eq('estado', String(estado));
    if (legajo) query = query.eq('legajo', Number(legajo));
    if (proveedor_id) query = query.eq('proveedor_id', String(proveedor_id));

    const { data, error } = await query.order('id', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/certificaciones/:id - Obtener certificación individual
certificacionesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;

    const { data, error } = await supabase
      .from('certificaciones_externas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Certificación no encontrada' });

    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/certificaciones - Crear certificación
certificacionesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    const registro = {
      codigo: body.codigo || `CERT-${Date.now()}`,
      alcance: body.alcance || '',
      categoria: body.categoria || '',
      subcategoria: body.subcategoria || '',
      legajo: body.legajo ? Number(body.legajo) : null,
      apellido_nombre: body.apellido_nombre || '',
      puesto: body.puesto || '',
      area_jefatura: body.area_jefatura || '',
      proveedor_id: body.proveedor_id || '',
      proveedor_ente: body.proveedor_ente || '',
      fecha_emision: body.fecha_emision || '',
      fecha_vencimiento: body.fecha_vencimiento || '',
      tiene_vencimiento: body.tiene_vencimiento !== false,
      archivo_pdf_nombre: body.archivo_pdf_nombre || '',
      archivo_pdf_base64: body.archivo_pdf_base64 || '',
      estado: body.estado || 'Vigente',
    };

    const { data, error } = await supabase
      .from('certificaciones_externas')
      .insert(registro)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/certificaciones/:id - Actualizar certificación
certificacionesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;
    const body = req.body;

    const actualizacion: Record<string, any> = {};
    if (body.codigo !== undefined) actualizacion.codigo = body.codigo;
    if (body.alcance !== undefined) actualizacion.alcance = body.alcance;
    if (body.categoria !== undefined) actualizacion.categoria = body.categoria;
    if (body.subcategoria !== undefined) actualizacion.subcategoria = body.subcategoria;
    if (body.legajo !== undefined) actualizacion.legajo = body.legajo ? Number(body.legajo) : null;
    if (body.apellido_nombre !== undefined) actualizacion.apellido_nombre = body.apellido_nombre;
    if (body.puesto !== undefined) actualizacion.puesto = body.puesto;
    if (body.area_jefatura !== undefined) actualizacion.area_jefatura = body.area_jefatura;
    if (body.proveedor_id !== undefined) actualizacion.proveedor_id = body.proveedor_id;
    if (body.proveedor_ente !== undefined) actualizacion.proveedor_ente = body.proveedor_ente;
    if (body.fecha_emision !== undefined) actualizacion.fecha_emision = body.fecha_emision;
    if (body.fecha_vencimiento !== undefined) actualizacion.fecha_vencimiento = body.fecha_vencimiento;
    if (body.tiene_vencimiento !== undefined) actualizacion.tiene_vencimiento = body.tiene_vencimiento;
    if (body.archivo_pdf_nombre !== undefined) actualizacion.archivo_pdf_nombre = body.archivo_pdf_nombre;
    if (body.archivo_pdf_base64 !== undefined) actualizacion.archivo_pdf_base64 = body.archivo_pdf_base64;
    if (body.estado !== undefined) actualizacion.estado = body.estado;

    const { data, error } = await supabase
      .from('certificaciones_externas')
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

// DELETE /api/certificaciones/:id - Eliminar certificación
certificacionesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;

    const { error } = await supabase.from('certificaciones_externas').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, message: `Certificación ${id} eliminada` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
