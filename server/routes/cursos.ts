import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const cursosRouter = Router();

// GET /api/cursos - Listar todos los cursos
cursosRouter.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { estado } = req.query;

    let query = supabase.from('cursos').select('*').order('nombre', { ascending: true });
    if (estado) {
      query = query.eq('estado', String(estado));
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/cursos/:codigo - Obtener curso por código
cursosRouter.get('/:codigo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || '').trim();

    const { data, error } = await supabase
      .from('cursos')
      .select('*')
      .eq('codigo_curso', codigo)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Curso no encontrado' });

    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cursos - Crear curso
cursosRouter.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    if (!body.nombre) {
      return res.status(400).json({ error: 'El nombre del curso es obligatorio' });
    }

    let codigo = (body.codigo_curso || '').trim();
    if (!codigo) {
      // Generar código autoincremental si no se suministra
      const { data: ultimos } = await supabase
        .from('cursos')
        .select('codigo_curso')
        .order('codigo_curso', { ascending: false })
        .limit(1);
      const ultimo = ultimos && ultimos[0] ? ultimos[0].codigo_curso : '';
      const match = ultimo.match(/\d+$/);
      const siguienteNum = match ? parseInt(match[0], 10) + 1 : 1;
      codigo = `CUR-${new Date().getFullYear()}-${String(siguienteNum).padStart(3, '0')}`;
    }

    const hsTeoria = Number(body.hs_teoria) || 0;
    const hsPractica = Number(body.hs_practica) || 0;
    const hsTotales = Number(body.hs_totales) || (hsTeoria + hsPractica);

    const registro = {
      codigo_curso: codigo,
      nombre: String(body.nombre).trim(),
      hs_teoria: hsTeoria,
      hs_practica: hsPractica,
      hs_totales: hsTotales,
      modalidad: body.modalidad || 'Presencial',
      contenido: body.contenido || body.descripcion || '',
      descripcion: body.descripcion || body.contenido || '',
      programa_pdf_url: body.programa_pdf_url || '',
      estado: body.estado || 'Activo',
    };

    const { data, error } = await supabase
      .from('cursos')
      .upsert(registro, { onConflict: 'codigo_curso' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/cursos/:codigo - Modificar curso
cursosRouter.put('/:codigo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || '').trim();
    const body = req.body;

    const actualizacion: Record<string, any> = {};
    if (body.nombre !== undefined) actualizacion.nombre = String(body.nombre).trim();
    if (body.hs_teoria !== undefined) actualizacion.hs_teoria = Number(body.hs_teoria);
    if (body.hs_practica !== undefined) actualizacion.hs_practica = Number(body.hs_practica);
    if (body.hs_totales !== undefined) actualizacion.hs_totales = Number(body.hs_totales);
    if (body.modalidad !== undefined) actualizacion.modalidad = body.modalidad;
    if (body.contenido !== undefined) actualizacion.contenido = String(body.contenido).trim();
    if (body.descripcion !== undefined) actualizacion.descripcion = String(body.descripcion).trim();
    if (body.programa_pdf_url !== undefined) actualizacion.programa_pdf_url = String(body.programa_pdf_url).trim();
    if (body.estado !== undefined) actualizacion.estado = body.estado;

    let { data, error } = await supabase
      .from('cursos')
      .update(actualizacion)
      .eq('codigo_curso', codigo)
      .select()
      .maybeSingle();

    if (!data && !error) {
      const resUpsert = await supabase
        .from('cursos')
        .upsert({ ...actualizacion, codigo_curso: codigo }, { onConflict: 'codigo_curso' })
        .select()
        .single();
      data = resUpsert.data;
      error = resUpsert.error;
    }

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cursos/:codigo - Eliminar curso
cursosRouter.delete('/:codigo', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || '').trim();

    const { error } = await supabase
      .from('cursos')
      .delete()
      .eq('codigo_curso', codigo);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, message: `Curso ${codigo} eliminado` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
